from io import StringIO
from unittest.mock import patch

from django.core.management import call_command
from django.test import TestCase, override_settings


@override_settings(EMAIL_BACKEND='django.core.mail.backends.smtp.EmailBackend')
class SeedCommandEmailTests(TestCase):
    """Demo seeding fires notification signals; it must never send real email."""

    @patch('apps.notifications.tasks.MANAGEMENT_EMAIL', 'manager@example.com')
    @patch('django.core.mail.backends.smtp.EmailBackend.send_messages')
    def test_seed_demo_data_sends_no_smtp_email(self, smtp_send):
        call_command('seed_demo_data', stdout=StringIO())
        smtp_send.assert_not_called()
