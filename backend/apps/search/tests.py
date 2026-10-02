from datetime import date
from decimal import Decimal

from rest_framework.test import APITestCase

from apps.core.testing import (
    client_for, make_chemical, make_decolor_session, make_drying_session, make_fabric, make_order,
    make_sorting_session, make_stock, make_tank, make_user,
)
from apps.decolorization.models import ChemicalIssuance
from apps.documents.models import Document, DocumentCategory
from apps.maintenance.models import Machine, WorkOrder
from apps.procurement.models import PurchaseOrder, PurchaseOrderLine, PurchaseRequisition
from apps.production.models import OrderStep, ProcessStage, ProductionOrder, Routing
from apps.quality.models import CorrectiveAction, Inspection
from apps.sales.models import Customer, DispatchTracking, SalesInvoice, SalesQuotation, SalesReturn
from apps.warehouse.models import Vendor
from apps.workforce.models import Department, Employee, JobRole
from .finder import parse_number

SEARCH = '/api/search/'
TRACE = '/api/search/trace/'
TODAY = date(2026, 1, 15)


class SearchTestCase(APITestCase):
    def setUp(self):
        self.admin = make_user('admin')
        self.keeper = make_user('warehouse_supervisor')
        self.sorter = make_user('sorting_supervisor')
        self.decolorer = make_user('decolorization_supervisor')
        self.dryer_user = make_user('drying_supervisor')
        self.as_admin = client_for(self.admin)
        self.as_keeper = client_for(self.keeper)
        self.as_sorter = client_for(self.sorter)
        self.as_decolorer = client_for(self.decolorer)
        self.as_dryer = client_for(self.dryer_user)

    def find(self, client, q, **params):
        res = client.get(SEARCH, {'q': q, **params})
        self.assertEqual(res.status_code, 200, res.data)
        return {group['type']: group['results'] for group in res.data['groups']}

    def production_order(self, fabric, **kwargs):
        routing, _ = Routing.objects.get_or_create(name='Search test routing')
        kwargs.setdefault('product_name', 'Zephyr recycled fibre')
        return ProductionOrder.objects.create(
            fabric=fabric, routing=routing, planned_input_kg=Decimal('500'), planned_output_kg=Decimal('400'),
            planned_start=TODAY, planned_end=TODAY, created_by=self.admin, **kwargs)


class SearchTests(SearchTestCase):
    """Every record is named with "Zephyr", so one query reaches every group."""

    def setUp(self):
        super().setUp()
        self.vendor = Vendor.objects.create(name='Zephyr Textiles', category='Textile waste')
        self.stock = make_stock(vendor=self.vendor, fabric_type='Zephyr denim', vehicle_no='ZEP-77')
        self.fabric = make_fabric(stock=self.stock, material_type='Zephyr cotton')
        self.customer = Customer.objects.create(name='Zephyr Traders')
        self.requisition = PurchaseRequisition.objects.create(requested_by=self.keeper)
        self.po = PurchaseOrder.objects.create(vendor=self.vendor, order_date=TODAY, created_by=self.keeper)
        self.order = make_order(fabric=self.fabric, created_by=self.admin, buyer_name='Zephyr Traders')
        self.quotation = SalesQuotation.objects.create(
            customer=self.customer, fabric_quality='A', weight=Decimal('10'), price_per_kg=Decimal('100'),
            created_by=self.admin)
        self.invoice = SalesInvoice.objects.create(
            order=self.order, invoice_date=TODAY, due_date=TODAY, weight=Decimal('10'), price_per_kg=Decimal('100'),
            subtotal=Decimal('1000'), total=Decimal('1000'), created_by=self.admin)
        self.sales_return = SalesReturn.objects.create(
            order=self.order, return_date=TODAY, weight=Decimal('1'), reason='Damp', created_by=self.admin)
        self.mo = self.production_order(self.fabric)
        self.inspection = Inspection.objects.create(
            stage='In-process', fabric=self.fabric, inspector=self.sorter, inspected_on=TODAY, result='Pass')
        self.chemical = make_chemical(chemical_name='Zephyr bleach')
        self.machine = Machine.objects.create(code='ZEP-01', name='Zephyr shredder')
        self.work_order = WorkOrder.objects.create(machine=self.machine, title='Zephyr belt worn', reported_by=self.sorter)
        department = Department.objects.create(name='Sorting floor')
        self.employee = Employee.objects.create(
            full_name='Zephyr Khan', department=department,
            job_role=JobRole.objects.create(title='Sorter', department=department), joined_on=TODAY)
        open_category = DocumentCategory.objects.create(name='Search open', allowed_roles=['sorting_supervisor'])
        closed_category = DocumentCategory.objects.create(name='Search closed', allowed_roles=[])
        self.open_document = Document.objects.create(title='Zephyr test report', category=open_category,
                                                     created_by=self.admin)
        self.closed_document = Document.objects.create(title='Zephyr contract', category=closed_category,
                                                       created_by=self.admin)

    def test_the_admin_finds_every_kind_of_record(self):
        groups = self.find(self.as_admin, 'zephyr')
        self.assertEqual(set(groups), {
            'lots', 'deliveries', 'suppliers', 'customers', 'purchase_orders', 'sales_orders', 'quotations',
            'invoices', 'returns', 'production_orders', 'chemicals', 'machines', 'work_orders', 'employees',
            'documents',
        })
        lot = groups['lots'][0]
        self.assertEqual(set(lot), {'type', 'id', 'label', 'detail', 'href', 'lot'})
        self.assertEqual(lot['id'], self.fabric.pk)
        self.assertEqual(lot['href'], f'/traceability?lot={self.fabric.pk}')
        self.assertIn('Zephyr cotton', lot['label'])
        self.assertIn('Zephyr Textiles', lot['detail'])
        self.assertEqual(groups['suppliers'][0]['href'], '/procurement')
        self.assertEqual(groups['customers'][0]['label'], 'Zephyr Traders')
        self.assertEqual(groups['sales_orders'][0]['href'], '/sales')
        self.assertEqual(groups['purchase_orders'][0]['label'], self.po.number)
        self.assertEqual(groups['invoices'][0]['label'], self.invoice.number)
        self.assertEqual(groups['employees'][0]['href'], '/workforce')
        self.assertEqual(len(groups['documents']), 2)

    def test_numbers_find_their_record(self):
        cases = [
            (self.po.number, 'purchase_orders', self.po.pk),
            (f'po-{self.po.pk}', 'purchase_orders', self.po.pk),
            (self.requisition.number, 'requisitions', self.requisition.pk),
            (f'PR-{self.requisition.pk}', 'requisitions', self.requisition.pk),
            (f'INV-{self.invoice.pk}', 'invoices', self.invoice.pk),
            (f'QT-{self.quotation.pk}', 'quotations', self.quotation.pk),
            (f'SR-{self.sales_return.pk}', 'returns', self.sales_return.pk),
            (f'MO-{self.mo.pk}', 'production_orders', self.mo.pk),
            (f'QC-{self.inspection.pk}', 'inspections', self.inspection.pk),
            (self.work_order.number, 'work_orders', self.work_order.pk),
            (f'WO-{self.work_order.pk}', 'work_orders', self.work_order.pk),
            (f'EMP-{self.employee.pk}', 'employees', self.employee.pk),
            (f'DOC-{self.open_document.pk}', 'documents', self.open_document.pk),
            (f'#{self.order.pk}', 'sales_orders', self.order.pk),
            (f'#{self.fabric.pk}', 'lots', self.fabric.pk),
            (f'#{self.stock.pk}', 'deliveries', self.stock.pk),
        ]
        for query, group, pk in cases:
            with self.subTest(query=query):
                groups = self.find(self.as_admin, query)
                self.assertIn(group, groups)
                self.assertEqual(groups[group][0]['id'], pk)

    def test_a_prefix_only_looks_in_its_own_kind_of_record(self):
        groups = self.find(self.as_admin, f'INV-{self.invoice.pk}')
        self.assertEqual(list(groups), ['invoices'])

    def test_how_a_number_is_read(self):
        self.assertEqual(parse_number('PO-00012'), ('PO', 12))
        self.assertEqual(parse_number('inv-3'), ('INV', 3))
        self.assertEqual(parse_number('#15'), ('', 15))
        self.assertEqual(parse_number('15'), ('', 15))
        self.assertEqual(parse_number('WO 4'), ('WO', 4))
        self.assertEqual(parse_number('cotton'), (None, None))
        self.assertEqual(parse_number('B12 mix'), (None, None))

    def test_short_queries_find_nothing(self):
        for query in ('', 'z', ' z '):
            res = self.as_admin.get(SEARCH, {'q': query})
            self.assertEqual(res.status_code, 200)
            self.assertEqual(res.data['groups'], [])
            self.assertEqual(res.data['total'], 0)

    def test_a_group_holds_at_most_six(self):
        for n in range(8):
            Vendor.objects.create(name=f'Zephyr branch {n}')
        self.assertEqual(len(self.find(self.as_admin, 'zephyr')['suppliers']), 6)

    def test_a_warehouse_supervisor_sees_warehouse_and_purchasing_only(self):
        groups = self.find(self.as_keeper, 'zephyr')
        self.assertEqual(set(groups), {'lots', 'deliveries', 'suppliers', 'purchase_orders', 'machines', 'work_orders'})
        self.assertIn('requisitions', self.find(self.as_keeper, self.requisition.number))

    def test_a_sorting_supervisor_sees_the_floor_only(self):
        groups = self.find(self.as_sorter, 'zephyr')
        self.assertEqual(set(groups), {'lots', 'production_orders', 'machines', 'work_orders', 'documents'})
        # Documents follow the documents app's own category rule
        self.assertEqual([d['id'] for d in groups['documents']], [self.open_document.pk])
        self.assertIn('inspections', self.find(self.as_sorter, self.inspection.number))

    def test_a_decolorization_supervisor_also_finds_chemicals(self):
        groups = self.find(self.as_decolorer, 'zephyr')
        self.assertEqual(set(groups), {'lots', 'production_orders', 'chemicals', 'machines', 'work_orders'})

    def test_customers_sales_and_employees_never_reach_another_role(self):
        private = {'customers', 'sales_orders', 'quotations', 'invoices', 'returns', 'employees'}
        queries = ['zephyr', 'Zephyr Traders', 'Zephyr Khan', self.invoice.number, f'INV-{self.invoice.pk}',
                   f'#{self.order.pk}', self.employee.number, f'EMP-{self.employee.pk}', self.quotation.number,
                   self.sales_return.number]
        for client in (self.as_keeper, self.as_sorter, self.as_decolorer, self.as_dryer):
            for query in queries:
                for scope in ({}, {'scope': 'lots'}):
                    with self.subTest(query=query, scope=scope):
                        res = client.get(SEARCH, {'q': query, **scope})
                        self.assertEqual(res.status_code, 200)
                        self.assertFalse(private & {g['type'] for g in res.data['groups']})
                        self.assertNotIn('Traders', str(res.data['groups']))
                        self.assertNotIn('Khan', str(res.data['groups']))

    def test_search_needs_a_login(self):
        self.assertIn(self.client.get(SEARCH, {'q': 'zephyr'}).status_code, (401, 403))
        self.assertIn(self.client.get(TRACE, {'lot': self.fabric.pk}).status_code, (401, 403))

    def test_picking_a_lot_returns_only_things_that_lead_to_a_lot(self):
        line = PurchaseOrderLine.objects.create(order=self.po, material='Denim', quantity_kg=Decimal('1000'),
                                                unit_price=Decimal('40'))
        self.stock.po_line = line
        self.stock.save()
        target = f'/traceability?lot={self.fabric.pk}'

        groups = self.find(self.as_admin, 'zephyr', scope='lots')
        self.assertEqual(set(groups), {'lots', 'production_orders', 'sales_orders', 'invoices'})
        for results in groups.values():
            for result in results:
                self.assertEqual((result['lot'], result['href']), (self.fabric.pk, target))

        self.assertEqual(self.find(self.as_admin, self.po.number, scope='lots')['purchase_orders'][0]['lot'], self.fabric.pk)
        self.assertEqual(self.find(self.as_keeper, self.po.number, scope='lots')['purchase_orders'][0]['href'], target)
        self.assertEqual(self.find(self.as_sorter, self.po.number, scope='lots'), {})
        self.assertEqual(self.find(self.as_sorter, 'ZEP-77', scope='lots')['deliveries'][0]['lot'], self.fabric.pk)
        self.assertEqual(self.find(self.as_admin, self.invoice.number, scope='lots')['invoices'][0]['lot'], self.fabric.pk)

    def test_the_number_of_queries_does_not_grow_with_the_results(self):
        with self.assertNumQueries(17):
            self.find(self.as_admin, 'zephyr')
        for n in range(5):
            make_fabric(stock=self.stock, material_type=f'Zephyr blend {n}')
            Customer.objects.create(name=f'Zephyr buyer {n}')
        with self.assertNumQueries(17):
            self.find(self.as_admin, 'zephyr')


class TraceTests(SearchTestCase):
    """One lot taken from delivery through sorting, decolorization and drying to a sale."""

    def setUp(self):
        super().setUp()
        self.vendor = Vendor.objects.create(name='Malik Enterprises')
        self.po = PurchaseOrder.objects.create(vendor=self.vendor, order_date=TODAY, created_by=self.keeper)
        line = PurchaseOrderLine.objects.create(order=self.po, material='Cotton', quantity_kg=Decimal('1000'),
                                                unit_price=Decimal('40'))
        self.stock = make_stock(vendor=self.vendor, po_line=line, vehicle_no='LHR-900')
        self.fabric = make_fabric('500', stock=self.stock)
        self.incoming = Inspection.objects.create(
            stage='Incoming', stock=self.stock, inspector=self.keeper, inspected_on=TODAY, result='Pass')

        make_sorting_session(fabric=self.fabric, supervisor=self.sorter, quantity_taken=Decimal('500'),
                             quantity_sorted=Decimal('450'), waste_quantity=Decimal('50'), status='Completed')
        tank = make_tank()
        self.decolor = make_decolor_session(
            tank=tank, fabric=self.fabric, supervisor=self.decolorer, input_quantity=Decimal('450'),
            output_quantity=Decimal('420'), waste_quantity=Decimal('30'), status='Completed')
        ChemicalIssuance.objects.create(
            chemical=make_chemical(chemical_name='Peroxide'), tank=tank, issued_by=self.decolorer,
            quantity=Decimal('10'), session=self.decolor, unit_cost=Decimal('25'))
        make_drying_session(
            fabric=self.fabric, supervisor=self.dryer_user, input_quantity=Decimal('420'),
            output_quantity=Decimal('400'), waste_quantity=Decimal('5'), status='Completed',
            temperature_celsius=Decimal('80'), duration_minutes=60)

        self.mo = self.production_order(self.fabric, status='In Progress')
        OrderStep.objects.create(
            order=self.mo, stage=ProcessStage.objects.create(name='Search test stage'), sequence=1, status='Done',
            actual_hours=Decimal('2'), hourly_cost=Decimal('100'), input_kg=Decimal('500'),
            output_kg=Decimal('450'), waste_kg=Decimal('50'))
        self.finished = Inspection.objects.create(
            stage='Finished', fabric=self.fabric, inspector=self.dryer_user, inspected_on=TODAY, result='Conditional')
        CorrectiveAction.objects.create(inspection=self.finished, description='Re-dry the top bales',
                                        created_by=self.dryer_user)

        self.order = make_order(fabric=self.fabric, created_by=self.admin, weight='100', price='50',
                                buyer_name='Ali Traders', status='Confirmed')
        self.dispatch = DispatchTracking.objects.create(
            sales_order=self.order, vehicle_number='KHI-12', dispatched_weight=Decimal('60'),
            dispatched_by=self.admin)
        self.invoice = SalesInvoice.objects.create(
            order=self.order, invoice_date=TODAY, due_date=TODAY, weight=Decimal('60'), price_per_kg=Decimal('50'),
            subtotal=Decimal('3000'), total=Decimal('3000'), created_by=self.admin)
        self.sales_return = SalesReturn.objects.create(
            order=self.order, return_date=TODAY, weight=Decimal('10'), reason='Damp', restock=True,
            status='Approved', created_by=self.admin)
        make_order(fabric=self.fabric, created_by=self.admin, weight='30', buyer_name='Draft Buyer')   # a draft

    def trace(self, client=None, **params):
        res = (client or self.as_admin).get(TRACE, params or {'lot': self.fabric.pk})
        self.assertEqual(res.status_code, 200, res.data)
        return res.data

    def test_the_admin_sees_the_whole_chain(self):
        data = self.trace()
        self.assertEqual(data['lot_id'], self.fabric.pk)
        self.assertEqual(data['matches'], [])

        delivery = data['source']['delivery']
        self.assertEqual((delivery['supplier'], delivery['vehicle_no']), ('Malik Enterprises', 'LHR-900'))
        self.assertEqual((delivery['our_weight'], delivery['unloading_weight']), ('1000.00', '990.00'))
        self.assertEqual(data['source']['purchase_order']['number'], self.po.number)
        self.assertEqual(data['source']['purchase_order']['unit_price'], '40.00')
        self.assertEqual([i['number'] for i in data['source']['inspections']], [self.incoming.number])

        self.assertEqual(data['lot']['initial_quantity'], '500.00')
        self.assertFalse(data['lot']['quarantined'])

        sorting = data['sorting']
        self.assertEqual((sorting['taken'], sorting['sorted'], sorting['waste']), ('500.00', '450.00', '50.00'))
        self.assertEqual(sorting['sessions'][0]['supervisor'], self.sorter.username)

        session = data['decolorization']['sessions'][0]
        self.assertEqual((session['input_quantity'], session['output_quantity'], session['waste_quantity']),
                         ('450.00', '420.00', '30.00'))
        self.assertEqual(session['chemicals'][0]['chemical'], 'Peroxide')
        self.assertEqual((session['chemicals'][0]['quantity'], session['chemicals'][0]['cost']), ('10.00', '250.00'))
        self.assertEqual(data['decolorization']['chemical_cost'], '250.00')

        drying = data['drying']['sessions'][0]
        self.assertEqual((drying['output_quantity'], drying['temperature_celsius'], drying['duration_minutes']),
                         ('400.00', '80.0', 60))

        order = data['production']['orders'][0]
        self.assertEqual((order['number'], order['status'], order['total_cost']), (self.mo.number, 'In Progress', '200.00'))
        self.assertEqual(order['steps'][0]['stage'], 'Search test stage')
        self.assertEqual(order['steps'][0]['output_kg'], '450.00')

        inspections = data['quality']['inspections']
        self.assertEqual([i['number'] for i in inspections], [self.finished.number])
        self.assertEqual(inspections[0]['actions'][0]['description'], 'Re-dry the top bales')

        stock = data['stock']
        self.assertEqual((stock['on_hand'], stock['reserved'], stock['available']), ('350.00', '40.00', '310.00'))
        self.assertEqual([(m['movement_type'], m['quantity']) for m in stock['movements']],
                         [('DRYING_OUTPUT', '400.00'), ('DISPATCH', '-60.00'), ('SALES_RETURN', '10.00')])

        sale = data['sales']['orders'][0]
        self.assertEqual((sale['customer'], sale['weight_sold'], sale['status']), ('Ali Traders', '100.00', 'Confirmed'))
        self.assertEqual(sale['dispatches'][0]['challan_number'], f'DC-{self.dispatch.pk:05d}')
        self.assertEqual(sale['dispatches'][0]['vehicle_number'], 'KHI-12')
        self.assertEqual(sale['invoices'][0]['number'], self.invoice.number)
        self.assertEqual(sale['returns'][0]['number'], self.sales_return.number)
        self.assertEqual(len(data['sales']['orders']), 2)

    def test_the_summary_is_worked_out_from_the_records(self):
        summary = self.trace()['summary']
        self.assertEqual(summary['weight_in'], '500.00')
        self.assertEqual(summary['sorted'], '450.00')
        self.assertEqual(summary['decolorized'], '420.00')
        self.assertEqual(summary['dried'], '400.00')
        self.assertEqual(summary['sold'], '100.00')        # the draft order is not a sale
        self.assertEqual(summary['dispatched'], '60.00')
        self.assertEqual(summary['returned'], '10.00')
        self.assertEqual(summary['waste'], {'sorting': '50.00', 'decolorization': '30.00', 'drying': '5.00',
                                            'total': '85.00'})
        self.assertEqual(summary['yield_pct'], '80.0')
        self.assertEqual(summary['chemical_cost'], '250.00')
        self.assertEqual(summary['production_cost'], '200.00')
        self.assertEqual(summary['total_cost'], '450.00')

    def test_a_new_lot_has_empty_stages(self):
        fabric = make_fabric('200')
        data = self.trace(lot=fabric.pk)
        self.assertIsNone(data['source']['purchase_order'])
        self.assertEqual(data['sorting']['sessions'], [])
        self.assertEqual(data['drying']['sessions'], [])
        self.assertEqual(data['sales']['orders'], [])
        self.assertEqual(data['stock']['on_hand'], '0.00')
        summary = data['summary']
        self.assertEqual(summary['weight_in'], '200.00')
        for key in ('sorted', 'decolorized', 'dried', 'sold', 'returned', 'yield_pct', 'total_cost'):
            self.assertIsNone(summary[key], key)
        self.assertIsNone(summary['waste']['total'])

    def test_a_failed_inspection_shows_the_quarantine(self):
        held = Inspection.objects.create(stage='In-process', fabric=self.fabric, inspector=self.sorter,
                                         inspected_on=TODAY, result='Fail', rejection_reason='Oil stains')
        lot = self.trace()['lot']
        self.assertTrue(lot['quarantined'])
        self.assertEqual(lot['quarantined_by'], held.number)

    def restricted(self, data):
        return {name for name in ('source', 'lot', 'sorting', 'decolorization', 'drying', 'production', 'quality',
                                  'stock', 'sales') if data[name] == {'restricted': True}}

    def test_a_sorting_supervisor_sees_no_sales_drying_or_purchase_order(self):
        data = self.trace(self.as_sorter)
        self.assertEqual(self.restricted(data), {'drying', 'sales'})
        self.assertEqual(data['source']['purchase_order'], {'restricted': True})
        self.assertEqual(data['source']['delivery']['supplier'], 'Malik Enterprises')
        self.assertEqual(data['sorting']['sorted'], '450.00')
        summary = data['summary']
        self.assertEqual(summary['dried'], '400.00')      # from the stock ledger, which every role reads
        self.assertIsNone(summary['waste']['drying'])
        self.assertEqual(summary['waste']['total'], '80.00')
        for key in ('sold', 'dispatched', 'returned'):
            self.assertIsNone(summary[key], key)
        for private in ('Ali Traders', 'Draft Buyer', 'KHI-12', self.invoice.number, self.po.number):
            self.assertNotIn(private, str(data))

    def test_a_warehouse_supervisor_sees_the_purchase_order_but_no_sales(self):
        data = self.trace(self.as_keeper)
        self.assertEqual(self.restricted(data), {'drying', 'sales'})
        self.assertEqual(data['source']['purchase_order']['number'], self.po.number)
        self.assertNotIn('Ali Traders', str(data))

    def test_a_drying_supervisor_sees_drying_but_no_sales(self):
        data = self.trace(self.as_dryer)
        self.assertEqual(self.restricted(data), {'sales'})
        self.assertEqual(data['drying']['output'], '400.00')
        self.assertEqual(data['summary']['waste']['total'], '85.00')
        self.assertEqual(data['source']['purchase_order'], {'restricted': True})
        self.assertNotIn('Ali Traders', str(data))

    def test_a_sales_order_leads_to_its_lot_for_admins_only(self):
        self.assertEqual(self.trace(order=self.order.pk)['lot_id'], self.fabric.pk)
        for client in (self.as_keeper, self.as_sorter, self.as_dryer):
            self.assertEqual(client.get(TRACE, {'order': self.order.pk}).status_code, 403)

    def test_a_delivery_leads_to_its_lots(self):
        self.assertEqual(self.trace(stock=self.stock.pk)['lot_id'], self.fabric.pk)
        second = make_fabric('100', stock=self.stock, material_type='Denim')
        data = self.trace(self.as_sorter, stock=self.stock.pk)
        self.assertEqual(data['lot_id'], self.fabric.pk)
        self.assertEqual([m['id'] for m in data['matches']], [self.fabric.pk, second.pk])

    def test_a_production_order_leads_to_its_lot(self):
        self.assertEqual(self.trace(self.as_sorter, production=self.mo.pk)['lot_id'], self.fabric.pk)

    def test_what_cannot_be_found(self):
        self.assertEqual(self.as_admin.get(TRACE).status_code, 400)
        self.assertEqual(self.as_admin.get(TRACE, {'lot': 'abc'}).status_code, 400)
        self.assertEqual(self.as_admin.get(TRACE, {'lot': 999999}).status_code, 404)
        self.assertEqual(self.as_admin.get(TRACE, {'order': 999999}).status_code, 404)
        self.assertEqual(self.as_admin.get(TRACE, {'stock': make_stock().pk}).status_code, 404)

    def test_the_number_of_queries_does_not_grow_with_the_records(self):
        with self.assertNumQueries(26):
            self.trace()
        for _ in range(3):
            make_sorting_session(fabric=self.fabric, supervisor=self.sorter)
            session = make_decolor_session(fabric=self.fabric, supervisor=self.decolorer)
            ChemicalIssuance.objects.create(chemical=make_chemical(), tank=session.tank, issued_by=self.decolorer,
                                            quantity=Decimal('1'), session=session)
            order = make_order(fabric=self.fabric, created_by=self.admin, weight='1')
            DispatchTracking.objects.create(sales_order=order, vehicle_number='X', dispatched_weight=Decimal('1'),
                                            dispatched_by=self.admin)
        with self.assertNumQueries(26):
            self.trace()
