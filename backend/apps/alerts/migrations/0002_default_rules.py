from decimal import Decimal

from django.db import migrations

WAREHOUSE, SORTING, DECOLOR, DRYING = (
    'warehouse_supervisor', 'sorting_supervisor', 'decolorization_supervisor', 'drying_supervisor',
)
FLOOR = [SORTING, DECOLOR, DRYING]
EVERYONE = [WAREHOUSE, SORTING, DECOLOR, DRYING]

# key, title, description, enabled, threshold, what the threshold means, roles (admins always receive)
RULES = [
    ('chemical-low', 'Low chemical stock', 'A chemical has less left than this share of its total stock.',
     True, '25', 'Percent of total stock', [DECOLOR]),
    ('spare-part-low', 'Spare parts to reorder', 'A spare part is at or below its reorder level.',
     True, None, '', EVERYONE),
    ('dried-stock-low', 'Low dried stock', 'A lot has less dried stock free to sell than this weight.',
     False, '100', 'Kg free to sell per lot', [DRYING]),
    ('stock-oversold', 'More reserved than on hand', 'Orders reserve more of a lot than is in stock.',
     True, None, '', []),
    ('purchase-approval', 'Purchases waiting for approval', 'Purchase requests and purchase orders waiting for an admin.',
     True, None, '', []),
    ('production-delayed', 'Delayed production orders', 'A production order is past its planned end and not finished.',
     True, '0', 'Days late before it is listed', FLOOR),
    ('quality-quarantine', 'Material in quarantine', 'A failed inspection holds a delivery or lot until an admin releases it.',
     True, None, '', EVERYONE),
    ('quality-action-overdue', 'Overdue corrective actions', 'An open corrective action is past its due date.',
     True, None, '', EVERYONE),
    ('machine-breakdown', 'Machine breakdowns', 'A breakdown work order is still open.',
     True, None, '', EVERYONE),
    ('maintenance-overdue', 'Overdue preventive maintenance', 'A scheduled maintenance task is past its due date.',
     True, '0', 'Days overdue before it is listed', EVERYONE),
    ('invoice-overdue', 'Overdue customer invoices', 'A customer invoice is unpaid after its due date.',
     True, '0', 'Days overdue before it is listed', []),
    ('credit-limit', 'Customers over their credit limit', 'A customer owes more than their credit limit.',
     True, None, '', []),
    ('supplier-invoice-due', 'Supplier invoices to pay', 'An unpaid supplier invoice is overdue or due soon.',
     True, '7', 'Days before the due date', []),
    ('document-expiry', 'Documents expiring', 'A document has expired or expires soon.',
     True, '30', 'Days before the expiry date', EVERYONE),
    ('stock-adjustment', 'Unusual stock adjustments', 'A manual stock correction in the last 7 days is larger than this weight.',
     True, '500', 'Kg adjusted in one correction', []),
    ('sales-return-pending', 'Sales returns waiting for approval', 'A customer return is waiting for an admin.',
     True, None, '', []),
    ('leave-pending', 'Leave requests waiting', 'A leave request is waiting for an admin.',
     True, None, '', []),
]


def create_rules(apps, schema_editor):
    NotificationRule = apps.get_model('alerts', 'NotificationRule')
    for order, (key, title, description, enabled, threshold, label, roles) in enumerate(RULES, start=1):
        NotificationRule.objects.get_or_create(key=key, defaults={
            'title': title, 'description': description, 'is_enabled': enabled,
            'threshold': Decimal(threshold) if threshold is not None else None, 'threshold_label': label,
            'roles': list(roles), 'sort_order': order,
        })


class Migration(migrations.Migration):

    dependencies = [
        ('alerts', '0001_initial'),
    ]

    operations = [
        migrations.RunPython(create_rules, migrations.RunPython.noop),
    ]
