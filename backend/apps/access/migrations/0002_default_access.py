from django.db import migrations

# The access each role had while it was fixed in the web app's code, so nobody
# gains or loses a page when access becomes configurable. Admins need no rows:
# they always have every page.
EVERY_SUPERVISOR = ['quality', 'maintenance', 'sustainability', 'documents', 'traceability']
DEFAULTS = {
    'warehouse_supervisor': EVERY_SUPERVISOR + ['warehouse', 'procurement'],
    'sorting_supervisor': EVERY_SUPERVISOR + ['sorting', 'production'],
    'decolorization_supervisor': EVERY_SUPERVISOR + ['decolorization', 'production'],
    'drying_supervisor': EVERY_SUPERVISOR + ['drying', 'production'],
}


def add_defaults(apps, schema_editor):
    RolePage = apps.get_model('access', 'RolePage')
    if RolePage.objects.exists():
        return
    RolePage.objects.bulk_create([RolePage(role=role, page=page) for role, pages in DEFAULTS.items() for page in pages])


class Migration(migrations.Migration):
    dependencies = [('access', '0001_initial')]
    operations = [migrations.RunPython(add_defaults, migrations.RunPython.noop)]
