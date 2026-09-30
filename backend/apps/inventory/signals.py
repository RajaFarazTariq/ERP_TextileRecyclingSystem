# inventory/signals.py
"""
Keep the stock ledger in step with drying sessions and dispatches however they
are saved (API, admin, seed commands).
"""
from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver

from . import services


@receiver(post_save, sender='drying.DryingSession')
def drying_session_saved(sender, instance, **kwargs):
    services.sync_drying_session(instance)


@receiver(post_delete, sender='drying.DryingSession')
def drying_session_deleted(sender, instance, **kwargs):
    services.sync_drying_session(instance, deleted=True)


@receiver(post_save, sender='sales.DispatchTracking')
def dispatch_saved(sender, instance, **kwargs):
    services.sync_dispatch(instance)


@receiver(post_delete, sender='sales.DispatchTracking')
def dispatch_deleted(sender, instance, **kwargs):
    services.sync_dispatch(instance, deleted=True)


@receiver(post_save, sender='sales.SalesOrder')
def order_saved(sender, instance, created, **kwargs):
    # If an order is moved to another fabric lot, its dispatches move with it
    if not created:
        for dispatch in instance.dispatches.all():
            services.sync_dispatch(dispatch)
