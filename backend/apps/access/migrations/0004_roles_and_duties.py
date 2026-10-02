from django.db import migrations, models

ROLES = [
    ('admin', 'Admin', 'Everything, always. Manages users and access.'),
    ('warehouse_supervisor', 'Warehouse Supervisor', 'Receives deliveries and raises purchases.'),
    ('sorting_supervisor', 'Sorting Supervisor', 'Runs sorting.'),
    ('decolorization_supervisor', 'Decolorization Supervisor', 'Runs decolorization and chemicals.'),
    ('drying_supervisor', 'Drying Supervisor', 'Runs drying.'),
]
# The duties each role carried while they were fixed in the code. Admins need no rows: they carry every duty.
DUTIES = {
    'warehouse_supervisor': ['inspect_incoming'],
    'sorting_supervisor': ['inspect_in_process', 'run_production'],
    'decolorization_supervisor': ['inspect_in_process', 'run_production'],
    'drying_supervisor': ['inspect_in_process', 'inspect_finished', 'run_production'],
}


def add_defaults(apps, schema_editor):
    Role = apps.get_model('access', 'Role')
    RoleDuty = apps.get_model('access', 'RoleDuty')
    for key, name, description in ROLES:
        Role.objects.get_or_create(key=key, defaults={'name': name, 'description': description, 'is_system': True})
    if not RoleDuty.objects.exists():
        RoleDuty.objects.bulk_create([RoleDuty(role=role, duty=duty) for role, duties in DUTIES.items() for duty in duties])


class Migration(migrations.Migration):
    dependencies = [('access', '0003_access_levels')]
    operations = [
        migrations.CreateModel(
            name='Role',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('key', models.SlugField(unique=True)),
                ('name', models.CharField(max_length=80, unique=True)),
                ('description', models.CharField(blank=True, default='', max_length=255)),
                ('is_system', models.BooleanField(default=False, editable=False)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
            ],
            options={'ordering': ['-is_system', 'id']},
        ),
        migrations.CreateModel(
            name='RoleDuty',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('role', models.CharField(max_length=50)),
                ('duty', models.CharField(max_length=50)),
            ],
            options={'ordering': ['role', 'duty']},
        ),
        migrations.AddConstraint(
            model_name='roleduty',
            constraint=models.UniqueConstraint(fields=('role', 'duty'), name='unique_role_duty'),
        ),
        migrations.RunPython(add_defaults, migrations.RunPython.noop),
    ]
