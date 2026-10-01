from datetime import date

from rest_framework.test import APITestCase

from apps.core.testing import (
    client_for, make_dried_stock, make_dryer, make_fabric, make_order, make_stock, make_tank, make_user,
)
from .models import Inspection

API = '/api/v1/quality'


class QualityTestCase(APITestCase):
    def setUp(self):
        self.admin = make_user('admin')
        self.keeper = make_user('warehouse_supervisor')
        self.sorter = make_user('sorting_supervisor')
        self.dryer_user = make_user('drying_supervisor')
        self.as_admin = client_for(self.admin)
        self.as_keeper = client_for(self.keeper)
        self.as_sorter = client_for(self.sorter)
        self.as_dryer = client_for(self.dryer_user)
        self.stock = make_stock()

    def inspect(self, client=None, **data):
        data.setdefault('stage', 'Incoming')
        if data['stage'] == 'Incoming':
            data.setdefault('stock', self.stock.pk)
        data.setdefault('inspected_on', str(date.today()))
        data.setdefault('result', 'Pass')
        if data['result'] == 'Fail':
            data.setdefault('rejection_reason', 'Too wet')
        return (client or self.as_keeper).post(f'{API}/inspections/', data, format='json')

    def fail_delivery(self):
        res = self.inspect(result='Fail')
        self.assertEqual(res.status_code, 201, res.data)
        return res.data


class StandardTests(QualityTestCase):
    def standard(self, client=None, **extra):
        return (client or self.as_admin).post(f'{API}/standards/', {
            'name': 'Incoming cotton', 'stage': 'Incoming',
            'checks': [{'name': 'Moisture', 'kind': 'Measure', 'unit': '%', 'max_value': '12'},
                       {'name': 'No oil stains', 'kind': 'Pass/Fail'}], **extra,
        }, format='json')

    def test_admins_maintain_standards_and_everyone_reads_them(self):
        self.assertEqual(self.standard(self.as_keeper).status_code, 403)
        res = self.standard()
        self.assertEqual(res.status_code, 201, res.data)
        self.assertEqual(len(res.data['checks']), 2)
        self.assertEqual(len(self.as_sorter.get(f'{API}/standards/').data), 1)

    def test_a_measurement_needs_a_limit(self):
        res = self.standard(checks=[{'name': 'Moisture', 'kind': 'Measure'}])
        self.assertEqual(res.status_code, 400)
        res = self.standard(checks=[{'name': 'Moisture', 'kind': 'Measure', 'min_value': '9', 'max_value': '5'}])
        self.assertEqual(res.status_code, 400)
        self.assertEqual(self.standard(checks=[]).status_code, 400)

    def test_standard_must_match_the_inspection_stage(self):
        standard = self.standard(stage='Finished').data
        res = self.inspect(standard=standard['id'])
        self.assertEqual(res.status_code, 400)
        self.assertIn('standard', res.data)


class InspectionTests(QualityTestCase):
    def test_inspector_and_number_are_set_by_the_server(self):
        res = self.inspect(inspector=self.admin.pk)
        self.assertEqual(res.status_code, 201, res.data)
        self.assertEqual(res.data['inspector'], self.keeper.pk)
        self.assertTrue(res.data['number'].startswith('QC-'))
        self.assertEqual(res.data['target'], f'Delivery #{self.stock.pk}')
        self.assertFalse(res.data['quarantined'])

    def test_each_role_inspects_its_own_stage(self):
        fabric = make_fabric(stock=self.stock)
        self.assertEqual(self.inspect(self.as_sorter).status_code, 403)                       # incoming: warehouse
        self.assertEqual(self.inspect(self.as_keeper, stage='In-process', fabric=fabric.pk).status_code, 403)
        self.assertEqual(self.inspect(self.as_sorter, stage='In-process', fabric=fabric.pk).status_code, 201)
        self.assertEqual(self.inspect(self.as_sorter, stage='Finished', fabric=fabric.pk).status_code, 403)
        self.assertEqual(self.inspect(self.as_dryer, stage='Finished', fabric=fabric.pk).status_code, 201)
        self.assertEqual(self.inspect(self.as_admin, stage='Finished', fabric=fabric.pk).status_code, 201)

    def test_stage_decides_what_is_inspected(self):
        self.assertIn('stock', self.inspect(stock=None).data)
        self.assertIn('fabric', self.inspect(self.as_admin, stage='Finished').data)

    def test_measurements_are_judged_against_their_limits(self):
        results = [
            {'name': 'Moisture', 'kind': 'Measure', 'unit': '%', 'max_value': '12', 'value': '15'},
            {'name': 'No oil stains', 'kind': 'Pass/Fail', 'passed': True},
        ]
        res = self.inspect(results=results)                       # a failed check can't be a Pass
        self.assertEqual(res.status_code, 400)
        self.assertIn('result', res.data)
        res = self.inspect(results=results, result='Conditional', notes='Dry before sorting')
        self.assertEqual(res.status_code, 201, res.data)
        self.assertEqual([r['passed'] for r in res.data['results']], [False, True])
        self.assertEqual(res.data['failed_checks'], 1)

        results[0]['value'] = None                                # a measurement needs its value
        self.assertEqual(self.inspect(results=results).status_code, 400)
        results[0]['value'] = '10'
        results[1].pop('passed')                                  # a yes/no check needs an answer
        self.assertEqual(self.inspect(results=results).status_code, 400)

    def test_fail_needs_a_reason_and_conditional_a_condition(self):
        self.assertIn('rejection_reason', self.inspect(result='Fail', rejection_reason=' ').data)
        self.assertIn('notes', self.inspect(result='Conditional').data)

    def test_only_admins_change_failed_inspections_or_delete(self):
        failed = self.fail_delivery()
        url = f'{API}/inspections/{failed["id"]}/'
        self.assertEqual(self.as_keeper.patch(url, {'result': 'Pass'}, format='json').status_code, 403)
        self.assertEqual(self.as_keeper.delete(url).status_code, 403)
        res = self.as_admin.patch(url, {'result': 'Pass'}, format='json')
        self.assertEqual(res.status_code, 200, res.data)
        self.assertEqual(res.data['rejection_reason'], '')
        self.assertEqual(self.as_admin.delete(url).status_code, 204)


class QuarantineTests(QualityTestCase):
    def test_failed_delivery_is_blocked_from_sorting_until_released(self):
        failed = self.fail_delivery()
        self.assertTrue(failed['quarantined'])
        stock_row = next(s for s in self.as_keeper.get('/api/v1/warehouse/stock/').data if s['id'] == self.stock.pk)
        self.assertEqual(stock_row['qc_status'], 'Quarantined')

        lot = {'stock': self.stock.pk, 'material_type': 'Cotton', 'initial_quantity': '500'}
        res = self.as_sorter.post('/api/v1/sorting/fabric-stock/', lot, format='json')
        self.assertEqual(res.status_code, 400)
        self.assertIn('quarantine', res.data['stock'][0])

        url = f'{API}/inspections/{failed["id"]}/release/'
        self.assertEqual(self.as_keeper.post(url, {'note': 'ok'}).status_code, 403)       # admin only
        self.assertEqual(self.as_admin.post(url, {'note': ''}).status_code, 400)           # needs a reason
        res = self.as_admin.post(url, {'note': 'Dried and re-tested'})
        self.assertEqual(res.status_code, 200, res.data)
        self.assertFalse(res.data['quarantined'])
        self.assertEqual(res.data['released_by'], self.admin.pk)
        self.assertEqual(self.as_admin.post(url, {'note': 'again'}).status_code, 400)      # already released

        self.assertEqual(self.as_sorter.post('/api/v1/sorting/fabric-stock/', lot, format='json').status_code, 201)
        res = self.as_admin.patch(f'{API}/inspections/{failed["id"]}/', {'notes': 'x'}, format='json')
        self.assertEqual(res.status_code, 400)                                             # released = final

    def test_quarantined_lot_cannot_start_any_process(self):
        fabric = make_fabric(stock=self.stock)
        other = make_fabric()
        self.fail_delivery()                                     # the lot's delivery failed
        session = {'fabric': fabric.pk, 'supervisor': self.admin.pk, 'unit': 'Unit 1', 'quantity_taken': '50'}
        res = self.as_admin.post('/api/v1/sorting/sessions/', session, format='json')
        self.assertEqual(res.status_code, 400)
        self.assertIn('fabric', res.data)
        res = self.as_admin.post('/api/v1/decolorization/sessions/', {
            'tank': make_tank().pk, 'fabric': fabric.pk, 'supervisor': self.admin.pk, 'input_quantity': '50',
        }, format='json')
        self.assertEqual(res.status_code, 400)
        res = self.as_admin.post('/api/v1/drying/sessions/', {
            'dryer': make_dryer().pk, 'fabric': fabric.pk, 'supervisor': self.admin.pk, 'input_quantity': '50',
        }, format='json')
        self.assertEqual(res.status_code, 400)

        lots = {f['id']: f['quarantined'] for f in self.as_admin.get('/api/v1/sorting/fabric-stock/').data}
        self.assertEqual(lots, {fabric.pk: True, other.pk: False})
        session['fabric'] = other.pk                             # uninspected material works as before
        self.assertEqual(self.as_admin.post('/api/v1/sorting/sessions/', session, format='json').status_code, 201)

    def test_failed_finished_lot_cannot_be_sold(self):
        fabric = make_fabric()
        make_dried_stock(fabric, '500')
        confirmed = make_order(fabric=fabric, weight='100', status='Confirmed')
        draft = make_order(fabric=fabric, weight='50')
        res = self.inspect(self.as_dryer, stage='Finished', fabric=fabric.pk, result='Fail')
        self.assertEqual(res.status_code, 201, res.data)

        res = self.as_admin.post(f'/api/v1/sales/orders/{draft.pk}/confirm/')
        self.assertEqual(res.status_code, 400)
        self.assertIn('quarantine', str(res.data))
        dispatch = {'sales_order': confirmed.pk, 'vehicle_number': 'LHR-1', 'driver_name': 'Ali',
                    'dispatched_weight': '10'}
        res = self.as_admin.post('/api/v1/sales/dispatch/', dispatch, format='json')
        self.assertEqual(res.status_code, 400)
        self.assertIn('quarantine', str(res.data))

        Inspection.objects.update(released_at='2026-01-01T00:00:00Z')
        self.assertEqual(self.as_admin.post(f'/api/v1/sales/orders/{draft.pk}/confirm/').status_code, 200)
        self.assertEqual(self.as_admin.post('/api/v1/sales/dispatch/', dispatch, format='json').status_code, 201)


class ActionAndSummaryTests(QualityTestCase):
    def test_corrective_actions_are_completed_and_reopened(self):
        failed = self.fail_delivery()
        action = {'inspection': failed['id'], 'kind': 'Corrective', 'description': 'Return to supplier',
                  'due_date': '2020-01-01'}
        self.assertEqual(self.as_sorter.post(f'{API}/actions/', action, format='json').status_code, 403)
        res = self.as_keeper.post(f'{API}/actions/', action, format='json')
        self.assertEqual(res.status_code, 201, res.data)
        self.assertEqual(res.data['created_by'], self.keeper.pk)
        self.assertTrue(res.data['overdue'])

        url = f'{API}/actions/{res.data["id"]}'
        res = self.as_keeper.post(f'{url}/complete/', {'note': 'Sent back'})
        self.assertEqual((res.data['status'], res.data['completion_note'], res.data['overdue']), ('Done', 'Sent back', False))
        self.assertEqual(self.as_keeper.post(f'{url}/complete/').status_code, 400)
        self.assertEqual(self.as_keeper.post(f'{url}/reopen/').data['status'], 'Open')
        inspection = self.as_keeper.get(f'{API}/inspections/{failed["id"]}/').data
        self.assertEqual(len(inspection['actions']), 1)

    def test_summary_counts_results_defects_and_suppliers(self):
        self.inspect(results=[{'name': 'Moisture', 'kind': 'Measure', 'max_value': '12', 'value': '10'}])
        self.inspect(result='Fail', results=[{'name': 'Moisture', 'kind': 'Measure', 'max_value': '12', 'value': '20'}])
        res = self.as_sorter.get(f'{API}/summary/')
        self.assertEqual(res.status_code, 200)
        self.assertEqual((res.data['inspections_this_month'], res.data['failed_this_month'], res.data['quarantined']),
                         (2, 1, 1))
        self.assertEqual(res.data['pass_pct_this_month'], 50.0)
        self.assertEqual(res.data['defects'], [{'name': 'Moisture', 'checks': 2, 'failures': 1, 'failure_pct': 50.0}])
        self.assertEqual(res.data['suppliers'][0]['pass_pct'], 50.0)
        self.assertEqual(len(res.data['trend']), 6)

        rows = self.as_admin.get('/api/v1/procurement/supplier-performance/').data
        row = next(r for r in rows if r['vendor'] == self.stock.vendor_id)
        self.assertEqual((row['inspections'], row['quality_pass_pct']), (2, 50.0))

    def test_inspection_filters(self):
        self.fail_delivery()
        self.inspect()
        self.assertEqual(len(self.as_admin.get(f'{API}/inspections/?quarantined=1').data), 1)
        self.assertEqual(len(self.as_admin.get(f'{API}/inspections/?result=Pass').data), 1)
        self.assertEqual(len(self.as_admin.get(f'{API}/inspections/?date_filter=today').data), 2)
        self.assertEqual(len(self.as_admin.get(f'{API}/inspections/?start=2000-01-01&end=2000-12-31').data), 0)
