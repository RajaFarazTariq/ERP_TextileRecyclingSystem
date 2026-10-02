"""Maintenance rules: work order steps, machine status, spare part stock and the performance report."""
from datetime import date, timedelta
from decimal import Decimal

from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError

from apps.core.permissions import is_admin
from apps.decolorization.models import DecolorizationSession
from apps.drying.models import DryingSession
from .models import Machine, PartUse, SparePart, WorkOrder

ZERO = Decimal('0')
DEFAULT_PERIOD_DAYS = 90


def fixed(value):
    return f'{value:.2f}'


# ── Machine status ──────────────────────────────────────────────────────────

def refresh_machine(machine):
    """Set the machine's status from its unfinished work orders. A retired machine is left alone."""
    if machine.status == 'Retired':
        return
    active = list(machine.work_orders.exclude(status__in=WorkOrder.CLOSED))
    if any(o.is_breakdown for o in active):
        status = 'Broken down'
    elif any(o.status == 'In progress' for o in active):
        status = 'Under maintenance'
    elif machine.status in ('Broken down', 'Under maintenance'):
        status = 'Running'
    else:
        return
    if status != machine.status:
        machine.status = status
        machine.save(update_fields=['status'])


# ── Work orders ─────────────────────────────────────────────────────────────

def check_may_work(user, order):
    """Admins, the assigned person, or anyone when nobody is assigned."""
    if not is_admin(user) and order.assigned_to_id not in (None, user.pk):
        raise PermissionDenied('This work order is assigned to someone else.')


def check_open(order):
    if order.closed:
        raise ValidationError({'status': [f"A work order that is {order.status.lower()} can't be changed."]})


@transaction.atomic
def start(order, user):
    check_may_work(user, order)
    if order.status != 'Open':
        raise ValidationError({'status': ['Only an open work order can be started.']})
    order.status = 'In progress'
    order.started_at = timezone.now()
    order.save(update_fields=['status', 'started_at'])
    refresh_machine(order.machine)


def _amount(data, name, current):
    raw = data.get(name)
    if raw in (None, ''):
        return current
    try:
        value = Decimal(str(raw))
    except ArithmeticError:
        raise ValidationError({name: ['Enter a number.']})
    if not value.is_finite() or value < 0:
        raise ValidationError({name: ["Can't be negative."]})
    return value.quantize(Decimal('0.01'))


@transaction.atomic
def complete(order, user, data):
    check_may_work(user, order)
    check_open(order)
    work_done = str(data.get('work_done') or '').strip()
    if not work_done:
        raise ValidationError({'work_done': ['Describe the work that was done.']})
    downtime = data.get('downtime_minutes')
    if downtime not in (None, ''):
        try:
            order.downtime_minutes = int(downtime)
        except (TypeError, ValueError):
            raise ValidationError({'downtime_minutes': ['Enter whole minutes.']})
        if order.downtime_minutes < 0:
            raise ValidationError({'downtime_minutes': ["Can't be negative."]})
    order.labour_hours = _amount(data, 'labour_hours', order.labour_hours)
    order.labour_cost = _amount(data, 'labour_cost', order.labour_cost)
    order.other_cost = _amount(data, 'other_cost', order.other_cost)
    order.work_done = work_done
    order.completed_at = timezone.now()
    order.started_at = order.started_at or order.completed_at
    order.status = 'Done'
    order.save()
    refresh_machine(order.machine)
    # A finished preventive job moves its schedule forward
    if order.schedule_id:
        order.schedule.last_done_on = timezone.localdate(order.completed_at)
        order.schedule.save()


@transaction.atomic
def cancel(order):
    check_open(order)
    order.status = 'Cancelled'
    order.save(update_fields=['status'])
    refresh_machine(order.machine)


@transaction.atomic
def create_preventive(schedule, user):
    """Raise the work order for a schedule, unless one is still open."""
    if not schedule.is_active:
        raise ValidationError({'schedule': ['This schedule is not in use.']})
    waiting = schedule.work_orders.exclude(status__in=WorkOrder.CLOSED).first()
    if waiting:
        raise ValidationError({'schedule': [f'{waiting.number} is still open for this schedule.']})
    return WorkOrder.objects.create(
        machine=schedule.machine, kind='Preventive', schedule=schedule, title=schedule.task,
        description=schedule.instructions, reported_by=user,
    )


# ── Spare parts ─────────────────────────────────────────────────────────────

@transaction.atomic
def use_part(order, part, quantity, user):
    check_may_work(user, order)
    if order.closed:
        raise ValidationError({'work_order': [f"Parts can't be added to a work order that is {order.status.lower()}."]})
    if quantity <= 0:
        raise ValidationError({'quantity': ['Must be greater than zero.']})
    part = SparePart.objects.select_for_update().get(pk=part.pk)
    if quantity > part.stock_quantity:
        raise ValidationError({'quantity': [f'Only {float(part.stock_quantity):g} {part.unit} of {part.name} in stock.']})
    part.stock_quantity -= quantity
    part.save(update_fields=['stock_quantity'])
    return PartUse.objects.create(work_order=order, part=part, quantity=quantity, unit_cost=part.unit_cost,
                                  used_by=user)


@transaction.atomic
def return_part(use):
    """Undo a part use: the quantity goes back into stock."""
    if use.work_order.closed:
        raise ValidationError({'work_order': [
            f"Parts can't be removed from a work order that is {use.work_order.status.lower()}."]})
    part = SparePart.objects.select_for_update().get(pk=use.part_id)
    part.stock_quantity += use.quantity
    part.save(update_fields=['stock_quantity'])
    use.delete()


@transaction.atomic
def receive(part, data):
    """Add stock to a part; a cost given here becomes the part's current cost."""
    quantity = _amount(data, 'quantity', None)
    if not quantity:
        raise ValidationError({'quantity': ['Enter the quantity received.']})
    part = SparePart.objects.select_for_update().get(pk=part.pk)
    part.stock_quantity += quantity
    part.unit_cost = _amount(data, 'unit_cost', part.unit_cost)
    part.save(update_fields=['stock_quantity', 'unit_cost'])
    return part


# ── Reports ─────────────────────────────────────────────────────────────────

def _day(text):
    try:
        return date.fromisoformat(text)
    except (TypeError, ValueError):
        return None


def period(params):
    """
    First and last day asked for with the DateFilter params (see core/filters.py).
    With no period the last 90 days are used. A period never runs past today.
    """
    today = timezone.localdate()
    start = end = None
    choice = params.get('date_filter')
    if choice == 'today':
        start = today
    elif choice == 'this_week':
        start = today - timedelta(days=today.weekday())
    elif choice == 'this_month':
        start = today.replace(day=1)
    elif choice == 'this_year':
        start = today.replace(month=1, day=1)
    elif str(params.get('year', '')).isdigit() and 1 <= int(params['year']) <= 9998:
        start, end = date(int(params['year']), 1, 1), date(int(params['year']), 12, 31)
    elif first := _day(f"{params.get('month')}-01"):
        start = first
        end = (first.replace(day=28) + timedelta(days=4)).replace(day=1) - timedelta(days=1)
    else:
        start, end = _day(params.get('start')), _day(params.get('end'))

    end = min(end or today, today)
    if start is None or start > end:
        start = end - timedelta(days=DEFAULT_PERIOD_DAYS - 1)
    return start, end


def orders_between(start, end):
    """Work orders reported in the period, leaving out cancelled ones."""
    return (WorkOrder.objects.exclude(status='Cancelled')
            .filter(reported_at__date__gte=start, reported_at__date__lte=end))


def performance(params):
    start, end = period(params)
    days = (end - start).days + 1
    period_hours = Decimal(days * 24)

    by_machine = {}
    for order in orders_between(start, end).prefetch_related('parts').order_by('reported_at'):
        by_machine.setdefault(order.machine_id, []).append(order)

    rows, impact = [], []
    for machine in Machine.objects.select_related('tank', 'dryer'):
        orders = by_machine.get(machine.pk, [])
        breakdowns = [o for o in orders if o.is_breakdown]
        downtime = Decimal(sum(o.downtime_minutes for o in orders)) / 60
        mtbf = None
        if len(breakdowns) >= 2:
            span = breakdowns[-1].reported_at - breakdowns[0].reported_at
            mtbf = round(span.total_seconds() / 86400 / (len(breakdowns) - 1), 1)
        availability = max(ZERO, (period_hours - downtime) / period_hours * 100)
        rows.append({
            'machine': machine.pk, 'code': machine.code, 'name': machine.name, 'category': machine.category,
            'status': machine.status,
            'work_orders': len(orders),
            'breakdowns': len(breakdowns),
            'downtime_hours': fixed(downtime),
            'cost': fixed(sum((o.total_cost for o in orders), ZERO)),
            'downtime_cost': fixed(downtime * machine.hourly_operating_cost),
            'mtbf_days': mtbf,
            'availability_pct': round(float(availability), 1),
        })
        if machine.tank_id or machine.dryer_id:
            if machine.tank_id:
                sessions = DecolorizationSession.objects.filter(
                    tank_id=machine.tank_id, start_date__date__gte=start, start_date__date__lte=end)
            else:
                sessions = DryingSession.objects.filter(
                    dryer_id=machine.dryer_id, created_at__date__gte=start, created_at__date__lte=end)
            impact.append({
                'machine': machine.pk, 'code': machine.code, 'name': machine.name,
                'equipment': machine.tank.name if machine.tank_id else machine.dryer.name,
                'equipment_kind': 'Tank' if machine.tank_id else 'Dryer',
                'downtime_hours': fixed(downtime),
                'breakdowns': len(breakdowns),
                'sessions': sessions.count(),
            })

    downtime_total = sum((Decimal(r['downtime_hours']) for r in rows), ZERO)
    machine_hours = period_hours * len(rows)
    return {
        'start': start.isoformat(), 'end': end.isoformat(), 'days': days,
        'breakdowns': sum(r['breakdowns'] for r in rows),
        'downtime_hours': fixed(downtime_total),
        'cost': fixed(sum((Decimal(r['cost']) for r in rows), ZERO)),
        'availability_pct': (round(float((machine_hours - downtime_total) / machine_hours * 100), 1)
                             if rows else None),
        'machines': rows,
        'impact': impact,
    }
