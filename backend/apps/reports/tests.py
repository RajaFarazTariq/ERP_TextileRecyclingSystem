from datetime import timedelta
from decimal import Decimal
from unittest import mock

from django.db import connection
from django.test import TestCase
from django.test.utils import CaptureQueriesContext
from django.utils import timezone

from apps.core.testing import (
    make_user, client_for, make_stock, make_fabric, make_sorting_session, make_order,
    make_chemical, make_drying_session, make_tank,
)
from apps.decolorization.models import ChemicalIssuance
from apps.documents.models import Document, DocumentCategory
from apps.finance.models import Account
from apps.maintenance.models import Machine, MaintenanceSchedule, WorkOrder
from apps.production.models import ProductionOrder, Routing
from apps.quality.models import CorrectiveAction, Inspection
from apps.sales.models import Payment
from apps.sustainability.models import WasteCategory, WasteRecord
from apps.warehouse.models import Vendor
from apps.workforce.models import Attendance, Department, Employee, JobRole
from . import services

XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
RUN = '/api/reports/run'
OLD = 'year=2020'    # a period with no records


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


# ─────────────────────────────────────────────────────────────────────────────
# Report centre
# ─────────────────────────────────────────────────────────────────────────────

class CentreTestCase(TestCase):
    def setUp(self):
        self.admin = make_user('admin')
        self.client = client_for(self.admin)
        self.today = timezone.localdate()
        self.now = timezone.now()

    def run_report(self, key, query=''):
        res = self.client.get(f'{RUN}/{key}/?{query}')
        self.assertEqual(res.status_code, 200, getattr(res, 'data', None))
        return res.data

    def row(self, data, **match):
        found = [r for r in data['rows'] if all(r[k] == v for k, v in match.items())]
        self.assertEqual(len(found), 1, data['rows'])
        return found[0]

    def expense(self, amount='5000'):
        res = self.client.post('/api/finance/expenses/', {
            'date': str(self.today), 'account': Account.objects.get(code='5300').id,
            'paid_from': Account.objects.get(system_key='cash').id, 'amount': amount,
            'description': 'Electricity bill'}, format='json')
        self.assertEqual(res.status_code, 201, res.data)

    def dried(self, kg='1000'):
        fabric = make_fabric()
        make_drying_session(fabric=fabric, input_quantity=Decimal(kg), output_quantity=Decimal(kg),
                            status='Completed', end_date=self.now)
        return fabric

    def production_order(self, **extra):
        data = {'product_name': 'White fibre', 'fabric': make_fabric(), 'created_by': self.admin,
                'routing': Routing.objects.get(name='Standard recycling'),
                'planned_input_kg': Decimal('500'), 'planned_output_kg': Decimal('400'),
                'planned_start': self.today, 'planned_end': self.today + timedelta(days=3), **extra}
        return ProductionOrder.objects.create(**data)


class CatalogueTests(CentreTestCase):
    def test_catalogue_lists_every_report_in_a_known_group(self):
        res = self.client.get('/api/reports/catalogue/')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(res.data['reports']), 13)
        self.assertEqual(res.data['groups'], ['Stock', 'Production', 'Quality', 'Commercial', 'Finance',
                                              'Sustainability', 'Maintenance'])
        for report in res.data['reports']:
            self.assertEqual(set(report), {'key', 'title', 'description', 'group', 'dated'})
            self.assertIn(report['group'], res.data['groups'])

    def test_every_report_has_the_table_shape_and_both_files(self):
        self.dried()
        for report in services.catalogue():
            with self.subTest(report=report['key']):
                data = self.run_report(report['key'])
                self.assertEqual(data['title'], report['title'])
                self.assertEqual(set(data['period']), {'start', 'end', 'label'})
                self.assertTrue(data['columns'] and data['notes'])
                for column in data['columns']:
                    self.assertIn(column['kind'], ('text', 'number', 'kg', 'money', 'percent', 'date'))
                keys = {c['key'] for c in data['columns']}
                for row in data['rows']:
                    self.assertLessEqual(keys, set(row))
                self.assertLessEqual(set(data['totals']), keys)

                xlsx = self.client.get(f"{RUN}/{report['key']}/?format=xlsx")
                self.assertEqual((xlsx.status_code, xlsx['Content-Type']), (200, XLSX))
                self.assertTrue(xlsx.content.startswith(b'PK'))
                self.assertIn('.xlsx"', xlsx['Content-Disposition'])
                sheet = self.client.get(f"{RUN}/{report['key']}/?format=csv&date_filter=this_year")
                self.assertEqual(sheet.status_code, 200)
                self.assertTrue(sheet['Content-Type'].startswith('text/csv'))
                self.assertIn('.csv"', sheet['Content-Disposition'])
                self.assertIn(data['columns'][0]['label'], sheet.content.decode('utf-8-sig').splitlines()[0])

    def test_unknown_report_format_and_dates(self):
        self.assertEqual(self.client.get(f'{RUN}/nothing/').status_code, 404)
        self.assertEqual(self.client.get(f'{RUN}/stock-movement/?format=pdf').status_code, 400)
        self.assertEqual(self.client.get(f'{RUN}/stock-movement/?start=bad').status_code, 400)
        self.assertEqual(self.client.get(f'{RUN}/stock-movement/?start=2026-02-01&end=2026-01-01').status_code, 400)

    def test_periods(self):
        data = self.run_report('stock-movement', 'month=2026-02')
        self.assertEqual((data['period']['start'], data['period']['end']), ('2026-02-01', '2026-02-28'))
        data = self.run_report('stock-movement', 'start=2026-01-05&end=2026-01-09')
        self.assertEqual((data['period']['start'], data['period']['end']), ('2026-01-05', '2026-01-09'))
        self.assertEqual(self.run_report('stock-movement')['period']['label'], 'All time')

    def test_admin_only(self):
        for role in ('warehouse_supervisor', 'sorting_supervisor', 'decolorization_supervisor', 'drying_supervisor'):
            client = client_for(make_user(role))
            for path in ('catalogue/', 'run/stock-movement/', 'run/profit-and-loss/?format=xlsx', 'schedules/',
                         'executive/'):
                with self.subTest(role=role, path=path):
                    self.assertEqual(client.get(f'/api/reports/{path}').status_code, 403)

    def test_schedules_are_described(self):
        res = self.client.get('/api/reports/schedules/')
        self.assertEqual(res.status_code, 200)
        self.assertFalse(res.data['automatic'])
        self.assertEqual([r['command'] for r in res.data['reports']],
                         ['python manage.py send_daily_report', 'python manage.py send_monthly_report'])


class ReportNumberTests(CentreTestCase):
    def test_inventory_valuation(self):
        fabric = self.dried('1000')
        make_order(fabric=fabric, weight='100', created_by=self.admin, status='Confirmed')
        self.expense('5000')
        data = self.run_report('inventory-valuation', 'date_filter=this_year')
        row = self.row(data, lot=f'Lot #{fabric.pk}')
        self.assertEqual((row['on_hand_kg'], row['reserved_kg'], row['available_kg']), ('1000.00', '100.00', '900.00'))
        self.assertEqual((row['cost_per_kg'], row['value']), ('5.00', '5000.00'))
        self.assertEqual(data['totals']['value'], '5000.00')
        # No dried output in the period: stock still shows, the value is empty and the notes say why
        old = self.run_report('inventory-valuation', OLD)
        row = self.row(old, lot=f'Lot #{fabric.pk}')
        self.assertEqual((row['on_hand_kg'], row['value'], old['totals']['value']), ('1000.00', None, None))
        self.assertTrue(any('value is left empty' in note for note in old['notes']))

    def test_stock_movement(self):
        fabric = self.dried('1000')
        data = self.run_report('stock-movement', 'date_filter=today')
        row = self.row(data, lot=f'Lot #{fabric.pk}')
        self.assertEqual((row['type'], row['movements'], row['in_kg'], row['out_kg'], row['net_kg']),
                         ('Drying output', 1, '1000.00', '0.00', '1000.00'))
        self.assertEqual(data['totals']['net_kg'], '1000.00')
        self.assertEqual(self.run_report('stock-movement', OLD)['rows'], [])

    def test_material_recovery(self):
        make_sorting_session(quantity_taken=Decimal('200'), quantity_sorted=Decimal('150'),
                             waste_quantity=Decimal('10'), status='Completed', end_date=self.now)
        self.dried('120')
        data = self.run_report('material-recovery', 'date_filter=this_month')
        row = self.row(data, stage='Sorting')
        self.assertEqual((row['input_kg'], row['output_kg'], row['loss_kg'], row['waste_kg'], row['yield_pct']),
                         ('200.00', '150.00', '50.00', '10.00', '75.00'))
        self.assertEqual((data['totals']['input_kg'], data['totals']['output_kg'], data['totals']['yield_pct']),
                         ('200.00', '120.00', '60.00'))
        self.assertEqual(self.row(self.run_report('material-recovery', OLD), stage='Sorting')['sessions'], 0)

    def test_sorting_performance(self):
        sorter = make_user('sorting_supervisor')
        for taken, done in (('200', '150'), ('100', '90')):
            make_sorting_session(supervisor=sorter, quantity_taken=Decimal(taken), quantity_sorted=Decimal(done),
                                 waste_quantity=Decimal('10'), status='Completed', end_date=self.now)
        make_sorting_session(supervisor=sorter)    # still running: not counted
        data = self.run_report('sorting-performance', 'date_filter=this_week')
        row = self.row(data, supervisor=sorter.username)
        self.assertEqual((row['sessions'], row['taken_kg'], row['sorted_kg'], row['waste_kg']),
                         (2, '300.00', '240.00', '20.00'))
        self.assertEqual((row['efficiency_pct'], row['waste_pct']), (80.0, 6.7))
        self.assertEqual(data['totals']['efficiency_pct'], 80.0)
        self.assertEqual(self.run_report('sorting-performance', OLD)['rows'], [])

    def test_production_efficiency(self):
        order = self.production_order()
        self.production_order(status='Cancelled')
        data = self.run_report('production-efficiency', 'date_filter=this_month')
        row = self.row(data, number=order.number)
        self.assertEqual((row['status'], row['planned_output_kg'], row['output_kg'], row['late']),
                         ('Draft', '400.00', None, ''))
        self.assertEqual(len(data['rows']), 1)
        self.assertEqual(data['totals']['planned_output_kg'], '400.00')
        self.assertEqual(self.run_report('production-efficiency', OLD)['rows'], [])

    def test_chemical_consumption(self):
        chemical = make_chemical(chemical_name='Bleach')
        ChemicalIssuance.objects.create(chemical=chemical, tank=make_tank(), issued_by=self.admin,
                                        quantity=Decimal('10'), unit_cost=Decimal('40'))
        data = self.run_report('chemical-consumption', 'date_filter=today')
        row = self.row(data, chemical='Bleach')
        self.assertEqual((row['issuances'], row['quantity'], row['cost']), (1, '10.00', '400.00'))
        self.assertEqual(data['totals']['cost'], '400.00')
        self.assertEqual(self.run_report('chemical-consumption', OLD)['rows'], [])

    def test_quality_performance(self):
        vendor = Vendor.objects.create(name='Malik Traders')
        stock = make_stock(vendor=vendor)
        for result in ('Pass', 'Fail'):
            Inspection.objects.create(stage='Incoming', stock=stock, inspector=self.admin, inspected_on=self.today,
                                      result=result)
        Inspection.objects.create(stage='Finished', fabric=make_fabric(), inspector=self.admin,
                                  inspected_on=self.today, result='Conditional')
        data = self.run_report('quality-performance', 'date_filter=this_year')
        incoming = self.row(data, group='Stage', name='Incoming material')
        self.assertEqual((incoming['inspections'], incoming['passed'], incoming['failed'], incoming['pass_pct']),
                         (2, 1, 1, 50.0))
        supplier = self.row(data, group='Supplier', name='Malik Traders')
        self.assertEqual((supplier['inspections'], supplier['failed']), (2, 1))
        self.assertEqual((data['totals']['inspections'], data['totals']['conditional'], data['totals']['pass_pct']),
                         (3, 1, 66.7))
        self.assertEqual(self.run_report('quality-performance', OLD)['totals']['inspections'], 0)

    def test_supplier_performance(self):
        vendor = Vendor.objects.create(name='Malik Traders')
        make_stock(vendor=vendor, our_weight=Decimal('800'))
        make_stock(vendor=vendor, our_weight=Decimal('200'), status='Rejected')
        data = self.run_report('supplier-performance', OLD)    # this report has no period
        row = self.row(data, supplier='Malik Traders')
        self.assertEqual((row['deliveries'], row['received_kg'], row['rejected_kg'], row['rejected_pct']),
                         (2, '800.00', '200.00', 20.0))
        self.assertEqual(data['period']['label'], 'All time')

    def test_customer_sales(self):
        make_order(weight='10', price='100', created_by=self.admin, status='Confirmed', buyer_name='Noor Mills')
        make_order(weight='5', price='200', created_by=self.admin)    # a draft is not a sale
        data = self.run_report('customer-sales', 'date_filter=this_month')
        row = self.row(data, group='Customer', name='Noor Mills')
        self.assertEqual((row['orders'], row['kg'], row['revenue'], row['average_price']),
                         (1, '10.00', '1000.00', '100.00'))
        self.assertEqual(self.row(data, group='Month')['name'], self.today.strftime('%Y-%m'))
        self.assertEqual((data['totals']['orders'], data['totals']['revenue']), (1, '1000.00'))
        self.assertEqual(self.run_report('customer-sales', OLD)['rows'], [])

    def test_production_costing_and_profit_and_loss(self):
        self.dried('1000')
        self.expense('5000')
        costing = self.run_report('production-costing', 'date_filter=this_month')
        self.assertEqual(self.row(costing, basis='Expenses')['amount'], '5000.00')
        self.assertEqual(costing['totals']['amount'], '5000.00')
        self.assertEqual({s['label']: s['value'] for s in costing['summary']}['Cost per kg'], '5.00')
        self.assertEqual(self.run_report('production-costing', OLD)['totals']['amount'], '0.00')

        pnl = self.run_report('profit-and-loss', 'date_filter=this_month')
        self.assertEqual(self.row(pnl, section='Expenses')['amount'], '5000.00')
        self.assertEqual(pnl['totals'], {'section': 'Net profit', 'amount': '-5000.00'})
        self.assertEqual(self.run_report('profit-and-loss', OLD)['rows'], [])
        self.assertEqual(self.run_report('profit-and-loss')['totals']['amount'], '-5000.00')   # all time

    def test_waste_and_sustainability(self):
        dust = WasteCategory.objects.get(name='Fibre dust')
        for kg, method in (('40', 'Landfill'), ('60', 'Sent to recycler')):
            WasteRecord.objects.create(category=dust, stage='Sorting', quantity_kg=Decimal(kg),
                                       disposal_method=method, recorded_by=self.admin)
        data = self.run_report('waste-sustainability', 'date_filter=this_month')
        row = self.row(data, group='Disposal method', name='Landfill')
        self.assertEqual((row['kg'], row['share_pct']), ('40.00', '40.00'))
        self.assertEqual(data['totals']['kg'], '100.00')
        self.assertEqual({s['label']: s['value'] for s in data['summary']}['Diverted from landfill'], '60.00')
        self.assertEqual(self.run_report('waste-sustainability', OLD)['rows'], [])

    def test_machine_utilisation(self):
        machine = Machine.objects.create(code='SH-01', name='Shredder', hourly_operating_cost=Decimal('500'))
        WorkOrder.objects.create(machine=machine, title='Belt snapped', reported_by=self.admin, is_breakdown=True,
                                 downtime_minutes=120)
        data = self.run_report('machine-utilisation', 'date_filter=today')
        row = self.row(data, code='SH-01')
        self.assertEqual((row['breakdowns'], row['downtime_hours'], row['downtime_cost']), (1, '2.00', '1000.00'))
        self.assertEqual(row['availability_pct'], 91.7)     # 22 of 24 hours
        self.assertEqual(data['totals']['downtime_hours'], '2.00')
        self.assertEqual((data['period']['start'], data['period']['end']), (str(self.today), str(self.today)))
        earlier = self.today - timedelta(days=40)
        old = self.run_report('machine-utilisation', f'start={earlier}&end={earlier}')
        self.assertEqual(self.row(old, code='SH-01')['breakdowns'], 0)


class ExecutiveTests(CentreTestCase):
    def test_figures_of_every_module(self):
        self.expense('5000')
        fabric = self.dried('1000')
        make_order(fabric=fabric, weight='10', price='100', created_by=self.admin, status='Confirmed')
        self.production_order(status='In Progress', planned_start=self.today - timedelta(days=9),
                              planned_end=self.today - timedelta(days=2))
        failed = Inspection.objects.create(stage='Finished', fabric=fabric, inspector=self.admin,
                                           inspected_on=self.today, result='Fail')
        CorrectiveAction.objects.create(inspection=failed, description='Re-dry the lot', created_by=self.admin,
                                        due_date=self.today - timedelta(days=1))
        machine = Machine.objects.create(code='SH-01', name='Shredder', status='Broken down')
        MaintenanceSchedule.objects.create(machine=machine, task='Grease', every_days=30,
                                           start_date=self.today - timedelta(days=5))
        category = DocumentCategory.objects.create(name='Test licences')
        Document.objects.create(title='Old licence', category=category, created_by=self.admin,
                                expires_on=self.today - timedelta(days=1))
        Document.objects.create(title='Fire certificate', category=category, created_by=self.admin,
                                expires_on=self.today + timedelta(days=3))
        department = Department.objects.create(name='Sorting floor')
        role = JobRole.objects.create(title='Sorter')
        for name, status in (('Ali Raza', 'Present'), ('Sara Khan', 'Late')):
            employee = Employee.objects.create(full_name=name, department=department, job_role=role,
                                               joined_on=self.today - timedelta(days=90))
            Attendance.objects.create(employee=employee, date=self.today, status=status)
        WasteRecord.objects.create(category=WasteCategory.objects.get(name='Fibre dust'), stage='Sorting',
                                   quantity_kg=Decimal('40'), disposal_method='Landfill', recorded_by=self.admin)

        res = self.client.get('/api/reports/executive/')
        self.assertEqual(res.status_code, 200)
        d = res.data
        self.assertEqual(d['as_of'], str(self.today))
        self.assertEqual((d['finance']['cash'], d['finance']['profit_month'], d['finance']['payable']),
                         ('-5000.00', '-5000.00', '0.00'))
        self.assertEqual((d['sales']['open_orders'], d['sales']['open_order_value'], d['sales']['overdue_invoices']),
                         (1, '1000.00', 0))
        self.assertEqual(d['procurement'], {'pending_orders': 0, 'awaiting_approval': 0, 'awaiting_delivery': 0,
                                            'late_orders': 0})
        self.assertEqual(d['production'], {'in_progress': 1, 'late': 1})
        self.assertEqual(d['quality'], {'quarantined': 1, 'open_actions': 1, 'overdue_actions': 1})
        self.assertEqual(d['maintenance'], {'broken_down': 1, 'overdue_schedules': 1})
        self.assertEqual((d['sustainability']['landfill_kg'], d['sustainability']['recovery_pct']), ('40.00', None))
        self.assertEqual((d['documents']['expired'], d['documents']['expiring_soon']), (1, 1))
        self.assertEqual((d['workforce']['present_today'], d['workforce']['on_leave_today']), (2, 0))

    def test_one_failing_module_leaves_the_rest(self):
        def broken(user, today):
            raise RuntimeError('boom')
        with mock.patch.dict(services.EXECUTIVE_BLOCKS, {'finance': broken}), self.assertLogs(services.logger):
            res = self.client.get('/api/reports/executive/')
        self.assertEqual(res.status_code, 200)
        self.assertIsNone(res.data['finance'])
        self.assertEqual(res.data['production'], {'in_progress': 0, 'late': 0})

    def test_queries_do_not_grow_with_the_records(self):
        def count():
            with CaptureQueriesContext(connection) as queries:
                self.assertEqual(self.client.get('/api/reports/executive/').status_code, 200)
            return len(queries)

        self.production_order()
        count()                      # the first call posts the automatic finance entries
        before = count()
        for n in range(6):
            self.production_order(status='In Progress')
            Machine.objects.create(code=f'M-{n}', name='Machine', status='Broken down')
            Inspection.objects.create(stage='Finished', fabric=make_fabric(), inspector=self.admin,
                                      inspected_on=self.today, result='Fail')
        self.assertEqual(count(), before)
