# core/management/base.py
from decimal import Decimal

from django.core.management.base import BaseCommand
from django.test.utils import override_settings


class SeedCommand(BaseCommand):
    """
    Base for demo-data seed commands. Creating demo orders, payments and
    chemical issuances fires the notification signals; their alert emails are
    captured in memory here instead of being sent to MANAGEMENT_EMAIL.
    """

    def execute(self, *args, **options):
        with override_settings(EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend'):
            return super().execute(*args, **options)

    def add_demo_opening_stock(self, user, spare_kg='2000'):
        """
        Demo histories sell more than they dry, which the stock rules flag as
        oversold. Give each lot a labelled opening balance that covers its
        orders plus spare kg, so new demo orders can be confirmed.
        """
        from apps.inventory import services as inventory
        for fabric_id, figures in inventory.availability_map().items():
            top_up = max(-figures['available'], Decimal('0')) + Decimal(spare_kg)
            inventory.post_adjustment(fabric_id, top_up, 'Demo opening stock', user)
        self.stdout.write('  ✓ Demo opening stock added (labelled "Demo opening stock")')
