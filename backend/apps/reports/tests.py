from decimal import Decimal

from django.test import TestCase
from django.utils import timezone

from apps.core.testing import (
    make_user, client_for, make_stock, make_fabric, make_sorting_session, make_order,
)
from apps.sales.models import Payment

XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'


class ReportTests(TestCase):
    def setUp(self):
        self.admin = make_user('admin')
        self.client = client_for(self.admin)
        self.today = timezone.localdate()

    def test_daily_production_totals(self):
        stock = make_stock(unloading_weight=Decimal('990'))
        make_stock(unloading_weight=Decimal('10'))
        make_sorting_session(fabric=make_fabric(stock=stock),
                             quantity_taken=Decimal('200'), quantity_sorted=Decimal('150'),
                             waste_quantity=Decimal('10'))
        res = self.client.get(f'/api/reports/daily-production/?date={self.today}')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data['warehouse'], {'stock_entries': 2, 'total_weight_kg': 1000})
        self.assertEqual(res.data['sorting']['input_kg'], 200)
        self.assertEqual(res.data['sorting']['output_kg'], 150)
        self.assertEqual(res.data['sorting']['efficiency_pct'], 75.0)

    def test_invalid_parameters_return_400(self):
        self.assertEqual(self.client.get('/api/reports/daily-production/?date=bad').status_code, 400)
        self.assertEqual(self.client.get('/api/reports/monthly-sales/?year=x&month=y').status_code, 400)

    def test_monthly_sales_totals(self):
        order = make_order(weight='10', price='100', created_by=self.admin)
        make_order(weight='5', price='200', created_by=self.admin)
        Payment.objects.create(sales_order=order, amount=Decimal('400'), received_by=self.admin)
        res = self.client.get(f'/api/reports/monthly-sales/?year={self.today.year}&month={self.today.month}')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data['total_orders'], 2)
        self.assertEqual(res.data['total_revenue'], 2000)
        self.assertEqual(res.data['total_collected'], 400)
        self.assertEqual(res.data['pending_amount'], 1600)
        self.assertEqual(res.data['total_weight_kg'], 15)

    def test_waste_analysis(self):
        make_sorting_session(quantity_taken=Decimal('100'), waste_quantity=Decimal('7'))
        res = self.client.get(f'/api/reports/waste-analysis/?start={self.today}&end={self.today}')
        self.assertEqual(res.status_code, 200)

    def test_excel_exports(self):
        make_fabric()
        for url in (
            f'/api/reports/daily-production/export/?date={self.today}',
            f'/api/reports/monthly-sales/export/?year={self.today.year}&month={self.today.month}',
            f'/api/reports/waste-analysis/export/?start={self.today}&end={self.today}',
        ):
            with self.subTest(url=url):
                res = self.client.get(url)
                self.assertEqual(res.status_code, 200)
                self.assertEqual(res['Content-Type'], XLSX)
                self.assertTrue(res.content.startswith(b'PK'))   # xlsx is a zip file
