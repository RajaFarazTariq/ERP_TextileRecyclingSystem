from decimal import Decimal
from unittest.mock import patch

from django.core import mail
from django.test import TestCase, override_settings

from users.models import CustomUser
from warehouse.models import Vendor, FactoryUnit, Stock
from sorting.models import FabricStock, SortingSession
from sales.models import SalesOrder, Payment


@override_settings(EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend')
class SignalWiringTests(TestCase):
    def setUp(self):
        self.user = CustomUser.objects.create_user(
            username='admin_user', password='Pass@12345', role='admin'
        )
        stock = Stock.objects.create(
            vendor=Vendor.objects.create(name='Vendor A'), fabric_type='Cotton',
            vendor_weight_slip='S-1', vehicle_no='LHR-1', our_weight=Decimal('1000'),
            unloading_weight=Decimal('990'), unit=FactoryUnit.objects.create(name='Unit 1'),
        )
        self.fabric = FabricStock.objects.create(
            stock=stock, material_type='Cotton',
            initial_quantity=Decimal('500'), remaining_quantity=Decimal('500'),
        )
        self.order = SalesOrder.objects.create(
            buyer_name='Buyer', fabric=self.fabric, fabric_quality='A',
            weight_sold=Decimal('10'), price_per_kg=Decimal('100'),
            total_price=Decimal('1000'), created_by=self.user,
        )

    @patch('notifications.tasks.MANAGEMENT_EMAIL', 'manager@example.com')
    def test_order_completed_sends_alert(self):
        self.order.status = 'Completed'
        self.order.save()
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn('Completed', mail.outbox[0].subject)
        self.assertEqual(mail.outbox[0].to, ['manager@example.com'])

    @patch('notifications.tasks.MANAGEMENT_EMAIL', '')
    def test_no_recipient_configured_skips_email(self):
        self.order.status = 'Completed'
        self.order.save()
        self.assertEqual(len(mail.outbox), 0)

    def test_deleting_payment_recalculates_payment_status(self):
        payment = Payment.objects.create(
            sales_order=self.order, amount=Decimal('1000'), received_by=self.user,
        )
        self.order.refresh_from_db()
        self.assertEqual(self.order.payment_status, 'Paid')
        payment.delete()
        self.order.refresh_from_db()
        self.assertEqual(self.order.payment_status, 'Pending')

    def test_sorting_session_save_does_not_overwrite_fabric_status(self):
        # Fabric that has moved on to decolorization must keep its status
        self.fabric.status = 'Sent to Decolorization'
        self.fabric.save()
        SortingSession.objects.create(
            fabric=self.fabric, supervisor=self.user, unit='Unit 1',
            quantity_taken=Decimal('50'), status='Completed',
        )
        self.fabric.refresh_from_db()
        self.assertEqual(self.fabric.status, 'Sent to Decolorization')
