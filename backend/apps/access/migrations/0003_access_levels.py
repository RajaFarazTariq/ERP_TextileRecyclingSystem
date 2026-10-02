from django.db import migrations, models


def to_levels(apps, schema_editor):
    """Exceptions were "given" or "taken away"; they become "full" or "none". Role pages were all in full."""
    Override = apps.get_model('access', 'UserPageOverride')
    Override.objects.filter(allowed=True).update(level='full')
    Override.objects.filter(allowed=False).update(level='none')


def to_allowed(apps, schema_editor):
    Override = apps.get_model('access', 'UserPageOverride')
    Override.objects.exclude(level='none').update(allowed=True)
    Override.objects.filter(level='none').update(allowed=False)


class Migration(migrations.Migration):
    dependencies = [('access', '0002_default_access')]
    operations = [
        migrations.AddField(
            model_name='rolepage', name='level',
            field=models.CharField(choices=[('view', 'View only'), ('full', 'Full')], default='full', max_length=10)),
        migrations.AddField(
            model_name='userpageoverride', name='level',
            field=models.CharField(choices=[('none', 'No access'), ('view', 'View only'), ('full', 'Full')],
                                   default='full', max_length=10)),
        migrations.RunPython(to_levels, to_allowed),
        migrations.RemoveField(model_name='userpageoverride', name='allowed'),
    ]
