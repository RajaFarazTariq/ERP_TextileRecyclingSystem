"""
Finance: a chart of accounts and a double-entry journal, with the statements
built from it.

Every journal entry balances (debits = credits). Entries come from three
places: typed in by hand, made by recording an expense, or posted from the
sales and purchasing records (customer invoices, payments and returns;
supplier invoices and payments) by `services.sync_operations`.

This supports the business's own bookkeeping. It is not a certified
statutory accounting system.
"""
from decimal import Decimal

from django.db import models

from apps.procurement.models import NumberedModel
from apps.users.models import CustomUser

ZERO = Decimal('0')
MONEY = {'max_digits': 14, 'decimal_places': 2}


class Account(models.Model):
    ASSET, LIABILITY, EQUITY, INCOME, EXPENSE = 'Asset', 'Liability', 'Equity', 'Income', 'Expense'
    TYPE_CHOICES = [(t, t) for t in (ASSET, LIABILITY, EQUITY, INCOME, EXPENSE)]
    # Assets and expenses grow with debits; the others with credits
    DEBIT_TYPES = (ASSET, EXPENSE)

    code = models.CharField(max_length=20, unique=True)
    name = models.CharField(max_length=150)
    type = models.CharField(max_length=10, choices=TYPE_CHOICES)
    is_cash = models.BooleanField(default=False, help_text='A cash or bank account: money is paid from and into it')
    # Accounts the automatic postings use (e.g. "receivable"); these can be renamed but not deleted
    system_key = models.CharField(max_length=30, unique=True, null=True, blank=True, editable=False)
    description = models.TextField(blank=True, default='')
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ['code']

    def __str__(self):
        return f'{self.code} {self.name}'


class FinancialPeriod(models.Model):
    """A bookkeeping period. Once closed, no entry dated inside it can be added, changed or removed."""
    name = models.CharField(max_length=50, unique=True)
    start_date = models.DateField()
    end_date = models.DateField()
    is_closed = models.BooleanField(default=False)
    closed_by = models.ForeignKey(CustomUser, on_delete=models.PROTECT, null=True, blank=True, related_name='+')
    closed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-start_date']

    def __str__(self):
        return self.name


class TaxRate(models.Model):
    name = models.CharField(max_length=80, unique=True)
    rate = models.DecimalField(max_digits=5, decimal_places=2, help_text='Percent')
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return f'{self.name} ({self.rate}%)'


class JournalEntry(NumberedModel):
    PREFIX = 'JV'
    MANUAL = 'Manual'
    SOURCE_CHOICES = [(s, s) for s in (
        MANUAL, 'Expense', 'Sales invoice', 'Customer payment', 'Sales return', 'Supplier invoice', 'Supplier payment',
    )]

    date = models.DateField(db_index=True)
    memo = models.CharField(max_length=255)
    source = models.CharField(max_length=20, choices=SOURCE_CHOICES, default=MANUAL)
    # The record an automatic entry was posted from
    source_id = models.PositiveBigIntegerField(null=True, blank=True)
    reference = models.CharField(max_length=100, blank=True, default='')
    reverses = models.OneToOneField('self', on_delete=models.PROTECT, null=True, blank=True, related_name='reversed_by')
    created_by = models.ForeignKey(CustomUser, on_delete=models.PROTECT, null=True, blank=True, related_name='+')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-date', '-id']
        indexes = [models.Index(fields=['source', 'source_id'])]

    def __str__(self):
        return self.number or f'Entry #{self.pk}'


class JournalLine(models.Model):
    entry = models.ForeignKey(JournalEntry, on_delete=models.CASCADE, related_name='lines')
    account = models.ForeignKey(Account, on_delete=models.PROTECT, related_name='lines')
    debit = models.DecimalField(**MONEY, default=0)
    credit = models.DecimalField(**MONEY, default=0)
    description = models.CharField(max_length=255, blank=True, default='')

    class Meta:
        ordering = ['id']

    def __str__(self):
        return f'{self.entry}: {self.account}'


class Expense(NumberedModel):
    """Money spent that is not a supplier invoice: utilities, wages, repairs, packaging and so on."""
    PREFIX = 'EXP'
    COST_CENTRES = [(c, c) for c in ('General', 'Warehouse', 'Sorting', 'Decolorization', 'Drying', 'Maintenance', 'Sales')]

    date = models.DateField()
    account = models.ForeignKey(Account, on_delete=models.PROTECT, related_name='expenses',
                                help_text='The expense account, e.g. Electricity')
    paid_from = models.ForeignKey(Account, on_delete=models.PROTECT, related_name='payments_out',
                                  help_text='The cash or bank account it was paid from')
    amount = models.DecimalField(**MONEY)
    payee = models.CharField(max_length=150, blank=True, default='')
    description = models.CharField(max_length=255)
    cost_centre = models.CharField(max_length=20, choices=COST_CENTRES, default='General',
                                   help_text='The part of the factory the cost belongs to (used in production costing)')
    reference = models.CharField(max_length=100, blank=True, default='', help_text='Voucher or receipt number')
    created_by = models.ForeignKey(CustomUser, on_delete=models.PROTECT, related_name='+')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-date', '-id']

    def __str__(self):
        return self.number or f'Expense #{self.pk}'
