from django.db import migrations

# Usual kinds of waste in a textile recycling factory; admins can rename, add or switch them off
CATEGORIES = [
    ('Fibre dust', 'Recyclable', 'Dust and short fibres collected from sorting and drying.'),
    ('Offcuts', 'Reusable', 'Clean fabric pieces too small to process.'),
    ('Contaminated fabric', 'General', 'Fabric with oil, paint or other dirt that cannot be processed.'),
    ('Chemical sludge', 'Hazardous', 'Residue from the decolorization tanks.'),
    ('Wastewater sludge', 'Hazardous', 'Solids removed from process water.'),
    ('Packaging', 'Recyclable', 'Bale wrap, straps, drums and cartons.'),
]


def add_defaults(apps, schema_editor):
    WasteCategory = apps.get_model('sustainability', 'WasteCategory')
    for name, classification, description in CATEGORIES:
        WasteCategory.objects.get_or_create(
            name=name, defaults={'classification': classification, 'description': description})


class Migration(migrations.Migration):

    dependencies = [
        ('sustainability', '0001_initial'),
    ]

    operations = [
        migrations.RunPython(add_defaults, migrations.RunPython.noop),
    ]
