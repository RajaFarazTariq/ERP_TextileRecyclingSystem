# notifications/management/commands/send_monthly_report.py
"""
Management command to send the monthly sales summary email.
Run manually:   python manage.py send_monthly_report
Schedule via cron (runs at 8 AM on the 1st of every month):
    0 8 1 * *  /path/to/venv/bin/python /path/to/manage.py send_monthly_report >> /var/log/erp_monthly.log 2>&1
"""
from django.core.management.base import BaseCommand
from notifications.tasks import send_monthly_sales_summary


class Command(BaseCommand):
    help = 'Send monthly sales summary email to management'

    def handle(self, *args, **options):
        self.stdout.write('Sending monthly sales summary...')
        try:
            send_monthly_sales_summary()
            self.stdout.write(self.style.SUCCESS('  ✓ Monthly summary sent to management'))
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'  ✗ Monthly summary failed: {e}'))
