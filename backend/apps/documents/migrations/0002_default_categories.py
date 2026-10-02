from django.db import migrations

FLOOR = ['decolorization_supervisor', 'drying_supervisor', 'sorting_supervisor', 'warehouse_supervisor']

# name, description, roles that may see it (admins always may)
CATEGORIES = [
    ('Supplier documents', 'Registrations, agreements and other supplier papers', ['warehouse_supervisor']),
    ('Purchase documents', 'Purchase orders, quotations and delivery papers', ['warehouse_supervisor']),
    ('Production batch documents', 'Batch records and process sheets', FLOOR),
    ('Quality certificates', 'Certificates for materials, products and the factory', FLOOR),
    ('Material test reports', 'Laboratory and in-house test results', FLOOR),
    ('Safety data sheets', 'Handling and hazard information for chemicals', FLOOR),
    ('Customer documents', 'Agreements and other customer papers', []),
    ('Invoices and delivery challans', 'Sales invoices and delivery challans', []),
    ('Employee documents', 'Contracts, identity papers and training records', []),
]


def add_categories(apps, schema_editor):
    DocumentCategory = apps.get_model('documents', 'DocumentCategory')
    for name, description, roles in CATEGORIES:
        DocumentCategory.objects.get_or_create(name=name, defaults={'description': description, 'allowed_roles': roles})


class Migration(migrations.Migration):

    dependencies = [
        ('documents', '0001_initial'),
    ]

    operations = [
        migrations.RunPython(add_categories, migrations.RunPython.noop),
    ]
