from decimal import Decimal

from rest_framework.test import APITestCase

from apps.users.models import CustomUser
from apps.warehouse.models import Vendor, FactoryUnit, Stock
from apps.sorting.models import FabricStock, SortingSession
from apps.core.testing import client_for, make_user
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


# ─────────────────────────────────────────────────────────────────────────────
# Phase 5: price list, quotations, invoices, returns, credit and statements
# ─────────────────────────────────────────────────────────────────────────────
class SalesExtrasTests(APITestCase):
    def setUp(self):
        from decimal import Decimal as D
        from apps.core.testing import make_dried_stock, make_fabric
        from .models import Customer
        self.D = D
        self.admin_user = make_user('admin')
        self.client = client_for(self.admin_user)
        self.fabric = make_fabric()
        make_dried_stock(self.fabric, '1000')
        self.customer = Customer.objects.create(name='Ali Traders', category='Wholesaler', payment_terms_days=30)

    # helpers
    def order(self, weight='100', price='50', **extra):
        res = self.client.post('/api/sales/orders/', {
            'customer': self.customer.id, 'fabric': self.fabric.id, 'fabric_quality': 'A',
            'weight_sold': weight, 'price_per_kg': price, **extra}, format='json')
        self.assertEqual(res.status_code, 201, res.data)
        return res.data

    def dispatched_order(self, weight='100', shipped='100', **extra):
        order = self.order(weight=weight, **extra)
        self.client.post(f"/api/sales/orders/{order['id']}/confirm/")
        res = self.client.post('/api/sales/dispatch/', {
            'sales_order': order['id'], 'vehicle_number': 'LEA-1', 'dispatched_weight': shipped}, format='json')
        self.assertEqual(res.status_code, 201, res.data)
        return order

    def on_hand(self):
        from apps.inventory import services
        return services.on_hand(self.fabric.id)

    def test_discount_and_tax_change_the_total_only_when_given(self):
        self.assertEqual(self.D(self.order()['total_price']), self.D('5000'))
        order = self.order(discount_pct='10', tax_pct='5')
        self.assertEqual(self.D(order['total_price']), self.D('4725.00'))     # 5000 - 500 = 4500, + 5%
        self.assertEqual(self.client.post('/api/sales/orders/', {
            'customer': self.customer.id, 'fabric': self.fabric.id, 'fabric_quality': 'A',
            'weight_sold': '1', 'price_per_kg': '1', 'discount_pct': '101'}, format='json').status_code, 400)

    def test_product_price_list(self):
        res = self.client.post('/api/sales/products/', {
            'name': 'White fibre A', 'grade': 'A', 'price_per_kg': '60',
            'prices': [{'customer_category': 'Wholesaler', 'price_per_kg': '55'}]}, format='json')
        self.assertEqual(res.status_code, 201, res.data)
        self.assertEqual(res.data['prices'][0]['price_per_kg'], '55.00')
        url = f"/api/sales/products/{res.data['id']}/"
        res = self.client.patch(url, {'prices': [{'customer_category': 'Exporter', 'price_per_kg': '70'}]}, format='json')
        self.assertEqual([p['customer_category'] for p in res.data['prices']], ['Exporter'])
        twice = [{'customer_category': 'Exporter', 'price_per_kg': '70'}] * 2
        self.assertEqual(self.client.patch(url, {'prices': twice}, format='json').status_code, 400)

    def test_quotation_becomes_an_order(self):
        res = self.client.post('/api/sales/quotations/', {
            'customer': self.customer.id, 'fabric_quality': 'A', 'weight': '200', 'price_per_kg': '40',
            'discount_pct': '5'}, format='json')
        self.assertEqual(res.status_code, 201, res.data)
        self.assertTrue(res.data['number'].startswith('QT-'))
        self.assertEqual(res.data['total'], '7600.00')
        url = f"/api/sales/quotations/{res.data['id']}/"
        # not before the customer accepts
        self.assertEqual(self.client.post(url + 'convert/', {'fabric': self.fabric.id}, format='json').status_code, 400)
        self.assertEqual(self.client.post(url + 'send/').data['status'], 'Sent')
        self.assertEqual(self.client.post(url + 'accept/').data['status'], 'Accepted')
        # the lot has to be known
        self.assertEqual(self.client.post(url + 'convert/').status_code, 400)
        done = self.client.post(url + 'convert/', {'fabric': self.fabric.id}, format='json')
        self.assertEqual(done.data['status'], 'Converted')
        order = self.client.get(f"/api/sales/orders/{done.data['order']}/").data
        self.assertEqual((order['status'], order['quotation_number']), ('Draft', res.data['number']))
        self.assertEqual(self.D(order['total_price']), self.D('7600.00'))
        # converted quotations are closed
        self.assertEqual(self.client.patch(url, {'weight': '1'}, format='json').status_code, 400)
        self.assertEqual(self.client.delete(url).status_code, 400)

    def test_rejected_quotation_cannot_be_converted(self):
        res = self.client.post('/api/sales/quotations/', {
            'customer': self.customer.id, 'fabric': self.fabric.id, 'fabric_quality': 'A',
            'weight': '10', 'price_per_kg': '40'}, format='json')
        url = f"/api/sales/quotations/{res.data['id']}/"
        rejected = self.client.post(url + 'reject/', {'reason': 'Too dear'}, format='json').data
        self.assertEqual((rejected['status'], rejected['rejection_reason']), ('Rejected', 'Too dear'))
        self.assertEqual(self.client.post(url + 'accept/').status_code, 400)
        self.assertEqual(self.client.post(url + 'convert/').status_code, 400)

    def test_invoice_covers_dispatched_weight_only(self):
        order = self.order()
        url = f"/api/sales/orders/{order['id']}/invoice/"
        self.assertEqual(self.client.post(url).status_code, 400)             # nothing dispatched yet
        order = self.dispatched_order(weight='100', shipped='60', discount_pct='10')
        url = f"/api/sales/orders/{order['id']}/invoice/"
        self.assertEqual(self.client.post(url, {'weight': '61'}, format='json').status_code, 400)
        res = self.client.post(url, {'invoice_date': '2026-10-01'}, format='json')
        self.assertEqual(res.status_code, 201, res.data)
        self.assertTrue(res.data['number'].startswith('INV-'))
        self.assertEqual((res.data['weight'], res.data['subtotal'], res.data['discount_amount'], res.data['total']),
                         ('60.00', '3000.00', '300.00', '2700.00'))
        self.assertEqual(res.data['due_date'], '2026-10-31')                 # the customer's 30-day terms
        self.assertEqual(self.client.post(url).status_code, 400)             # all dispatched weight is invoiced
        self.assertEqual(self.client.get(f"/api/sales/orders/{order['id']}/").data['invoiced_weight'], '60.00')

    def test_invoice_status_follows_payments(self):
        order = self.dispatched_order()
        invoice = self.client.post(f"/api/sales/orders/{order['id']}/invoice/", {'invoice_date': '2020-01-01'}, format='json').data
        self.assertEqual(invoice['status'], 'Overdue')
        self.client.post('/api/sales/payments/', {'sales_order': order['id'], 'amount': '5000'}, format='json')
        listed = self.client.get('/api/sales/invoices/').data[0]
        self.assertEqual((listed['status'], listed['paid']), ('Paid', '5000.00'))

    def test_return_is_limited_to_dispatched_weight(self):
        order = self.dispatched_order(weight='100', shipped='40')
        body = {'order': order['id'], 'return_date': '2026-10-02', 'reason': 'Damp', 'weight': '41'}
        self.assertEqual(self.client.post('/api/sales/returns/', body, format='json').status_code, 400)
        self.assertEqual(self.client.post('/api/sales/returns/', {**body, 'weight': '30'}, format='json').status_code, 201)
        # a pending return already holds its weight
        self.assertEqual(self.client.post('/api/sales/returns/', {**body, 'weight': '11'}, format='json').status_code, 400)

    def test_approved_return_credits_and_restocks_when_chosen(self):
        order = self.dispatched_order()
        self.assertEqual(self.on_hand(), self.D('900'))
        self.client.post('/api/sales/payments/', {'sales_order': order['id'], 'amount': '4000'}, format='json')
        res = self.client.post('/api/sales/returns/', {
            'order': order['id'], 'return_date': '2026-10-02', 'reason': 'Damp', 'weight': '20', 'restock': True}, format='json')
        url = f"/api/sales/returns/{res.data['id']}/"
        self.assertEqual(self.on_hand(), self.D('900'))                      # nothing moves until approved
        other = client_for(make_user('warehouse_supervisor'))
        self.assertEqual(other.post(url + 'approve/').status_code, 403)
        approved = self.client.post(url + 'approve/').data
        self.assertEqual((approved['status'], approved['credit_amount']), ('Approved', '1000.00'))
        self.assertEqual(self.on_hand(), self.D('920'))
        # 5000 - 1000 credit = 4000 due, and 4000 is paid
        data = self.client.get(f"/api/sales/orders/{order['id']}/").data
        self.assertEqual((data['payment_status'], data['credited'], data['returned_weight']), ('Paid', '1000.00', '20.00'))
        self.assertEqual(self.client.post(url + 'approve/').status_code, 400)
        self.assertEqual(self.client.delete(url).status_code, 400)

    def test_return_without_restock_leaves_stock_alone(self):
        order = self.dispatched_order()
        res = self.client.post('/api/sales/returns/', {
            'order': order['id'], 'return_date': '2026-10-02', 'reason': 'Contaminated', 'weight': '20'}, format='json')
        self.client.post(f"/api/sales/returns/{res.data['id']}/approve/")
        self.assertEqual(self.on_hand(), self.D('900'))

    def test_rejected_return_frees_its_weight(self):
        order = self.dispatched_order()
        body = {'order': order['id'], 'return_date': '2026-10-02', 'reason': 'Damp', 'weight': '100'}
        first = self.client.post('/api/sales/returns/', body, format='json').data
        rejected = self.client.post(f"/api/sales/returns/{first['id']}/reject/", {'reason': 'No fault found'}, format='json').data
        self.assertEqual((rejected['status'], rejected['credit_amount']), ('Rejected', '0.00'))
        self.assertEqual(self.client.post('/api/sales/returns/', body, format='json').status_code, 201)

    def test_credit_limit_warns_but_does_not_block(self):
        self.customer.credit_limit = self.D('6000')
        self.customer.save()
        first = self.order()                                                 # Rs. 5,000
        res = self.client.post(f"/api/sales/orders/{first['id']}/confirm/")
        self.assertIsNone(res.data['credit_warning'])
        second = self.order()
        res = self.client.post(f"/api/sales/orders/{second['id']}/confirm/")
        self.assertEqual(res.status_code, 200)
        self.assertIn('over their credit limit', res.data['credit_warning'])
        customer = next(c for c in self.client.get('/api/sales/customers/').data if c['id'] == self.customer.id)
        self.assertEqual((customer['balance'], customer['over_limit']), ('10000.00', True))

    def test_customer_statement_has_a_running_balance(self):
        order = self.dispatched_order()
        self.order()                                                         # a draft is not owed
        self.client.post('/api/sales/payments/', {'sales_order': order['id'], 'amount': '1500'}, format='json')
        data = self.client.get(f'/api/sales/customers/{self.customer.id}/statement/').data
        self.assertEqual((data['billed'], data['paid'], data['balance']), ('5000.00', '1500.00', '3500.00'))
        self.assertEqual([(t['kind'], t['balance']) for t in data['transactions']],
                         [('Order', '5000.00'), ('Payment', '3500.00')])

    def test_performance_report(self):
        self.dispatched_order()
        self.order()                                                         # drafts are not sales yet
        data = self.client.get('/api/sales/performance/').data
        self.assertEqual((data['orders'], data['revenue'], data['kg'], data['average_price']), (1, '5000.00', '100.00', '50.00'))
        self.assertEqual(data['by_customer'][0]['name'], 'Ali Traders')
        self.assertEqual(self.client.get('/api/sales/performance/?start=2030-01-01').data['orders'], 0)

    def test_merging_customers_moves_their_quotations(self):
        from .models import Customer, SalesQuotation
        other = Customer.objects.create(name='Ali Trader')
        self.client.post('/api/sales/quotations/', {
            'customer': other.id, 'fabric_quality': 'A', 'weight': '10', 'price_per_kg': '40'}, format='json')
        res = self.client.post(f'/api/sales/customers/{other.id}/merge/', {'into': self.customer.id}, format='json')
        self.assertEqual(res.status_code, 200, res.data)
        self.assertEqual(SalesQuotation.objects.get().customer_id, self.customer.id)
