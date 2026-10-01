from datetime import date, timedelta
from decimal import Decimal

from rest_framework.test import APITestCase

from apps.core.testing import client_for, make_stock, make_user
from apps.warehouse.models import FactoryUnit, Stock, Vendor
from .models import PurchaseOrder, PurchaseRequisition, SupplierInvoice

API = '/api/v1/procurement'


class ProcurementTestCase(APITestCase):
    def setUp(self):
        self.admin = make_user('admin')
        self.keeper = make_user('warehouse_supervisor')
        self.as_admin = client_for(self.admin)
        self.as_keeper = client_for(self.keeper)
        self.vendor = Vendor.objects.create(name='Ali Traders')
        self.other_vendor = Vendor.objects.create(name='Sindh Fabrics')
        self.unit = FactoryUnit.objects.create(name='Unit 1')

    def order(self, qty='1000', price='50', approve=True, **extra):
        res = self.as_keeper.post(f'{API}/orders/', {
            'vendor': self.vendor.pk, 'order_date': str(date.today()),
            'lines': [{'material': 'Cotton White', 'quantity_kg': qty, 'unit_price': price}], **extra,
        }, format='json')
        self.assertEqual(res.status_code, 201, res.data)
        order_id = res.data['id']
        if approve:
            self.assertEqual(self.as_keeper.post(f'{API}/orders/{order_id}/submit/').status_code, 200)
            self.assertEqual(self.as_admin.post(f'{API}/orders/{order_id}/approve/').status_code, 200)
        return PurchaseOrder.objects.get(pk=order_id)

    def receive(self, line, weight, status='Received', vendor=None):
        return self.as_keeper.post('/api/v1/warehouse/stock/', {
            'vendor': (vendor or self.vendor).pk, 'unit': self.unit.pk, 'fabric_type': 'Cotton White',
            'vendor_weight_slip': 'S-1', 'vehicle_no': 'LHR-1', 'our_weight': weight,
            'unloading_weight': weight, 'status': status, 'po_line': line.pk if line else None,
        }, format='json')


class RequisitionTests(ProcurementTestCase):
    def test_request_is_approved_by_an_admin_only(self):
        res = self.as_keeper.post(f'{API}/requisitions/', {
            'unit': self.unit.pk, 'lines': [{'material': 'Denim', 'quantity_kg': '500'}],
        }, format='json')
        self.assertEqual(res.status_code, 201, res.data)
        self.assertEqual(res.data['requested_by'], self.keeper.pk)   # set by the server
        req_id = res.data['id']
        self.assertTrue(res.data['number'].startswith('PR-'))

        self.assertEqual(self.as_keeper.post(f'{API}/requisitions/{req_id}/submit/').status_code, 200)
        self.assertEqual(self.as_keeper.post(f'{API}/requisitions/{req_id}/approve/').status_code, 403)
        res = self.as_admin.post(f'{API}/requisitions/{req_id}/approve/')
        self.assertEqual(res.data['status'], 'Approved')
        self.assertEqual(res.data['decided_by'], self.admin.pk)

    def test_rejection_needs_a_reason_and_can_be_resubmitted(self):
        req = self.as_keeper.post(f'{API}/requisitions/', {'lines': [{'material': 'Denim', 'quantity_kg': '5'}]},
                                  format='json').data
        self.as_keeper.post(f'{API}/requisitions/{req["id"]}/submit/')
        self.assertEqual(self.as_admin.post(f'{API}/requisitions/{req["id"]}/reject/').status_code, 400)
        res = self.as_admin.post(f'{API}/requisitions/{req["id"]}/reject/', {'reason': 'Too expensive'})
        self.assertEqual(res.data['status'], 'Rejected')
        # Editing a rejected request puts it back to draft
        res = self.as_keeper.patch(f'{API}/requisitions/{req["id"]}/', {'notes': 'cheaper supplier'}, format='json')
        self.assertEqual(res.data['status'], 'Draft')

    def test_order_from_approved_request_marks_it_ordered(self):
        req = self.as_keeper.post(f'{API}/requisitions/', {'lines': [{'material': 'Denim', 'quantity_kg': '5'}]},
                                  format='json').data
        # A draft request can't be ordered yet
        res = self.as_keeper.post(f'{API}/orders/', {
            'vendor': self.vendor.pk, 'order_date': str(date.today()), 'requisition': req['id'],
            'lines': [{'material': 'Denim', 'quantity_kg': '5', 'unit_price': '10'}],
        }, format='json')
        self.assertEqual(res.status_code, 400)
        self.as_keeper.post(f'{API}/requisitions/{req["id"]}/submit/')
        self.as_admin.post(f'{API}/requisitions/{req["id"]}/approve/')
        self.order(requisition=req['id'])
        self.assertEqual(PurchaseRequisition.objects.get(pk=req['id']).status, 'Ordered')


class PurchaseOrderTests(ProcurementTestCase):
    def test_order_needs_admin_approval(self):
        order = self.order(approve=False)
        self.assertEqual(order.created_by, self.keeper)
        self.assertEqual(order.status, 'Draft')
        self.as_keeper.post(f'{API}/orders/{order.pk}/submit/')
        self.assertEqual(self.as_keeper.post(f'{API}/orders/{order.pk}/approve/').status_code, 403)
        res = self.as_admin.post(f'{API}/orders/{order.pk}/approve/')
        self.assertEqual(res.data['status'], 'Approved')
        self.assertEqual(res.data['total_amount'], '50000.00')

    def test_receipts_move_the_order_to_partly_and_fully_received(self):
        order = self.order(qty='1000')
        line = order.lines.get()
        self.assertEqual(self.receive(line, '400').status_code, 201)
        order.refresh_from_db()
        self.assertEqual(order.status, 'Partially Received')
        # A rejected delivery doesn't count as received
        self.receive(line, '600', status='Rejected')
        order.refresh_from_db()
        self.assertEqual(order.status, 'Partially Received')
        self.assertEqual(line.rejected_kg(), Decimal('600'))
        self.receive(line, '600')
        order.refresh_from_db()
        self.assertEqual(order.status, 'Received')
        # Deleting a delivery reopens the order
        Stock.objects.filter(po_line=line, our_weight=Decimal('600'), status='Received').delete()
        order.refresh_from_db()
        self.assertEqual(order.status, 'Partially Received')

    def test_receipt_must_match_supplier_and_approved_order(self):
        draft = self.order(approve=False)
        self.assertEqual(self.receive(draft.lines.get(), '10').status_code, 400)
        order = self.order()
        res = self.receive(order.lines.get(), '10', vendor=self.other_vendor)
        self.assertEqual(res.status_code, 400)
        self.assertIn('po_line', res.data)

    def test_delivery_without_an_order_still_works(self):
        res = self.receive(None, '250')
        self.assertEqual(res.status_code, 201, res.data)
        self.assertIsNone(Stock.objects.get(pk=res.data['data']['id']).po_line)

    def test_changing_an_approved_order_is_an_amendment(self):
        order = self.order(qty='1000')
        line = order.lines.get()
        self.receive(line, '300')
        lines = [{'id': line.pk, 'material': 'Cotton White', 'quantity_kg': '1200', 'unit_price': '50'}]
        res = self.as_keeper.patch(f'{API}/orders/{order.pk}/', {'lines': lines}, format='json')
        self.assertEqual(res.status_code, 200, res.data)
        self.assertEqual(res.data['revision'], 1)
        self.assertEqual(res.data['status'], 'Submitted')
        # Can't go below what has arrived
        lines[0]['quantity_kg'] = '200'
        self.assertEqual(self.as_keeper.patch(f'{API}/orders/{order.pk}/', {'lines': lines}, format='json').status_code, 400)
        # Re-approval returns it to its receiving status
        res = self.as_admin.post(f'{API}/orders/{order.pk}/approve/')
        self.assertEqual(res.data['status'], 'Partially Received')

    def test_cancel_and_close(self):
        order = self.order()
        self.receive(order.lines.get(), '10')
        self.assertEqual(self.as_keeper.post(f'{API}/orders/{order.pk}/cancel/').status_code, 400)
        self.assertEqual(self.as_keeper.post(f'{API}/orders/{order.pk}/close/').status_code, 403)
        self.assertEqual(self.as_admin.post(f'{API}/orders/{order.pk}/close/').data['status'], 'Closed')
        # A closed order takes no more deliveries
        self.assertEqual(self.receive(order.lines.get(), '10').status_code, 400)

    def test_open_lines_list_what_can_still_be_received(self):
        order = self.order(qty='100')
        self.receive(order.lines.get(), '40')
        res = self.as_keeper.get(f'{API}/open-lines/', {'vendor': self.vendor.pk})
        self.assertEqual(len(res.data), 1)
        self.assertEqual(Decimal(res.data[0]['remaining_kg']), Decimal('60'))


class InvoiceTests(ProcurementTestCase):
    def invoice(self, amount='1000', tax='170', **extra):
        res = self.as_keeper.post(f'{API}/invoices/', {
            'vendor': self.vendor.pk, 'invoice_number': extra.pop('number', 'INV-1'),
            'invoice_date': str(date.today()), 'amount': amount, 'tax_amount': tax, **extra,
        }, format='json')
        return res

    def test_payments_update_the_invoice_and_cannot_overpay(self):
        inv = self.invoice().data
        self.assertEqual(inv['total'], '1170.00')
        pay = {'invoice': inv['id'], 'amount': '500', 'method': 'Cash', 'payment_date': str(date.today())}
        # Only admins record payments
        self.assertEqual(self.as_keeper.post(f'{API}/payments/', pay).status_code, 403)
        res = self.as_admin.post(f'{API}/payments/', pay)
        self.assertEqual(res.status_code, 201, res.data)
        self.assertEqual(res.data['paid_by'], self.admin.pk)
        self.assertEqual(SupplierInvoice.objects.get(pk=inv['id']).status, 'Partial')
        self.assertEqual(self.as_admin.post(f'{API}/payments/', {**pay, 'amount': '700'}).status_code, 400)
        self.as_admin.post(f'{API}/payments/', {**pay, 'amount': '670'})
        self.assertEqual(SupplierInvoice.objects.get(pk=inv['id']).status, 'Paid')

    def test_invoice_rules(self):
        self.assertEqual(self.invoice().status_code, 201)
        self.assertEqual(self.invoice().status_code, 400)                       # same number twice
        other_order = self.order()
        other_order.vendor = self.other_vendor
        other_order.save()
        res = self.invoice(number='INV-2', purchase_order=other_order.pk)
        self.assertEqual(res.status_code, 400)                                  # PO from another supplier
        res = self.invoice(number='INV-3', due_date=str(date.today() - timedelta(days=1)))
        self.assertEqual(res.status_code, 400)                                  # due before invoice date


class ReturnTests(ProcurementTestCase):
    def test_cannot_return_more_than_was_delivered(self):
        stock = make_stock(vendor=self.vendor, unit=self.unit, our_weight=Decimal('100'))
        body = {'receipt': stock.pk, 'quantity_kg': '60', 'reason': 'Wet bales', 'return_date': str(date.today())}
        res = self.as_keeper.post(f'{API}/returns/', body)
        self.assertEqual(res.status_code, 201, res.data)
        self.assertEqual(res.data['created_by'], self.keeper.pk)
        self.assertEqual(self.as_keeper.post(f'{API}/returns/', body).status_code, 400)   # only 40 left
        self.assertEqual(self.as_keeper.post(f'{API}/returns/', {**body, 'quantity_kg': '40', 'reason': ' '}).status_code, 400)


class AccessAndReportTests(ProcurementTestCase):
    def test_other_roles_cannot_open_procurement(self):
        sorter = client_for(make_user('sorting_supervisor'))
        self.assertEqual(sorter.get(f'{API}/orders/').status_code, 403)
        self.assertEqual(sorter.get(f'{API}/summary/').status_code, 403)

    def test_reports(self):
        order = self.order(qty='100', price='40', expected_date=str(date.today() + timedelta(days=3)))
        self.receive(order.lines.get(), '100')
        self.receive(None, '50', status='Rejected')
        self.as_keeper.post(f'{API}/quotations/', {
            'vendor': self.other_vendor.pk, 'material': 'cotton white', 'price_per_kg': '35', 'quoted_on': str(date.today()),
        })

        summary = self.as_keeper.get(f'{API}/summary/').data
        self.assertEqual(summary['open_orders'], 0)

        perf = {row['name']: row for row in self.as_keeper.get(f'{API}/supplier-performance/').data}
        ali = perf['Ali Traders']
        self.assertEqual(Decimal(ali['received_kg']), Decimal('100'))
        self.assertEqual(Decimal(ali['rejected_kg']), Decimal('50'))
        self.assertEqual(ali['on_time_pct'], 100.0)

        prices = self.as_keeper.get(f'{API}/price-comparison/', {'material': 'cotton'}).data
        self.assertEqual(len(prices), 1)                                         # same material, different case
        self.assertEqual(prices[0]['offers'][0]['vendor'], 'Sindh Fabrics')      # cheapest first
