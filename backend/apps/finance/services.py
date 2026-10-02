"""
Finance rules: balanced entries, closed periods, postings from the sales and
purchasing records, and the statements.

Postings from operations
  Sales invoice       Dr Receivable             Cr Sales, Cr Sales tax
  Customer payment    Dr Cash or Bank           Cr Receivable
  Sales return        Dr Sales returns          Cr Receivable
  Supplier invoice    Dr Purchases, Dr Tax      Cr Payable
  Supplier payment    Dr Payable                Cr Cash or Bank
  Expense             Dr the expense account    Cr the account it was paid from

`sync_operations` keeps these in step with their source records: it posts
what is missing, corrects what changed and removes what was deleted. Entries
dated in a closed period are left exactly as they are.

A sale reaches the books when it is invoiced, so "Receivable" here can differ
from the Sales page's "owes" figure, which counts confirmed orders.
"""
from collections import defaultdict
from decimal import Decimal

from django.db import transaction
from django.db.models import Sum
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from .models import Account, Expense, FinancialPeriod, JournalEntry, JournalLine

ZERO = Decimal('0')
CENT = Decimal('0.01')


def money(value):
    return Decimal(value or 0).quantize(CENT)


def account(key):
    return Account.objects.get(system_key=key)


# ─────────────────────────────────────────────────────────────────────────────
# Periods and entries
# ─────────────────────────────────────────────────────────────────────────────

def closed_period(day):
    return FinancialPeriod.objects.filter(is_closed=True, start_date__lte=day, end_date__gte=day).first()


def check_open(day):
    period = closed_period(day)
    if period:
        raise ValidationError({'date': [f'{period.name} is closed. Reopen the period or use a later date.']})


def check_lines(lines):
    """`lines` are dicts with account, debit, credit. They must balance."""
    if len(lines) < 2:
        raise ValidationError({'lines': ['An entry needs at least two lines.']})
    debit = credit = ZERO
    for line in lines:
        d, c = money(line.get('debit')), money(line.get('credit'))
        if d < 0 or c < 0:
            raise ValidationError({'lines': ["Amounts can't be negative."]})
        if (d > 0) == (c > 0):
            raise ValidationError({'lines': ['Each line needs either a debit or a credit.']})
        debit += d
        credit += c
    if debit != credit:
        raise ValidationError({'lines': [
            f'The entry does not balance: debits Rs. {debit:,.2f}, credits Rs. {credit:,.2f}.'
        ]})


@transaction.atomic
def post(date, memo, lines, *, source=JournalEntry.MANUAL, source_id=None, reference='', user=None, reverses=None):
    check_open(date)
    lines = [line for line in lines if money(line.get('debit')) or money(line.get('credit'))]
    check_lines(lines)
    entry = JournalEntry.objects.create(date=date, memo=memo[:255], source=source, source_id=source_id,
                                        reference=reference[:100], created_by=user, reverses=reverses)
    JournalLine.objects.bulk_create([
        JournalLine(entry=entry, account=line['account'], debit=money(line.get('debit')), credit=money(line.get('credit')),
                    description=(line.get('description') or '')[:255])
        for line in lines
    ])
    return entry


@transaction.atomic
def reverse(entry, user, date=None):
    """Cancel an entry by posting its mirror image; the original stays for the record."""
    if entry.reverses_id:
        raise ValidationError('This entry is itself a reversal.')
    if hasattr(entry, 'reversed_by'):
        raise ValidationError('This entry has already been reversed.')
    if entry.source != JournalEntry.MANUAL:
        raise ValidationError(f'This entry was posted from a {entry.source.lower()}. Change that record instead.')
    lines = [{'account': line.account, 'debit': line.credit, 'credit': line.debit, 'description': line.description}
             for line in entry.lines.all()]
    return post(date or timezone.localdate(), f'Reversal of {entry.number}', lines, user=user, reverses=entry)


# ─────────────────────────────────────────────────────────────────────────────
# Expenses
# ─────────────────────────────────────────────────────────────────────────────

def check_expense(data, instance=None):
    get = lambda field: data.get(field, getattr(instance, field, None))   # noqa: E731
    if get('amount') is not None and get('amount') <= 0:
        raise ValidationError({'amount': ['Must be greater than zero.']})
    if get('account') is not None and get('account').type != Account.EXPENSE:
        raise ValidationError({'account': ['Choose an expense account.']})
    if get('paid_from') is not None and not get('paid_from').is_cash:
        raise ValidationError({'paid_from': ['Choose a cash or bank account.']})
    if get('date') is not None:
        check_open(get('date'))
    if instance is not None:
        check_open(instance.date)


def _expense_lines(expense):
    text = f'{expense.description} ({expense.payee})' if expense.payee else expense.description
    return [{'account': expense.account, 'debit': expense.amount, 'description': text},
            {'account': expense.paid_from, 'credit': expense.amount, 'description': text}]


# ─────────────────────────────────────────────────────────────────────────────
# Postings from sales and purchasing
# ─────────────────────────────────────────────────────────────────────────────

def _wanted():
    """{(source, source_id): (date, memo, reference, lines)} for every record that should be in the books."""
    from apps.procurement.models import SupplierInvoice, SupplierPayment
    from apps.sales.models import Payment, SalesInvoice, SalesReturn

    accounts = {a.system_key: a for a in Account.objects.exclude(system_key=None)}
    account = accounts.__getitem__
    money_account = lambda method: accounts['cash' if method == 'Cash' else 'bank']   # noqa: E731
    receivable, payable = account('receivable'), account('payable')
    wanted = {}
    for i in SalesInvoice.objects.select_related('order'):
        wanted[('Sales invoice', i.pk)] = (i.invoice_date, f'Invoice {i.number} to {i.order.buyer_name}', i.number, [
            {'account': receivable, 'debit': i.total},
            {'account': account('sales'), 'credit': i.subtotal - i.discount_amount},
            {'account': account('sales_tax'), 'credit': i.tax_amount},
        ])
    for p in Payment.objects.select_related('sales_order'):
        day = timezone.localtime(p.payment_date).date()
        wanted[('Customer payment', p.pk)] = (
            day, f'Payment from {p.sales_order.buyer_name} for order #{p.sales_order_id}', p.reference_number or '', [
                {'account': money_account(p.payment_method), 'debit': p.amount},
                {'account': receivable, 'credit': p.amount},
            ])
    for r in SalesReturn.objects.filter(status='Approved').select_related('order'):
        day = timezone.localtime(r.decided_at).date() if r.decided_at else r.return_date
        wanted[('Sales return', r.pk)] = (day, f'Return {r.number} from {r.order.buyer_name}', r.number, [
            {'account': account('sales_returns'), 'debit': r.credit_amount},
            {'account': receivable, 'credit': r.credit_amount},
        ])
    for i in SupplierInvoice.objects.select_related('vendor'):
        wanted[('Supplier invoice', i.pk)] = (i.invoice_date, f'Invoice {i.invoice_number} from {i.vendor}', i.invoice_number, [
            {'account': account('purchases'), 'debit': i.amount},
            {'account': account('purchase_tax'), 'debit': i.tax_amount},
            {'account': payable, 'credit': i.total},
        ])
    for p in SupplierPayment.objects.select_related('invoice__vendor'):
        wanted[('Supplier payment', p.pk)] = (p.payment_date, f'Payment to {p.invoice.vendor}', p.reference, [
            {'account': payable, 'debit': p.amount},
            {'account': money_account(p.method), 'credit': p.amount},
        ])
    for e in Expense.objects.select_related('account', 'paid_from'):
        wanted[('Expense', e.pk)] = (e.date, f'{e.number}: {e.description}', e.reference, _expense_lines(e))
    return wanted


def _same(entry, date, memo, lines):
    have = sorted((line.account_id, line.debit, line.credit) for line in entry.lines.all())
    want = sorted((line['account'].pk, money(line.get('debit')), money(line.get('credit')))
                  for line in lines if money(line.get('debit')) or money(line.get('credit')))
    return entry.date == date and entry.memo == memo[:255] and have == want


@transaction.atomic
def sync_operations(user=None):
    """Bring the automatic entries in line with their source records. Returns what changed."""
    wanted = _wanted()
    existing = {(e.source, e.source_id): e
                for e in JournalEntry.objects.exclude(source=JournalEntry.MANUAL).prefetch_related('lines')}
    result = {'posted': 0, 'updated': 0, 'removed': 0, 'skipped_closed': 0}

    for key, entry in existing.items():
        if key in wanted and _same(entry, wanted[key][0], wanted[key][1], wanted[key][3]):
            continue
        new_date = wanted[key][0] if key in wanted else None
        if closed_period(entry.date) or (new_date and closed_period(new_date)):
            result['skipped_closed'] += 1
            wanted.pop(key, None)
            continue
        entry.delete()
        result['removed' if key not in wanted else 'updated'] += 1
        existing[key] = None

    for key, (date, memo, reference, lines) in wanted.items():
        if existing.get(key) is not None:
            continue
        if closed_period(date):
            result['skipped_closed'] += 1
            continue
        if not any(money(line.get('debit')) or money(line.get('credit')) for line in lines):
            continue
        post(date, memo, lines, source=key[0], source_id=key[1], reference=reference or '', user=user)
        if key not in existing:
            result['posted'] += 1
    return result


# ─────────────────────────────────────────────────────────────────────────────
# Statements
# ─────────────────────────────────────────────────────────────────────────────

def _totals(start=None, end=None):
    """{account_id: (debit, credit)} for entries dated in [start, end]."""
    lines = JournalLine.objects.all()
    if start:
        lines = lines.filter(entry__date__gte=start)
    if end:
        lines = lines.filter(entry__date__lte=end)
    return {row['account_id']: (money(row['d']), money(row['c']))
            for row in lines.values('account_id').annotate(d=Sum('debit'), c=Sum('credit'))}


def balance_of(acc, debit, credit):
    """An account's balance on its natural side (assets and expenses: debit minus credit)."""
    return debit - credit if acc.type in Account.DEBIT_TYPES else credit - debit


def _row(acc, amount):
    return {'account': acc.pk, 'code': acc.code, 'name': acc.name, 'type': acc.type, 'amount': f'{amount:.2f}'}


def trial_balance(as_of):
    totals = _totals(end=as_of)
    rows, debit_total, credit_total = [], ZERO, ZERO
    for acc in Account.objects.all():
        d, c = totals.get(acc.pk, (ZERO, ZERO))
        net = d - c
        if not net:
            continue
        rows.append({'account': acc.pk, 'code': acc.code, 'name': acc.name, 'type': acc.type,
                     'debit': f'{max(net, ZERO):.2f}', 'credit': f'{max(-net, ZERO):.2f}'})
        debit_total += max(net, ZERO)
        credit_total += max(-net, ZERO)
    return {'as_of': as_of, 'rows': rows, 'debit': f'{debit_total:.2f}', 'credit': f'{credit_total:.2f}',
            'balanced': debit_total == credit_total}


def profit_and_loss(start, end):
    totals = _totals(start, end)
    income, expenses = [], []
    for acc in Account.objects.filter(type__in=(Account.INCOME, Account.EXPENSE)):
        amount = balance_of(acc, *totals.get(acc.pk, (ZERO, ZERO)))
        if amount:
            (income if acc.type == Account.INCOME else expenses).append(_row(acc, amount))
    total_income = sum((Decimal(r['amount']) for r in income), ZERO)
    total_expenses = sum((Decimal(r['amount']) for r in expenses), ZERO)
    return {'start': start, 'end': end, 'income': income, 'expenses': expenses,
            'total_income': f'{total_income:.2f}', 'total_expenses': f'{total_expenses:.2f}',
            'net_profit': f'{total_income - total_expenses:.2f}'}


def balance_sheet(as_of):
    totals = _totals(end=as_of)
    groups = {Account.ASSET: [], Account.LIABILITY: [], Account.EQUITY: []}
    earnings = ZERO
    for acc in Account.objects.all():
        amount = balance_of(acc, *totals.get(acc.pk, (ZERO, ZERO)))
        if acc.type in groups:
            if amount:
                groups[acc.type].append(_row(acc, amount))
        else:   # income and expense accounts roll into the profit kept in the business
            earnings += amount if acc.type == Account.INCOME else -amount
    total = lambda rows: sum((Decimal(r['amount']) for r in rows), ZERO)   # noqa: E731
    assets, liabilities, equity = total(groups[Account.ASSET]), total(groups[Account.LIABILITY]), total(groups[Account.EQUITY])
    return {'as_of': as_of, 'assets': groups[Account.ASSET], 'liabilities': groups[Account.LIABILITY],
            'equity': groups[Account.EQUITY], 'retained_earnings': f'{earnings:.2f}',
            'total_assets': f'{assets:.2f}', 'total_liabilities': f'{liabilities:.2f}',
            'total_equity': f'{equity + earnings:.2f}',
            'balanced': assets == liabilities + equity + earnings}


def cash_flow(start, end):
    """Money in and out of the cash and bank accounts, grouped by what it was for."""
    cash_ids = set(Account.objects.filter(is_cash=True).values_list('pk', flat=True))
    opening = sum((d - c for a, (d, c) in _totals(end=start - timezone.timedelta(days=1)).items() if a in cash_ids), ZERO)
    groups = defaultdict(lambda: {'inflow': ZERO, 'outflow': ZERO})
    entries = JournalEntry.objects.filter(date__gte=start, date__lte=end, lines__account_id__in=cash_ids).distinct()
    for entry in entries.prefetch_related('lines'):
        moved = sum((line.debit - line.credit for line in entry.lines.all() if line.account_id in cash_ids), ZERO)
        if moved:
            groups[entry.source]['inflow' if moved > 0 else 'outflow'] += abs(moved)
    rows = [{'source': source, 'inflow': f"{g['inflow']:.2f}", 'outflow': f"{g['outflow']:.2f}"}
            for source, g in sorted(groups.items())]
    inflow = sum((g['inflow'] for g in groups.values()), ZERO)
    outflow = sum((g['outflow'] for g in groups.values()), ZERO)
    return {'start': start, 'end': end, 'opening': f'{opening:.2f}', 'rows': rows, 'inflow': f'{inflow:.2f}',
            'outflow': f'{outflow:.2f}', 'net': f'{inflow - outflow:.2f}', 'closing': f'{opening + inflow - outflow:.2f}'}


def ledger(acc, start=None, end=None):
    """Every line on one account with a running balance."""
    opening = ZERO
    if start:
        d, c = _totals(end=start - timezone.timedelta(days=1)).get(acc.pk, (ZERO, ZERO))
        opening = balance_of(acc, d, c)
    lines = JournalLine.objects.filter(account=acc).select_related('entry').order_by('entry__date', 'entry_id', 'id')
    if start:
        lines = lines.filter(entry__date__gte=start)
    if end:
        lines = lines.filter(entry__date__lte=end)
    balance, rows = opening, []
    for line in lines:
        balance += balance_of(acc, line.debit, line.credit)
        rows.append({'date': line.entry.date, 'entry': line.entry_id, 'number': line.entry.number, 'memo': line.entry.memo,
                     'source': line.entry.source, 'debit': f'{line.debit:.2f}', 'credit': f'{line.credit:.2f}',
                     'balance': f'{balance:.2f}'})
    return {'account': acc.pk, 'code': acc.code, 'name': acc.name, 'type': acc.type,
            'opening': f'{opening:.2f}', 'closing': f'{balance:.2f}', 'rows': rows}


# ─────────────────────────────────────────────────────────────────────────────
# Balances and costing (read from the other modules)
# ─────────────────────────────────────────────────────────────────────────────

def balances():
    """Who owes us and whom we owe, from the sales and purchasing records."""
    from apps.procurement import services as procurement
    from apps.procurement.models import SupplierInvoice
    from apps.sales import services as sales
    from apps.sales.models import Customer

    today = timezone.localdate()
    figures = sales.customer_balances()
    receivables = [{'customer': c.pk, 'name': c.name, 'balance': f"{figures[c.pk]['balance']:.2f}",
                    'credit_limit': f'{c.credit_limit:.2f}',
                    'over_limit': bool(c.credit_limit) and figures[c.pk]['balance'] > c.credit_limit}
                   for c in Customer.objects.filter(pk__in=list(figures)) if figures[c.pk]['balance']]
    receivables.sort(key=lambda r: -Decimal(r['balance']))

    suppliers = defaultdict(lambda: {'balance': ZERO, 'overdue': ZERO, 'name': ''})
    for invoice in SupplierInvoice.objects.exclude(status='Paid').select_related('vendor').prefetch_related('payments'):
        due = procurement.outstanding(invoice)
        row = suppliers[invoice.vendor_id]
        row['name'] = str(invoice.vendor)
        row['balance'] += due
        if invoice.due_date and invoice.due_date < today:
            row['overdue'] += due
    payables = [{'supplier': pk, 'name': r['name'], 'balance': f"{r['balance']:.2f}", 'overdue': f"{r['overdue']:.2f}"}
                for pk, r in suppliers.items() if r['balance']]
    payables.sort(key=lambda r: -Decimal(r['balance']))
    return {
        'receivables': receivables, 'payables': payables,
        'total_receivable': f"{sum((Decimal(r['balance']) for r in receivables), ZERO):.2f}",
        'total_payable': f"{sum((Decimal(r['balance']) for r in payables), ZERO):.2f}",
    }


def production_cost(start, end):
    """
    What production cost in a period, by kind of cost, against the estimate
    on the production orders, and per kg of dried output.

      raw material   supplier invoices dated in the period (before tax)
      chemicals      chemicals issued x their cost when issued
      labour         hours recorded on production stages x the stage's hourly cost
      the rest       expenses, by account (electricity, packaging, repairs ...)
    """
    from apps.decolorization.models import ChemicalIssuance
    from apps.drying.models import DryingSession
    from apps.procurement.models import SupplierInvoice
    from apps.production.models import OrderStep, ProductionOrder
    from apps.production.services import figures

    raw = SupplierInvoice.objects.filter(invoice_date__gte=start, invoice_date__lte=end).aggregate(t=Sum('amount'))['t']
    chemicals = sum((i.quantity * i.unit_cost for i in ChemicalIssuance.objects.filter(
        issued_at__date__gte=start, issued_at__date__lte=end)), ZERO)
    labour = sum(((s.actual_hours or ZERO) * s.hourly_cost for s in OrderStep.objects.filter(
        status='Done', finished_at__date__gte=start, finished_at__date__lte=end)), ZERO)
    rows = [
        {'kind': 'Raw material', 'basis': 'Supplier invoices', 'amount': money(raw)},
        {'kind': 'Chemicals and consumables', 'basis': 'Chemicals issued at cost', 'amount': money(chemicals)},
        {'kind': 'Direct labour and machine time', 'basis': 'Hours on production stages', 'amount': money(labour)},
    ]
    by_account = defaultdict(lambda: ZERO)
    by_centre = defaultdict(lambda: ZERO)
    for e in Expense.objects.filter(date__gte=start, date__lte=end).select_related('account'):
        by_account[e.account.name] += e.amount
        by_centre[e.cost_centre] += e.amount
    rows += [{'kind': name, 'basis': 'Expenses', 'amount': money(amount)} for name, amount in sorted(by_account.items())]
    total = sum((r['amount'] for r in rows), ZERO)

    output = money(DryingSession.objects.filter(status='Completed', end_date__date__gte=start, end_date__date__lte=end)
                   .aggregate(t=Sum('output_quantity'))['t'])
    estimated = actual_orders = ZERO
    orders = ProductionOrder.objects.filter(planned_start__gte=start, planned_start__lte=end).exclude(
        status='Cancelled').prefetch_related('steps__stage', 'materials')
    for order in orders:
        f = figures(order)
        estimated += f['planned_cost']
        actual_orders += f['total_cost']
    for r in rows:
        r['share_pct'] = round(float(r['amount'] / total * 100), 1) if total else None
        r['amount'] = f"{r['amount']:.2f}"
    return {
        'start': start, 'end': end, 'rows': rows, 'total': f'{total:.2f}',
        'output_kg': f'{output:.2f}', 'cost_per_kg': f'{total / output:.2f}' if output else None,
        'by_cost_centre': [{'cost_centre': c, 'amount': f'{a:.2f}'} for c, a in sorted(by_centre.items())],
        'orders': orders.count(), 'estimated_order_cost': f'{estimated:.2f}', 'actual_order_cost': f'{actual_orders:.2f}',
        'order_variance': f'{actual_orders - estimated:.2f}',
    }
