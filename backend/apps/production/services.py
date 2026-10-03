"""Production rules: order life cycle, step sequence, and the figures derived from steps and materials."""
from decimal import Decimal

from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError

from apps.quality.services import check_usable
from .models import MaterialUse, OrderStep, ProductionOrder

ZERO = Decimal('0')
CENT = Decimal('0.01')

# Who runs production steps and records material use (admins always can)
FLOOR_ROLES = {'sorting_supervisor', 'decolorization_supervisor', 'drying_supervisor'}


def check_floor_user(user):
    from apps.core.permissions import has_duty
    if not has_duty(user, 'run_production', 'plan_production'):
        raise PermissionDenied('Your role is not allowed to update production steps.')


def _require(order, allowed, verb):
    if order.status not in allowed:
        raise ValidationError({'status': [f'A {order.status.lower()} order can\'t be {verb}.']})


# ── Building an order from its routing and bill of materials ────────────────

def build_steps(order):
    order.steps.all().delete()
    for step in order.routing.steps.select_related('stage'):
        OrderStep.objects.create(order=order, stage=step.stage, sequence=step.sequence,
                                 planned_hours=step.planned_hours, hourly_cost=step.hourly_cost)


def build_materials(order):
    order.materials.all().delete()
    if not order.bom_id:
        return
    for line in order.bom.lines.all():
        MaterialUse.objects.create(
            order=order, material=line.material, chemical=line.chemical, unit=line.unit, unit_cost=line.unit_cost,
            planned_quantity=(line.quantity_per_100kg * order.planned_input_kg / 100).quantize(CENT),
        )


# ── Life cycle ──────────────────────────────────────────────────────────────

def release(order, user):
    """Approve a draft for the shop floor (admin)."""
    _require(order, ('Draft',), 'released')
    if not order.steps.exists():
        raise ValidationError({'routing': ['The routing has no stages. Add stages to it first.']})
    check_usable(fabric=order.fabric, verb='processed')
    order.status = 'Released'
    order.released_by = user
    order.released_at = timezone.now()
    order.save(update_fields=['status', 'released_by', 'released_at'])


def cancel(order):
    _require(order, ProductionOrder.OPEN_STATUSES, 'cancelled')
    order.status = 'Cancelled'
    order.save(update_fields=['status'])
    order.steps.filter(status='In Progress').update(status='Pending', started_at=None)


@transaction.atomic
def start_step(step, user):
    order = step.order
    _require(order, ('Released', 'In Progress'), 'worked on')
    if step.status != 'Pending':
        raise ValidationError({'status': [f'This step is already {step.status.lower()}.']})
    waiting = order.steps.filter(sequence__lt=step.sequence).exclude(status__in=OrderStep.CLOSED).first()
    if waiting:
        raise ValidationError({'status': [f'Finish or skip "{waiting.stage.name}" first.']})
    check_usable(fabric=order.fabric, verb='processed')
    step.status = 'In Progress'
    step.started_at = timezone.now()
    if step.operator_id is None:
        step.operator = user
    step.save(update_fields=['status', 'started_at', 'operator'])
    if order.status == 'Released':
        order.status = 'In Progress'
        order.started_at = step.started_at
        order.save(update_fields=['status', 'started_at'])


def complete_step(step, input_kg, output_kg, waste_kg, actual_hours=None):
    if step.status != 'In Progress':
        raise ValidationError({'status': ['Start the step before completing it.']})
    if input_kg <= 0:
        raise ValidationError({'input_kg': ['Must be greater than zero.']})
    if output_kg < 0 or waste_kg < 0:
        raise ValidationError({'output_kg': ['Output and waste can\'t be negative.']})
    if output_kg + waste_kg > input_kg:
        raise ValidationError({'output_kg': [
            f'Output plus waste ({output_kg + waste_kg:,.2f} kg) is more than the input ({input_kg:,.2f} kg).'
        ]})
    step.finished_at = timezone.now()
    if actual_hours is None:
        seconds = Decimal((step.finished_at - step.started_at).total_seconds())
        actual_hours = (seconds / 3600).quantize(CENT)
    elif actual_hours < 0:
        raise ValidationError({'actual_hours': ['Hours can\'t be negative.']})
    step.status = 'Done'
    step.input_kg, step.output_kg, step.waste_kg, step.actual_hours = input_kg, output_kg, waste_kg, actual_hours
    step.save()


def skip_step(step):
    _require(step.order, ('Released', 'In Progress'), 'changed')
    if step.status in OrderStep.CLOSED:
        raise ValidationError({'status': [f'This step is already {step.status.lower()}.']})
    step.status = 'Skipped'
    step.started_at = None
    step.save(update_fields=['status', 'started_at'])


def complete(order, actual_output_kg=None):
    _require(order, ('In Progress',), 'completed')
    steps = list(order.steps.all())
    waiting = next((s for s in steps if s.status not in OrderStep.CLOSED), None)
    if waiting:
        raise ValidationError({'status': [f'"{waiting.stage.name}" is not finished yet.']})
    done = [s for s in steps if s.status == 'Done']
    if not done:
        raise ValidationError({'status': ['No step was carried out; cancel the order instead.']})
    if actual_output_kg is None:
        actual_output_kg = done[-1].output_kg
    if actual_output_kg < 0 or actual_output_kg > done[0].input_kg:
        raise ValidationError({'actual_output_kg': [
            f'Output must be between 0 and the {done[0].input_kg:,.2f} kg that went in.'
        ]})
    order.actual_output_kg = actual_output_kg
    order.status = 'Completed'
    order.completed_at = timezone.now()
    order.save(update_fields=['actual_output_kg', 'status', 'completed_at'])


# ── Figures ─────────────────────────────────────────────────────────────────

def figures(order):
    """Planned against actual for one order (uses prefetched steps and materials)."""
    steps = list(order.steps.all())
    materials = list(order.materials.all())
    done = [s for s in steps if s.status == 'Done']
    closed = [s for s in steps if s.status in OrderStep.CLOSED]
    current = next((s for s in steps if s.status == 'In Progress'), None) or next(
        (s for s in steps if s.status == 'Pending'), None)

    planned_hours = sum((s.planned_hours for s in steps), ZERO)
    actual_hours = sum((s.actual_hours or ZERO for s in done), ZERO)
    labour_cost = sum(((s.actual_hours or ZERO) * s.hourly_cost for s in done), ZERO)
    material_cost = sum(((m.actual_quantity or ZERO) * m.unit_cost for m in materials), ZERO)
    planned_cost = (sum((s.planned_hours * s.hourly_cost for s in steps), ZERO)
                    + sum((m.planned_quantity * m.unit_cost for m in materials), ZERO))
    total_cost = labour_cost + material_cost
    input_kg = done[0].input_kg if done else None
    output_kg = order.actual_output_kg if order.actual_output_kg is not None else (done[-1].output_kg if done else None)
    waste_kg = sum((s.waste_kg or ZERO for s in done), ZERO)
    finished = order.status == 'Completed'
    today = timezone.localdate()
    return {
        'progress_pct': round(len(closed) / len(steps) * 100) if steps else 0,
        'current_stage': current.stage.name if current and order.status in ('Released', 'In Progress') else None,
        'planned_hours': planned_hours,
        'actual_hours': actual_hours,
        'actual_input_kg': input_kg,
        'output_kg': output_kg,
        'waste_kg': waste_kg,
        'yield_pct': round(float(output_kg / input_kg * 100), 1) if finished and input_kg else None,
        'planned_cost': planned_cost.quantize(CENT),
        'labour_cost': labour_cost.quantize(CENT),
        'material_cost': material_cost.quantize(CENT),
        'total_cost': total_cost.quantize(CENT),
        'cost_per_kg': (total_cost / output_kg).quantize(CENT) if finished and output_kg else None,
        'is_late': order.status in ProductionOrder.OPEN_STATUSES and order.planned_end < today,
    }
