"""
The approvals inbox: everything waiting for an admin's decision, read from
the modules that own it.

Nothing is decided here. Each item names the module's own endpoints
(`actions`), so the rules stay where they are: the page posts to
`procurement/requisitions/5/approve` and so on, and shows whatever the module
answers.
"""
from decimal import Decimal

from django.utils import timezone

from apps.decolorization.models import DecolorizationSession
from apps.procurement.models import PurchaseOrder, PurchaseRequisition
from apps.production.models import ProductionOrder
from apps.quality.models import Inspection
from apps.sales import services as sales
from apps.sales.models import SalesReturn
from apps.workforce.models import LeaveRequest

ZERO = Decimal('0')


def fixed(value):
    return None if value is None else f'{value:.2f}'


def _action(name, label, path, success, reason=None, required=False):
    """`reason` is the name of the field the endpoint reads its reason from, when it takes one."""
    return {'name': name, 'label': label, 'path': path, 'success': success,
            'reason_field': reason, 'reason_required': required}


def _row(kind, pk, today, *, number, title, detail, day, href, actions, amount=None, weight=None, requested_by=''):
    day = timezone.localdate(day) if hasattr(day, 'hour') else day
    return {
        'key': f'{kind}:{pk}', 'id': pk, 'number': number, 'title': title, 'detail': detail,
        'amount': fixed(amount), 'weight': fixed(weight), 'requested_by': requested_by,
        'date': day.isoformat(), 'age_days': max((today - day).days, 0), 'href': href, 'actions': actions,
    }


def _requisitions(today):
    requests = (PurchaseRequisition.objects.filter(status='Submitted')
                .select_related('requested_by').prefetch_related('lines'))
    for r in requests:
        lines = list(r.lines.all())
        base = f'procurement/requisitions/{r.pk}'
        yield _row(
            'requisition', r.pk, today, number=r.number, title=', '.join(line.material for line in lines),
            detail=f'Needed by {r.needed_by:%d %b %Y}' if r.needed_by else (r.notes or ''),
            weight=sum((line.quantity_kg for line in lines), ZERO), requested_by=r.requested_by.username,
            day=r.created_at, href='/procurement',
            actions=[_action('approve', 'Approve', f'{base}/approve', 'Request approved.'),
                     _action('reject', 'Reject', f'{base}/reject', 'Request rejected.', 'reason', True)],
        )


def _purchase_orders(today):
    orders = (PurchaseOrder.objects.filter(status='Submitted')
              .select_related('vendor', 'created_by').prefetch_related('lines'))
    for o in orders:
        lines = list(o.lines.all())
        materials = ', '.join(line.material for line in lines)
        yield _row(
            'purchase_order', o.pk, today, number=o.number, title=o.vendor.name,
            detail=f'Amendment {o.revision}: {materials}' if o.revision else materials,
            amount=o.total_amount, weight=sum((line.quantity_kg for line in lines), ZERO),
            requested_by=o.created_by.username, day=o.created_at, href='/procurement',
            actions=[_action('approve', 'Approve', f'procurement/orders/{o.pk}/approve', 'Purchase order approved.')],
        )


def _quarantine(today):
    held = (Inspection.objects.filter(result='Fail', released_at__isnull=True)
            .select_related('stock', 'fabric', 'inspector'))
    for i in held:
        material = i.fabric.material_type if i.fabric else i.stock.fabric_type
        target = f'Lot #{i.fabric_id}' if i.fabric_id else f'Delivery #{i.stock_id}'
        yield _row(
            'quarantine', i.pk, today, number=i.number, title=material, detail=f'{target}: {i.rejection_reason}',
            weight=i.fabric.remaining_quantity if i.fabric else i.stock.our_weight,
            requested_by=i.inspector.username, day=i.inspected_on, href='/quality',
            actions=[_action('release', 'Release', f'quality/inspections/{i.pk}/release', 'Released from quarantine.',
                             'note', True)],
        )


def _production_orders(today):
    for o in ProductionOrder.objects.filter(status='Draft').select_related('fabric', 'created_by'):
        yield _row(
            'production_order', o.pk, today, number=o.number, title=o.product_name,
            detail=f'{o.fabric.material_type}, planned {o.planned_start:%d %b} to {o.planned_end:%d %b %Y}',
            weight=o.planned_input_kg, requested_by=o.created_by.username, day=o.created_at, href='/production',
            actions=[_action('release', 'Release', f'production/orders/{o.pk}/release', 'Production order released.')],
        )


def _sales_returns(today):
    returns = SalesReturn.objects.filter(status='Requested').select_related('order__customer', 'created_by')
    for r in returns:
        order = r.order
        base = f'sales/returns/{r.pk}'
        yield _row(
            'sales_return', r.pk, today, number=r.number,
            title=order.customer.name if order.customer else order.buyer_name,
            detail=f'Order #{order.pk}, {"restock" if r.restock else "write off"}: {r.reason}',
            # The credit the customer gets if it is approved
            amount=sales.amounts(r.weight, order.price_per_kg, order.discount_pct, order.tax_pct)[3],
            weight=r.weight, requested_by=r.created_by.username, day=r.created_at, href='/sales',
            actions=[_action('approve', 'Approve', f'{base}/approve', 'Return approved.'),
                     _action('reject', 'Reject', f'{base}/reject', 'Return rejected.', 'reason')],
        )


def _decolorization_batches(today):
    batches = (DecolorizationSession.objects.filter(status='Completed', approved_at__isnull=True)
               .select_related('tank', 'fabric', 'supervisor'))
    for s in batches:
        yield _row(
            'decolorization_batch', s.pk, today, number=f'Batch #{s.pk}', title=s.fabric.material_type,
            detail=f'{s.tank.name}: {s.input_quantity:,.2f} kg in, {s.waste_quantity:,.2f} kg waste',
            weight=s.output_quantity, requested_by=s.supervisor.username, day=s.end_date or s.start_date,
            href='/decolorization',
            actions=[_action('approve', 'Approve', f'decolorization/sessions/{s.pk}/approve', 'Batch approved.')],
        )


def _leave_requests(today):
    for leave in LeaveRequest.objects.filter(status='Pending').select_related('employee'):
        base = f'workforce/leave/{leave.pk}'
        days = f'{leave.days} day' if leave.days == 1 else f'{leave.days} days'
        yield _row(
            'leave', leave.pk, today, number=leave.employee.number, title=leave.employee.full_name,
            detail=(f'{leave.leave_type} leave, {leave.start_date:%d %b} to {leave.end_date:%d %b %Y} ({days})'
                    + (f': {leave.reason}' if leave.reason else '')),
            requested_by=leave.employee.full_name, day=leave.created_at, href='/workforce',
            actions=[_action('approve', 'Approve', f'{base}/approve', 'Leave approved.', 'note'),
                     _action('reject', 'Reject', f'{base}/reject', 'Leave rejected.', 'note')],
        )


KINDS = [
    ('requisition', 'Purchase requests', _requisitions),
    ('purchase_order', 'Purchase orders', _purchase_orders),
    ('quarantine', 'Quarantine', _quarantine),
    ('production_order', 'Production orders', _production_orders),
    ('sales_return', 'Sales returns', _sales_returns),
    ('decolorization_batch', 'Decolorization batches', _decolorization_batches),
    ('leave', 'Leave requests', _leave_requests),
]


def pending(today=None):
    today = today or timezone.localdate()
    groups = []
    for kind, label, collect in KINDS:
        items = sorted(collect(today), key=lambda row: (-row['age_days'], row['id']))
        groups.append({'kind': kind, 'label': label, 'count': len(items), 'items': items})
    ages = [row['age_days'] for group in groups for row in group['items']]
    return {'total': len(ages), 'oldest_days': max(ages) if ages else None, 'groups': groups}
