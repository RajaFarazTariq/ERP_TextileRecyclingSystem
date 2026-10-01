# inventory/services.py
"""
Sellable (dried) stock per fabric lot.

  on hand    = sum of StockMovement quantities for the lot
  reserved   = for Confirmed/Dispatched orders on the lot: ordered kg not yet dispatched
  available  = on hand - reserved

Stock enters when a drying session is completed (its output) and leaves when a
dispatch is recorded. sync_*() keep the ledger equal to those source records:
they compare what the source implies with what has been posted and post only
the difference, so creating, editing or deleting a source is always correct.
"""
from collections import defaultdict
from decimal import Decimal

from django.db import transaction
from django.db.models import Sum
from rest_framework.exceptions import ValidationError

from .models import StockMovement

ZERO = Decimal('0')
RESERVING_STATUSES = ('Confirmed', 'Dispatched')


def _current_user():
    from apps.audit.middleware import get_current_request
    request = get_current_request()
    user = getattr(request, 'user', None)
    return user if user is not None and user.is_authenticated else None


# ─────────────────────────────────────────────────────────────────────────────
# Stock figures
# ─────────────────────────────────────────────────────────────────────────────

def on_hand(fabric_id):
    total = StockMovement.objects.filter(fabric_id=fabric_id).aggregate(t=Sum('quantity'))['t']
    return total or ZERO


def dispatched_for_order(order_id, exclude_dispatch_id=None):
    from apps.sales.models import DispatchTracking
    qs = DispatchTracking.objects.filter(sales_order_id=order_id)
    if exclude_dispatch_id:
        qs = qs.exclude(pk=exclude_dispatch_id)
    return qs.aggregate(t=Sum('dispatched_weight'))['t'] or ZERO


def reserved(fabric_id, exclude_order_id=None):
    return availability_map([fabric_id], exclude_order_id=exclude_order_id)[fabric_id]['reserved']


def available(fabric_id, exclude_order_id=None):
    return availability_map([fabric_id], exclude_order_id=exclude_order_id)[fabric_id]['available']


def availability_map(fabric_ids=None, exclude_order_id=None):
    """{fabric_id: {'on_hand', 'reserved', 'available'}} in a fixed number of queries."""
    from apps.sales.models import SalesOrder, DispatchTracking

    movements = StockMovement.objects.all()
    orders = SalesOrder.objects.filter(status__in=RESERVING_STATUSES)
    if fabric_ids is not None:
        fabric_ids = list(fabric_ids)
        movements = movements.filter(fabric_id__in=fabric_ids)
        orders = orders.filter(fabric_id__in=fabric_ids)
    if exclude_order_id:
        orders = orders.exclude(pk=exclude_order_id)

    hand = dict(movements.values_list('fabric_id').annotate(t=Sum('quantity')))
    order_rows = list(orders.values_list('id', 'fabric_id', 'weight_sold'))
    shipped = dict(
        DispatchTracking.objects.filter(sales_order_id__in=[o[0] for o in order_rows])
        .values_list('sales_order_id').annotate(t=Sum('dispatched_weight'))
    )
    held = defaultdict(lambda: ZERO)
    for order_id, fabric_id, weight in order_rows:
        held[fabric_id] += max(ZERO, weight - shipped.get(order_id, ZERO))

    ids = fabric_ids if fabric_ids is not None else set(hand) | set(held)
    return {
        f: {
            'on_hand':   hand.get(f) or ZERO,
            'reserved':  held[f],
            'available': (hand.get(f) or ZERO) - held[f],
        }
        for f in ids
    }


def lock_fabric(fabric_id):
    """Serialize stock checks on one lot (row lock on PostgreSQL; no-op on SQLite)."""
    from apps.sorting.models import FabricStock
    if fabric_id and transaction.get_connection().in_atomic_block:
        list(FabricStock.objects.select_for_update().filter(pk=fabric_id).values_list('pk'))


# ─────────────────────────────────────────────────────────────────────────────
# Rules
# ─────────────────────────────────────────────────────────────────────────────

def _check_not_quarantined(fabric_id, field):
    """Lots held by a failed quality inspection can't be sold until released."""
    from apps.quality.services import check_usable
    from apps.sorting.models import FabricStock
    fabric = FabricStock.objects.filter(pk=fabric_id).first()
    if fabric:
        check_usable(fabric=fabric, field=field, verb='sold')


def check_order_reservation(fabric_id, weight_sold, order_id=None):
    """A Confirmed/Dispatched order must be covered by available dried stock."""
    lock_fabric(fabric_id)
    _check_not_quarantined(fabric_id, 'fabric')
    still_needed = weight_sold - (dispatched_for_order(order_id) if order_id else ZERO)
    free = available(fabric_id, exclude_order_id=order_id)
    if still_needed > free:
        raise ValidationError({'weight_sold': [
            f'Only {max(free, ZERO):,.2f} kg of dried stock is available for this fabric '
            f'({still_needed:,.2f} kg needed). Save the order as Draft until stock is ready.'
        ]})


def check_dispatch(order, weight, dispatch_id=None):
    """A dispatch needs a confirmed order and may not exceed what is left on it."""
    if order.status not in RESERVING_STATUSES:
        raise ValidationError({'sales_order': ['Confirm the order before dispatching it.']})
    lock_fabric(order.fabric_id)
    _check_not_quarantined(order.fabric_id, 'sales_order')
    remaining = order.weight_sold - dispatched_for_order(order.pk, exclude_dispatch_id=dispatch_id)
    if weight > remaining:
        raise ValidationError({'dispatched_weight': [
            f'Only {max(remaining, ZERO):,.2f} kg of this order is left to dispatch.'
        ]})
    # The order's reservation normally covers this; orders confirmed before
    # stock tracking existed may not be, so check the stock itself too.
    previous = ZERO
    if dispatch_id:
        from apps.sales.models import DispatchTracking
        previous = DispatchTracking.objects.filter(pk=dispatch_id).values_list(
            'dispatched_weight', flat=True).first() or ZERO
    free_for_this_order = on_hand(order.fabric_id) + previous - reserved(order.fabric_id, exclude_order_id=order.pk)
    if weight > free_for_this_order:
        raise ValidationError({'dispatched_weight': [
            f'Only {max(free_for_this_order, ZERO):,.2f} kg of dried stock is on hand for this order.'
        ]})


# ─────────────────────────────────────────────────────────────────────────────
# Ledger sync
# ─────────────────────────────────────────────────────────────────────────────

def _sync(source_type, source_id, movement_type, expected, note=''):
    """Post whatever difference remains between `expected` {fabric_id: qty} and the ledger."""
    posted = dict(
        StockMovement.objects.filter(source_type=source_type, source_id=source_id)
        .values_list('fabric_id').annotate(t=Sum('quantity'))
    )
    user = _current_user()
    for fabric_id in set(posted) | set(expected):
        delta = expected.get(fabric_id, ZERO) - (posted.get(fabric_id) or ZERO)
        if delta:
            StockMovement.objects.create(
                fabric_id=fabric_id, movement_type=movement_type, quantity=delta,
                source_type=source_type, source_id=source_id, note=note, created_by=user,
            )


def sync_drying_session(session, deleted=False):
    expected = {}
    if not deleted and session.status == 'Completed' and session.output_quantity:
        expected = {session.fabric_id: Decimal(session.output_quantity)}
    _sync('DryingSession', session.pk, StockMovement.DRYING_OUTPUT, expected,
          note=f'Drying session #{session.pk}')


def sync_dispatch(dispatch, deleted=False):
    expected = {}
    if not deleted and dispatch.dispatched_weight:
        fabric_id = dispatch.sales_order.fabric_id
        expected = {fabric_id: -Decimal(dispatch.dispatched_weight)}
    _sync('DispatchTracking', dispatch.pk, StockMovement.DISPATCH, expected,
          note=f'Dispatch #{dispatch.pk} for order #{dispatch.sales_order_id}')


def post_adjustment(fabric_id, quantity, note, user):
    """Manual correction (admin only), e.g. after a physical stock count."""
    if not note or not note.strip():
        raise ValidationError({'note': ['A reason is required for stock adjustments.']})
    with transaction.atomic():
        lock_fabric(fabric_id)
        if on_hand(fabric_id) + quantity < ZERO:
            raise ValidationError({'quantity': ['Adjustment would make on-hand stock negative.']})
        movement = StockMovement.objects.create(
            fabric_id=fabric_id, movement_type=StockMovement.ADJUSTMENT, quantity=quantity,
            source_type='Adjustment', source_id=0, note=note.strip()[:255], created_by=user,
        )
        StockMovement.objects.filter(pk=movement.pk).update(source_id=movement.pk)
        movement.source_id = movement.pk
    return movement
