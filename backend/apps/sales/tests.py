from decimal import Decimal

from rest_framework.test import APITestCase

from apps.users.models import CustomUser
from apps.warehouse.models import Vendor, FactoryUnit, Stock
from apps.sorting.models import FabricStock, SortingSession
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


# ─────────────────────────────────────────────────────────────────────────────
# Order, dispatch and payment workflow
# ─────────────────────────────────────────────────────────────────────────────
from apps.core.testing import make_user, client_for, make_fabric, make_order, make_dried_stock
from .models import DispatchTracking, Payment


class SalesWorkflowTests(APITestCase):
    def setUp(self):
        self.admin = make_user('admin')
        self.client = client_for(self.admin)
        self.fabric = make_fabric()

    def test_create_order_calculates_total_and_defaults(self):
        res = self.client.post('/api/sales/orders/', {
            'buyer_name': 'Ali Traders', 'fabric': self.fabric.id, 'fabric_quality': 'A',
            'weight_sold': '12.5', 'price_per_kg': '80', 'created_by': self.admin.id,
        }, format='json')
        self.assertEqual(res.status_code, 201)
        self.assertEqual(Decimal(res.data['total_price']), Decimal('1000'))
        self.assertEqual(res.data['status'], 'Draft')
        self.assertEqual(res.data['payment_status'], 'Pending')

    def test_update_recalculates_total(self):
        order = make_order(fabric=self.fabric, created_by=self.admin)
        res = self.client.patch(f'/api/sales/orders/{order.id}/', {'price_per_kg': '150'}, format='json')
        self.assertEqual(res.status_code, 200)
        order.refresh_from_db()
        self.assertEqual(order.total_price, Decimal('1500'))

    def test_confirm_and_cancel(self):
        make_dried_stock(self.fabric)
        order = make_order(fabric=self.fabric, created_by=self.admin)
        self.client.post(f'/api/sales/orders/{order.id}/confirm/')
        order.refresh_from_db()
        self.assertEqual(order.status, 'Confirmed')
        self.client.post(f'/api/sales/orders/{order.id}/cancel/')
        order.refresh_from_db()
        self.assertEqual(order.status, 'Cancelled')

    def test_payments_drive_payment_status(self):
        order = make_order(fabric=self.fabric, created_by=self.admin)   # total 1000

        def pay(amount):
            return self.client.post('/api/sales/payments/', {
                'sales_order': order.id, 'amount': amount, 'received_by': self.admin.id,
            }, format='json')

        self.assertEqual(pay('400').status_code, 201)
        order.refresh_from_db()
        self.assertEqual(order.payment_status, 'Partial')
        pay('600')
        order.refresh_from_db()
        self.assertEqual(order.payment_status, 'Paid')

    def test_mark_delivered_completes_order(self):
        order = make_order(fabric=self.fabric, created_by=self.admin)
        dispatch = DispatchTracking.objects.create(
            sales_order=order, vehicle_number='LHR-9', dispatched_weight=Decimal('10'),
            dispatched_by=self.admin,
        )
        res = self.client.post(f'/api/sales/dispatch/{dispatch.id}/mark_delivered/')
        self.assertEqual(res.status_code, 200)
        dispatch.refresh_from_db()
        order.refresh_from_db()
        self.assertEqual(dispatch.dispatch_status, 'Delivered')
        self.assertIsNotNone(dispatch.delivery_date)
        self.assertEqual(order.status, 'Completed')

    def test_summary(self):
        paid = make_order(fabric=self.fabric, created_by=self.admin, payment_status='Paid', status='Completed')
        make_order(fabric=self.fabric, created_by=self.admin, weight='5')
        Payment.objects.create(sales_order=paid, amount=Decimal('1000'), received_by=self.admin)
        data = self.client.get('/api/sales/orders/summary/').data
        self.assertEqual(data['total_orders'], 2)
        self.assertEqual(data['total_revenue'], 1500.0)
        self.assertEqual(data['total_collected'], 1000.0)
        self.assertEqual(data['pending_amount'], 500.0)
        self.assertEqual(data['completed_orders'], 1)
        self.assertEqual(data['paid_orders'], 1)

    def test_filters(self):
        a = make_order(fabric=self.fabric, created_by=self.admin, buyer_name='Ali Traders', status='Confirmed')
        make_order(fabric=self.fabric, created_by=self.admin, buyer_name='Bilal and Co')

        def ids(query):
            return {o['id'] for o in self.client.get(f'/api/sales/orders/?{query}').data}

        self.assertEqual(ids('buyer=ali'), {a.id})
        self.assertEqual(ids('status=Confirmed'), {a.id})
        self.assertEqual(len(ids('date_filter=today')), 2)



# ─────────────────────────────────────────────────────────────────────────────
# Phase 3: customers
# ─────────────────────────────────────────────────────────────────────────────
from .models import Customer


class CustomerTests(APITestCase):
    def setUp(self):
        self.admin = make_user('admin')
        self.client = client_for(self.admin)
        self.fabric = make_fabric()

    def create_order(self, **data):
        payload = {'fabric': self.fabric.id, 'fabric_quality': 'A', 'weight_sold': '1', 'price_per_kg': '1'}
        payload.update(data)
        return self.client.post('/api/sales/orders/', payload, format='json')

    def test_typed_buyer_names_link_to_one_customer(self):
        a = self.create_order(buyer_name='Ali Traders').data
        b = self.create_order(buyer_name='  ALI  traders').data
        self.assertEqual(a['customer'], b['customer'])
        self.assertEqual(a['customer_name'], 'Ali Traders')
        self.assertEqual(b['buyer_name'], 'ALI  traders')          # kept as typed (DRF trims the ends)
        self.assertEqual(Customer.objects.count(), 1)

    def test_choosing_a_customer_fills_the_buyer_name(self):
        c = Customer.objects.create(name='Bilal & Co')
        res = self.create_order(customer=c.id)
        self.assertEqual(res.status_code, 201)
        self.assertEqual(res.data['buyer_name'], 'Bilal & Co')
        self.assertEqual(self.create_order().status_code, 400)       # neither given

    def test_customer_crud_and_duplicate_names(self):
        res = self.client.post('/api/sales/customers/', {'name': 'Zain Fabrics'}, format='json')
        self.assertEqual(res.status_code, 201)
        res = self.client.post('/api/sales/customers/', {'name': 'zain  FABRICS'}, format='json')
        self.assertEqual(res.status_code, 400)
        self.assertEqual(client_for(make_user('sorting_supervisor')).post(
            '/api/sales/customers/', {'name': 'X'}, format='json').status_code, 403)

    def test_similar_names_are_reported_and_can_be_merged(self):
        keep = Customer.objects.create(name='Ali Traders')
        dupe = Customer.objects.create(name='Ali Trader')
        Customer.objects.create(name='Zain Fabrics')
        order = make_order(fabric=self.fabric, created_by=self.admin, customer=dupe)

        pairs = self.client.get('/api/sales/customers/duplicates/').data
        self.assertEqual(len(pairs), 1)
        self.assertEqual({pairs[0]['a']['id'], pairs[0]['b']['id']}, {keep.id, dupe.id})

        self.assertEqual(client_for(make_user('warehouse_supervisor')).post(
            f'/api/sales/customers/{dupe.id}/merge/', {'into': keep.id}, format='json').status_code, 403)
        res = self.client.post(f'/api/sales/customers/{dupe.id}/merge/', {'into': keep.id}, format='json')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data['order_count'], 1)
        order.refresh_from_db()
        self.assertEqual(order.customer, keep)
        self.assertFalse(Customer.objects.filter(pk=dupe.pk).exists())


class PaymentMethodTests(APITestCase):
    def test_all_offered_payment_methods_are_accepted(self):
        admin = make_user('admin')
        client = client_for(admin)
        order = make_order(created_by=admin)
        for method in ('Cash', 'Bank Transfer', 'Cheque', 'Online Transfer'):
            with self.subTest(method=method):
                res = client.post('/api/sales/payments/', {
                    'sales_order': order.id, 'amount': '1', 'payment_method': method,
                }, format='json')
                self.assertEqual(res.status_code, 201)
