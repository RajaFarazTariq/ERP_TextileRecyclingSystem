"""Procurement rules shared by the API, the admin and the signals."""
from decimal import Decimal

from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from .models import PurchaseOrder, PurchaseRequisition, SupplierInvoice

ZERO = Decimal('0')
EDITABLE_PO = ('Draft', 'Submitted', 'Approved', 'Partially Received')
AMENDED_ON_EDIT = ('Approved', 'Partially Received')


# ── Status transitions ──────────────────────────────────────────────────────

def _require(obj, allowed, verb):
    if obj.status not in allowed:
        raise ValidationError({'status': [f'Only {" or ".join(s.lower() for s in allowed)} records can be {verb}.']})


def submit_requisition(req):
    _require(req, ('Draft', 'Rejected'), 'submitted')
    if not req.lines.exists():
        raise ValidationError({'lines': ['Add at least one material before submitting.']})
    req.status = 'Submitted'
    req.rejection_reason = ''
    req.save(update_fields=['status', 'rejection_reason'])


def decide_requisition(req, user, approve, reason=''):
    _require(req, ('Submitted',), 'approved or rejected')
    if not approve and not reason.strip():
        raise ValidationError({'reason': ['Say why the request is rejected.']})
    req.status = 'Approved' if approve else 'Rejected'
    req.decided_by = user
    req.decided_at = timezone.now()
    req.rejection_reason = '' if approve else reason.strip()
    req.save(update_fields=['status', 'decided_by', 'decided_at', 'rejection_reason'])


def submit_order(order):
    _require(order, ('Draft',), 'submitted')
    if not order.lines.exists():
        raise ValidationError({'lines': ['Add at least one line before submitting.']})
    order.status = 'Submitted'
    order.save(update_fields=['status'])


@transaction.atomic
def approve_order(order, user):
    _require(order, ('Submitted',), 'approved')
    order.approved_by = user
    order.approved_at = timezone.now()
    order.status = 'Approved'
    order.save(update_fields=['approved_by', 'approved_at', 'status'])
    # An amendment of an order that already has deliveries goes straight back to its receiving status
    refresh_order_status(order)
    if order.requisition_id:
        PurchaseRequisition.objects.filter(pk=order.requisition_id, status='Approved').update(status='Ordered')


def cancel_order(order):
    _require(order, ('Draft', 'Submitted', 'Approved'), 'cancelled')
    if any(line.receipts.exists() for line in order.lines.all()):
        raise ValidationError({'status': ['Goods have been received against this order; close it instead.']})
    order.status = 'Cancelled'
    order.save(update_fields=['status'])


def close_order(order):
    """Short-close: no more deliveries are expected."""
    _require(order, ('Approved', 'Partially Received', 'Received'), 'closed')
    order.status = 'Closed'
    order.save(update_fields=['status'])


def refresh_order_status(order):
    """Approved / Partially Received / Received, from what has been delivered."""
    if order.status not in ('Approved', 'Partially Received', 'Received'):
        return
    lines = list(order.lines.all())
    received = [line.received_kg() for line in lines]
    if lines and all(r >= line.quantity_kg for r, line in zip(received, lines)):
        status = 'Received'
    elif any(r > 0 for r in received):
        status = 'Partially Received'
    else:
        status = 'Approved'
    if status != order.status:
        order.status = status
        order.save(update_fields=['status'])


# ── Editing orders (amendments) ─────────────────────────────────────────────

def check_order_editable(order):
    if order.status not in EDITABLE_PO:
        raise ValidationError({'status': [f'A {order.status.lower()} order can no longer be changed.']})


def mark_amended(order):
    """Changing an approved order needs a fresh approval."""
    if order.status in AMENDED_ON_EDIT:
        order.revision += 1
        order.status = 'Submitted'
        order.approved_by = None
        order.approved_at = None
        order.save(update_fields=['revision', 'status', 'approved_by', 'approved_at'])


def check_line_change(line, quantity_kg=None, removing=False):
    received = line.received_kg() + line.rejected_kg()
    if removing and line.receipts.exists():
        raise ValidationError({'lines': [f'"{line.material}" has deliveries and can\'t be removed.']})
    if quantity_kg is not None and quantity_kg < line.received_kg():
        raise ValidationError({'lines': [
            f'"{line.material}": {line.received_kg()} kg has already been received; the quantity can\'t be lower.']})
    return received


# ── Goods receipts (warehouse deliveries linked to a PO line) ───────────────

def check_receipt(po_line, vendor, current_line_id=None):
    """A delivery can be booked against an open PO line from the same supplier."""
    if po_line is None:
        return
    order = po_line.order
    if order.status not in PurchaseOrder.OPEN_STATUSES and po_line.pk != current_line_id:
        raise ValidationError({'po_line': [f'{order.number} is {order.status.lower()}; goods can only be received against an approved order.']})
    if vendor is not None and order.vendor_id != vendor.pk:
        raise ValidationError({'po_line': [f'{order.number} is from {order.vendor.name}, not {vendor.name}.']})


def line_remaining(line):
    return max(line.quantity_kg - line.received_kg(), ZERO)


# ── Invoices and payments ───────────────────────────────────────────────────

def check_invoice(vendor, purchase_order):
    if purchase_order is not None and vendor is not None and purchase_order.vendor_id != vendor.pk:
        raise ValidationError({'purchase_order': [f'{purchase_order.number} is from {purchase_order.vendor.name}.']})


def check_payment(invoice, amount, payment_id=None):
    if amount is None or amount <= 0:
        raise ValidationError({'amount': ['Must be greater than zero.']})
    paid = invoice.payments.exclude(pk=payment_id).values_list('amount', flat=True)
    outstanding = invoice.total - sum(paid, ZERO)
    if amount > outstanding:
        raise ValidationError({'amount': [f'Only Rs. {outstanding:,.2f} is outstanding on this invoice.']})


def check_return(receipt, quantity_kg, return_id=None):
    if quantity_kg is None or quantity_kg <= 0:
        raise ValidationError({'quantity_kg': ['Must be greater than zero.']})
    returned = receipt.purchase_returns.exclude(pk=return_id).values_list('quantity_kg', flat=True)
    left = receipt.our_weight - sum(returned, ZERO)
    if quantity_kg > left:
        raise ValidationError({'quantity_kg': [f'Only {left} kg of this delivery can still be returned.']})


def outstanding(invoice: SupplierInvoice):
    return max(invoice.total - invoice.paid_amount(), ZERO)
