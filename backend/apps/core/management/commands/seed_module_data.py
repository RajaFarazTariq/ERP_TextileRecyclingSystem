"""
Demo records for the newer modules: finance, maintenance, workforce,
sustainability and documents.

    python manage.py seed_demo_data
    python manage.py seed_drying_data
    python manage.py seed_module_data      # run last: it builds on the data above

Running it again replaces what it made before.
"""
from importlib import import_module

from django.core.management.base import BaseCommand
from django.db import transaction

from apps.users.models import CustomUser

MODULES = ['finance', 'maintenance', 'workforce', 'sustainability', 'documents']


def wipe_module_data():
    """Remove every module's records (they point at the main demo data, so they go first)."""
    for name in reversed(MODULES):
        getattr(import_module(f'apps.{name}.demo'), f'wipe_demo_{name}')()


class Command(BaseCommand):
    help = 'Add demo data for the finance, maintenance, workforce, sustainability and documents modules'

    def handle(self, *args, **options):
        admin = CustomUser.objects.filter(role='admin').order_by('id').first()
        if admin is None:
            self.stderr.write('Run seed_demo_data first: there is no admin user.')
            return
        with transaction.atomic():
            wipe_module_data()
        for name in MODULES:
            with transaction.atomic():
                getattr(import_module(f'apps.{name}.demo'), f'add_demo_{name}')(admin)
            self.stdout.write(f'  + {name}')
        self.stdout.write(self.style.SUCCESS('Module demo data added.'))
