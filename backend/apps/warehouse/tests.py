from datetime import timedelta
from decimal import Decimal

from django.test import TestCase
from django.utils import timezone

from apps.core.testing import make_user, client_for, make_stock
from .models import Vendor, FactoryUnit, Stock


class StockTests(TestCase):
    def setUp(self):
        self.client = client_for(make_user('warehouse_supervisor'))
        self.vendor = Vendor.objects.create(name='Vendor A')
        self.unit = FactoryUnit.objects.create(name='Unit 1')

    def payload(self, **overrides):
        data = {
            'vendor': self.vendor.id, 'unit': self.unit.id, 'fabric_type': 'Denim',
            'vendor_weight_slip': 'S-1', 'vehicle_no': 'LHR-1',
            'our_weight': '1200.50', 'unloading_weight': '1195.00',
        }
        data.update(overrides)
        return data

    def test_create_stock(self):
        res = self.client.post('/api/warehouse/stock/', self.payload(), format='json')
        self.assertEqual(res.status_code, 201)
        self.assertEqual(res.data['message'], 'Stock added successfully!')
        self.assertEqual(res.data['data']['vendor_name'], 'Vendor A')
        self.assertEqual(res.data['data']['status'], 'Received')
        self.assertEqual(Stock.objects.get().our_weight, Decimal('1200.50'))

    def test_rejects_non_positive_weight(self):
        res = self.client.post('/api/warehouse/stock/', self.payload(our_weight='0'), format='json')
        self.assertEqual(res.status_code, 400)
        self.assertFalse(Stock.objects.exists())

    def test_filters(self):
        s1 = make_stock(vendor=self.vendor, unit=self.unit, status='Approved')
        s2 = make_stock(status='Pending')
        old = make_stock()
        Stock.objects.filter(pk=old.pk).update(created_at=timezone.now() - timedelta(days=400))

        def ids(query):
            return {r['id'] for r in self.client.get(f'/api/warehouse/stock/?{query}').data}

        self.assertEqual(ids('status=Approved'), {s1.id})
        self.assertEqual(ids(f'vendor={self.vendor.id}'), {s1.id})
        self.assertEqual(ids(f'unit={self.unit.id}'), {s1.id})
        self.assertEqual(ids('date_filter=this_year'), {s1.id, s2.id})
        old.refresh_from_db()
        self.assertEqual(ids(f'year={old.created_at.year}'), {old.id})
        self.assertEqual(ids(f'month={old.created_at:%Y-%m}'), {old.id})
        today = timezone.localdate().isoformat()
        self.assertEqual(ids(f'start={today}&end={today}'), {s1.id, s2.id})
        # invalid values are ignored rather than erroring
        self.assertEqual(len(ids('year=abc&month=bad&start=nope')), 3)

    def test_list_is_newest_first(self):
        first, second = make_stock(), make_stock()
        res = self.client.get('/api/warehouse/stock/')
        self.assertEqual([r['id'] for r in res.data], [second.id, first.id])
