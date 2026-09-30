"""
Create customers from existing orders' free-text buyer names.

Names that match ignoring case and extra spaces become one customer; the most
common spelling is used as its name. buyer_name on each order is left exactly
as it was. Possible near-duplicates are listed by
`python manage.py customer_duplicates` for a person to review and merge.
"""
from collections import Counter, defaultdict

from django.db import migrations


def normalize_name(name):
    return ' '.join((name or '').split()).casefold()


def forwards(apps, schema_editor):
    SalesOrder = apps.get_model('sales', 'SalesOrder')
    Customer = apps.get_model('sales', 'Customer')

    groups = defaultdict(list)
    for order in SalesOrder.objects.filter(customer__isnull=True).order_by('created_at', 'id'):
        key = normalize_name(order.buyer_name)
        if key:
            groups[key].append(order)

    for key, orders in groups.items():
        customer = Customer.objects.filter(normalized_name=key).first()
        if customer is None:
            spellings = Counter(' '.join(o.buyer_name.split()) for o in orders)
            name = spellings.most_common(1)[0][0]
            customer = Customer.objects.create(
                name=name, normalized_name=key,
                contact=next((o.buyer_contact for o in reversed(orders) if o.buyer_contact), None),
                address=next((o.buyer_address for o in reversed(orders) if o.buyer_address), None),
            )
        SalesOrder.objects.filter(pk__in=[o.pk for o in orders]).update(customer=customer)


def backwards(apps, schema_editor):
    SalesOrder = apps.get_model('sales', 'SalesOrder')
    Customer = apps.get_model('sales', 'Customer')
    SalesOrder.objects.update(customer=None)
    Customer.objects.all().delete()


class Migration(migrations.Migration):

    dependencies = [
        ('sales', '0003_customer_alter_salesorder_total_price_and_more'),
    ]

    operations = [
        migrations.RunPython(forwards, backwards),
    ]
