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
