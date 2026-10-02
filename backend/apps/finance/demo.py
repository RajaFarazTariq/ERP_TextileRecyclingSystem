"""Demo records for the Finance module (called by the seed command)."""
from datetime import timedelta
from decimal import Decimal

from django.utils import timezone

from . import services
from .models import Account, Expense, FinancialPeriod, JournalEntry, TaxRate


def wipe_demo_finance():
    JournalEntry.objects.filter(reverses__isnull=False).delete()
    JournalEntry.objects.all().delete()
    Expense.objects.all().delete()
    FinancialPeriod.objects.all().delete()
    TaxRate.objects.all().delete()


def add_demo_finance(admin):
    today = timezone.localdate()
    account = lambda code: Account.objects.get(code=code)   # noqa: E731

    for name, rate in (('Sales tax', '18'), ('Reduced rate', '5'), ('Exempt', '0')):
        TaxRate.objects.get_or_create(name=name, defaults={'rate': Decimal(rate)})
    year_start = today.replace(month=1, day=1)
    FinancialPeriod.objects.get_or_create(
        name=f'Year {today.year}', defaults={'start_date': year_start, 'end_date': today.replace(month=12, day=31)})

    # Opening position: the owner's money in the bank and the machinery it bought
    services.post(year_start, 'Opening balances', [
        {'account': account('1010'), 'debit': Decimal('6000000')},
        {'account': account('1500'), 'debit': Decimal('9500000')},
        {'account': account('2500'), 'credit': Decimal('3500000')},
        {'account': account('3000'), 'credit': Decimal('12000000')},
    ], user=admin)

    monthly = [   # account, cost centre, what, payee, amount, paid from
        ('5300', 'Drying', 'Electricity bill', 'LESCO', 310000, '1010'),
        ('5310', 'Drying', 'Gas for the dryers', 'SNGPL', 185000, '1010'),
        ('5320', 'Decolorization', 'Water charges', 'WASA', 42000, '1010'),
        ('5200', 'Sorting', 'Sorting floor wages', 'Payroll', 420000, '1010'),
        ('5200', 'Decolorization', 'Tank operators wages', 'Payroll', 260000, '1010'),
        ('5400', 'Maintenance', 'Repairs and spare parts', 'Hamza Engineering', 65000, '1000'),
        ('5500', 'Sales', 'Bale wrap and strapping', 'Pak Packaging', 48000, '1000'),
        ('5600', 'Sales', 'Delivery trucks', 'City Goods Transport', 90000, '1000'),
        ('5900', 'General', 'Office and sundries', '', 18000, '1000'),
    ]
    for back in range(6):
        day = (today.replace(day=1) - timedelta(days=30 * back)).replace(day=min(today.day, 25) if back == 0 else 25)
        if day < year_start or day > today:
            continue
        for i, (code, centre, what, payee, amount, paid_from) in enumerate(monthly):
            Expense.objects.create(
                date=day - timedelta(days=i % 5), account=account(code), paid_from=account(paid_from),
                amount=Decimal(amount) * (Decimal('1') + Decimal(back % 3) / Decimal('20')), payee=payee,
                description=what, cost_centre=centre, reference=f'V-{day:%y%m}-{i + 1:02d}', created_by=admin,
            )
    return services.sync_operations(admin)
