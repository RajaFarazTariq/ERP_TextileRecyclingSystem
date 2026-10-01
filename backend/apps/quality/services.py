"""Quality rules: who may inspect what, how a checklist is judged, and quarantine."""
from django.db.models import Q
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError

from .models import Inspection

# Who records inspections at each stage (admins always can)
STAGE_ROLES = {
    'Incoming': {'warehouse_supervisor'},
    'In-process': {'sorting_supervisor', 'decolorization_supervisor', 'drying_supervisor'},
    'Finished': {'drying_supervisor'},
}


def check_may_inspect(user, stage):
    role = getattr(user, 'role', None)
    if role != 'admin' and role not in STAGE_ROLES.get(stage, set()):
        raise PermissionDenied(f"Your role can't record {stage.lower()} inspections.")


def judge(kind, value, min_value, max_value, passed):
    """Whether one checklist line passes. Measurements are judged against their limits."""
    if kind != 'Measure':
        if passed is None:
            raise ValidationError('Mark the check as passed or failed.')
        return passed
    if value is None:
        raise ValidationError('Enter the measured value.')
    return (min_value is None or value >= min_value) and (max_value is None or value <= max_value)


# ── Quarantine ──────────────────────────────────────────────────────────────

def _open_failures():
    return Inspection.objects.filter(result='Fail', released_at__isnull=True)


def blocking_inspection(fabric=None, stock=None):
    """The failed, unreleased inspection holding a lot or delivery, if any."""
    if fabric is not None:
        return _open_failures().filter(Q(fabric=fabric) | Q(stock_id=fabric.stock_id)).first()
    if stock is not None:
        return _open_failures().filter(stock=stock).first()
    return None


def quarantined_ids():
    """(delivery ids, lot ids) currently in quarantine, for list screens."""
    stock_ids, fabric_ids = set(), set()
    for stock_id, fabric_id in _open_failures().values_list('stock_id', 'fabric_id'):
        if stock_id:
            stock_ids.add(stock_id)
        if fabric_id:
            fabric_ids.add(fabric_id)
    return stock_ids, fabric_ids


def check_usable(fabric=None, stock=None, field='fabric', verb='used'):
    """Quarantined material can't go into production or sales until an admin releases it."""
    held = blocking_inspection(fabric=fabric, stock=stock)
    if held:
        what = 'This delivery' if fabric is None else 'This fabric lot'
        raise ValidationError({field: [
            f"{what} is in quarantine after failing inspection {held.number} and can't be {verb} "
            f'until an admin releases it.'
        ]})


def check_lot_change(serializer, data, verb):
    """For session serializers: check the lot when a session is created or moved to another lot."""
    fabric = data.get('fabric')
    if fabric is not None and (serializer.instance is None or serializer.instance.fabric_id != fabric.pk):
        check_usable(fabric=fabric, verb=verb)


def release(inspection, user, note):
    if not inspection.quarantined:
        raise ValidationError({'status': ['Only material in quarantine can be released.']})
    if not note.strip():
        raise ValidationError({'note': ['Say why the material is released (e.g. re-tested, returned to supplier).']})
    inspection.released_by = user
    inspection.released_at = timezone.now()
    inspection.release_note = note.strip()
    inspection.save(update_fields=['released_by', 'released_at', 'release_note'])
