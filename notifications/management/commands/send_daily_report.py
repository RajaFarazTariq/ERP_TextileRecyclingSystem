# notifications/management/commands/send_daily_report.py
"""
Management command to send the daily production + stock summary email.
Run manually:   python manage.py send_daily_report
Schedule via cron (runs at 6 PM every day):
    0 18 * * *  /path/to/venv/bin/python /path/to/manage.py send_daily_report >> /var/log/erp_daily.log 2>&1
"""
from django.core.management.base import BaseCommand
from notifications.tasks import send_daily_production_summary, check_chemical_stock_alerts


class Command(BaseCommand):
    help = 'Send daily production summary email + check stock alerts'

    def handle(self, *args, **options):
        self.stdout.write('Sending daily production summary...')
        try:
            send_daily_production_summary()
            self.stdout.write(self.style.SUCCESS('  ✓ Daily summary sent'))
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'  ✗ Daily summary failed: {e}'))

        self.stdout.write('Checking chemical stock levels...')
        try:
            check_chemical_stock_alerts()
            self.stdout.write(self.style.SUCCESS('  ✓ Stock alerts checked'))
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'  ✗ Stock check failed: {e}'))
