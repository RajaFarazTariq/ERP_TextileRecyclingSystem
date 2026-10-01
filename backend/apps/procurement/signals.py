"""Keep PO and invoice statuses in step with deliveries and payments."""
from django.db.models.signals import post_delete, post_save, pre_save
from django.dispatch import receiver

from apps.warehouse.models import Stock
from .models import PurchaseOrderLine, SupplierPayment
from .services import refresh_order_status


@receiver(pre_save, sender=Stock)
def _remember_old_line(sender, instance, **kwargs):
    instance._old_po_line_id = (
        Stock.objects.filter(pk=instance.pk).values_list('po_line_id', flat=True).first() if instance.pk else None
    )


def _refresh_lines(*line_ids):
    for line in PurchaseOrderLine.objects.filter(pk__in=[i for i in line_ids if i]).select_related('order'):
        refresh_order_status(line.order)


@receiver(post_save, sender=Stock)
def _receipt_saved(sender, instance, **kwargs):
    _refresh_lines(instance.po_line_id, getattr(instance, '_old_po_line_id', None))


@receiver(post_delete, sender=Stock)
def _receipt_deleted(sender, instance, **kwargs):
    _refresh_lines(instance.po_line_id)


@receiver([post_save, post_delete], sender=SupplierPayment)
def _payment_changed(sender, instance, **kwargs):
    instance.invoice.refresh_status()
