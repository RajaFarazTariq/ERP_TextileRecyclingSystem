"""
Build the dried-stock ledger from existing records: +output for every completed
drying session, -weight for every dispatch. Nothing is estimated. Lots whose
history sold more than was dried end up negative and are listed by
`python manage.py reconcile_inventory` for review.
"""
from django.db import migrations

NOTE = 'Backfilled from existing records'


def forwards(apps, schema_editor):
    StockMovement = apps.get_model('inventory', 'StockMovement')
    DryingSession = apps.get_model('drying', 'DryingSession')
    DispatchTracking = apps.get_model('sales', 'DispatchTracking')

    rows = []
    for s in DryingSession.objects.filter(status='Completed', output_quantity__gt=0):
        rows.append(StockMovement(
            fabric_id=s.fabric_id, movement_type='DRYING_OUTPUT', quantity=s.output_quantity,
            source_type='DryingSession', source_id=s.pk, note=NOTE,
        ))
    for d in DispatchTracking.objects.select_related('sales_order').filter(dispatched_weight__gt=0):
        rows.append(StockMovement(
            fabric_id=d.sales_order.fabric_id, movement_type='DISPATCH', quantity=-d.dispatched_weight,
            source_type='DispatchTracking', source_id=d.pk, note=NOTE,
        ))
    StockMovement.objects.bulk_create(rows, batch_size=500)


def backwards(apps, schema_editor):
    apps.get_model('inventory', 'StockMovement').objects.filter(note=NOTE).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('inventory', '0001_initial'),
        ('drying', '0002_alter_dryingsession_dryer_alter_dryingsession_fabric_and_more'),
        ('sales', '0004_backfill_customers'),
    ]

    operations = [
        migrations.RunPython(forwards, backwards),
    ]
