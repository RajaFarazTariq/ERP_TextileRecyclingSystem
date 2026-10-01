from datetime import date, timedelta
from decimal import Decimal

from rest_framework.test import APITestCase

from apps.core.testing import client_for, make_chemical, make_fabric, make_sorting_session, make_user
from apps.quality.models import Inspection
from .models import ProcessStage, ProductionOrder, Routing

API = '/api/v1/production'


class ProductionTestCase(APITestCase):
    def setUp(self):
        self.admin = make_user('admin')
        self.sorter = make_user('sorting_supervisor')
        self.keeper = make_user('warehouse_supervisor')
        self.as_admin = client_for(self.admin)
        self.as_sorter = client_for(self.sorter)
        self.as_keeper = client_for(self.keeper)
        self.fabric = make_fabric('1000')
        self.routing = Routing.objects.get(name='Standard recycling')   # from the data migration
        self.chemical = make_chemical(total='100')
        res = self.as_admin.post(f'{API}/boms/', {
            'name': 'Bleach recipe',
            'lines': [{'material': 'Bleach', 'chemical': self.chemical.pk, 'quantity_per_100kg': '5',
                       'unit': 'Liters', 'unit_cost': '40'}],
        }, format='json')
        self.assertEqual(res.status_code, 201, res.data)
        self.bom = res.data['id']

    def order(self, client=None, **extra):
        data = {
            'product_name': 'White fibre', 'fabric': self.fabric.pk, 'routing': self.routing.pk, 'bom': self.bom,
            'planned_input_kg': '500', 'planned_output_kg': '400',
            'planned_start': str(date.today()), 'planned_end': str(date.today() + timedelta(days=3)), **extra,
        }
        return (client or self.as_admin).post(f'{API}/orders/', data, format='json')

    def released(self, **extra):
        order = self.order(**extra).data
        res = self.as_admin.post(f'{API}/orders/{order["id"]}/release/')
        self.assertEqual(res.status_code, 200, res.data)
        return res.data

    def run_step(self, step, input_kg, output_kg, waste_kg='0', hours='2', client=None):
        client = client or self.as_sorter
        self.assertEqual(client.post(f'{API}/steps/{step["id"]}/start/').status_code, 200)
        return client.post(f'{API}/steps/{step["id"]}/complete/', {
            'input_kg': input_kg, 'output_kg': output_kg, 'waste_kg': waste_kg, 'actual_hours': hours})


class SetupTests(ProductionTestCase):
    def test_default_stages_and_routing_exist(self):
        self.assertEqual(ProcessStage.objects.count(), 8)
        self.assertEqual([s.stage.name for s in self.routing.steps.all()], ['Sorting', 'Decolorization', 'Drying'])

    def test_admins_maintain_planning_data_and_everyone_reads_it(self):
        routing = {'name': 'Short', 'steps': [{'stage': ProcessStage.objects.get(name='Washing').pk, 'planned_hours': '3'}]}
        self.assertEqual(self.as_sorter.post(f'{API}/routings/', routing, format='json').status_code, 403)
        res = self.as_admin.post(f'{API}/routings/', routing, format='json')
        self.assertEqual(res.status_code, 201, res.data)
        self.assertEqual(res.data['steps'][0]['sequence'], 1)
        self.assertEqual(self.as_admin.post(f'{API}/routings/', {'name': 'Empty', 'steps': []}, format='json').status_code, 400)
        self.assertEqual(self.as_keeper.get(f'{API}/routings/').status_code, 200)
        self.assertEqual(self.as_sorter.post(f'{API}/stages/', {'name': 'Baling'}, format='json').status_code, 403)
        self.assertEqual(self.as_admin.post(f'{API}/stages/', {'name': 'Baling'}, format='json').status_code, 201)


class OrderTests(ProductionTestCase):
    def test_order_gets_steps_from_the_routing_and_materials_from_the_bom(self):
        self.assertEqual(self.order(self.as_sorter).status_code, 403)          # admins plan
        res = self.order()
        self.assertEqual(res.status_code, 201, res.data)
        self.assertTrue(res.data['number'].startswith('MO-'))
        self.assertEqual(res.data['created_by'], self.admin.pk)
        self.assertEqual([s['stage_name'] for s in res.data['steps']], ['Sorting', 'Decolorization', 'Drying'])
        material = res.data['materials'][0]
        self.assertEqual((material['planned_quantity'], material['planned_cost']), ('25.00', '1000.00'))   # 5 per 100 kg
        self.assertEqual((res.data['status'], res.data['progress_pct'], res.data['planned_hours']), ('Draft', 0, '38.00'))

        res = self.as_admin.patch(f'{API}/orders/{res.data["id"]}/', {'planned_input_kg': '1000', 'planned_output_kg': '800'}, format='json')
        self.assertEqual(res.data['materials'][0]['planned_quantity'], '50.00')   # replanned while a draft

    def test_plan_is_checked(self):
        self.assertIn('planned_output_kg', self.order(planned_output_kg='600').data)
        self.assertIn('planned_end', self.order(planned_end=str(date.today() - timedelta(days=1))).data)
        self.assertIn('planned_input_kg', self.order(planned_input_kg='0').data)

    def test_only_admins_release_and_released_orders_keep_their_plan(self):
        order = self.order().data
        url = f'{API}/orders/{order["id"]}'
        self.assertEqual(self.as_sorter.post(f'{url}/release/').status_code, 403)
        res = self.as_admin.post(f'{url}/release/')
        self.assertEqual((res.data['status'], res.data['released_by']), ('Released', self.admin.pk))
        self.assertEqual(self.as_admin.patch(f'{url}/', {'planned_input_kg': '900'}, format='json').status_code, 400)
        self.assertEqual(self.as_admin.patch(f'{url}/', {'priority': 'High', 'notes': 'Rush'}, format='json').status_code, 200)
        self.assertEqual(self.as_admin.delete(f'{url}/').status_code, 400)       # cancel instead
        self.assertEqual(self.as_admin.post(f'{url}/cancel/').data['status'], 'Cancelled')
        self.assertEqual(self.as_admin.delete(f'{url}/').status_code, 204)

    def test_quarantined_lot_cannot_be_released(self):
        order = self.order().data
        Inspection.objects.create(stage='In-process', fabric=self.fabric, inspector=self.admin,
                                  inspected_on=date.today(), result='Fail', rejection_reason='Contaminated')
        res = self.as_admin.post(f'{API}/orders/{order["id"]}/release/')
        self.assertEqual(res.status_code, 400)
        self.assertIn('quarantine', str(res.data))


class ExecutionTests(ProductionTestCase):
    def test_steps_run_in_order_and_the_order_tracks_actuals(self):
        order = self.released()
        sorting, decolor, drying = order['steps']
        self.assertEqual(self.as_keeper.post(f'{API}/steps/{sorting["id"]}/start/').status_code, 403)   # not a floor role
        self.assertEqual(self.as_sorter.post(f'{API}/steps/{decolor["id"]}/start/').status_code, 400)   # sorting first

        res = self.as_sorter.post(f'{API}/steps/{sorting["id"]}/start/')
        self.assertEqual((res.data['status'], res.data['operator']), ('In Progress', self.sorter.pk))
        current = self.as_admin.get(f'{API}/orders/{order["id"]}/').data
        self.assertEqual((current['status'], current['current_stage']), ('In Progress', 'Sorting'))

        url = f'{API}/steps/{sorting["id"]}/complete/'
        too_much = self.as_sorter.post(url, {'input_kg': '500', 'output_kg': '480', 'waste_kg': '30'})
        self.assertEqual(too_much.status_code, 400)
        res = self.as_sorter.post(url, {'input_kg': '500', 'output_kg': '470', 'waste_kg': '30', 'actual_hours': '9'})
        self.assertEqual((res.data['status'], res.data['actual_hours']), ('Done', '9.00'))

        # An admin sets a rate and skips a stage; the rest is completed
        self.assertEqual(self.as_sorter.patch(f'{API}/steps/{decolor["id"]}/', {'hourly_cost': '100'}).status_code, 403)
        self.assertEqual(self.as_admin.patch(f'{API}/steps/{drying["id"]}/', {'hourly_cost': '100', 'machine': 'Dryer D-01'}).status_code, 200)
        self.assertEqual(self.as_sorter.post(f'{API}/steps/{decolor["id"]}/skip/').status_code, 403)
        self.assertEqual(self.as_admin.post(f'{API}/orders/{order["id"]}/complete/').status_code, 400)  # stages left
        self.assertEqual(self.as_admin.post(f'{API}/steps/{decolor["id"]}/skip/').data['status'], 'Skipped')
        self.assertEqual(self.run_step(drying, '470', '420', '10', hours='5').status_code, 200)

        material = order['materials'][0]
        self.assertEqual(self.as_sorter.patch(f'{API}/materials/{material["id"]}/', {'unit_cost': '1'}).status_code, 403)
        self.assertEqual(self.as_sorter.patch(f'{API}/materials/{material["id"]}/', {'actual_quantity': '30'}).status_code, 200)

        res = self.as_sorter.post(f'{API}/orders/{order["id"]}/complete/')
        self.assertEqual(res.status_code, 200, res.data)
        d = res.data
        self.assertEqual((d['status'], d['actual_output_kg'], d['progress_pct']), ('Completed', '420.00', 100))
        self.assertEqual((d['actual_input_kg'], d['waste_kg'], d['yield_pct']), ('500.00', '40.00', 84.0))
        self.assertEqual((d['actual_hours'], d['labour_cost'], d['material_cost']), ('14.00', '500.00', '1200.00'))
        self.assertEqual((d['total_cost'], d['cost_per_kg'], d['planned_cost']), ('1700.00', '4.05', '1600.00'))
        self.assertEqual(self.as_admin.patch(f'{API}/orders/{order["id"]}/', {'notes': 'x'}, format='json').status_code, 400)

    def test_requirements_show_chemical_shortage(self):
        self.released(planned_input_kg='1500', planned_output_kg='1200')       # needs 75, stock is 100
        self.order(planned_input_kg='1000', planned_output_kg='800')           # needs 50 more
        row = self.as_sorter.get(f'{API}/requirements/').data[0]
        self.assertEqual((row['required'], row['in_stock'], row['shortage']), (Decimal('125.00'), Decimal('100'), Decimal('25.00')))
        self.assertEqual(len(row['orders']), 2)

    def test_summary_and_lot_activity(self):
        order = self.released()
        make_sorting_session(fabric=self.fabric, supervisor=self.sorter)
        for step, (kg_in, kg_out) in zip(order['steps'], [('500', '480'), ('480', '450'), ('450', '430')]):
            self.assertEqual(self.run_step(step, kg_in, kg_out).status_code, 200)
        self.assertEqual(self.as_admin.post(f'{API}/orders/{order["id"]}/complete/').status_code, 200)
        self.order(planned_end=str(date.today()), planned_start=str(date.today()))
        ProductionOrder.objects.filter(status='Draft').update(planned_end=date.today() - timedelta(days=2))

        res = self.as_keeper.get(f'{API}/summary/')
        self.assertEqual((res.data['completed'], res.data['draft'], res.data['late']), (1, 1, 1))
        self.assertEqual((res.data['actual_output_completed'], res.data['yield_pct']), (Decimal('430.00'), 86.0))
        self.assertEqual([s['stage'] for s in res.data['stages']], ['Sorting', 'Decolorization', 'Drying'])
        activity = self.as_keeper.get(f'{API}/orders/{order["id"]}/activity/').data
        self.assertEqual([(a['module'], a['supervisor']) for a in activity], [('sorting', self.sorter.username)])
