"""Phase 2 foundation: delete protection, audit coverage, actor fields, pagination, docs."""
from decimal import Decimal

from django.core import mail
from django.core.cache import cache
from django.db import connection
from django.test import TestCase, override_settings
from django.test.utils import CaptureQueriesContext
from rest_framework.test import APIClient

from apps.audit.models import AuditLog
from apps.core.testing import (
    make_user, client_for, make_stock, make_fabric, make_sorting_session, make_order,
    make_chemical, make_tank,
)
from apps.sales.models import SalesOrder, Payment
from apps.warehouse.models import Vendor


class DeleteProtectionTests(TestCase):
    def setUp(self):
        self.admin = make_user('admin')
        self.client = client_for(self.admin)

    def test_vendor_with_stock_cannot_be_deleted(self):
        stock = make_stock()
        res = self.client.delete(f'/api/warehouse/vendors/{stock.vendor_id}/')
        self.assertEqual(res.status_code, 409)
        self.assertIn('stocks', res.data['detail'])
        self.assertTrue(Vendor.objects.filter(pk=stock.vendor_id).exists())
        # the blocked delete must not leave a DELETE entry in the audit log
        self.assertFalse(AuditLog.objects.filter(action='DELETE', model_name='Vendor').exists())

    def test_user_with_records_cannot_be_deleted(self):
        creator = make_user('admin')
        make_order(created_by=creator)
        res = self.client.delete(f'/api/users/detail/{creator.id}/')
        self.assertEqual(res.status_code, 409)
        self.assertTrue(SalesOrder.objects.filter(created_by=creator).exists())

    def test_order_with_payments_cannot_be_deleted(self):
        order = make_order(created_by=self.admin)
        Payment.objects.create(sales_order=order, amount=Decimal('10'), received_by=self.admin)
        self.assertEqual(self.client.delete(f'/api/sales/orders/{order.id}/').status_code, 409)

    def test_unlinked_records_still_delete(self):
        vendor = Vendor.objects.create(name='Unused')
        self.assertEqual(self.client.delete(f'/api/warehouse/vendors/{vendor.id}/').status_code, 204)
        self.assertTrue(AuditLog.objects.filter(action='DELETE', model_name='Vendor').exists())


class AuditCoverageTests(TestCase):
    """Writes that used to bypass the audit log."""

    def setUp(self):
        self.admin = make_user('admin')
        self.client = client_for(self.admin)

    def actions(self, model):
        return list(AuditLog.objects.filter(model_name=model).values_list('action', flat=True))

    def test_sales_order_create_and_actions(self):
        fabric = make_fabric()
        res = self.client.post('/api/sales/orders/', {
            'buyer_name': 'B', 'fabric': fabric.id, 'fabric_quality': 'A',
            'weight_sold': '1', 'price_per_kg': '1',
        }, format='json')
        self.client.post(f"/api/sales/orders/{res.data['id']}/confirm/")
        self.assertEqual(self.actions('SalesOrder'), ['UPDATE', 'CREATE'])   # newest first
        log = AuditLog.objects.filter(model_name='SalesOrder', action='UPDATE').get()
        self.assertEqual(log.changes['status'], {'old': 'Draft', 'new': 'Confirmed'})

    def test_stock_payment_issuance_tank_creates(self):
        stock = make_stock()
        self.client.post('/api/warehouse/stock/', {
            'vendor': stock.vendor_id, 'unit': stock.unit_id, 'fabric_type': 'X',
            'vendor_weight_slip': 'S', 'vehicle_no': 'V', 'our_weight': '5', 'unloading_weight': '5',
        }, format='json')
        order = make_order(created_by=self.admin)
        self.client.post('/api/sales/payments/', {'sales_order': order.id, 'amount': '5'}, format='json')
        chem, tank = make_chemical(), make_tank()
        self.client.post('/api/decolorization/issuances/',
                         {'chemical': chem.id, 'tank': tank.id, 'quantity': '5'}, format='json')
        self.client.post('/api/decolorization/tanks/',
                         {'name': 'T', 'capacity': '1', 'batch_id': 'NEW-1'}, format='json')
        for model in ('Stock', 'Payment', 'ChemicalIssuance', 'Tank'):
            with self.subTest(model=model):
                self.assertIn('CREATE', self.actions(model))
        self.assertIn('UPDATE', self.actions('ChemicalStock'))   # the deduction

    def test_sorting_complete_logs_session_and_fabric(self):
        session = make_sorting_session()
        self.client.post(f'/api/sorting/sessions/{session.id}/complete/',
                         {'quantity_sorted': '40'}, format='json')
        self.assertEqual(self.actions('SortingSession'), ['UPDATE'])
        fabric_log = AuditLog.objects.get(model_name='FabricStock')
        self.assertEqual(fabric_log.changes['remaining_quantity'], {'old': 500.0, 'new': 460.0})


class ActorFieldTests(TestCase):
    def setUp(self):
        self.admin = make_user('admin')
        self.other = make_user('admin')
        self.client = client_for(self.admin)
        self.order = make_order(created_by=self.other)

    def test_created_by_is_always_the_logged_in_user(self):
        res = self.client.post('/api/sales/orders/', {
            'buyer_name': 'B', 'fabric': self.order.fabric_id, 'fabric_quality': 'A',
            'weight_sold': '1', 'price_per_kg': '1', 'created_by': self.other.id,
        }, format='json')
        self.assertEqual(res.data['created_by'], self.admin.id)
        # and cannot be changed afterwards
        self.client.patch(f"/api/sales/orders/{res.data['id']}/", {'created_by': self.other.id}, format='json')
        self.assertEqual(SalesOrder.objects.get(pk=res.data['id']).created_by, self.admin)

    def test_received_by_defaults_to_logged_in_user_but_can_be_chosen(self):
        res = self.client.post('/api/sales/payments/', {'sales_order': self.order.id, 'amount': '1'}, format='json')
        self.assertEqual(res.data['received_by'], self.admin.id)
        res = self.client.post('/api/sales/payments/', {
            'sales_order': self.order.id, 'amount': '1', 'received_by': self.other.id}, format='json')
        self.assertEqual(res.data['received_by'], self.other.id)

    def test_issued_and_dispatched_by_default(self):
        chem, tank = make_chemical(), make_tank()
        res = self.client.post('/api/decolorization/issuances/',
                               {'chemical': chem.id, 'tank': tank.id, 'quantity': '1'}, format='json')
        self.assertEqual(res.data['issued_by'], self.admin.id)
        res = self.client.post('/api/sales/dispatch/', {
            'sales_order': self.order.id, 'vehicle_number': 'V', 'dispatched_weight': '1'}, format='json')
        self.assertEqual(res.data['dispatched_by'], self.admin.id)


@override_settings(EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend')
class LowStockAlertTests(TestCase):
    def setUp(self):
        self.client = client_for(make_user('admin'))

    def issue(self, chem, qty):
        tank = make_tank()
        return self.client.post('/api/decolorization/issuances/',
                                {'chemical': chem.id, 'tank': tank.id, 'quantity': qty}, format='json')

    def test_alerts_once_when_crossing_threshold(self):
        from unittest.mock import patch
        chem = make_chemical(total='1000', remaining='300')
        with patch('apps.notifications.tasks.MANAGEMENT_EMAIL', 'manager@example.com'):
            self.issue(chem, '40')     # 26% remaining: still above threshold
            self.assertEqual(len(mail.outbox), 0)
            self.issue(chem, '20')     # 24%: crossed below 25%
            self.assertEqual(len(mail.outbox), 1)
            self.assertIn(chem.chemical_name, mail.outbox[0].subject)
            self.issue(chem, '10')     # already low: no repeat alert
            self.assertEqual(len(mail.outbox), 1)


class PaginationAndQueryTests(TestCase):
    def setUp(self):
        self.client = client_for(make_user('admin'))

    def test_lists_are_plain_arrays_unless_a_page_is_requested(self):
        for _ in range(3):
            make_stock()
        self.assertIsInstance(self.client.get('/api/warehouse/stock/').data, list)
        page = self.client.get('/api/warehouse/stock/?page_size=2').data
        self.assertEqual(page['count'], 3)
        self.assertEqual(len(page['results']), 2)
        self.assertIsNotNone(page['next'])

    def test_list_query_count_does_not_grow_with_rows(self):
        """No N+1 queries: 1 row and 6 rows take the same number of queries."""
        endpoints = ['/api/warehouse/stock/', '/api/sorting/sessions/', '/api/sales/orders/',
                     '/api/sorting/fabric-stock/']

        def counts():
            result = {}
            for url in endpoints:
                with CaptureQueriesContext(connection) as ctx:
                    self.client.get(url)
                result[url] = len(ctx.captured_queries)
            return result

        admin = make_user('admin')
        make_sorting_session(); make_order(created_by=admin)
        few = counts()
        for _ in range(5):
            make_sorting_session(); make_order(created_by=admin)
        self.assertEqual(counts(), few)


class ApiSurfaceTests(TestCase):
    def test_v1_prefix_mirrors_api(self):
        client = client_for(make_user('admin'))
        make_stock()
        self.assertEqual(client.get('/api/v1/warehouse/stock/').data,
                         client.get('/api/warehouse/stock/').data)

    def test_docs_follow_configured_access(self):
        """Open with DEBUG=True, admin-only otherwise (CI runs with DEBUG=False)."""
        from django.conf import settings
        # (the test runner forces settings.DEBUG=False, so read the configured permission)
        open_docs = settings.SPECTACULAR_SETTINGS['SERVE_PERMISSIONS'] == ['rest_framework.permissions.AllowAny']
        anonymous = APIClient().get('/api/schema/').status_code
        if open_docs:
            self.assertEqual(anonymous, 200)
        else:
            self.assertIn(anonymous, (401, 403))

        staff = make_user('admin', is_staff=True)
        client = APIClient()
        client.force_login(staff)
        res = client.get('/api/schema/')
        self.assertEqual(res.status_code, 200)
        self.assertIn(b'/api/v1/warehouse/stock/', res.content)
