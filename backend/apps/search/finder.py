"""
Global search: one query, results grouped by the kind of record.

A group is returned only to the roles that can open the page it lives on and
read that data through its own API (see ROLES below; the pages are the route
roles of the web app). Nothing is stored here: every result is read from the
module that owns it.
"""
import re

from django.db.models import Case, IntegerField, Q, When
from django.utils import timezone

from apps.core.permissions import ALL_ROLES, get_role
from apps.decolorization.models import ChemicalStock
from apps.documents import services as document_services
from apps.maintenance.models import Machine, WorkOrder
from apps.procurement.models import PurchaseOrder, PurchaseRequisition
from apps.production.models import ProductionOrder
from apps.quality.models import Inspection
from apps.sales.models import Customer, SalesInvoice, SalesOrder, SalesQuotation, SalesReturn
from apps.sorting.models import FabricStock
from apps.warehouse.models import Stock, Vendor
from apps.workforce.models import Employee

LIMIT = 6
MIN_LENGTH = 2

# Who gets each kind of result
EVERYONE = frozenset(ALL_ROLES)
ADMIN = frozenset({'admin'})
STORE = frozenset({'admin', 'warehouse_supervisor'})                 # Warehouse and Purchasing pages
FLOOR = frozenset(ALL_ROLES - {'warehouse_supervisor'})              # Production page
DECOLOR = frozenset({'admin', 'decolorization_supervisor'})          # Decolorization page

# "PO-00012", "INV-3", "wo 4", "#15" or "15": an optional prefix and a record number
NUMBER = re.compile(r'^#?\s*(?:([A-Za-z]{2,4})\s*[-#]?\s*)?0*(\d{1,9})$')


def parse_number(text):
    """('PO', 12) for "PO-00012", ('', 15) for "#15" or "15", (None, None) for anything else."""
    match = NUMBER.match(text)
    if not match:
        return None, None
    return (match.group(1) or '').upper(), int(match.group(2))


def _day(value):
    if value is None:
        return ''
    if hasattr(value, 'hour'):
        value = timezone.localtime(value).date()
    return value.isoformat()


def _kg(value):
    return f'{value:.2f} kg'


def _result(kind, pk, label, detail, href, lot=None):
    return {
        'type': kind, 'id': pk, 'label': label,
        'detail': ' · '.join(str(part) for part in detail if part),
        'href': href, 'lot': lot,
    }


def _lot_href(lot_id):
    return f'/traceability?lot={lot_id}'


def _matches(queryset, text, pk):
    """Records matching the text, or with this record number (shown first)."""
    if pk is None:
        return queryset.filter(text).order_by('-pk')[:LIMIT]
    first = Case(When(pk=pk, then=0), default=1, output_field=IntegerField())
    return queryset.filter(text | Q(pk=pk)).order_by(first, '-pk')[:LIMIT]


def _lot_label(lot):
    return f'Lot #{lot.pk} · {lot.material_type}'


# ── One function per kind of record: (user, text, record number or None) ────

def find_lots(user, q, pk):
    lots = FabricStock.objects.select_related('stock__vendor')
    text = Q(material_type__icontains=q) | Q(stock__vendor__name__icontains=q)
    return [
        _result('lots', lot.pk, _lot_label(lot),
                [lot.stock.vendor.name, f'{_kg(lot.remaining_quantity)} left', lot.status],
                _lot_href(lot.pk), lot=lot.pk)
        for lot in _matches(lots, text, pk)
    ]


def find_deliveries(user, q, pk):
    deliveries = Stock.objects.select_related('vendor')
    text = (Q(fabric_type__icontains=q) | Q(vendor__name__icontains=q) | Q(vehicle_no__icontains=q)
            | Q(vendor_weight_slip__icontains=q))
    return [
        _result('deliveries', d.pk, f'Delivery #{d.pk} · {d.fabric_type}',
                [d.vendor.name, d.vehicle_no, _kg(d.our_weight), d.status, _day(d.created_at)], '/warehouse')
        for d in _matches(deliveries, text, pk)
    ]


def find_suppliers(user, q, pk):
    text = Q(name__icontains=q) | Q(email__icontains=q) | Q(specialties__icontains=q)
    return [
        _result('suppliers', v.pk, v.name,
                [v.category, v.contact, v.specialties, '' if v.is_active else 'Inactive'], '/procurement')
        for v in _matches(Vendor.objects.all(), text, None)
    ]


def find_customers(user, q, pk):
    text = Q(name__icontains=q) | Q(email__icontains=q)
    return [
        _result('customers', c.pk, c.name, [c.category, c.contact, '' if c.is_active else 'Inactive'], '/sales')
        for c in _matches(Customer.objects.all(), text, None)
    ]


def find_requisitions(user, q, pk):
    requisitions = PurchaseRequisition.objects.select_related('requested_by')
    return [
        _result('requisitions', r.pk, r.number,
                [r.status, f'by {r.requested_by.username}', r.needed_by and f'needed by {_day(r.needed_by)}'],
                '/procurement')
        for r in _matches(requisitions, Q(number__icontains=q), pk)
    ]


def find_purchase_orders(user, q, pk):
    orders = PurchaseOrder.objects.select_related('vendor')
    text = Q(number__icontains=q) | Q(vendor__name__icontains=q)
    return [
        _result('purchase_orders', o.pk, o.number, [o.vendor.name, o.status, _day(o.order_date)], '/procurement')
        for o in _matches(orders, text, pk)
    ]


def find_sales_orders(user, q, pk):
    orders = SalesOrder.objects.select_related('customer', 'fabric')
    text = Q(buyer_name__icontains=q) | Q(customer__name__icontains=q)
    return [
        _result('sales_orders', o.pk, f'Order #{o.pk} · {o.customer.name if o.customer else o.buyer_name}',
                [_kg(o.weight_sold), o.status, o.payment_status, _lot_label(o.fabric)], '/sales', lot=o.fabric_id)
        for o in _matches(orders, text, pk)
    ]


def find_quotations(user, q, pk):
    quotations = SalesQuotation.objects.select_related('customer')
    text = Q(number__icontains=q) | Q(customer__name__icontains=q)
    return [
        _result('quotations', x.pk, x.number, [x.customer.name, _kg(x.weight), x.status], '/sales', lot=x.fabric_id)
        for x in _matches(quotations, text, pk)
    ]


def find_invoices(user, q, pk):
    invoices = SalesInvoice.objects.select_related('order__customer', 'order__fabric')
    text = Q(number__icontains=q) | Q(order__customer__name__icontains=q) | Q(order__buyer_name__icontains=q)
    return [
        _result('invoices', i.pk, i.number,
                [i.order.customer.name if i.order.customer else i.order.buyer_name, f'Order #{i.order_id}',
                 f'Rs. {i.total:.2f}', _day(i.invoice_date)], '/sales', lot=i.order.fabric_id)
        for i in _matches(invoices, text, pk)
    ]


def find_returns(user, q, pk):
    returns = SalesReturn.objects.select_related('order__customer')
    text = Q(number__icontains=q) | Q(order__customer__name__icontains=q) | Q(order__buyer_name__icontains=q)
    return [
        _result('returns', x.pk, x.number,
                [x.order.customer.name if x.order.customer else x.order.buyer_name, f'Order #{x.order_id}',
                 _kg(x.weight), x.status], '/sales', lot=x.order.fabric_id)
        for x in _matches(returns, text, pk)
    ]


def find_production_orders(user, q, pk):
    orders = ProductionOrder.objects.select_related('fabric')
    text = Q(number__icontains=q) | Q(product_name__icontains=q)
    return [
        _result('production_orders', o.pk, f'{o.number} · {o.product_name}',
                [o.status, _lot_label(o.fabric), f'{_day(o.planned_start)} to {_day(o.planned_end)}'],
                '/production', lot=o.fabric_id)
        for o in _matches(orders, text, pk)
    ]


def find_inspections(user, q, pk):
    inspections = Inspection.objects.select_related('stock', 'fabric')

    def material(i):
        if i.fabric_id:
            return _lot_label(i.fabric)
        return f'Delivery #{i.stock_id} · {i.stock.fabric_type}' if i.stock_id else ''

    return [
        _result('inspections', i.pk, i.number, [i.get_stage_display(), i.result, material(i), _day(i.inspected_on)],
                '/quality', lot=i.fabric_id)
        for i in _matches(inspections, Q(number__icontains=q), pk)
    ]


def find_chemicals(user, q, pk):
    return [
        _result('chemicals', c.pk, c.chemical_name,
                [f'{c.remaining_stock:.2f} {c.unit_of_measure} left', c.hazard_class,
                 'Restricted' if c.is_restricted else ''], '/decolorization')
        for c in _matches(ChemicalStock.objects.all(), Q(chemical_name__icontains=q), None)
    ]


def find_machines(user, q, pk):
    text = Q(code__icontains=q) | Q(name__icontains=q)
    return [
        _result('machines', m.pk, f'{m.code} · {m.name}', [m.category, m.location, m.status], '/maintenance')
        for m in _matches(Machine.objects.all(), text, None)
    ]


def find_work_orders(user, q, pk):
    orders = WorkOrder.objects.select_related('machine')
    text = Q(number__icontains=q) | Q(title__icontains=q) | Q(machine__code__icontains=q) | Q(machine__name__icontains=q)
    return [
        _result('work_orders', w.pk, f'{w.number} · {w.title}',
                [f'{w.machine.code} {w.machine.name}', w.kind, w.status], '/maintenance')
        for w in _matches(orders, text, pk)
    ]


def find_employees(user, q, pk):
    employees = Employee.objects.select_related('department', 'job_role')
    text = Q(number__icontains=q) | Q(full_name__icontains=q)
    return [
        _result('employees', e.pk, f'{e.number} · {e.full_name}', [e.job_role.title, e.department.name, e.status],
                '/workforce')
        for e in _matches(employees, text, pk)
    ]


def find_documents(user, q, pk):
    # The documents app decides which categories this user may see
    documents = document_services.visible_documents(user).prefetch_related(None)   # file versions aren't shown
    text = Q(number__icontains=q) | Q(title__icontains=q) | Q(reference_number__icontains=q)
    return [
        _result('documents', d.pk, f'{d.number} · {d.title}',
                [d.category.name, d.reference_number, d.linked_label, d.expires_on and f'expires {_day(d.expires_on)}'],
                '/documents')
        for d in _matches(documents, text, pk)
    ]


# Lots reached through a delivery or a purchase order (used when picking a lot to trace)

def find_lots_by_delivery(user, q, pk):
    lots = FabricStock.objects.select_related('stock__vendor')
    text = Q(stock__vehicle_no__icontains=q) | Q(stock__vendor_weight_slip__icontains=q)
    if pk is not None:
        text |= Q(stock_id=pk)
    return [
        _result('deliveries', lot.pk, _lot_label(lot),
                [f'Delivery #{lot.stock_id}', lot.stock.vendor.name, lot.stock.vehicle_no, _day(lot.stock.created_at)],
                _lot_href(lot.pk), lot=lot.pk)
        for lot in lots.filter(text).order_by('-pk')[:LIMIT]
    ]


def find_lots_by_purchase_order(user, q, pk):
    lots = FabricStock.objects.select_related('stock__vendor', 'stock__po_line__order')
    text = Q(stock__po_line__order__number__icontains=q)
    if pk is not None:
        text |= Q(stock__po_line__order_id=pk)
    return [
        _result('purchase_orders', lot.pk, _lot_label(lot),
                [lot.stock.po_line.order.number, lot.stock.vendor.name, f'Delivery #{lot.stock_id}'],
                _lot_href(lot.pk), lot=lot.pk)
        for lot in lots.filter(text).order_by('-pk')[:LIMIT]
    ]


# (type, heading, roles, number prefixes, finder). A prefix of '' means a bare number ("#15") finds it too.
GROUPS = [
    ('lots', 'Fabric lots', EVERYONE, ('', 'LOT'), find_lots),
    ('deliveries', 'Deliveries', STORE, ('', 'DEL'), find_deliveries),
    ('suppliers', 'Suppliers', STORE, (), find_suppliers),
    ('customers', 'Customers', ADMIN, (), find_customers),
    ('requisitions', 'Purchase requests', STORE, ('', 'PR'), find_requisitions),
    ('purchase_orders', 'Purchase orders', STORE, ('', 'PO'), find_purchase_orders),
    ('sales_orders', 'Sales orders', ADMIN, ('', 'SO', 'ORD'), find_sales_orders),
    ('quotations', 'Quotations', ADMIN, ('', 'QT'), find_quotations),
    ('invoices', 'Invoices', ADMIN, ('', 'INV'), find_invoices),
    ('returns', 'Sales returns', ADMIN, ('', 'SR'), find_returns),
    ('production_orders', 'Production orders', FLOOR, ('', 'MO'), find_production_orders),
    ('inspections', 'Inspections', EVERYONE, ('', 'QC'), find_inspections),
    ('chemicals', 'Chemicals', DECOLOR, (), find_chemicals),
    ('machines', 'Machines', EVERYONE, (), find_machines),
    ('work_orders', 'Work orders', EVERYONE, ('', 'WO'), find_work_orders),
    ('employees', 'Employees', ADMIN, ('', 'EMP'), find_employees),
    ('documents', 'Documents', EVERYONE, ('', 'DOC'), find_documents),
]

# Picking a lot to trace: only records that lead to a fabric lot. Tracing by a
# production order is open to every role, because every role may read them.
LOT_GROUPS = [
    ('lots', 'Fabric lots', EVERYONE, ('', 'LOT'), find_lots),
    ('deliveries', 'Deliveries', EVERYONE, ('', 'DEL'), find_lots_by_delivery),
    ('purchase_orders', 'Purchase orders', STORE, ('', 'PO'), find_lots_by_purchase_order),
    ('production_orders', 'Production orders', EVERYONE, ('', 'MO'), find_production_orders),
    ('sales_orders', 'Sales orders', ADMIN, ('', 'SO', 'ORD'), find_sales_orders),
    ('invoices', 'Invoices', ADMIN, ('', 'INV'), find_invoices),
]


def search(user, query, lots_only=False):
    """{'query', 'groups': [{'type', 'label', 'results'}], 'total'} for this user's role."""
    q = ' '.join((query or '').split())[:100]
    groups = []
    if len(q) >= MIN_LENGTH:
        role = get_role(user)
        prefix, number = parse_number(q)
        for kind, heading, roles, prefixes, finder in (LOT_GROUPS if lots_only else GROUPS):
            if role not in roles:
                continue
            results = finder(user, q, number if prefix in prefixes else None)
            if lots_only:
                results = [{**r, 'href': _lot_href(r['lot'])} for r in results if r['lot']]
            if results:
                groups.append({'type': kind, 'label': heading, 'results': results})
    return {'query': q, 'groups': groups, 'total': sum(len(g['results']) for g in groups)}
