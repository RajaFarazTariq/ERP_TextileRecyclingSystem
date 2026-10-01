from django.db import migrations

# The usual textile recycling stages; factories can rename, add or switch them off
STAGES = [
    ('Sorting', 'sorting'),
    ('Shredding', ''),
    ('Fiber opening', ''),
    ('Washing', ''),
    ('Decolorization', 'decolorization'),
    ('Drying', 'drying'),
    ('Blending', ''),
    ('Packaging', ''),
]
STANDARD_ROUTE = [('Sorting', 8), ('Decolorization', 24), ('Drying', 6)]


def add_defaults(apps, schema_editor):
    ProcessStage = apps.get_model('production', 'ProcessStage')
    Routing = apps.get_model('production', 'Routing')
    RoutingStep = apps.get_model('production', 'RoutingStep')
    stages = {}
    for position, (name, module) in enumerate(STAGES, start=1):
        stages[name], _ = ProcessStage.objects.get_or_create(
            name=name, defaults={'sequence': position * 10, 'module': module})
    routing, created = Routing.objects.get_or_create(
        name='Standard recycling', defaults={'description': 'Sorting, decolorization and drying.'})
    if created:
        for position, (name, hours) in enumerate(STANDARD_ROUTE, start=1):
            RoutingStep.objects.create(routing=routing, stage=stages[name], sequence=position, planned_hours=hours)


class Migration(migrations.Migration):

    dependencies = [
        ('production', '0001_initial'),
    ]

    operations = [
        migrations.RunPython(add_defaults, migrations.RunPython.noop),
    ]
