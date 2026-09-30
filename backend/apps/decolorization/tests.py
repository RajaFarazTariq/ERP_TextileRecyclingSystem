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
