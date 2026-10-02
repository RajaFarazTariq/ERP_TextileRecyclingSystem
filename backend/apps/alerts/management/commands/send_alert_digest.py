"""
E-mail the current notifications of every rule marked "send e-mail" as one digest.

Run it by hand or from a scheduler (nothing in the app sends it by itself):
    python manage.py send_alert_digest
"""
from django.core.management.base import BaseCommand

from apps.alerts.digest import send_digest


class Command(BaseCommand):
    help = 'E-mail the open notifications of the rules marked "send e-mail" to MANAGEMENT_EMAIL'

    def handle(self, *args, **options):
        sent = send_digest()
        if sent is None:
            self.stdout.write('MANAGEMENT_EMAIL is not set; nothing sent.')
        elif sent == 0:
            self.stdout.write('Nothing to report; nothing sent.')
        else:
            self.stdout.write(self.style.SUCCESS(f'Digest sent with {sent} item(s).'))
