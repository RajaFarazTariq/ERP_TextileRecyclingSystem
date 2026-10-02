from django.db import migrations

# A starting chart of accounts. Accounts with a key are the ones the automatic
# postings use; they can be renamed but not removed.
ACCOUNTS = [   # code, name, type, cash or bank, key
    ('1000', 'Cash in hand', 'Asset', True, 'cash'),
    ('1010', 'Bank account', 'Asset', True, 'bank'),
    ('1100', 'Accounts receivable', 'Asset', False, 'receivable'),
    ('1200', 'Purchase tax recoverable', 'Asset', False, 'purchase_tax'),
    ('1500', 'Machinery and equipment', 'Asset', False, None),
    ('2000', 'Accounts payable', 'Liability', False, 'payable'),
    ('2100', 'Sales tax payable', 'Liability', False, 'sales_tax'),
    ('2500', 'Loans', 'Liability', False, None),
    ('3000', "Owner's capital", 'Equity', False, None),
    ('4000', 'Sales', 'Income', False, 'sales'),
    ('4010', 'Sales returns', 'Income', False, 'sales_returns'),
    ('4900', 'Other income', 'Income', False, None),
    ('5000', 'Raw material purchases', 'Expense', False, 'purchases'),
    ('5100', 'Chemicals and consumables', 'Expense', False, None),
    ('5200', 'Wages and labour', 'Expense', False, None),
    ('5300', 'Electricity', 'Expense', False, None),
    ('5310', 'Gas and fuel', 'Expense', False, None),
    ('5320', 'Water', 'Expense', False, None),
    ('5400', 'Repairs and maintenance', 'Expense', False, None),
    ('5500', 'Packaging', 'Expense', False, None),
    ('5600', 'Transport', 'Expense', False, None),
    ('5900', 'Other expenses', 'Expense', False, None),
]


def add_accounts(apps, schema_editor):
    Account = apps.get_model('finance', 'Account')
    for code, name, kind, is_cash, key in ACCOUNTS:
        Account.objects.get_or_create(code=code, defaults={'name': name, 'type': kind, 'is_cash': is_cash, 'system_key': key})


class Migration(migrations.Migration):
    dependencies = [('finance', '0001_initial')]
    operations = [migrations.RunPython(add_accounts, migrations.RunPython.noop)]
