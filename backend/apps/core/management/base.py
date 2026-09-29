# core/management/base.py
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
