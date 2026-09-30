from io import StringIO
from unittest.mock import patch

from django.core.management import call_command
from django.test import TestCase, override_settings


@override_settings(EMAIL_BACKEND='django.core.mail.backends.smtp.EmailBackend')
class SeedCommandEmailTests(TestCase):
    """Demo seeding fires notification signals; it must never send real email."""

    @patch('apps.notifications.tasks.MANAGEMENT_EMAIL', 'manager@example.com')
    @patch('django.core.mail.backends.smtp.EmailBackend.send_messages')
    def test_seed_demo_data_sends_no_smtp_email(self, smtp_send):
        call_command('seed_demo_data', stdout=StringIO())
        smtp_send.assert_not_called()


# ─────────────────────────────────────────────────────────────────────────────
# Access-control matrix: who may read and write each module today.
# A write with an empty body returns 400 (validation) when the role is allowed
# and 403 when it is not, so no records are created by these checks.
# ─────────────────────────────────────────────────────────────────────────────
from rest_framework.test import APIClient

from apps.core.testing import ROLES, make_user, client_for

ALL = set(ROLES)
ADMIN = {'admin'}

# endpoint: (roles that may read, roles that may write)
MATRIX = {
    '/api/warehouse/vendors/':        (ALL, {'admin', 'warehouse_supervisor'}),
    '/api/warehouse/units/':          (ALL, {'admin', 'warehouse_supervisor'}),
    '/api/warehouse/stock/':          (ALL, {'admin', 'warehouse_supervisor'}),
    '/api/sorting/fabric-stock/':     (ALL, {'admin', 'sorting_supervisor'}),
    '/api/sorting/sessions/':         (ALL, {'admin', 'sorting_supervisor'}),
    '/api/decolorization/chemicals/': (ALL, {'admin', 'decolorization_supervisor'}),
    '/api/decolorization/tanks/':     (ALL, {'admin', 'decolorization_supervisor'}),
    '/api/decolorization/issuances/': (ALL, {'admin', 'decolorization_supervisor'}),
    '/api/decolorization/sessions/':  (ALL, {'admin', 'decolorization_supervisor'}),
    '/api/drying/dryers/':            ({'admin', 'drying_supervisor'}, {'admin', 'drying_supervisor'}),
    '/api/drying/sessions/':          ({'admin', 'drying_supervisor'}, {'admin', 'drying_supervisor'}),
    '/api/sales/orders/':             (ALL, ADMIN),
    '/api/sales/dispatch/':           (ALL, ADMIN),
    '/api/sales/payments/':           (ALL, ADMIN),
    '/api/users/register/':           (None, ADMIN),
}

READ_ONLY = {
    '/api/decolorization/fabric-stock/':      ALL,
    '/api/drying/fabric-ready/':              {'admin', 'drying_supervisor'},
    '/api/drying/decolor-sessions-done/':     {'admin', 'drying_supervisor'},
    '/api/users/list/':                       ALL,
    '/api/sales/orders/summary/':             ALL,
    '/api/reports/daily-production/':         ALL,
    '/api/reports/monthly-sales/':            ALL,
    '/api/reports/waste-analysis/':           ALL,
    '/api/audit/logs/':                       ALL,
    '/api/audit/logs/summary/':               ADMIN,
}


class AccessMatrixTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.users = {role: make_user(role) for role in ROLES}

    def test_reads(self):
        for url, (readers, _) in MATRIX.items():
            if readers is None:
                continue
            for role in ROLES:
                with self.subTest(url=url, role=role):
                    res = client_for(self.users[role]).get(url)
                    self.assertEqual(res.status_code, 200 if role in readers else 403)

    def test_read_only_endpoints(self):
        for url, readers in READ_ONLY.items():
            for role in ROLES:
                with self.subTest(url=url, role=role):
                    res = client_for(self.users[role]).get(url)
                    self.assertEqual(res.status_code, 200 if role in readers else 403)

    def test_writes(self):
        for url, (_, writers) in MATRIX.items():
            for role in ROLES:
                with self.subTest(url=url, role=role):
                    res = client_for(self.users[role]).post(url, {}, format='json')
                    self.assertEqual(res.status_code, 400 if role in writers else 403)

    def test_anonymous_is_rejected(self):
        for url in list(MATRIX) + list(READ_ONLY):
            with self.subTest(url=url):
                self.assertEqual(APIClient().get(url).status_code, 401)


class ReseedTests(TestCase):
    """Demo seeding must work repeatedly with stock tracking and delete protection in place."""

    def test_seed_twice_then_confirm_a_new_order(self):
        from apps.inventory import services
        from apps.sales.models import SalesOrder
        from apps.sorting.models import FabricStock

        for _ in range(2):
            call_command('seed_demo_data', stdout=StringIO())
            call_command('seed_drying_data', stdout=StringIO())
        self.assertFalse(SalesOrder.objects.filter(customer__isnull=True).exists())

        fabric = FabricStock.objects.filter(
            pk__in=[f for f, v in services.availability_map().items() if v['available'] >= 100]
        ).first()
        self.assertIsNotNone(fabric)
        admin = make_user('admin')
        res = client_for(admin).post('/api/sales/orders/', {
            'buyer_name': 'New Buyer', 'fabric': fabric.id, 'fabric_quality': 'A',
            'weight_sold': '100', 'price_per_kg': '50', 'status': 'Confirmed',
        }, format='json')
        self.assertEqual(res.status_code, 201)
