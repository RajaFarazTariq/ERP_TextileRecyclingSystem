# notifications/signals.py
"""
Django signals that wire up:
  • auto status updates  →  triggered on save/delete of key models
  • email alerts         →  triggered on specific status changes

Wire these signals by calling `import notifications.signals` inside
NotificationsConfig.ready() in notifications/apps.py:

    # notifications/apps.py
    from django.apps import AppConfig

    class NotificationsConfig(AppConfig):
        default_auto_field = 'django.db.models.BigAutoField'
        name = 'notifications'

        def ready(self):
            import apps.notifications.signals  # noqa: F401
"""

import logging
from django.db.models.signals import post_save, post_delete, pre_save
from django.dispatch import receiver

from .tasks import (
    alert_order_completed,
    alert_order_dispatched,
    alert_payment_received,
    auto_update_order_payment_status,
    check_chemical_stock_alerts,
)

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
# SALES ORDER signals
# ─────────────────────────────────────────────────────────────────────────────

@receiver(pre_save, sender='sales.SalesOrder')
def capture_order_old_status(sender, instance, **kwargs):
    """
    Capture the old status before save so we can diff in post_save.
    """
    if instance.pk:
        try:
            instance._old_status = sender.objects.get(pk=instance.pk).status
        except sender.DoesNotExist:
            instance._old_status = None
    else:
        instance._old_status = None


@receiver(post_save, sender='sales.SalesOrder')
def on_order_saved(sender, instance, created, **kwargs):
    """
    Trigger alerts when an order status changes to Completed.
    """
    old_status = getattr(instance, '_old_status', None)
    new_status = instance.status

    if new_status == 'Completed' and old_status != 'Completed':
        try:
            alert_order_completed(instance)
        except Exception as e:
            logger.error(f"alert_order_completed failed: {e}")


# ─────────────────────────────────────────────────────────────────────────────
# PAYMENT signals
# ─────────────────────────────────────────────────────────────────────────────

@receiver(post_save, sender='sales.Payment')
def on_payment_saved(sender, instance, created, **kwargs):
    """
    1. Send payment-received alert when a new payment is created.
    2. Auto-recalculate order's payment_status.
    """
    if created:
        try:
            alert_payment_received(instance)
        except Exception as e:
            logger.error(f"alert_payment_received failed: {e}")

    if instance.sales_order_id:
        try:
            auto_update_order_payment_status(instance.sales_order)
        except Exception as e:
            logger.error(f"auto_update_order_payment_status failed: {e}")


@receiver(post_delete, sender='sales.Payment')
def on_payment_deleted(sender, instance, **kwargs):
    """Recalculate order payment_status after a payment is deleted."""
    if instance.sales_order_id:
        try:
            auto_update_order_payment_status(instance.sales_order)
        except Exception as e:
            logger.error(f"auto_update_order_payment_status on delete failed: {e}")


# ─────────────────────────────────────────────────────────────────────────────
# DISPATCH signals
# ─────────────────────────────────────────────────────────────────────────────

@receiver(pre_save, sender='sales.DispatchTracking')
def capture_dispatch_old_status(sender, instance, **kwargs):
    if instance.pk:
        try:
            instance._old_dispatch_status = sender.objects.get(pk=instance.pk).dispatch_status
        except sender.DoesNotExist:
            instance._old_dispatch_status = None
    else:
        instance._old_dispatch_status = None


@receiver(post_save, sender='sales.DispatchTracking')
def on_dispatch_saved(sender, instance, created, **kwargs):
    """Alert when a dispatch status changes to 'Dispatched'."""
    old_st = getattr(instance, '_old_dispatch_status', None)
    new_st = instance.dispatch_status

    if new_st == 'Dispatched' and old_st != 'Dispatched':
        try:
            order = instance.sales_order
            if order:
                alert_order_dispatched(order, instance)
        except Exception as e:
            logger.error(f"alert_order_dispatched failed: {e}")


# Sorting-session → fabric status and decolorization-session → tank status
# auto-updates (auto_update_fabric_status / auto_update_tank_status in tasks.py)
# are intentionally NOT connected: they overwrite the statuses that the
# workflow actions set (e.g. resetting fabric already in decolorization back
# to "Sorted"). They will be replaced by the status redesign in Phase 3.


# ─────────────────────────────────────────────────────────────────────────────
# CHEMICAL ISSUANCE signals — check stock levels after every issuance
# ─────────────────────────────────────────────────────────────────────────────

# Stock deduction itself happens in ChemicalIssuanceViewSet.perform_create.
# Recalculating from total_stock here would double-deduct and overwrite manual
# remaining_stock edits; stock accuracy is addressed by the Phase 3 ledger.

@receiver(post_save, sender='decolorization.ChemicalIssuance')
def on_chemical_issuance_saved(sender, instance, **kwargs):
    """Alert management if any chemical is now critically low."""
    try:
        check_chemical_stock_alerts()
    except Exception as e:
        logger.error(f"check_chemical_stock_alerts failed: {e}")
