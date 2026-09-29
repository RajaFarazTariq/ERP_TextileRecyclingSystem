from decimal import Decimal

from django.test import TestCase

from apps.core.testing import make_user, client_for, make_fabric, make_sorting_session
from .models import SortingSession


class SortingSessionTests(TestCase):
    def setUp(self):
        self.user = make_user('sorting_supervisor')
        self.client = client_for(self.user)
        self.fabric = make_fabric(qty='300')

    def complete(self, session, sorted_qty, waste='0'):
        return self.client.post(
            f'/api/sorting/sessions/{session.id}/complete/',
            {'quantity_sorted': sorted_qty, 'waste_quantity': waste}, format='json',
        )

    def test_create_session(self):
        res = self.client.post('/api/sorting/sessions/', {
            'fabric': self.fabric.id, 'supervisor': self.user.id,
            'unit': 'Unit 1', 'quantity_taken': '120',
        }, format='json')
        self.assertEqual(res.status_code, 201)
        self.assertEqual(res.data['status'], 'In Progress')
        self.assertEqual(res.data['supervisor_name'], self.user.username)

    def test_rejects_non_positive_quantity_taken(self):
        res = self.client.post('/api/sorting/sessions/', {
            'fabric': self.fabric.id, 'supervisor': self.user.id,
            'unit': 'Unit 1', 'quantity_taken': '0',
        }, format='json')
        self.assertEqual(res.status_code, 400)

    def test_partial_completion_reduces_remaining(self):
        session = make_sorting_session(fabric=self.fabric, supervisor=self.user)
        res = self.complete(session, '100', waste='5')
        self.assertEqual(res.status_code, 200)

        session.refresh_from_db()
        self.assertEqual(session.status, 'Completed')
        self.assertEqual(session.quantity_sorted, Decimal('100'))
        self.assertEqual(session.waste_quantity, Decimal('5'))
        self.assertIsNotNone(session.end_date)

        self.fabric.refresh_from_db()
        self.assertEqual(self.fabric.sorted_quantity, Decimal('100'))
        self.assertEqual(self.fabric.remaining_quantity, Decimal('200'))
        self.assertEqual(self.fabric.status, 'In Warehouse')   # unchanged until fully sorted

    def test_full_completion_marks_fabric_sorted(self):
        session = make_sorting_session(fabric=self.fabric, supervisor=self.user)
        self.complete(session, '350')   # more than remaining is clamped to zero
        self.fabric.refresh_from_db()
        self.assertEqual(self.fabric.remaining_quantity, Decimal('0'))
        self.assertEqual(self.fabric.status, 'Sorted')

    def test_cannot_complete_twice(self):
        session = make_sorting_session(fabric=self.fabric, supervisor=self.user)
        self.complete(session, '50')
        res = self.complete(session, '50')
        self.assertEqual(res.status_code, 400)
        self.fabric.refresh_from_db()
        self.assertEqual(self.fabric.remaining_quantity, Decimal('250'))

    def test_filters(self):
        a = make_sorting_session(fabric=self.fabric, unit='Unit 1')
        b = make_sorting_session(fabric=self.fabric, unit='Unit 2', status='On Hold')
        ids = lambda q: {r['id'] for r in self.client.get(f'/api/sorting/sessions/?{q}').data}
        self.assertEqual(ids('unit=Unit 2'), {b.id})
        self.assertEqual(ids('status=In Progress'), {a.id})
        fabric_ids = {r['id'] for r in self.client.get('/api/sorting/fabric-stock/?status=In Warehouse').data}
        self.assertIn(self.fabric.id, fabric_ids)
