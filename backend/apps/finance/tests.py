from datetime import date
from decimal import Decimal

from django.test import TestCase
from django.utils import timezone

from apps.core.testing import client_for, make_dried_stock, make_fabric, make_user
from apps.procurement.models import SupplierInvoice, SupplierPayment
from apps.sales.models import Customer
from apps.warehouse.models import Vendor
from . import services
from .models import Account, JournalEntry


def acc(key=None, code=None):
    return Account.objects.get(system_key=key) if key else Account.objects.get(code=code)


class FinanceTests(TestCase):
    def setUp(self):
        self.admin_user = make_user('admin')
        self.client = client_for(self.admin_user)
        self.today = timezone.localdate()

    def entry(self, lines, **extra):
        return self.client.post('/api/finance/journal/', {
            'date': str(self.today), 'memo': 'Test entry', 'lines': lines, **extra}, format='json')

    def capital(self, amount='100000'):
        return self.entry([{'account': acc('bank').id, 'debit': amount},
                           {'account': acc(code='3000').id, 'credit': amount}])

    def expense(self, amount='2500', **extra):
        return self.client.post('/api/finance/expenses/', {
            'date': str(self.today), 'account': acc(code='5300').id, 'paid_from': acc('cash').id,
            'amount': amount, 'description': 'Electricity bill', **extra}, format='json')

    # ── entries ──────────────────────────────────────────────────────────────
    def test_default_chart_of_accounts_exists(self):
        self.assertTrue(Account.objects.filter(system_key='receivable', type='Asset').exists())
        self.assertEqual(Account.objects.filter(is_cash=True).count(), 2)

    def test_entry_must_balance(self):
        res = self.entry([{'account': acc('bank').id, 'debit': '100'}, {'account': acc(code='3000').id, 'credit': '90'}])
        self.assertEqual(res.status_code, 400)
        self.assertIn('does not balance', str(res.data))
        self.assertEqual(self.entry([{'account': acc('bank').id, 'debit': '100'}]).status_code, 400)
        both = [{'account': acc('bank').id, 'debit': '100', 'credit': '100'}, {'account': acc(code='3000').id, 'credit': '0'}]
        self.assertEqual(self.entry(both).status_code, 400)
        self.assertFalse(JournalEntry.objects.exists())

    def test_balanced_entry_is_posted_and_numbered(self):
        res = self.capital()
        self.assertEqual(res.status_code, 201, res.data)
        self.assertTrue(res.data['number'].startswith('JV-'))
        self.assertEqual((res.data['total'], res.data['source']), ('100000.00', 'Manual'))
        accounts = {a['code']: a['balance'] for a in self.client.get('/api/finance/accounts/').data}
        self.assertEqual((accounts['1010'], accounts['3000']), ('100000.00', '100000.00'))

    def test_entries_are_reversed_not_edited(self):
        entry = self.capital().data
        url = f"/api/finance/journal/{entry['id']}/"
        self.assertEqual(self.client.patch(url, {'memo': 'x'}, format='json').status_code, 405)
        self.assertEqual(self.client.delete(url).status_code, 405)
        res = self.client.post(url + 'reverse/')
        self.assertEqual(res.status_code, 201, res.data)
        self.assertEqual(res.data['reverses_number'], entry['number'])
        self.assertEqual(self.client.post(url + 'reverse/').status_code, 400)       # only once
        tb = self.client.get('/api/finance/trial-balance/').data
        self.assertEqual((tb['rows'], tb['balanced']), ([], True))

    def test_only_admin_sees_finance(self):
        other = client_for(make_user('warehouse_supervisor'))
        for path in ('accounts/', 'journal/', 'expenses/', 'summary/', 'trial-balance/', 'balances/'):
            self.assertEqual(other.get(f'/api/finance/{path}').status_code, 403, path)

    # ── periods ──────────────────────────────────────────────────────────────
    def test_closed_period_refuses_entries(self):
        res = self.client.post('/api/finance/periods/', {
            'name': 'This month', 'start_date': str(self.today.replace(day=1)), 'end_date': str(self.today)}, format='json')
        self.assertEqual(res.status_code, 201, res.data)
        url = f"/api/finance/periods/{res.data['id']}/"
        self.assertEqual(self.client.post(url + 'close/').data['is_closed'], True)
        self.assertEqual(self.capital().status_code, 400)
        self.assertEqual(self.expense().status_code, 400)
        self.assertEqual(self.client.post(url + 'reopen/').data['is_closed'], False)
        self.assertEqual(self.capital().status_code, 201)

    def test_periods_cannot_overlap(self):
        body = {'name': 'A', 'start_date': '2026-01-01', 'end_date': '2026-03-31'}
        self.assertEqual(self.client.post('/api/finance/periods/', body, format='json').status_code, 201)
        clash = {'name': 'B', 'start_date': '2026-03-01', 'end_date': '2026-04-30'}
        self.assertEqual(self.client.post('/api/finance/periods/', clash, format='json').status_code, 400)

    # ── accounts ─────────────────────────────────────────────────────────────
    def test_accounts_in_use_are_protected(self):
        self.capital()
        bank = acc('bank')
        self.assertEqual(self.client.delete(f'/api/finance/accounts/{bank.id}/').status_code, 400)
        capital = acc(code='3000')
        self.assertEqual(self.client.delete(f'/api/finance/accounts/{capital.id}/').status_code, 400)   # has entries
        self.assertEqual(self.client.patch(f'/api/finance/accounts/{capital.id}/', {'type': 'Asset'}, format='json').status_code, 400)
        unused = acc(code='2500')
        self.assertEqual(self.client.delete(f'/api/finance/accounts/{unused.id}/').status_code, 204)
        bad = {'code': '9000', 'name': 'Odd', 'type': 'Expense', 'is_cash': True}
        self.assertEqual(self.client.post('/api/finance/accounts/', bad, format='json').status_code, 400)

    # ── expenses ─────────────────────────────────────────────────────────────
    def test_expense_posts_its_entry_and_follows_changes(self):
        res = self.expense()
        self.assertEqual(res.status_code, 201, res.data)
        entry = JournalEntry.objects.get(source='Expense', source_id=res.data['id'])
        self.assertEqual(sorted((line.account.code, line.debit, line.credit) for line in entry.lines.all()),
                         [('1000', Decimal('0'), Decimal('2500')), ('5300', Decimal('2500'), Decimal('0'))])
        url = f"/api/finance/expenses/{res.data['id']}/"
        self.client.patch(url, {'amount': '3000'}, format='json')
        self.assertEqual(self.client.get('/api/finance/profit-and-loss/').data['total_expenses'], '3000.00')
        self.assertEqual(self.client.delete(url).status_code, 204)
        self.assertFalse(JournalEntry.objects.exists())

    def test_expense_needs_the_right_kind_of_accounts(self):
        self.assertEqual(self.expense(account=acc('bank').id).status_code, 400)
        self.assertEqual(self.expense(paid_from=acc(code='5300').id).status_code, 400)
        self.assertEqual(self.expense(amount='0').status_code, 400)

    # ── postings from sales and purchasing ───────────────────────────────────
    def sale(self):
        """A dispatched, invoiced and part-paid order: 100 kg at Rs. 50 with 10% tax."""
        fabric = make_fabric()
        make_dried_stock(fabric, '1000')
        customer = Customer.objects.create(name='Ali Traders')
        order = self.client.post('/api/sales/orders/', {
            'customer': customer.id, 'fabric': fabric.id, 'fabric_quality': 'A', 'weight_sold': '100',
            'price_per_kg': '50', 'tax_pct': '10'}, format='json').data
        self.client.post(f"/api/sales/orders/{order['id']}/confirm/")
        self.client.post('/api/sales/dispatch/', {
            'sales_order': order['id'], 'vehicle_number': 'LEA-1', 'dispatched_weight': '100'}, format='json')
        self.client.post(f"/api/sales/orders/{order['id']}/invoice/", {'invoice_date': str(self.today)}, format='json')
        self.client.post('/api/sales/payments/', {'sales_order': order['id'], 'amount': '2000', 'payment_method': 'Cash'}, format='json')
        return order

    def purchase(self):
        vendor = Vendor.objects.create(name='Fibre Source')
        invoice = SupplierInvoice.objects.create(vendor=vendor, invoice_number='S-1', invoice_date=self.today,
                                                 amount=Decimal('3000'), tax_amount=Decimal('300'))
        SupplierPayment.objects.create(invoice=invoice, amount=Decimal('1300'), method='Bank Transfer',
                                       payment_date=self.today, paid_by=self.admin_user)
        return invoice

    def balances(self):
        return {a['code']: a['balance'] for a in self.client.get('/api/finance/accounts/').data}

    def test_sales_and_purchases_reach_the_books(self):
        self.sale()
        self.purchase()
        result = self.client.post('/api/finance/journal/sync/').data
        self.assertEqual((result['posted'], result['updated'], result['removed']), (4, 0, 0))
        b = self.balances()
        self.assertEqual(b['1100'], '3500.00')        # 5,500 invoiced - 2,000 paid
        self.assertEqual((b['4000'], b['2100']), ('5000.00', '500.00'))
        self.assertEqual(b['1000'], '2000.00')        # cash from the customer
        self.assertEqual((b['5000'], b['1200']), ('3000.00', '300.00'))
        self.assertEqual(b['2000'], '2000.00')        # 3,300 invoiced - 1,300 paid
        self.assertEqual(b['1010'], '-1300.00')       # paid by bank transfer
        # running it again changes nothing
        again = self.client.post('/api/finance/journal/sync/').data
        self.assertEqual((again['posted'], again['updated'], again['removed']), (0, 0, 0))
        self.assertEqual(JournalEntry.objects.count(), 4)

    def test_sync_follows_changed_and_deleted_records(self):
        invoice = self.purchase()
        services.sync_operations()
        invoice.amount = Decimal('4000')
        invoice.save()
        SupplierPayment.objects.all().delete()
        result = services.sync_operations()
        self.assertEqual((result['updated'], result['removed']), (1, 1))
        self.assertEqual(self.balances()['2000'], '4300.00')

    def test_posted_entries_cannot_be_reversed_by_hand(self):
        self.purchase()
        services.sync_operations()
        entry = JournalEntry.objects.filter(source='Supplier invoice').first()
        self.assertEqual(self.client.post(f'/api/finance/journal/{entry.id}/reverse/').status_code, 400)

    def test_closed_period_keeps_its_entries(self):
        invoice = self.purchase()
        services.sync_operations()
        period = self.client.post('/api/finance/periods/', {
            'name': 'Now', 'start_date': str(self.today), 'end_date': str(self.today)}, format='json').data
        self.client.post(f"/api/finance/periods/{period['id']}/close/")
        invoice.amount = Decimal('9000')
        invoice.save()
        result = services.sync_operations()
        self.assertEqual((result['updated'], result['skipped_closed']), (0, 1))
        self.assertEqual(self.balances()['5000'], '3000.00')

    def test_approved_return_reduces_receivable(self):
        order = self.sale()
        ret = self.client.post('/api/sales/returns/', {
            'order': order['id'], 'return_date': str(self.today), 'reason': 'Damp', 'weight': '10'}, format='json').data
        self.client.post(f"/api/sales/returns/{ret['id']}/approve/")
        services.sync_operations()
        b = self.balances()
        self.assertEqual((b['4010'], b['1100']), ('-550.00', '2950.00'))     # 10 kg x 50 + 10% tax

    # ── statements ───────────────────────────────────────────────────────────
    def test_statements_balance(self):
        self.capital('100000')
        self.sale()
        self.purchase()
        self.expense('2500')
        tb = self.client.get('/api/finance/trial-balance/').data
        self.assertTrue(tb['balanced'])
        self.assertEqual(tb['debit'], tb['credit'])
        pl = self.client.get('/api/finance/profit-and-loss/').data
        self.assertEqual((pl['total_income'], pl['total_expenses'], pl['net_profit']), ('5000.00', '5500.00', '-500.00'))
        bs = self.client.get('/api/finance/balance-sheet/').data
        self.assertTrue(bs['balanced'])
        self.assertEqual(bs['retained_earnings'], '-500.00')
        self.assertEqual(Decimal(bs['total_assets']), Decimal(bs['total_liabilities']) + Decimal(bs['total_equity']))

    def test_cash_flow_groups_money_movements(self):
        self.capital('100000')
        self.sale()
        self.purchase()
        self.expense('2500')
        cf = self.client.get('/api/finance/cash-flow/').data
        rows = {r['source']: (r['inflow'], r['outflow']) for r in cf['rows']}
        self.assertEqual(rows['Customer payment'], ('2000.00', '0.00'))
        self.assertEqual(rows['Supplier payment'], ('0.00', '1300.00'))
        self.assertEqual(rows['Expense'], ('0.00', '2500.00'))
        self.assertEqual((cf['opening'], cf['net'], cf['closing']), ('0.00', '98200.00', '98200.00'))

    def test_account_ledger_has_a_running_balance(self):
        self.capital('1000')
        self.expense('200', paid_from=acc('bank').id)
        data = self.client.get(f"/api/finance/accounts/{acc('bank').id}/ledger/").data
        self.assertEqual([r['balance'] for r in data['rows']], ['1000.00', '800.00'])
        self.assertEqual(data['closing'], '800.00')

    def test_balances_list_who_owes_what(self):
        self.sale()
        self.purchase()
        data = self.client.get('/api/finance/balances/').data
        self.assertEqual((data['total_receivable'], data['total_payable']), ('3500.00', '2000.00'))
        self.assertEqual(data['receivables'][0]['name'], 'Ali Traders')

    def test_costing_adds_up_the_kinds_of_cost(self):
        self.purchase()
        self.expense('2500', cost_centre='Drying')
        data = self.client.get('/api/finance/costing/').data
        kinds = {r['kind']: r['amount'] for r in data['rows']}
        self.assertEqual((kinds['Raw material'], kinds['Electricity'], data['total']), ('3000.00', '2500.00', '5500.00'))
        self.assertEqual(data['by_cost_centre'], [{'cost_centre': 'Drying', 'amount': '2500.00'}])
        self.assertIsNone(data['cost_per_kg'])                                 # nothing was dried

    def test_summary_and_date_checks(self):
        self.capital('5000')
        data = self.client.get('/api/finance/summary/').data
        self.assertEqual((data['cash_total'], len(data['trend'])), ('5000.00', 6))
        self.assertEqual(self.client.get('/api/finance/profit-and-loss/?start=2026-05-01&end=2026-01-01').status_code, 400)
        self.assertEqual(self.client.get('/api/finance/trial-balance/?as_of=nonsense').status_code, 400)
        self.assertEqual(date.fromisoformat(str(self.client.get('/api/finance/trial-balance/').data['as_of'])), self.today)
