from decimal import Decimal

from rest_framework.test import APITestCase

from users.models import CustomUser
from warehouse.models import Vendor, FactoryUnit, Stock
from sorting.models import FabricStock, SortingSession
from .models import SalesOrder


class PartialUpdateTests(APITestCase):
    """PATCH requests that omit validated fields used to crash with HTTP 500."""

    def setUp(self):
        self.admin = CustomUser.objects.create_user(
            username='admin_user', password='Pass@12345', role='admin'
        )
        self.client.force_authenticate(self.admin)
        vendor = Vendor.objects.create(name='Vendor A')
        unit = FactoryUnit.objects.create(name='Unit 1')
        self.stock = Stock.objects.create(
            vendor=vendor, fabric_type='Cotton', vendor_weight_slip='S-1',
            vehicle_no='LHR-1', our_weight=Decimal('1000'),
            unloading_weight=Decimal('990'), unit=unit,
        )
        self.fabric = FabricStock.objects.create(
            stock=self.stock, material_type='Cotton',
            initial_quantity=Decimal('500'), remaining_quantity=Decimal('500'),
        )
        self.order = SalesOrder.objects.create(
            buyer_name='Buyer', fabric=self.fabric, fabric_quality='A',
            weight_sold=Decimal('10'), price_per_kg=Decimal('100'),
            total_price=Decimal('1000'), created_by=self.admin,
        )

    def test_patch_sales_order_without_weight_or_price(self):
        res = self.client.patch(f'/api/sales/orders/{self.order.id}/', {'notes': 'call first'})
        self.assertEqual(res.status_code, 200)
        self.order.refresh_from_db()
        self.assertEqual(self.order.notes, 'call first')

    def test_patch_still_rejects_invalid_value(self):
        res = self.client.patch(f'/api/sales/orders/{self.order.id}/', {'weight_sold': '0'})
        self.assertEqual(res.status_code, 400)

    def test_patch_warehouse_stock_status_only(self):
        res = self.client.patch(f'/api/warehouse/stock/{self.stock.id}/', {'status': 'Approved'})
        self.assertEqual(res.status_code, 200)

    def test_patch_fabric_stock_and_sorting_session(self):
        res = self.client.patch(f'/api/sorting/fabric-stock/{self.fabric.id}/', {'material_type': 'Denim'})
        self.assertEqual(res.status_code, 200)
        session = SortingSession.objects.create(
            fabric=self.fabric, supervisor=self.admin, unit='Unit 1',
            quantity_taken=Decimal('50'),
        )
        res = self.client.patch(f'/api/sorting/sessions/{session.id}/', {'notes': 'shift B'})
        self.assertEqual(res.status_code, 200)
