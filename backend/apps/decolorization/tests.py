from decimal import Decimal

from django.test import TestCase

from apps.core.testing import (
    make_user, client_for, make_fabric, make_chemical, make_tank, make_decolor_session,
)
from .models import ChemicalIssuance


class ChemicalIssuanceTests(TestCase):
    def setUp(self):
        self.user = make_user('decolorization_supervisor')
        self.client = client_for(self.user)
        self.chemical = make_chemical(total='1000')
        self.tank = make_tank()

    def issue(self, qty):
        return self.client.post('/api/decolorization/issuances/', {
            'chemical': self.chemical.id, 'tank': self.tank.id,
            'issued_by': self.user.id, 'quantity': qty,
        }, format='json')

    def test_issuance_deducts_stock(self):
        res = self.issue('150')
        self.assertEqual(res.status_code, 201)
        self.chemical.refresh_from_db()
        self.assertEqual(self.chemical.issued_quantity, Decimal('150'))
        self.assertEqual(self.chemical.remaining_stock, Decimal('850'))

    def test_cannot_issue_more_than_remaining(self):
        res = self.issue('1000.01')
        self.assertEqual(res.status_code, 400)
        self.assertFalse(ChemicalIssuance.objects.exists())
        self.chemical.refresh_from_db()
        self.assertEqual(self.chemical.remaining_stock, Decimal('1000'))

    def test_low_stock_endpoint_uses_fixed_threshold(self):
        low = make_chemical(total='500', remaining='49')
        make_chemical(total='500', remaining='50')
        ids = {c['id'] for c in self.client.get('/api/decolorization/chemicals/low_stock/').data}
        self.assertEqual(ids, {low.id})


class TankAndSessionTests(TestCase):
    def setUp(self):
        self.user = make_user('decolorization_supervisor')
        self.client = client_for(self.user)

    def test_create_tank_accepts_current_load_alias(self):
        res = self.client.post('/api/decolorization/tanks/', {
            'name': 'T-1', 'capacity': '400', 'batch_id': 'B-100', 'current_load': '250',
        }, format='json')
        self.assertEqual(res.status_code, 201)
        self.assertEqual(Decimal(res.data['fabric_quantity']), Decimal('250'))

    def test_tank_start_and_complete(self):
        tank = make_tank()
        self.client.post(f'/api/decolorization/tanks/{tank.id}/start/')
        tank.refresh_from_db()
        self.assertEqual(tank.tank_status, 'Processing')
        self.assertIsNotNone(tank.start_date)
        self.client.post(f'/api/decolorization/tanks/{tank.id}/complete/')
        tank.refresh_from_db()
        self.assertEqual(tank.tank_status, 'Completed')
        self.assertIsNotNone(tank.actual_completion)

    def test_complete_session_updates_tank_and_fabric(self):
        fabric = make_fabric()
        session = make_decolor_session(fabric=fabric, supervisor=self.user)
        res = self.client.post(f'/api/decolorization/sessions/{session.id}/complete/',
                               {'output_quantity': '90', 'waste_quantity': '4'}, format='json')
        self.assertEqual(res.status_code, 200)
        session.refresh_from_db()
        self.assertEqual(session.status, 'Completed')
        self.assertEqual(session.output_quantity, Decimal('90'))
        self.assertEqual(session.tank.tank_status, 'Completed')
        fabric.refresh_from_db()
        self.assertEqual(fabric.status, 'Sent to Decolorization')

        again = self.client.post(f'/api/decolorization/sessions/{session.id}/complete/', {}, format='json')
        self.assertEqual(again.status_code, 400)

    def test_fabric_stock_dropdown(self):
        fabric = make_fabric()
        res = self.client.get('/api/decolorization/fabric-stock/')
        self.assertEqual(res.data, [{'id': fabric.id, 'material_type': 'Cotton', 'status': 'In Warehouse'}])



# ─────────────────────────────────────────────────────────────────────────────
# Phase 3: chemical stock corrections and completion checks
# ─────────────────────────────────────────────────────────────────────────────
class ChemicalCorrectionTests(TestCase):
    def setUp(self):
        self.user = make_user('decolorization_supervisor')
        self.client = client_for(self.user)
        self.chemical = make_chemical(total='1000')
        self.tank = make_tank()

    def issue(self, qty, chemical=None):
        return self.client.post('/api/decolorization/issuances/', {
            'chemical': (chemical or self.chemical).id, 'tank': self.tank.id, 'quantity': qty,
        }, format='json')

    def remaining(self, chemical=None):
        c = chemical or self.chemical
        c.refresh_from_db()
        return c.remaining_stock, c.issued_quantity

    def test_editing_an_issuance_adjusts_stock(self):
        iid = self.issue('100').data['id']
        self.client.patch(f'/api/decolorization/issuances/{iid}/', {'quantity': '60'}, format='json')
        self.assertEqual(self.remaining(), (Decimal('940'), Decimal('60')))
        # up to remaining + its own quantity is allowed
        self.assertEqual(self.client.patch(f'/api/decolorization/issuances/{iid}/', {'quantity': '1000'},
                                           format='json').status_code, 200)
        self.assertEqual(self.remaining(), (Decimal('0'), Decimal('1000')))

    def test_moving_an_issuance_to_another_chemical(self):
        other = make_chemical(total='500')
        iid = self.issue('100').data['id']
        self.client.patch(f'/api/decolorization/issuances/{iid}/', {'chemical': other.id}, format='json')
        self.assertEqual(self.remaining(), (Decimal('1000'), Decimal('0')))
        self.assertEqual(self.remaining(other), (Decimal('400'), Decimal('100')))

    def test_deleting_an_issuance_returns_stock(self):
        iid = self.issue('250').data['id']
        self.client.delete(f'/api/decolorization/issuances/{iid}/')
        self.assertEqual(self.remaining(), (Decimal('1000'), Decimal('0')))

    def test_remaining_stock_is_not_typed_in_directly(self):
        self.issue('100')
        res = self.client.patch(f'/api/decolorization/chemicals/{self.chemical.id}/',
                                {'remaining_stock': '5000', 'issued_quantity': '0'}, format='json')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(self.remaining(), (Decimal('900'), Decimal('100')))
        # raising the total (a restock) raises remaining by the same amount
        self.client.patch(f'/api/decolorization/chemicals/{self.chemical.id}/', {'total_stock': '1500'}, format='json')
        self.assertEqual(self.remaining(), (Decimal('1400'), Decimal('100')))
        # the total can't drop below what has been issued
        self.assertEqual(self.client.patch(f'/api/decolorization/chemicals/{self.chemical.id}/',
                                           {'total_stock': '50'}, format='json').status_code, 400)

    def test_new_chemical_starts_with_remaining_equal_to_total(self):
        res = self.client.post('/api/decolorization/chemicals/',
                               {'chemical_name': 'Peroxide', 'total_stock': '300'}, format='json')
        self.assertEqual(res.status_code, 201)
        self.assertEqual(Decimal(res.data['remaining_stock']), Decimal('300'))

    def test_session_completion_is_validated(self):
        session = make_decolor_session(input_quantity=Decimal('100'))
        url = f'/api/decolorization/sessions/{session.id}/complete/'
        self.assertEqual(self.client.post(url, {'output_quantity': '90', 'waste_quantity': '20'},
                                          format='json').status_code, 400)
        self.assertEqual(self.client.post(url, {'output_quantity': '-1'}, format='json').status_code, 400)
        session.refresh_from_db()
        self.assertEqual(session.status, 'In Progress')


# ─────────────────────────────────────────────────────────────────────────────
# Phase 5: lots, recipes, cost, consumption and usage
# ─────────────────────────────────────────────────────────────────────────────
class ChemicalExtrasTests(TestCase):
    def setUp(self):
        self.user = make_user('decolorization_supervisor')
        self.client = client_for(self.user)
        self.admin = client_for(make_user('admin'))
        self.chemical = make_chemical(total='1000', unit_cost=Decimal('10'))
        self.tank = make_tank()

    def stock(self, chemical=None):
        c = chemical or self.chemical
        c.refresh_from_db()
        return c.total_stock, c.remaining_stock

    def receive(self, qty='200', number='L-1', **extra):
        return self.client.post('/api/decolorization/lots/', {
            'chemical': self.chemical.id, 'lot_number': number, 'received_on': '2026-10-01',
            'quantity': qty, 'unit_cost': '12.50', **extra,
        }, format='json')

    def recipe(self, **extra):
        return self.client.post('/api/decolorization/recipes/', {
            'name': 'Cotton bleach', 'temperature_c': '80', 'duration_minutes': 90,
            'lines': [{'chemical': self.chemical.id, 'quantity_per_100kg': '5'}], **extra,
        }, format='json')

    def test_receiving_a_lot_adds_stock_and_sets_the_cost(self):
        res = self.receive()
        self.assertEqual(res.status_code, 201, res.data)
        self.assertEqual(res.data['received_by'], self.user.id)
        self.assertEqual(self.stock(), (Decimal('1200'), Decimal('1200')))
        self.assertEqual(self.chemical.unit_cost, Decimal('12.50'))
        # the same lot number can't be entered twice for one chemical
        self.assertEqual(self.receive().status_code, 400)

    def test_lot_quantity_is_fixed_and_delete_takes_stock_back(self):
        lot = self.receive().data['id']
        url = f'/api/decolorization/lots/{lot}/'
        self.assertEqual(self.client.patch(url, {'quantity': '500'}, format='json').status_code, 400)
        self.assertEqual(self.client.patch(url, {'notes': 'drum 4'}, format='json').status_code, 200)
        self.assertEqual(self.client.delete(url).status_code, 204)
        self.assertEqual(self.stock(), (Decimal('1000'), Decimal('1000')))

    def test_lot_cannot_be_deleted_once_its_stock_is_used(self):
        lot = self.receive().data['id']
        self.client.post('/api/decolorization/issuances/', {
            'chemical': self.chemical.id, 'tank': self.tank.id, 'quantity': '1100'}, format='json')
        self.assertEqual(self.client.delete(f'/api/decolorization/lots/{lot}/').status_code, 400)
        self.assertEqual(self.stock(), (Decimal('1200'), Decimal('100')))

    def test_lot_dates_and_quantity_are_checked(self):
        self.assertEqual(self.receive(qty='0').status_code, 400)
        self.assertEqual(self.receive(expiry_date='2026-09-01').status_code, 400)

    def test_restricted_chemical_is_issued_by_admin_only(self):
        self.chemical.is_restricted = True
        self.chemical.save()
        body = {'chemical': self.chemical.id, 'tank': self.tank.id, 'quantity': '10'}
        self.assertEqual(self.client.post('/api/decolorization/issuances/', body, format='json').status_code, 403)
        self.assertEqual(self.admin.post('/api/decolorization/issuances/', body, format='json').status_code, 201)

    def test_issuance_links_to_the_running_session_and_keeps_the_cost(self):
        session = make_decolor_session(tank=self.tank, supervisor=self.user)
        res = self.client.post('/api/decolorization/issuances/', {
            'chemical': self.chemical.id, 'tank': self.tank.id, 'quantity': '4'}, format='json')
        self.assertEqual(res.data['session'], session.id)
        self.assertEqual(res.data['cost'], '40.00')
        # a later price change doesn't rewrite the batch
        self.chemical.unit_cost = Decimal('99')
        self.chemical.save()
        issuance = self.client.get(f"/api/decolorization/issuances/{res.data['id']}/").data
        self.assertEqual(issuance['cost'], '40.00')
        sessions = self.client.get(f'/api/decolorization/sessions/{session.id}/').data
        self.assertEqual(sessions['chemical_cost'], '40.00')

    def test_issuance_without_a_running_session_stays_unlinked(self):
        res = self.client.post('/api/decolorization/issuances/', {
            'chemical': self.chemical.id, 'tank': self.tank.id, 'quantity': '4'}, format='json')
        self.assertEqual(res.status_code, 201)
        self.assertIsNone(res.data['session'])
        other = make_decolor_session(supervisor=self.user)
        bad = self.client.post('/api/decolorization/issuances/', {
            'chemical': self.chemical.id, 'tank': self.tank.id, 'quantity': '4', 'session': other.id}, format='json')
        self.assertEqual(bad.status_code, 400)

    def test_recipe_changes_make_a_new_version(self):
        res = self.recipe()
        self.assertEqual(res.status_code, 201, res.data)
        url = f"/api/decolorization/recipes/{res.data['id']}/"
        self.assertEqual([v['version'] for v in res.data['versions']], [1])
        # renaming alone keeps the version
        same = self.client.patch(url, {'name': 'Cotton bleach A'}, format='json')
        self.assertEqual(len(same.data['versions']), 1)
        # the same process sent again keeps the version too
        same = self.client.patch(url, {'lines': [{'chemical': self.chemical.id, 'quantity_per_100kg': '5.00'}]}, format='json')
        self.assertEqual(len(same.data['versions']), 1)
        changed = self.client.patch(url, {
            'lines': [{'chemical': self.chemical.id, 'quantity_per_100kg': '6'}], 'change_note': 'Stronger'}, format='json')
        self.assertEqual([v['version'] for v in changed.data['versions']], [2, 1])
        self.assertEqual(changed.data['versions'][0]['notes'], 'Stronger')
        self.assertEqual(changed.data['versions'][0]['temperature_c'], '80.0')
        self.assertEqual(changed.data['versions'][1]['lines'][0]['quantity_per_100kg'], '5.00')
        hotter = self.client.patch(url, {'temperature_c': '85'}, format='json')
        self.assertEqual(hotter.data['versions'][0]['version'], 3)
        self.assertEqual(hotter.data['versions'][0]['lines'][0]['quantity_per_100kg'], '6.00')

    def test_recipe_needs_chemicals_listed_once(self):
        self.assertEqual(self.recipe(lines=[]).status_code, 400)
        line = {'chemical': self.chemical.id, 'quantity_per_100kg': '5'}
        self.assertEqual(self.recipe(lines=[line, line]).status_code, 400)

    def test_consumption_compares_plan_and_actual(self):
        version = self.recipe(water_liters_per_100kg='300').data['versions'][0]['id']
        extra = make_chemical(total='100', unit_cost=Decimal('2'))
        res = self.client.post('/api/decolorization/sessions/', {
            'tank': self.tank.id, 'fabric': make_fabric().id, 'supervisor': self.user.id,
            'input_quantity': '200', 'recipe_version': version, 'temperature_c': '82',
        }, format='json')
        self.assertEqual(res.status_code, 201, res.data)
        self.assertEqual(res.data['recipe_name'], 'Cotton bleach v1')
        for chemical, qty in ((self.chemical, '12'), (extra, '3')):
            self.client.post('/api/decolorization/issuances/', {
                'chemical': chemical.id, 'tank': self.tank.id, 'quantity': qty}, format='json')
        data = self.client.get(f"/api/decolorization/sessions/{res.data['id']}/consumption/").data
        lines = {line['chemical']: line for line in data['lines']}
        self.assertEqual((lines[self.chemical.id]['planned'], lines[self.chemical.id]['actual'],
                          lines[self.chemical.id]['variance']), ('10.00', '12.00', '2.00'))
        self.assertEqual((lines[extra.id]['planned'], lines[extra.id]['actual']), ('0.00', '3.00'))
        self.assertEqual((data['planned_cost'], data['actual_cost'], data['cost_per_kg']), ('100.00', '126.00', '0.63'))
        self.assertEqual(data['process']['planned_water_liters'], '600.00')

    def test_only_admin_approves_a_batch(self):
        session = make_decolor_session(supervisor=self.user)
        url = f'/api/decolorization/sessions/{session.id}/approve/'
        self.assertEqual(self.client.post(url).status_code, 403)
        res = self.admin.post(url)
        self.assertEqual(res.status_code, 200)
        self.assertIsNotNone(res.data['approved_at'])
        self.assertEqual(self.admin.post(url).status_code, 400)
        # the approval can't be typed in
        other = make_decolor_session(supervisor=self.user)
        self.client.patch(f'/api/decolorization/sessions/{other.id}/', {'approved_by': self.user.id}, format='json')
        other.refresh_from_db()
        self.assertIsNone(other.approved_by)

    def test_usage_report_totals_by_chemical(self):
        make_decolor_session(tank=self.tank, supervisor=self.user, input_quantity=Decimal('250'))
        for qty in ('10', '5'):
            self.client.post('/api/decolorization/issuances/', {
                'chemical': self.chemical.id, 'tank': self.tank.id, 'quantity': qty}, format='json')
        data = self.client.get('/api/decolorization/usage/').data
        self.assertEqual(data['total_cost'], '150.00')
        self.assertEqual((data['issuances'], data['batches'], data['treated_kg']), (2, 1, '250.00'))
        self.assertEqual((data['batch_cost'], data['cost_per_kg']), ('150.00', '0.60'))
        # an issuance to a tank with no running batch adds to the total, not to the cost per kg
        self.client.post('/api/decolorization/issuances/', {
            'chemical': self.chemical.id, 'tank': make_tank().id, 'quantity': '1'}, format='json')
        data = self.client.get('/api/decolorization/usage/').data
        self.assertEqual((data['total_cost'], data['batch_cost'], data['cost_per_kg']), ('160.00', '150.00', '0.60'))
        self.assertEqual(data['chemicals'][0]['quantity'], '16.00')
        empty = self.client.get('/api/decolorization/usage/?start=2030-01-01').data
        self.assertEqual(empty['chemicals'], [])
