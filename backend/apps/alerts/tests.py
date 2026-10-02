from datetime import timedelta
from decimal import Decimal
from io import StringIO

from django.core import mail
from django.core.management import call_command
from django.db import connection
from django.test import override_settings
from django.test.utils import CaptureQueriesContext
from django.utils import timezone
from rest_framework.test import APITestCase

from apps.core.testing import (
    client_for, make_chemical, make_decolor_session, make_dried_stock, make_fabric, make_order, make_stock, make_user,
)
from apps.documents.models import Document, DocumentCategory
from apps.inventory import services as inventory
from apps.maintenance.models import Machine, MaintenanceSchedule, SparePart, WorkOrder
from apps.procurement.models import (
    PurchaseOrder, PurchaseOrderLine, PurchaseRequisition, RequisitionLine, SupplierInvoice, SupplierPayment,
)
from apps.production.models import ProductionOrder, Routing
from apps.quality.models import CorrectiveAction, Inspection
from apps.sales.models import Customer, DispatchTracking, Payment, SalesInvoice, SalesReturn
from apps.warehouse.models import Vendor
from apps.workforce.models import Department, Employee, JobRole, LeaveRequest
from .models import NotificationRule

API = '/api/v1/alerts'


class AlertsTestCase(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.admin = make_user('admin')
        cls.keeper = make_user('warehouse_supervisor')
        cls.sorter = make_user('sorting_supervisor')
        cls.decolorer = make_user('decolorization_supervisor')
        cls.drier = make_user('drying_supervisor')

    def setUp(self):
        self.today = timezone.localdate()
        self.as_admin = client_for(self.admin)
        self.as_keeper = client_for(self.keeper)
        self.as_sorter = client_for(self.sorter)
        self.as_decolorer = client_for(self.decolorer)
        self.as_drier = client_for(self.drier)

    def day(self, offset):
        return self.today + timedelta(days=offset)

    def rule(self, key, **changes):
        rule = NotificationRule.objects.get(key=key)
        for name, value in changes.items():
            setattr(rule, name, value)
        rule.save()
        return rule

    def items(self, client=None):
        res = (client or self.as_admin).get(f'{API}/notifications/')
        self.assertEqual(res.status_code, 200, res.data)
        return {entry['id']: entry for entry in res.data}

    def assertListed(self, item_id, client=None):
        self.assertIn(item_id, self.items(client))

    def assertNotListed(self, item_id, client=None):
        self.assertNotIn(item_id, self.items(client))

    def check_switch(self, key, item_id):
        """A rule that is switched off lists nothing; switched on again it lists the item."""
        self.rule(key, is_enabled=False)
        self.assertNotListed(item_id)
        self.rule(key, is_enabled=True)
        self.assertListed(item_id)

    # Records the rules look at

    def failed_inspection(self, days_ago=0, **extra):
        extra.setdefault('stock', make_stock())
        return Inspection.objects.create(stage='Incoming', inspector=self.keeper, inspected_on=self.day(-days_ago),
                                         result='Fail', rejection_reason='Too wet', **extra)

    def machine(self):
        n = Machine.objects.count() + 1
        return Machine.objects.create(code=f'M-{n}', name=f'Machine {n}')

    def production_order(self, **extra):
        extra.setdefault('planned_start', self.day(-10))
        extra.setdefault('planned_end', self.day(-3))
        routing, _ = Routing.objects.get_or_create(name='Test routing')
        return ProductionOrder.objects.create(
            product_name='Recycled cotton', fabric=make_fabric(), routing=routing, planned_input_kg=Decimal('500'),
            planned_output_kg=Decimal('400'), created_by=self.admin, **extra)

    def sales_invoice(self, order, due_in):
        return SalesInvoice.objects.create(
            order=order, invoice_date=self.day(due_in - 10), due_date=self.day(due_in), weight=order.weight_sold,
            price_per_kg=order.price_per_kg, subtotal=order.total_price, total=order.total_price,
            created_by=self.admin)

    def supplier_invoice(self, due_in, number='SI-1', amount='1000'):
        vendor = Vendor.objects.create(name=f'Supplier {number}')
        return SupplierInvoice.objects.create(vendor=vendor, invoice_number=number, invoice_date=self.day(-20),
                                              due_date=self.day(due_in), amount=Decimal(amount))

    def requisition(self):
        req = PurchaseRequisition.objects.create(requested_by=self.keeper, status='Submitted')
        RequisitionLine.objects.create(requisition=req, material='Cotton waste', quantity_kg=Decimal('800'))
        return req

    def purchase_order(self):
        order = PurchaseOrder.objects.create(vendor=Vendor.objects.create(name='Supplier PO'), order_date=self.today,
                                             status='Submitted', created_by=self.keeper)
        PurchaseOrderLine.objects.create(order=order, material='Denim', quantity_kg=Decimal('100'),
                                         unit_price=Decimal('50'))
        return order

    def sales_return(self):
        fabric = make_fabric()
        make_dried_stock(fabric, '500')
        order = make_order(fabric=fabric, created_by=self.admin, weight='100', price='200', status='Dispatched')
        DispatchTracking.objects.create(sales_order=order, vehicle_number='LHR-9', dispatched_weight=Decimal('100'),
                                        dispatched_by=self.admin)
        return SalesReturn.objects.create(order=order, return_date=self.today, weight=Decimal('20'),
                                          reason='Stained', created_by=self.admin)

    def leave_request(self):
        department = Department.objects.create(name='Sorting floor')
        employee = Employee.objects.create(full_name='Kashif Ali', department=department,
                                           job_role=JobRole.objects.create(title='Sorter'), joined_on=self.day(-200))
        return LeaveRequest.objects.create(employee=employee, start_date=self.day(3), end_date=self.day(4),
                                           reason='Family event')


class RuleTests(AlertsTestCase):
    """Each rule: listed when the condition holds, not listed when it doesn't or when the rule is off."""

    def test_low_chemical_stock(self):
        low = make_chemical(total='1000', remaining='200', chemical_name='Caustic soda')
        nearly_empty = make_chemical(total='1000', remaining='50')
        full = make_chemical(total='1000', remaining='900')
        items = self.items()
        entry = items[f'chemical-low:{low.pk}']
        self.assertEqual(entry['title'], 'Caustic soda')
        self.assertEqual(entry['message'], 'is below 25% (200 Liters left)')
        self.assertEqual((entry['severity'], entry['share'], entry['href']), ('warning', 20.0, '/decolorization'))
        self.assertEqual(items[f'chemical-low:{nearly_empty.pk}']['severity'], 'danger')
        self.assertNotIn(f'chemical-low:{full.pk}', items)
        self.check_switch('chemical-low', f'chemical-low:{low.pk}')
        # The threshold decides what counts as low
        self.rule('chemical-low', threshold=Decimal('10'))
        self.assertNotListed(f'chemical-low:{low.pk}')
        self.assertListed(f'chemical-low:{nearly_empty.pk}')

    def test_spare_parts_at_or_below_reorder_level(self):
        low = SparePart.objects.create(code='P-1', name='Belt', stock_quantity=Decimal('2'), reorder_level=Decimal('2'))
        out = SparePart.objects.create(code='P-2', name='Seal', stock_quantity=Decimal('0'), reorder_level=Decimal('4'))
        fine = SparePart.objects.create(code='P-3', name='Fuse', stock_quantity=Decimal('9'), reorder_level=Decimal('2'))
        items = self.items()
        self.assertEqual(items[f'spare-part-low:{low.pk}']['severity'], 'warning')
        self.assertEqual(items[f'spare-part-low:{out.pk}']['severity'], 'danger')
        self.assertNotIn(f'spare-part-low:{fine.pk}', items)
        self.check_switch('spare-part-low', f'spare-part-low:{low.pk}')

    def test_low_dried_stock_is_off_until_switched_on(self):
        small, large = make_fabric(), make_fabric()
        make_dried_stock(small, '40')
        make_dried_stock(large, '900')
        self.assertNotListed(f'dried-stock-low:{small.pk}')
        self.rule('dried-stock-low', is_enabled=True)
        items = self.items()
        self.assertIn(f'dried-stock-low:{small.pk}', items)
        self.assertNotIn(f'dried-stock-low:{large.pk}', items)
        self.rule('dried-stock-low', threshold=Decimal('1000'))
        self.assertListed(f'dried-stock-low:{large.pk}')

    def test_more_reserved_than_on_hand(self):
        short, covered = make_fabric(), make_fabric()
        for fabric in (short, covered):
            make_dried_stock(fabric, '100')
        make_order(fabric=short, weight='150', status='Confirmed')
        make_order(fabric=covered, weight='60', status='Confirmed')
        items = self.items()
        self.assertEqual(items[f'stock-oversold:{short.pk}']['message'], 'has more reserved than on hand (50 kg short)')
        self.assertNotIn(f'stock-oversold:{covered.pk}', items)
        self.check_switch('stock-oversold', f'stock-oversold:{short.pk}')

    def test_purchases_waiting_for_approval(self):
        req, order = self.requisition(), self.purchase_order()
        draft = PurchaseRequisition.objects.create(requested_by=self.keeper)
        items = self.items()
        self.assertEqual(items[f'purchase-approval:request-{req.pk}']['href'], '/approvals')
        self.assertIn('Rs. 5,000', items[f'purchase-approval:order-{order.pk}']['message'])
        self.assertNotIn(f'purchase-approval:request-{draft.pk}', items)
        self.check_switch('purchase-approval', f'purchase-approval:request-{req.pk}')
        order.status = 'Approved'
        order.save()
        self.assertNotListed(f'purchase-approval:order-{order.pk}')

    def test_delayed_production_orders(self):
        late = self.production_order()
        very_late = self.production_order(planned_end=self.day(-9))
        on_time = self.production_order(planned_end=self.day(2))
        finished = self.production_order(status='Completed')
        items = self.items()
        entry = items[f'production-delayed:{late.pk}']
        self.assertIn('3 days past its planned end', entry['message'])
        self.assertEqual((entry['severity'], entry['created']), ('warning', self.day(-3)))
        self.assertEqual(items[f'production-delayed:{very_late.pk}']['severity'], 'danger')
        self.assertNotIn(f'production-delayed:{on_time.pk}', items)
        self.assertNotIn(f'production-delayed:{finished.pk}', items)
        self.check_switch('production-delayed', f'production-delayed:{late.pk}')
        self.rule('production-delayed', threshold=Decimal('5'))
        self.assertNotListed(f'production-delayed:{late.pk}')

    def test_material_in_quarantine(self):
        held = self.failed_inspection()
        released = self.failed_inspection(released_at=timezone.now(), released_by=self.admin)
        passed = Inspection.objects.create(stage='Incoming', stock=make_stock(), inspector=self.keeper,
                                           inspected_on=self.today, result='Pass')
        items = self.items()
        entry = items[f'quality-quarantine:{held.pk}']
        self.assertEqual(entry['message'], f'is in quarantine after failing {held.number}')
        self.assertEqual(entry['severity'], 'danger')
        self.assertNotIn(f'quality-quarantine:{released.pk}', items)
        self.assertNotIn(f'quality-quarantine:{passed.pk}', items)
        self.check_switch('quality-quarantine', f'quality-quarantine:{held.pk}')

    def test_overdue_corrective_actions(self):
        inspection = self.failed_inspection()
        make = lambda **extra: CorrectiveAction.objects.create(   # noqa: E731
            inspection=inspection, description='Cover loads in transit', created_by=self.admin, **extra)
        overdue = make(due_date=self.day(-2))
        upcoming = make(due_date=self.day(5))
        undated = make()
        done = make(due_date=self.day(-2))
        CorrectiveAction.objects.filter(pk=done.pk).update(status='Done')
        items = self.items()
        self.assertIn('2 days overdue', items[f'quality-action-overdue:{overdue.pk}']['message'])
        for other in (upcoming, undated, done):
            self.assertNotIn(f'quality-action-overdue:{other.pk}', items)
        self.check_switch('quality-action-overdue', f'quality-action-overdue:{overdue.pk}')

    def test_open_machine_breakdowns(self):
        machine = self.machine()
        make = lambda **extra: WorkOrder.objects.create(   # noqa: E731
            machine=machine, title='Motor burnt', reported_by=self.sorter, **extra)
        broken = make(is_breakdown=True)
        repaired = make(is_breakdown=True, status='Done')
        routine = make()
        items = self.items()
        self.assertEqual(items[f'machine-breakdown:{broken.pk}']['severity'], 'danger')
        self.assertNotIn(f'machine-breakdown:{repaired.pk}', items)
        self.assertNotIn(f'machine-breakdown:{routine.pk}', items)
        self.check_switch('machine-breakdown', f'machine-breakdown:{broken.pk}')

    def test_overdue_preventive_maintenance(self):
        machine = self.machine()
        make = lambda **extra: MaintenanceSchedule.objects.create(   # noqa: E731
            machine=machine, task='Grease bearings', every_days=30, **extra)
        overdue = make(start_date=self.day(-4))
        upcoming = make(start_date=self.day(4))
        paused = make(start_date=self.day(-4), is_active=False)
        items = self.items()
        self.assertEqual(items[f'maintenance-overdue:{overdue.pk}']['message'], 'is 4 days overdue')
        self.assertNotIn(f'maintenance-overdue:{upcoming.pk}', items)
        self.assertNotIn(f'maintenance-overdue:{paused.pk}', items)
        self.check_switch('maintenance-overdue', f'maintenance-overdue:{overdue.pk}')

    def test_overdue_customer_invoices(self):
        owing = make_order(buyer_name='Ali Traders', created_by=self.admin, weight='10', price='100', status='Dispatched')
        settled = make_order(buyer_name='Paid Up', created_by=self.admin, weight='10', price='100', status='Dispatched')
        overdue = self.sales_invoice(owing, due_in=-5)
        paid = self.sales_invoice(settled, due_in=-5)
        not_due = self.sales_invoice(make_order(buyer_name='Later', created_by=self.admin, status='Dispatched'), due_in=5)
        Payment.objects.create(sales_order=settled, amount=Decimal('1000'), received_by=self.admin)
        items = self.items()
        entry = items[f'invoice-overdue:{overdue.pk}']
        self.assertEqual(entry['message'], 'from Ali Traders is 5 days overdue (Rs. 1,000 unpaid)')
        self.assertEqual((entry['severity'], entry['href'], entry['created']), ('danger', '/sales', self.day(-5)))
        self.assertNotIn(f'invoice-overdue:{paid.pk}', items)
        self.assertNotIn(f'invoice-overdue:{not_due.pk}', items)
        self.check_switch('invoice-overdue', f'invoice-overdue:{overdue.pk}')

    def test_customers_over_their_credit_limit(self):
        over = Customer.objects.create(name='Over Limit', credit_limit=Decimal('500'))
        within = Customer.objects.create(name='Within Limit', credit_limit=Decimal('5000'))
        unlimited = Customer.objects.create(name='No Limit')
        for customer in (over, within, unlimited):
            make_order(customer=customer, buyer_name=customer.name, created_by=self.admin, weight='10', price='100',
                       status='Confirmed')
        items = self.items()
        self.assertEqual(items[f'credit-limit:{over.pk}']['message'], 'owes Rs. 1,000, over the credit limit of Rs. 500')
        self.assertNotIn(f'credit-limit:{within.pk}', items)
        self.assertNotIn(f'credit-limit:{unlimited.pk}', items)
        self.check_switch('credit-limit', f'credit-limit:{over.pk}')

    def test_supplier_invoices_due_or_overdue(self):
        overdue = self.supplier_invoice(-2, 'SI-1')
        soon = self.supplier_invoice(3, 'SI-2')
        later = self.supplier_invoice(30, 'SI-3')
        paid = self.supplier_invoice(-2, 'SI-4')
        SupplierPayment.objects.create(invoice=paid, amount=Decimal('1000'), method='Cash', payment_date=self.today,
                                       paid_by=self.admin)
        part_paid = self.supplier_invoice(1, 'SI-5')
        SupplierPayment.objects.create(invoice=part_paid, amount=Decimal('400'), method='Cash',
                                       payment_date=self.today, paid_by=self.admin)
        items = self.items()
        self.assertEqual(items[f'supplier-invoice-due:{overdue.pk}']['severity'], 'danger')
        self.assertIn('2 days overdue', items[f'supplier-invoice-due:{overdue.pk}']['message'])
        self.assertEqual(items[f'supplier-invoice-due:{soon.pk}']['severity'], 'warning')
        self.assertIn('due in 3 days', items[f'supplier-invoice-due:{soon.pk}']['message'])
        self.assertIn('Rs. 600 to pay', items[f'supplier-invoice-due:{part_paid.pk}']['message'])
        self.assertNotIn(f'supplier-invoice-due:{later.pk}', items)
        self.assertNotIn(f'supplier-invoice-due:{paid.pk}', items)
        self.check_switch('supplier-invoice-due', f'supplier-invoice-due:{soon.pk}')
        self.rule('supplier-invoice-due', threshold=Decimal('45'))
        self.assertListed(f'supplier-invoice-due:{later.pk}')

    def test_documents_expired_or_expiring(self):
        category = DocumentCategory.objects.create(name='Test certificates')
        make = lambda title, expires: Document.objects.create(   # noqa: E731
            title=title, category=category, expires_on=expires, created_by=self.admin)
        expired = make('Fire certificate', self.day(-3))
        soon = make('Export licence', self.day(10))
        valid = make('Lease', self.day(200))
        forever = make('Company registration', None)
        items = self.items()
        self.assertEqual(items[f'document-expiry:{expired.pk}']['message'], 'expired 3 days ago')
        self.assertEqual(items[f'document-expiry:{expired.pk}']['severity'], 'danger')
        self.assertEqual(items[f'document-expiry:{soon.pk}']['message'], 'expires in 10 days')
        self.assertNotIn(f'document-expiry:{valid.pk}', items)
        self.assertNotIn(f'document-expiry:{forever.pk}', items)
        self.check_switch('document-expiry', f'document-expiry:{soon.pk}')
        self.rule('document-expiry', threshold=Decimal('5'))
        self.assertNotListed(f'document-expiry:{soon.pk}')

    def test_unusual_stock_adjustments(self):
        fabric = make_fabric()
        make_dried_stock(fabric, '2000')
        large = inventory.post_adjustment(fabric.pk, Decimal('-800'), 'Stock count', self.admin)
        small = inventory.post_adjustment(fabric.pk, Decimal('50'), 'Stock count', self.admin)
        old = inventory.post_adjustment(fabric.pk, Decimal('900'), 'Stock count', self.admin)
        type(old).objects.filter(pk=old.pk).update(created_at=timezone.now() - timedelta(days=20))
        items = self.items()
        self.assertIn('-800.00 kg', items[f'stock-adjustment:{large.pk}']['message'])
        self.assertNotIn(f'stock-adjustment:{small.pk}', items)
        self.assertNotIn(f'stock-adjustment:{old.pk}', items)
        self.check_switch('stock-adjustment', f'stock-adjustment:{large.pk}')
        self.rule('stock-adjustment', threshold=Decimal('1000'))
        self.assertNotListed(f'stock-adjustment:{large.pk}')

    def test_sales_returns_waiting_for_approval(self):
        waiting = self.sales_return()
        self.assertEqual(self.items()[f'sales-return-pending:{waiting.pk}']['href'], '/approvals')
        self.check_switch('sales-return-pending', f'sales-return-pending:{waiting.pk}')
        self.assertEqual(self.as_admin.post(f'/api/v1/sales/returns/{waiting.pk}/reject/', {}, format='json').status_code, 200)
        self.assertNotListed(f'sales-return-pending:{waiting.pk}')

    def test_leave_requests_waiting(self):
        leave = self.leave_request()
        entry = self.items()[f'leave-pending:{leave.pk}']
        self.assertEqual((entry['title'], entry['severity']), ('Kashif Ali', 'info'))
        self.check_switch('leave-pending', f'leave-pending:{leave.pk}')
        LeaveRequest.objects.filter(pk=leave.pk).update(status='Approved')
        self.assertNotListed(f'leave-pending:{leave.pk}')


class AudienceTests(AlertsTestCase):
    def test_a_login_is_needed(self):
        self.assertEqual(self.client.get(f'{API}/notifications/').status_code, 401)

    def test_each_role_sees_only_the_rules_sent_to_it(self):
        chemical = make_chemical(total='1000', remaining='100')
        held = self.failed_inspection()
        delayed = self.production_order()
        for client in (self.as_admin, self.as_keeper, self.as_sorter, self.as_decolorer, self.as_drier):
            self.assertListed(f'quality-quarantine:{held.pk}', client)
        for client in (self.as_admin, self.as_decolorer):
            self.assertListed(f'chemical-low:{chemical.pk}', client)
        for client in (self.as_keeper, self.as_sorter, self.as_drier):
            self.assertNotListed(f'chemical-low:{chemical.pk}', client)
        for client in (self.as_admin, self.as_sorter, self.as_decolorer, self.as_drier):
            self.assertListed(f'production-delayed:{delayed.pk}', client)
        self.assertNotListed(f'production-delayed:{delayed.pk}', self.as_keeper)
        # Taking a role off a rule hides it from that role, never from admins
        self.rule('quality-quarantine', roles=['warehouse_supervisor'])
        self.assertListed(f'quality-quarantine:{held.pk}', self.as_keeper)
        self.assertNotListed(f'quality-quarantine:{held.pk}', self.as_sorter)
        self.assertListed(f'quality-quarantine:{held.pk}')

    def test_money_and_staff_matters_reach_admins_only(self):
        order = make_order(buyer_name='Ali Traders', created_by=self.admin, weight='10', price='100', status='Dispatched')
        invoice = self.sales_invoice(order, due_in=-5)
        Customer.objects.filter(pk=order.customer_id).update(credit_limit=Decimal('100'))
        sales_return, leave = self.sales_return(), self.leave_request()
        admin_only = [f'invoice-overdue:{invoice.pk}', f'credit-limit:{order.customer_id}',
                      f'sales-return-pending:{sales_return.pk}', f'leave-pending:{leave.pk}']
        # Even a rule row that names other roles can't show them what their role can't read
        for key in ('invoice-overdue', 'credit-limit', 'sales-return-pending', 'leave-pending'):
            self.rule(key, roles=['warehouse_supervisor', 'sorting_supervisor', 'drying_supervisor'])
        seen = self.items()
        for item_id in admin_only:
            self.assertIn(item_id, seen)
        for client in (self.as_keeper, self.as_sorter, self.as_decolorer, self.as_drier):
            listed = self.items(client)
            for item_id in admin_only:
                self.assertNotIn(item_id, listed)

    def test_purchasing_alerts_can_go_to_the_warehouse_supervisor_only(self):
        req = self.requisition()
        invoice = self.supplier_invoice(2)
        ids = [f'purchase-approval:request-{req.pk}', f'supplier-invoice-due:{invoice.pk}']
        for item_id in ids:
            self.assertNotListed(item_id, self.as_keeper)
        everyone = ['warehouse_supervisor', 'sorting_supervisor', 'decolorization_supervisor', 'drying_supervisor']
        self.rule('purchase-approval', roles=everyone)
        self.rule('supplier-invoice-due', roles=everyone)
        listed = self.items(self.as_keeper)
        self.assertEqual(listed[ids[0]]['href'], '/procurement')
        self.assertIn(ids[1], listed)
        for client in (self.as_sorter, self.as_decolorer, self.as_drier):
            for item_id in ids:
                self.assertNotListed(item_id, client)

    def test_documents_follow_the_category_access(self):
        warehouse = DocumentCategory.objects.create(name='Warehouse papers', allowed_roles=['warehouse_supervisor'])
        private = DocumentCategory.objects.create(name='Board papers')
        shared = Document.objects.create(title='Weighbridge calibration', category=warehouse,
                                         expires_on=self.day(5), created_by=self.admin)
        hidden = Document.objects.create(title='Bank guarantee', category=private, expires_on=self.day(5),
                                         created_by=self.admin)
        self.assertListed(f'document-expiry:{shared.pk}')
        self.assertListed(f'document-expiry:{hidden.pk}')
        self.assertListed(f'document-expiry:{shared.pk}', self.as_keeper)
        self.assertNotListed(f'document-expiry:{hidden.pk}', self.as_keeper)
        self.assertNotListed(f'document-expiry:{shared.pk}', self.as_sorter)
        self.assertNotListed(f'document-expiry:{hidden.pk}', self.as_sorter)

    def test_old_items_escalate_and_come_first(self):
        fresh = self.failed_inspection(days_ago=1)
        old = self.failed_inspection(days_ago=6)
        make_chemical(total='1000', remaining='10')
        self.assertFalse(self.items()[f'quality-quarantine:{old.pk}']['escalated'])
        self.rule('quality-quarantine', escalate_after_days=3)
        res = self.as_sorter.get(f'{API}/notifications/')
        self.assertEqual(res.data[0]['id'], f'quality-quarantine:{old.pk}')
        self.assertTrue(res.data[0]['escalated'])
        self.assertFalse(self.items()[f'quality-quarantine:{fresh.pk}']['escalated'])
        # Most serious first, after the escalated ones
        severities = [entry['severity'] for entry in self.as_admin.get(f'{API}/notifications/').data[1:]]
        self.assertEqual(severities, sorted(severities, key=['danger', 'warning', 'info'].index))

    def test_more_records_do_not_mean_more_queries(self):
        def load():
            make_chemical(total='1000', remaining='100')
            self.failed_inspection()
            self.production_order()
            self.requisition()
            self.purchase_order()
            self.sales_return()
            self.supplier_invoice(1, f'SI-{SupplierInvoice.objects.count()}')
            order = make_order(buyer_name='Ali Traders', created_by=self.admin, status='Dispatched')
            self.sales_invoice(order, due_in=-5)
            WorkOrder.objects.create(machine=self.machine(), title='Stopped', reported_by=self.sorter, is_breakdown=True)

        def queries():
            with CaptureQueriesContext(connection) as captured:
                self.items()
            return len(captured)

        self.rule('dried-stock-low', is_enabled=True)
        load()
        once = queries()
        for _ in range(3):
            load()
        self.assertEqual(queries(), once)


class RuleSettingsTests(AlertsTestCase):
    def rule_id(self, key):
        return NotificationRule.objects.get(key=key).pk

    def patch(self, key, client=None, **body):
        return (client or self.as_admin).patch(f'{API}/rules/{self.rule_id(key)}/', body, format='json')

    def test_the_default_rules_exist(self):
        res = self.as_admin.get(f'{API}/rules/')
        self.assertEqual(res.status_code, 200)
        by_key = {rule['key']: rule for rule in res.data}
        self.assertEqual(len(by_key), 17)
        self.assertEqual(by_key['chemical-low']['threshold'], '25.00')
        self.assertEqual(by_key['chemical-low']['allowed_roles'], ['decolorization_supervisor'])
        self.assertFalse(by_key['dried-stock-low']['is_enabled'])
        self.assertEqual(by_key['leave-pending']['allowed_roles'], [])
        self.assertTrue(all(rule['send_email'] is False for rule in res.data))

    def test_only_admins_read_and_change_rules(self):
        for client in (self.as_keeper, self.as_sorter, self.as_decolorer):
            self.assertEqual(client.get(f'{API}/rules/').status_code, 403)
            self.assertEqual(self.patch('chemical-low', client, is_enabled=False).status_code, 403)
        self.assertTrue(NotificationRule.objects.get(key='chemical-low').is_enabled)

    def test_an_admin_changes_a_rule(self):
        res = self.patch('quality-quarantine', is_enabled=False, roles=['sorting_supervisor'], send_email=True,
                         escalate_after_days=2)
        self.assertEqual(res.status_code, 200, res.data)
        rule = NotificationRule.objects.get(key='quality-quarantine')
        self.assertEqual((rule.is_enabled, rule.roles, rule.send_email, rule.escalate_after_days),
                         (False, ['sorting_supervisor'], True, 2))
        res = self.patch('chemical-low', threshold='40', title='Renamed')
        self.assertEqual(res.status_code, 200, res.data)
        rule = NotificationRule.objects.get(key='chemical-low')
        self.assertEqual((rule.threshold, rule.title), (Decimal('40'), 'Low chemical stock'))
        self.assertEqual(self.patch('quality-quarantine', escalate_after_days=None).data['escalate_after_days'], None)

    def test_a_rule_cannot_go_to_a_role_without_access(self):
        res = self.patch('invoice-overdue', roles=['warehouse_supervisor'])
        self.assertEqual(res.status_code, 400)
        self.assertIn('roles', res.data)
        self.assertEqual(self.patch('chemical-low', roles=['sorting_supervisor']).status_code, 400)
        self.assertEqual(self.patch('chemical-low', roles=['manager']).status_code, 400)
        self.assertEqual(self.patch('supplier-invoice-due', roles=['warehouse_supervisor']).status_code, 200)

    def test_thresholds_are_checked(self):
        self.assertEqual(self.patch('chemical-low', threshold='-1').status_code, 400)
        self.assertEqual(self.patch('chemical-low', threshold='140').status_code, 400)
        self.assertEqual(self.patch('chemical-low', threshold=None).status_code, 400)
        self.assertEqual(self.patch('leave-pending', threshold='5').status_code, 400)
        self.assertEqual(self.patch('quality-quarantine', escalate_after_days=-2).status_code, 400)

    def test_rules_cannot_be_added_or_removed(self):
        self.assertEqual(self.as_admin.post(f'{API}/rules/', {'key': 'x', 'title': 'X'}, format='json').status_code, 405)
        self.assertEqual(self.as_admin.delete(f'{API}/rules/{self.rule_id("chemical-low")}/').status_code, 405)


class ApprovalsTests(AlertsTestCase):
    def groups(self):
        res = self.as_admin.get(f'{API}/approvals/')
        self.assertEqual(res.status_code, 200, res.data)
        return res.data, {group['kind']: group for group in res.data['groups']}

    def act(self, row, name, body=None):
        action = next(a for a in row['actions'] if a['name'] == name)
        return self.as_admin.post(f'/api/v1/{action["path"]}/', body or {}, format='json')

    def test_only_admins_open_the_inbox(self):
        for client in (self.as_keeper, self.as_sorter, self.as_decolorer, self.as_drier):
            self.assertEqual(client.get(f'{API}/approvals/').status_code, 403)
        self.assertEqual(self.client.get(f'{API}/approvals/').status_code, 401)

    def test_an_empty_inbox(self):
        data, groups = self.groups()
        self.assertEqual((data['total'], data['oldest_days']), (0, None))
        self.assertEqual(list(groups), ['requisition', 'purchase_order', 'quarantine', 'production_order',
                                        'sales_return', 'decolorization_batch', 'leave'])
        self.assertTrue(all(group['count'] == 0 and group['items'] == [] for group in groups.values()))

    def test_every_kind_is_listed_with_what_the_page_needs(self):
        req, order = self.requisition(), self.purchase_order()
        held = self.failed_inspection(days_ago=4)
        draft = self.production_order()
        self.production_order(status='Released')
        sales_return, leave = self.sales_return(), self.leave_request()
        batch = make_decolor_session(supervisor=self.decolorer, status='Completed', output_quantity=Decimal('90'))
        make_decolor_session(supervisor=self.decolorer)                      # still running
        make_decolor_session(supervisor=self.decolorer, status='Completed', approved_at=timezone.now(),
                             approved_by=self.admin)
        data, groups = self.groups()
        self.assertEqual((data['total'], data['oldest_days']), (7, 4))
        self.assertTrue(all(group['count'] == 1 for group in groups.values()))

        row = groups['requisition']['items'][0]
        self.assertEqual((row['id'], row['number'], row['title'], row['weight'], row['requested_by']),
                         (req.pk, req.number, 'Cotton waste', '800.00', self.keeper.username))
        self.assertEqual([(a['name'], a['reason_field'], a['reason_required']) for a in row['actions']],
                         [('approve', None, False), ('reject', 'reason', True)])
        row = groups['purchase_order']['items'][0]
        self.assertEqual((row['id'], row['amount'], row['weight']), (order.pk, '5000.00', '100.00'))
        self.assertEqual([a['name'] for a in row['actions']], ['approve'])
        row = groups['quarantine']['items'][0]
        self.assertEqual((row['id'], row['age_days'], row['date']), (held.pk, 4, str(self.day(-4))))
        self.assertEqual([(a['name'], a['reason_field'], a['reason_required']) for a in row['actions']],
                         [('release', 'note', True)])
        row = groups['production_order']['items'][0]
        self.assertEqual((row['id'], row['weight'], row['href']), (draft.pk, '500.00', '/production'))
        row = groups['sales_return']['items'][0]
        self.assertEqual((row['id'], row['amount'], row['weight']), (sales_return.pk, '4000.00', '20.00'))
        row = groups['decolorization_batch']['items'][0]
        self.assertEqual((row['id'], row['weight'], row['requested_by']), (batch.pk, '90.00', self.decolorer.username))
        row = groups['leave']['items'][0]
        self.assertEqual((row['id'], row['title'], row['amount']), (leave.pk, 'Kashif Ali', None))
        self.assertEqual([(a['name'], a['reason_field'], a['reason_required']) for a in row['actions']],
                         [('approve', 'note', False), ('reject', 'note', False)])

    def test_the_listed_actions_are_the_modules_own_endpoints(self):
        self.requisition()
        self.purchase_order()
        self.failed_inspection()
        self.sales_return()
        self.leave_request()
        make_decolor_session(supervisor=self.decolorer, status='Completed')
        _, groups = self.groups()
        row = lambda kind: groups[kind]['items'][0]   # noqa: E731

        # The module's own rules still apply: a reason where it asks for one
        self.assertEqual(self.act(row('requisition'), 'reject').status_code, 400)
        self.assertEqual(self.act(row('requisition'), 'reject', {'reason': 'Too much stock'}).status_code, 200)
        self.assertEqual(self.act(row('purchase_order'), 'approve').status_code, 200)
        self.assertEqual(self.act(row('quarantine'), 'release').status_code, 400)
        self.assertEqual(self.act(row('quarantine'), 'release', {'note': 'Dried and re-tested'}).status_code, 200)
        self.assertEqual(self.act(row('sales_return'), 'approve').status_code, 200)
        self.assertEqual(self.act(row('decolorization_batch'), 'approve').status_code, 200)
        self.assertEqual(self.act(row('leave'), 'reject', {'note': 'Short of staff'}).status_code, 200)
        data, _ = self.groups()
        self.assertEqual(data['total'], 0)

    def test_a_production_order_is_released_from_the_inbox(self):
        res = self.as_admin.post('/api/v1/production/orders/', {
            'product_name': 'Recycled cotton', 'fabric': make_fabric().pk,
            'routing': Routing.objects.filter(steps__isnull=False).first().pk,
            'planned_input_kg': '500', 'planned_output_kg': '400',
            'planned_start': str(self.today), 'planned_end': str(self.day(5)),
        }, format='json')
        self.assertEqual(res.status_code, 201, res.data)
        _, groups = self.groups()
        row = groups['production_order']['items'][0]
        self.assertEqual(row['id'], res.data['id'])
        self.assertEqual(self.act(row, 'release').status_code, 200)
        self.assertEqual(self.groups()[1]['production_order']['count'], 0)


@override_settings(EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend')
class DigestTests(AlertsTestCase):
    def setUp(self):
        super().setUp()
        self.chemical = make_chemical(total='1000', remaining='100', chemical_name='Caustic soda')
        self.held = self.failed_inspection(days_ago=6)

    @override_settings(MANAGEMENT_EMAIL='manager@example.com')
    def test_the_digest_lists_the_rules_marked_for_email(self):
        self.rule('chemical-low', send_email=True)
        self.rule('quality-quarantine', send_email=True, escalate_after_days=3)
        self.rule('leave-pending', send_email=True)             # nothing waiting: no section
        call_command('send_alert_digest', stdout=StringIO())
        self.assertEqual(len(mail.outbox), 1)
        message = mail.outbox[0]
        self.assertEqual(message.to, ['manager@example.com'])
        self.assertEqual(message.subject, '[ERP] 2 item(s) need attention')
        self.assertIn('Caustic soda is below 25% (100 Liters left)', message.body)
        self.assertIn(f'[ESCALATED] Cotton (delivery #{self.held.stock_id})', message.body)
        self.assertNotIn('Leave requests', message.body)
        self.assertEqual(message.alternatives[0][1], 'text/html')

    @override_settings(MANAGEMENT_EMAIL='manager@example.com')
    def test_rules_not_marked_for_email_or_switched_off_are_left_out(self):
        call_command('send_alert_digest', stdout=StringIO())
        self.assertEqual(len(mail.outbox), 0)
        self.rule('chemical-low', send_email=True, is_enabled=False)
        call_command('send_alert_digest', stdout=StringIO())
        self.assertEqual(len(mail.outbox), 0)

    @override_settings(MANAGEMENT_EMAIL='')
    def test_nothing_is_sent_without_a_recipient(self):
        self.rule('chemical-low', send_email=True)
        call_command('send_alert_digest', stdout=StringIO())
        self.assertEqual(len(mail.outbox), 0)

    @override_settings(MANAGEMENT_EMAIL='manager@example.com')
    def test_saving_records_sends_no_alert_email(self):
        self.rule('chemical-low', send_email=True)
        make_chemical(total='1000', remaining='10')
        self.failed_inspection()
        self.as_admin.get(f'{API}/notifications/')
        self.assertEqual(len(mail.outbox), 0)
