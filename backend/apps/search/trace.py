"""
Batch traceability: everything recorded about one fabric lot, from the
delivery it came from to the customers it was sold to.

Each section is read from the module that owns it, and is shown only to a role
that may read that module's own list (SECTION_PERMISSIONS). A section the role
may not read is returned as {'restricted': True}.
"""
from decimal import Decimal

from django.db.models import Prefetch
from django.utils import timezone
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError

from apps.core.permissions import (
    IsAdminUser, IsDecolorizationOrAdmin, IsDryingSupervisor, IsSortingOrAdmin, IsWarehouseOrAdmin,
    SharedReadPermission,
)
from apps.decolorization.models import ChemicalIssuance, DecolorizationSession
from apps.drying.models import DryingSession
from apps.inventory import services as inventory
from apps.inventory.models import StockMovement
from apps.procurement.views import IsProcurementUser
from apps.production import services as production
from apps.production.models import ProductionOrder
from apps.quality import services as quality
from apps.quality.models import Inspection
from apps.quality.views import IsQualityUser
from apps.sales import services as sales
from apps.sales.models import SalesOrder
from apps.sorting.models import FabricStock, SortingSession

ZERO = Decimal('0')
RESTRICTED = {'restricted': True}
SOLD_STATUSES = ('Confirmed', 'Dispatched', 'Completed')

# The permission of each section's own list endpoint. Sales and customer data
# are for admins only here, the same as the Sales page.
SECTION_PERMISSIONS = {
    'source': IsWarehouseOrAdmin,
    'purchase_order': IsProcurementUser,
    'lot': IsSortingOrAdmin,
    'sorting': IsSortingOrAdmin,
    'decolorization': IsDecolorizationOrAdmin,
    'drying': IsDryingSupervisor,
    'production': SharedReadPermission,
    'quality': IsQualityUser,
    'stock': SharedReadPermission,
    'sales': IsAdminUser,
}


def allowed_sections(request):
    return {name for name, permission in SECTION_PERMISSIONS.items() if permission().has_permission(request, None)}


def _fixed(value):
    return None if value is None else f'{value:.2f}'


def _name(user):
    return user.username if user else None


def _total(rows, field):
    return sum((getattr(row, field) or ZERO for row in rows), ZERO)


# ── Finding the lot ─────────────────────────────────────────────────────────

LOOKUPS = ('lot', 'order', 'stock', 'production')


def resolve_lots(request):
    """The lot ids a request points to: ?lot=, ?order=, ?stock= or ?production=."""
    given = [(key, request.query_params.get(key)) for key in LOOKUPS if request.query_params.get(key)]
    if not given:
        raise ValidationError({'lot': ['Give a fabric lot, sales order, delivery or production order.']})
    key, value = given[0]
    if not value.isdigit():
        raise ValidationError({key: ['This must be a number.']})
    pk = int(value)
    if key == 'order':
        if 'sales' not in allowed_sections(request):
            raise PermissionDenied('Only an admin can trace a sales order.')
        ids = list(SalesOrder.objects.filter(pk=pk).values_list('fabric_id', flat=True))
    elif key == 'stock':
        ids = list(FabricStock.objects.filter(stock_id=pk).order_by('pk').values_list('pk', flat=True))
    elif key == 'production':
        ids = list(ProductionOrder.objects.filter(pk=pk).values_list('fabric_id', flat=True))
    else:
        ids = list(FabricStock.objects.filter(pk=pk).values_list('pk', flat=True))
    if not ids:
        raise NotFound('No fabric lot was found for this.')
    return ids


# ── Sections ────────────────────────────────────────────────────────────────

def _inspection(inspection):
    return {
        'id': inspection.pk,
        'number': inspection.number,
        'stage': inspection.get_stage_display(),
        'inspected_on': inspection.inspected_on,
        'inspector': _name(inspection.inspector),
        'result': inspection.result,
        'quarantined': inspection.quarantined,
        'composition': inspection.composition,
        'rejection_reason': inspection.rejection_reason,
        'released_at': inspection.released_at,
        'released_by': _name(inspection.released_by),
        'release_note': inspection.release_note,
        'actions': [{
            'id': action.pk,
            'kind': action.kind,
            'description': action.description,
            'owner': _name(action.owner),
            'due_date': action.due_date,
            'status': action.status,
        } for action in inspection.actions.all()],
    }


def _inspections(**where):
    found = (Inspection.objects.filter(**where).select_related('inspector', 'released_by')
             .prefetch_related('actions__owner').order_by('inspected_on', 'id'))
    return [_inspection(i) for i in found]


def _purchase_order(stock):
    line = stock.po_line
    if line is None:
        return None
    return {
        'id': line.order_id,
        'number': line.order.number,
        'status': line.order.status,
        'order_date': line.order.order_date,
        'material': line.material,
        'quantity_kg': _fixed(line.quantity_kg),
        'unit_price': _fixed(line.unit_price),
    }


def _source(lot, allowed):
    stock = lot.stock
    return {
        'delivery': {
            'id': stock.pk,
            'supplier': stock.vendor.name,
            'supplier_id': stock.vendor_id,
            'received_at': stock.created_at,
            'fabric_type': stock.fabric_type,
            'vendor_weight_slip': stock.vendor_weight_slip,
            'vehicle_no': stock.vehicle_no,
            'our_weight': _fixed(stock.our_weight),
            'unloading_weight': _fixed(stock.unloading_weight),
            'unit': stock.unit.name,
            'status': stock.status,
        },
        'purchase_order': _purchase_order(stock) if 'purchase_order' in allowed else RESTRICTED,
        'inspections': _inspections(stock=stock) if 'quality' in allowed else RESTRICTED,
    }


def _lot(lot):
    held_by = quality.blocking_inspection(fabric=lot)
    return {
        'id': lot.pk,
        'material_type': lot.material_type,
        'initial_quantity': _fixed(lot.initial_quantity),
        'sorted_quantity': _fixed(lot.sorted_quantity),
        'remaining_quantity': _fixed(lot.remaining_quantity),
        'status': lot.status,
        'quarantined': held_by is not None,
        'quarantined_by': held_by.number if held_by else None,
        'created_at': lot.created_at,
    }


def _sorting(sessions):
    return {
        'sessions': [{
            'id': s.pk,
            'unit': s.unit,
            'supervisor': _name(s.supervisor),
            'status': s.status,
            'start_date': s.start_date,
            'end_date': s.end_date,
            'quantity_taken': _fixed(s.quantity_taken),
            'quantity_sorted': _fixed(s.quantity_sorted),
            'waste_quantity': _fixed(s.waste_quantity),
        } for s in sessions],
        'taken': _fixed(_total(sessions, 'quantity_taken')),
        'sorted': _fixed(_total(sessions, 'quantity_sorted')),
        'waste': _fixed(_total(sessions, 'waste_quantity')),
    }


def _chemical_cost(session):
    return sum((i.quantity * i.unit_cost for i in session.issuances.all()), ZERO)


def _decolorization(sessions):
    return {
        'sessions': [{
            'id': s.pk,
            'tank': s.tank.name,
            'batch_id': s.tank.batch_id,
            'supervisor': _name(s.supervisor),
            'status': s.status,
            'start_date': s.start_date,
            'end_date': s.end_date,
            'recipe': str(s.recipe_version) if s.recipe_version else None,
            'input_quantity': _fixed(s.input_quantity),
            'output_quantity': _fixed(s.output_quantity),
            'waste_quantity': _fixed(s.waste_quantity),
            'temperature_c': None if s.temperature_c is None else f'{s.temperature_c:.1f}',
            'duration_minutes': s.duration_minutes,
            'water_liters': _fixed(s.water_liters),
            'approved_by': _name(s.approved_by),
            'approved_at': s.approved_at,
            'chemicals': [{
                'id': i.pk,
                'chemical': i.chemical.chemical_name,
                'unit': i.chemical.unit_of_measure,
                'quantity': _fixed(i.quantity),
                'unit_cost': _fixed(i.unit_cost),
                'cost': _fixed(i.quantity * i.unit_cost),
                'issued_at': i.issued_at,
            } for i in s.issuances.all()],
            'chemical_cost': _fixed(_chemical_cost(s)),
        } for s in sessions],
        'input': _fixed(_total(sessions, 'input_quantity')),
        'output': _fixed(_total(sessions, 'output_quantity')),
        'waste': _fixed(_total(sessions, 'waste_quantity')),
        'chemical_cost': _fixed(sum((_chemical_cost(s) for s in sessions), ZERO)),
    }


def _drying(sessions):
    return {
        'sessions': [{
            'id': s.pk,
            'dryer': s.dryer.name,
            'supervisor': _name(s.supervisor),
            'status': s.status,
            'start_date': s.start_date,
            'end_date': s.end_date,
            'input_quantity': _fixed(s.input_quantity),
            'output_quantity': _fixed(s.output_quantity),
            'waste_quantity': _fixed(s.waste_quantity),
            'temperature_celsius': None if s.temperature_celsius is None else f'{s.temperature_celsius:.1f}',
            'duration_minutes': s.duration_minutes,
        } for s in sessions],
        'input': _fixed(_total(sessions, 'input_quantity')),
        'output': _fixed(_total(sessions, 'output_quantity')),
        'waste': _fixed(_total(sessions, 'waste_quantity')),
    }


def _production(orders):
    rows, cost = [], ZERO
    for order in orders:
        figures = production.figures(order)
        cost += figures['total_cost']
        rows.append({
            'id': order.pk,
            'number': order.number,
            'product_name': order.product_name,
            'status': order.status,
            'priority': order.priority,
            'planned_start': order.planned_start,
            'planned_end': order.planned_end,
            'planned_input_kg': _fixed(order.planned_input_kg),
            'planned_output_kg': _fixed(order.planned_output_kg),
            'input_kg': _fixed(figures['actual_input_kg']),
            'output_kg': _fixed(figures['output_kg']),
            'waste_kg': _fixed(figures['waste_kg']),
            'yield_pct': None if figures['yield_pct'] is None else f"{figures['yield_pct']:.1f}",
            'labour_cost': _fixed(figures['labour_cost']),
            'material_cost': _fixed(figures['material_cost']),
            'total_cost': _fixed(figures['total_cost']),
            'steps': [{
                'id': step.pk,
                'stage': step.stage.name,
                'status': step.status,
                'operator': _name(step.operator),
                'machine': step.machine,
                'started_at': step.started_at,
                'finished_at': step.finished_at,
                'actual_hours': _fixed(step.actual_hours),
                'input_kg': _fixed(step.input_kg),
                'output_kg': _fixed(step.output_kg),
                'waste_kg': _fixed(step.waste_kg),
            } for step in order.steps.all()],
        })
    return {'orders': rows, 'total_cost': _fixed(cost)}


def _stock(lot, movements):
    figures = inventory.availability_map([lot.pk])[lot.pk]
    return {
        'on_hand': _fixed(figures['on_hand']),
        'reserved': _fixed(figures['reserved']),
        'available': _fixed(figures['available']),
        'movements': [{
            'id': m.pk,
            'movement_type': m.movement_type,
            'label': m.get_movement_type_display(),
            'quantity': _fixed(m.quantity),
            'note': m.note,
            'created_by': _name(m.created_by),
            'created_at': m.created_at,
        } for m in movements],
    }


def _dispatched(order):
    return _total(order.dispatches.all(), 'dispatched_weight')


def _returned(order):
    return sum((r.weight for r in order.returns.all() if r.status == 'Approved'), ZERO)


def _sales(orders):
    states = sales.invoice_states([i for order in orders for i in order.invoices.all()])
    sold = [o for o in orders if o.status in SOLD_STATUSES]
    return {
        'orders': [{
            'id': order.pk,
            'customer': order.customer.name if order.customer else order.buyer_name,
            'customer_id': order.customer_id,
            'status': order.status,
            'payment_status': order.payment_status,
            'fabric_quality': order.fabric_quality,
            'weight_sold': _fixed(order.weight_sold),
            'price_per_kg': _fixed(order.price_per_kg),
            'total_price': _fixed(order.total_price),
            'created_at': order.created_at,
            'dispatches': [{
                'id': d.pk,
                'challan_number': f'DC-{d.pk:05d}',
                'vehicle_number': d.vehicle_number,
                'driver_name': d.driver_name,
                'dispatched_weight': _fixed(d.dispatched_weight),
                'status': d.dispatch_status,
                'dispatch_date': d.dispatch_date,
                'delivery_date': d.delivery_date,
            } for d in order.dispatches.all()],
            'invoices': [{
                'id': i.pk,
                'number': i.number,
                'invoice_date': i.invoice_date,
                'due_date': i.due_date,
                'weight': _fixed(i.weight),
                'total': _fixed(i.total),
                'paid': _fixed(states[i.pk]['paid']),
                'status': states[i.pk]['status'],
            } for i in order.invoices.all()],
            'returns': [{
                'id': r.pk,
                'number': r.number,
                'return_date': r.return_date,
                'weight': _fixed(r.weight),
                'reason': r.reason,
                'restock': r.restock,
                'status': r.status,
                'credit_amount': _fixed(r.credit_amount),
            } for r in order.returns.all()],
        } for order in orders],
        'sold': _fixed(_total(sold, 'weight_sold')),
        'dispatched': _fixed(sum((_dispatched(o) for o in orders), ZERO)),
        'returned': _fixed(sum((_returned(o) for o in orders), ZERO)),
        'revenue': _fixed(_total(sold, 'total_price')),
    }


# ── The whole chain ─────────────────────────────────────────────────────────

def build(request, lot_id):
    """The full trace of one lot, with the sections this user's role may read."""
    allowed = allowed_sections(request)
    lot = (FabricStock.objects
           .select_related('stock__vendor', 'stock__unit', 'stock__po_line__order').get(pk=lot_id))

    sorting = list(SortingSession.objects.filter(fabric=lot).select_related('supervisor').order_by('start_date', 'id'))
    decolor = list(
        DecolorizationSession.objects.filter(fabric=lot)
        .select_related('tank', 'supervisor', 'approved_by', 'recipe_version__recipe')
        .prefetch_related(Prefetch('issuances', ChemicalIssuance.objects.select_related('chemical').order_by('id')))
        .order_by('start_date', 'id'))
    drying = (list(DryingSession.objects.filter(fabric=lot).select_related('dryer', 'supervisor')
                   .order_by('created_at', 'id'))
              if 'drying' in allowed else None)
    orders = list(ProductionOrder.objects.filter(fabric=lot)
                  .prefetch_related('steps__stage', 'steps__operator', 'materials').order_by('created_at', 'id'))
    movements = list(StockMovement.objects.filter(fabric=lot).select_related('created_by').order_by('created_at', 'id'))
    sales_orders = (list(SalesOrder.objects.filter(fabric=lot).select_related('customer')
                         .prefetch_related('dispatches', 'invoices', 'returns').order_by('created_at', 'id'))
                    if 'sales' in allowed else None)

    def section(name, make):
        return make() if name in allowed else RESTRICTED

    data = {
        'lot_id': lot.pk,
        'source': section('source', lambda: _source(lot, allowed)),
        'lot': section('lot', lambda: _lot(lot)),
        'sorting': section('sorting', lambda: _sorting(sorting)),
        'decolorization': section('decolorization', lambda: _decolorization(decolor)),
        'drying': section('drying', lambda: _drying(drying)),
        'production': section('production', lambda: _production(orders)),
        'quality': section('quality', lambda: {'inspections': _inspections(fabric=lot)}),
        'stock': section('stock', lambda: _stock(lot, movements)),
        'sales': section('sales', lambda: _sales(sales_orders)),
    }

    # Summary: a figure is null when its stage has not happened, or the role may not read it
    weight_in = lot.initial_quantity
    if drying is not None:
        dried = _total(drying, 'output_quantity') if drying else None
        drying_waste = _total(drying, 'waste_quantity') if drying else None
    else:
        # The stock ledger is open to every role, and drying output is what enters it
        outputs = [m.quantity for m in movements if m.movement_type == StockMovement.DRYING_OUTPUT]
        dried = sum(outputs, ZERO) if outputs and 'stock' in allowed else None
        drying_waste = None
    sorting_waste = _total(sorting, 'waste_quantity') if sorting and 'sorting' in allowed else None
    decolor_waste = _total(decolor, 'waste_quantity') if decolor and 'decolorization' in allowed else None
    wastes = [w for w in (sorting_waste, decolor_waste, drying_waste) if w is not None]

    chemical_cost = (sum((_chemical_cost(s) for s in decolor), ZERO)
                     if 'decolorization' in allowed and any(s.issuances.all() for s in decolor) else None)
    production_cost = (sum((production.figures(o)['total_cost'] for o in orders), ZERO)
                       if 'production' in allowed and orders else None)
    costs = [c for c in (chemical_cost, production_cost) if c is not None]

    sold = returned = dispatched = None
    if sales_orders is not None and sales_orders:
        sold = _total([o for o in sales_orders if o.status in SOLD_STATUSES], 'weight_sold')
        dispatched = sum((_dispatched(o) for o in sales_orders), ZERO)
        returned = sum((_returned(o) for o in sales_orders), ZERO)

    data['summary'] = {
        'weight_in': _fixed(weight_in),
        'sorted': _fixed(_total(sorting, 'quantity_sorted')) if sorting and 'sorting' in allowed else None,
        'decolorized': _fixed(_total(decolor, 'output_quantity')) if decolor and 'decolorization' in allowed else None,
        'dried': _fixed(dried),
        'sold': _fixed(sold),
        'dispatched': _fixed(dispatched),
        'returned': _fixed(returned),
        'waste': {
            'sorting': _fixed(sorting_waste),
            'decolorization': _fixed(decolor_waste),
            'drying': _fixed(drying_waste),
            'total': _fixed(sum(wastes, ZERO)) if wastes else None,
        },
        'yield_pct': f'{dried / weight_in * 100:.1f}' if dried is not None and weight_in else None,
        'chemical_cost': _fixed(chemical_cost),
        'production_cost': _fixed(production_cost),
        'total_cost': _fixed(sum(costs, ZERO)) if costs else None,
        'generated_at': timezone.now(),
    }
    return data
