"""
The report centre and the executive dashboard.

Every report is a table: {title, period, columns, rows, totals, notes}, so one
screen and one export can show any of them. The figures come from the modules'
own calculations (their service functions, or their report views where the
calculation lives in the view), so a number here equals the one on the
module's page. The few figures defined here say so in their notes.

Column kinds: text, number, kg, money, percent, date.
"""
import logging
from datetime import date, timedelta
from decimal import ROUND_HALF_UP, Decimal
from urllib.parse import urlencode

from django.conf import settings
from django.db import transaction
from django.db.models import Count, Q, Sum
from django.http import HttpRequest, QueryDict
from django.utils import timezone
from rest_framework.exceptions import NotFound, ValidationError

logger = logging.getLogger(__name__)

ZERO = Decimal('0')
CENT = Decimal('0.01')
GROUPS = ['Stock', 'Production', 'Quality', 'Commercial', 'Finance', 'Sustainability', 'Maintenance']


# ─────────────────────────────────────────────────────────────────────────────
# Small helpers
# ─────────────────────────────────────────────────────────────────────────────

def _dec(value):
    """Database sums can come back as floats on SQLite; always work in 2-decimal Decimals."""
    return Decimal(str(value or 0)).quantize(CENT, rounding=ROUND_HALF_UP)


def _fixed(value):
    return None if value is None else f'{_dec(value):.2f}'


def _pct(part, whole):
    return round(float(Decimal(str(part)) / Decimal(str(whole)) * 100), 1) if whole else None


def _col(key, label, kind='text'):
    return {'key': key, 'label': label, 'kind': kind}


def _sum(rows, key):
    return _fixed(sum((_dec(row[key]) for row in rows if row.get(key) is not None), ZERO))


def _module_view(view_class, user, params=None):
    """
    The data of another module's report view, for calculations that live in
    the view rather than in a service. The view checks the user's permission
    as usual.
    """
    request = HttpRequest()
    request.method = 'GET'
    request.META = {'REMOTE_ADDR': '127.0.0.1', 'SERVER_NAME': 'localhost', 'SERVER_PORT': '80'}
    request.GET = QueryDict(urlencode(params or {}))
    request._force_auth_user = user
    response = view_class.as_view()(request)
    if response.status_code != 200:
        raise ValidationError(getattr(response, 'data', None) or 'This report could not be built.')
    return response.data


# ─────────────────────────────────────────────────────────────────────────────
# Period
# ─────────────────────────────────────────────────────────────────────────────

def _day(text):
    try:
        return date.fromisoformat(text)
    except (TypeError, ValueError):
        return None


def _month_end(first):
    return (first.replace(day=28) + timedelta(days=4)).replace(day=1) - timedelta(days=1)


class Period:
    """First and last day of a report. Either can be None, meaning no limit on that side."""

    def __init__(self, start=None, end=None):
        self.start, self.end = start, end

    @property
    def params(self):
        """The same period as DateFilter params, for services that take those."""
        return {key: value.isoformat() for key, value in (('start', self.start), ('end', self.end)) if value}

    @property
    def label(self):
        show = lambda d: d.strftime('%d %b %Y')   # noqa: E731
        if self.start and self.end:
            return show(self.start) if self.start == self.end else f'{show(self.start)} to {show(self.end)}'
        if self.start:
            return f'From {show(self.start)}'
        if self.end:
            return f'Up to {show(self.end)}'
        return 'All time'

    def as_dict(self):
        return {'start': self.start.isoformat() if self.start else None,
                'end': self.end.isoformat() if self.end else None, 'label': self.label}

    def bounds(self):
        """Concrete days, for services that need both ends."""
        return self.start or date(2000, 1, 1), self.end or timezone.localdate()

    def filter(self, queryset, field):
        from apps.core.filters import filter_by_date_params
        return filter_by_date_params(queryset, self.params, field)


def period_from(params):
    """
    The period asked for with the DateFilter params (see core/filters.py):
    date_filter, year, month (YYYY-MM), or start and end. Nothing sent means
    all time. Weeks start on Monday.
    """
    today = timezone.localdate()
    choice = params.get('date_filter')
    year, month = str(params.get('year') or ''), _day(f"{params.get('month')}-01")
    if choice == 'today':
        return Period(today, today)
    if choice == 'this_week':
        monday = today - timedelta(days=today.weekday())
        return Period(monday, monday + timedelta(days=6))
    if choice == 'this_month':
        return Period(today.replace(day=1), _month_end(today.replace(day=1)))
    if choice == 'this_year':
        return Period(date(today.year, 1, 1), date(today.year, 12, 31))
    if year.isdigit() and 1 <= int(year) <= 9998:
        return Period(date(int(year), 1, 1), date(int(year), 12, 31))
    if month:
        return Period(month, _month_end(month))
    for name in ('start', 'end'):
        if params.get(name) and not _day(params.get(name)):
            raise ValidationError({name: ['Enter a date as YYYY-MM-DD.']})
    start, end = _day(params.get('start')), _day(params.get('end'))
    if start and end and end < start:
        raise ValidationError({'end': ["Can't be before the start date."]})
    return Period(start, end)


# ─────────────────────────────────────────────────────────────────────────────
# Reports. Each takes (period, user) and returns columns, rows, totals, notes,
# and optionally summary figures and a chart.
# ─────────────────────────────────────────────────────────────────────────────

def inventory_valuation(period, user):
    from apps.finance import services as finance
    from apps.inventory import services as inventory
    from apps.sorting.models import FabricStock

    figures = inventory.availability_map()
    names = dict(FabricStock.objects.filter(pk__in=figures).values_list('pk', 'material_type'))
    finance.sync_operations(user)
    costing = finance.production_cost(*period.bounds())
    rate = Decimal(costing['cost_per_kg']) if costing['cost_per_kg'] else None

    rows = []
    for fabric, f in sorted(figures.items()):
        rows.append({
            'lot': f'Lot #{fabric}', 'material': names.get(fabric, ''),
            'on_hand_kg': _fixed(f['on_hand']), 'reserved_kg': _fixed(f['reserved']),
            'available_kg': _fixed(f['available']),
            'cost_per_kg': _fixed(rate),
            'value': _fixed(f['on_hand'] * rate) if rate is not None else None,
            '_href': '/sales',
        })
    totals = {'lot': 'Total', 'on_hand_kg': _sum(rows, 'on_hand_kg'), 'reserved_kg': _sum(rows, 'reserved_kg'),
              'available_kg': _sum(rows, 'available_kg'),
              'value': _sum(rows, 'value') if rate is not None else None}
    notes = [
        'Stock is the dried, sellable stock as it stands now, from the inventory ledger: on hand is the sum of the '
        "lot's movements, reserved is what confirmed orders have not yet dispatched, available is the difference.",
        'Value = kg on hand x production cost per kg. The cost per kg is Finance costing for the chosen period: '
        'total production cost divided by the dried output of that period. It is one rate for the whole factory, '
        'not a cost per lot. Selling prices are not used.',
    ]
    if rate is None:
        notes.append('No dried output was completed in this period, so there is no cost per kg and the value is left '
                     'empty. Choose a period in which drying sessions were completed.')
    return {
        'columns': [_col('lot', 'Lot'), _col('material', 'Material'), _col('on_hand_kg', 'On hand', 'kg'),
                    _col('reserved_kg', 'Reserved', 'kg'), _col('available_kg', 'Available', 'kg'),
                    _col('cost_per_kg', 'Cost per kg', 'money'), _col('value', 'Value', 'money')],
        'rows': rows, 'totals': totals, 'notes': notes,
        'summary': [{'label': 'On hand', 'value': totals['on_hand_kg'], 'kind': 'kg'},
                    {'label': 'Available', 'value': totals['available_kg'], 'kind': 'kg'},
                    {'label': 'Cost per kg', 'value': _fixed(rate), 'kind': 'money'},
                    {'label': 'Stock value', 'value': totals['value'], 'kind': 'money'}],
        'chart': {'type': 'bar', 'x': 'lot', 'series': [{'key': 'on_hand_kg', 'label': 'On hand'},
                                                         {'key': 'reserved_kg', 'label': 'Reserved'}], 'kind': 'kg'},
    }


def stock_movement(period, user):
    from apps.inventory.models import StockMovement

    labels = dict(StockMovement.TYPE_CHOICES)
    grouped = (period.filter(StockMovement.objects.all(), 'created_at').order_by()
               .values('fabric_id', 'fabric__material_type', 'movement_type')
               .annotate(n=Count('id'), added=Sum('quantity', filter=Q(quantity__gt=0)),
                         removed=Sum('quantity', filter=Q(quantity__lt=0)))
               .order_by('fabric_id', 'movement_type'))
    rows = []
    for g in grouped:
        added, removed = _dec(g['added']), -_dec(g['removed'])
        rows.append({
            'lot': f"Lot #{g['fabric_id']}", 'material': g['fabric__material_type'],
            'type': labels.get(g['movement_type'], g['movement_type']), 'movements': g['n'],
            'in_kg': _fixed(added), 'out_kg': _fixed(removed), 'net_kg': _fixed(added - removed),
            '_href': '/sales',
        })
    return {
        'columns': [_col('lot', 'Lot'), _col('material', 'Material'), _col('type', 'Movement'),
                    _col('movements', 'Movements', 'number'), _col('in_kg', 'In', 'kg'), _col('out_kg', 'Out', 'kg'),
                    _col('net_kg', 'Net', 'kg')],
        'rows': rows,
        'totals': {'lot': 'Total', 'movements': sum(r['movements'] for r in rows), 'in_kg': _sum(rows, 'in_kg'),
                   'out_kg': _sum(rows, 'out_kg'), 'net_kg': _sum(rows, 'net_kg')},
        'notes': ['Movements of the dried-stock ledger dated in the period, per lot and kind. Drying output and '
                  'restocked returns add stock; dispatches take it out; adjustments can do either.'],
        'chart': {'type': 'bar', 'x': 'type', 'group': True, 'kind': 'kg',
                  'series': [{'key': 'in_kg', 'label': 'In'}, {'key': 'out_kg', 'label': 'Out'}]},
    }


def _definitions(*names):
    from apps.sustainability.services import DEFINITIONS
    return [f"{d['name']}: {d['text']}" for d in DEFINITIONS if d['name'] in names]


def material_recovery(period, user):
    from apps.sustainability import services as sustainability

    figures = sustainability.figures(period.params)
    rows = [{
        'stage': s['stage'], 'sessions': s['sessions'], 'input_kg': s['input_kg'], 'output_kg': s['output_kg'],
        'loss_kg': s['loss_kg'], 'waste_kg': s['waste_kg'], 'other_loss_kg': s['other_loss_kg'],
        'yield_pct': s['yield_pct'], 'loss_pct': s['loss_pct'],
        '_href': f"/{s['stage'].lower()}",
    } for s in figures['stages']]
    recovery = figures['recovery']
    return {
        'columns': [_col('stage', 'Stage'), _col('sessions', 'Sessions', 'number'), _col('input_kg', 'Input', 'kg'),
                    _col('output_kg', 'Output', 'kg'), _col('loss_kg', 'Loss', 'kg'),
                    _col('waste_kg', 'Recorded waste', 'kg'), _col('other_loss_kg', 'Other loss', 'kg'),
                    _col('yield_pct', 'Yield', 'percent'), _col('loss_pct', 'Loss share', 'percent')],
        'rows': rows,
        'totals': {'stage': 'Overall recovery', 'input_kg': recovery['input_kg'], 'output_kg': recovery['output_kg'],
                   'loss_kg': recovery['loss_kg'], 'yield_pct': recovery['rate_pct']},
        'notes': _definitions('Process loss', 'Recovery rate', 'Stage yields combined') + [
            'The total row is the overall recovery: weight taken into sorting, dried output, and the recovery rate.'],
        'summary': [{'label': 'Material in', 'value': figures['material_in']['kg'], 'kind': 'kg'},
                    {'label': 'Into sorting', 'value': recovery['input_kg'], 'kind': 'kg'},
                    {'label': 'Dried output', 'value': recovery['output_kg'], 'kind': 'kg'},
                    {'label': 'Recovery rate', 'value': recovery['rate_pct'], 'kind': 'percent'}],
        'chart': {'type': 'bar', 'x': 'stage', 'kind': 'kg',
                  'series': [{'key': 'input_kg', 'label': 'Input'}, {'key': 'output_kg', 'label': 'Output'},
                             {'key': 'waste_kg', 'label': 'Recorded waste'}]},
    }


def sorting_performance(period, user):
    from apps.sorting.models import SortingSession

    sessions = period.filter(SortingSession.objects.filter(status='Completed', end_date__isnull=False), 'end_date')
    grouped = (sessions.order_by().values('supervisor__username', 'unit')
               .annotate(n=Count('id'), taken=Sum('quantity_taken'), done=Sum('quantity_sorted'),
                         waste=Sum('waste_quantity'))
               .order_by('supervisor__username', 'unit'))
    rows = []
    for g in grouped:
        taken, done, waste = _dec(g['taken']), _dec(g['done']), _dec(g['waste'])
        rows.append({
            'supervisor': g['supervisor__username'], 'unit': g['unit'], 'sessions': g['n'],
            'taken_kg': _fixed(taken), 'sorted_kg': _fixed(done), 'waste_kg': _fixed(waste),
            'efficiency_pct': _pct(done, taken), 'waste_pct': _pct(waste, taken),
            '_href': '/sorting',
        })
    taken = sum((_dec(r['taken_kg']) for r in rows), ZERO)
    done = sum((_dec(r['sorted_kg']) for r in rows), ZERO)
    waste = sum((_dec(r['waste_kg']) for r in rows), ZERO)
    return {
        'columns': [_col('supervisor', 'Supervisor'), _col('unit', 'Unit'), _col('sessions', 'Sessions', 'number'),
                    _col('taken_kg', 'Taken', 'kg'), _col('sorted_kg', 'Sorted', 'kg'), _col('waste_kg', 'Waste', 'kg'),
                    _col('efficiency_pct', 'Efficiency', 'percent'), _col('waste_pct', 'Waste share', 'percent')],
        'rows': rows,
        'totals': {'supervisor': 'Total', 'sessions': sum(r['sessions'] for r in rows), 'taken_kg': _fixed(taken),
                   'sorted_kg': _fixed(done), 'waste_kg': _fixed(waste), 'efficiency_pct': _pct(done, taken),
                   'waste_pct': _pct(waste, taken)},
        'notes': ['Sorting sessions completed in the period (by the day they were completed), per supervisor and unit.',
                  'Efficiency = kg sorted / kg taken x 100, as on the Sorting page. Waste share = waste kg / kg taken x 100.'],
        'chart': {'type': 'bar', 'x': 'supervisor', 'group': True, 'kind': 'kg',
                  'series': [{'key': 'taken_kg', 'label': 'Taken'}, {'key': 'sorted_kg', 'label': 'Sorted'},
                             {'key': 'waste_kg', 'label': 'Waste'}]},
    }


def production_efficiency(period, user):
    from apps.production.models import ProductionOrder
    from apps.production.services import figures

    orders = period.filter(ProductionOrder.objects.exclude(status='Cancelled'), 'planned_start').select_related(
        'fabric').prefetch_related('steps__stage', 'materials').order_by('planned_start', 'id')
    rows, total_in, total_out = [], ZERO, ZERO
    for order in orders:
        f = figures(order)
        if order.status == 'Completed':
            total_in += f['actual_input_kg'] or ZERO
            total_out += f['output_kg'] or ZERO
        rows.append({
            'number': order.number, 'product': order.product_name, 'status': order.status,
            'planned_start': order.planned_start.isoformat(), 'planned_end': order.planned_end.isoformat(),
            'planned_output_kg': _fixed(order.planned_output_kg), 'output_kg': _fixed(f['output_kg']),
            'yield_pct': f['yield_pct'],
            'planned_hours': _fixed(f['planned_hours']), 'actual_hours': _fixed(f['actual_hours']),
            'planned_cost': _fixed(f['planned_cost']), 'total_cost': _fixed(f['total_cost']),
            'cost_per_kg': _fixed(f['cost_per_kg']), 'late': 'Late' if f['is_late'] else '',
            '_href': '/production',
        })
    return {
        'columns': [_col('number', 'Order'), _col('product', 'Product'), _col('status', 'Status'),
                    _col('planned_start', 'Planned start', 'date'), _col('planned_end', 'Planned end', 'date'),
                    _col('planned_output_kg', 'Planned output', 'kg'), _col('output_kg', 'Actual output', 'kg'),
                    _col('yield_pct', 'Yield', 'percent'), _col('planned_hours', 'Planned hours', 'number'),
                    _col('actual_hours', 'Actual hours', 'number'), _col('planned_cost', 'Planned cost', 'money'),
                    _col('total_cost', 'Actual cost', 'money'), _col('cost_per_kg', 'Cost per kg', 'money'),
                    _col('late', 'Late')],
        'rows': rows,
        'totals': {'number': 'Total', 'planned_output_kg': _sum(rows, 'planned_output_kg'),
                   'output_kg': _sum(rows, 'output_kg'), 'yield_pct': _pct(total_out, total_in),
                   'planned_hours': _sum(rows, 'planned_hours'), 'actual_hours': _sum(rows, 'actual_hours'),
                   'planned_cost': _sum(rows, 'planned_cost'), 'total_cost': _sum(rows, 'total_cost')},
        'notes': ['Production orders whose planned start is in the period; cancelled orders are left out.',
                  'Output, hours, cost, yield and "late" are the figures shown on each order in Production. Yield and '
                  'cost per kg appear once an order is completed. The total yield covers completed orders only.'],
        'chart': {'type': 'bar', 'x': 'number', 'kind': 'kg',
                  'series': [{'key': 'planned_output_kg', 'label': 'Planned'}, {'key': 'output_kg', 'label': 'Actual'}]},
    }


def chemical_consumption(period, user):
    from apps.decolorization.views import ChemicalUsageView

    usage = _module_view(ChemicalUsageView, user, period.params)
    rows = [{'chemical': c['chemical_name'], 'unit': c['unit'], 'issuances': c['issuances'],
             'quantity': c['quantity'], 'cost': c['cost'], '_href': '/decolorization'} for c in usage['chemicals']]
    return {
        'columns': [_col('chemical', 'Chemical'), _col('unit', 'Unit'), _col('issuances', 'Issuances', 'number'),
                    _col('quantity', 'Quantity', 'number'), _col('cost', 'Cost', 'money')],
        'rows': rows,
        'totals': {'chemical': 'Total', 'issuances': usage['issuances'], 'cost': usage['total_cost']},
        'notes': ['Chemical issuances in the period. Cost = quantity x the unit cost kept on each issuance, as on '
                  "the Decolorization page's Usage tab. Quantities are not added up across chemicals because the "
                  'units differ.',
                  'Cost per kg treated counts only issuances tied to a batch, divided by the input weight of those '
                  'batches.'],
        'summary': [{'label': 'Chemical cost', 'value': usage['total_cost'], 'kind': 'money'},
                    {'label': 'Batches', 'value': usage['batches'], 'kind': 'number'},
                    {'label': 'Treated', 'value': usage['treated_kg'], 'kind': 'kg'},
                    {'label': 'Cost per kg treated', 'value': usage['cost_per_kg'], 'kind': 'money'}],
        'chart': {'type': 'bar', 'x': 'chemical', 'kind': 'money', 'series': [{'key': 'cost', 'label': 'Cost'}]},
    }


def quality_performance(period, user):
    from apps.quality.models import STAGE_CHOICES, Inspection

    inspections = period.filter(Inspection.objects.all(), 'inspected_on').order_by()
    blank = lambda group, name, href: {   # noqa: E731
        'group': group, 'name': name, 'inspections': 0, 'passed': 0, 'conditional': 0, 'failed': 0, '_href': href}
    field = {'Pass': 'passed', 'Conditional': 'conditional', 'Fail': 'failed'}
    stages = {stage: blank('Stage', label, '/quality') for stage, label in STAGE_CHOICES}
    for stage, result, n in inspections.values_list('stage', 'result').annotate(n=Count('id')):
        stages[stage]['inspections'] += n
        stages[stage][field[result]] += n
    suppliers = {}
    for vendor, name, result, n in (inspections.filter(stage='Incoming', stock__isnull=False)
                                    .values_list('stock__vendor_id', 'stock__vendor__name', 'result')
                                    .annotate(n=Count('id'))):
        row = suppliers.setdefault(vendor, blank('Supplier', name, '/procurement'))
        row['inspections'] += n
        row[field[result]] += n
    rows = list(stages.values()) + sorted(suppliers.values(), key=lambda r: r['name'])
    for row in rows:
        row['pass_pct'] = _pct(row['inspections'] - row['failed'], row['inspections'])
    total = {key: sum(r[key] for r in stages.values()) for key in ('inspections', 'passed', 'conditional', 'failed')}
    return {
        'columns': [_col('group', 'By'), _col('name', 'Name'), _col('inspections', 'Inspections', 'number'),
                    _col('passed', 'Pass', 'number'), _col('conditional', 'Conditional', 'number'),
                    _col('failed', 'Fail', 'number'), _col('pass_pct', 'Pass rate', 'percent')],
        'rows': rows,
        'totals': {'group': 'Total', **total, 'pass_pct': _pct(total['inspections'] - total['failed'], total['inspections'])},
        'notes': ['Inspections dated in the period, by stage and, for incoming material, by supplier.',
                  'Pass rate = inspections that did not fail (pass or conditional) / all inspections x 100, as on the '
                  'Quality page. The total counts each inspection once (the stage rows).'],
        'chart': {'type': 'bar', 'x': 'name', 'only': {'key': 'group', 'value': 'Stage'}, 'kind': 'number',
                  'series': [{'key': 'passed', 'label': 'Pass'}, {'key': 'conditional', 'label': 'Conditional'},
                             {'key': 'failed', 'label': 'Fail'}]},
    }


def supplier_performance(period, user):
    from apps.procurement.views import SupplierPerformanceView

    rows = []
    for s in _module_view(SupplierPerformanceView, user):
        rows.append({
            'supplier': s['name'], 'category': s['category'], 'orders': s['orders'], 'deliveries': s['deliveries'],
            'ordered_kg': _fixed(s['ordered_kg']), 'received_kg': _fixed(s['received_kg']),
            'rejected_kg': _fixed(s['rejected_kg']), 'rejected_pct': s['rejected_pct'],
            'on_time_pct': s['on_time_pct'], 'avg_price_per_kg': _fixed(s['avg_price_per_kg']),
            'spend': _fixed(s['spend']), 'payable': _fixed(s['payable']),
            'inspections': s['inspections'], 'quality_pass_pct': s['quality_pass_pct'],
            '_href': '/procurement',
        })
    return {
        'columns': [_col('supplier', 'Supplier'), _col('category', 'Category'), _col('orders', 'Orders', 'number'),
                    _col('deliveries', 'Deliveries', 'number'), _col('ordered_kg', 'Ordered', 'kg'),
                    _col('received_kg', 'Received', 'kg'), _col('rejected_kg', 'Rejected', 'kg'),
                    _col('rejected_pct', 'Rejected share', 'percent'), _col('on_time_pct', 'On time', 'percent'),
                    _col('avg_price_per_kg', 'Average price per kg', 'money'), _col('spend', 'Ordered value', 'money'),
                    _col('payable', 'We owe', 'money'), _col('inspections', 'Inspections', 'number'),
                    _col('quality_pass_pct', 'Quality pass rate', 'percent')],
        'rows': rows,
        'totals': {'supplier': 'Total', 'orders': sum(r['orders'] for r in rows),
                   'deliveries': sum(r['deliveries'] for r in rows), 'ordered_kg': _sum(rows, 'ordered_kg'),
                   'received_kg': _sum(rows, 'received_kg'), 'rejected_kg': _sum(rows, 'rejected_kg'),
                   'spend': _sum(rows, 'spend'), 'payable': _sum(rows, 'payable')},
        'notes': ["This is Purchasing's supplier performance report. It covers all records: that calculation has no "
                  'period, so the date filter does not change it.'],
        'chart': {'type': 'bar', 'x': 'supplier', 'kind': 'kg',
                  'series': [{'key': 'received_kg', 'label': 'Received'}, {'key': 'rejected_kg', 'label': 'Rejected'}]},
    }


def customer_sales(period, user):
    from apps.sales.views import SalesPerformanceView

    data = _module_view(SalesPerformanceView, user, period.params)
    rows = []
    for group, key in (('Customer', 'by_customer'), ('Material', 'by_product'), ('Month', 'by_month')):
        for r in data[key]:
            kg, revenue = Decimal(r['kg']), Decimal(r['revenue'])
            rows.append({'group': group, 'name': r['name'], 'orders': r['orders'], 'kg': r['kg'],
                         'revenue': r['revenue'], 'average_price': _fixed(revenue / kg) if kg else None,
                         '_href': '/sales'})
    notes = ['Sales orders created in the period that are confirmed, dispatched or completed, as in the Sales '
             "page's Performance tab. The same orders are listed three ways: by customer, by material and by month; "
             'the total counts each order once.',
             f"Quotations in the period: {data['quotations']}"
             + (f", {data['quotation_win_pct']}% of the decided ones won." if data['quotation_win_pct'] is not None else '.'),
             f"Approved returns in the period: {data['returned_kg']} kg, Rs. {data['returned_credit']} credited."]
    return {
        'columns': [_col('group', 'By'), _col('name', 'Name'), _col('orders', 'Orders', 'number'),
                    _col('kg', 'Weight', 'kg'), _col('revenue', 'Order value', 'money'),
                    _col('average_price', 'Average price per kg', 'money')],
        'rows': rows,
        'totals': {'group': 'Total', 'orders': data['orders'], 'kg': data['kg'], 'revenue': data['revenue'],
                   'average_price': data['average_price']},
        'notes': notes,
        'chart': {'type': 'line', 'x': 'name', 'only': {'key': 'group', 'value': 'Month'}, 'kind': 'money',
                  'series': [{'key': 'revenue', 'label': 'Order value'}]},
    }


def production_costing(period, user):
    from apps.finance import services as finance

    finance.sync_operations(user)
    data = finance.production_cost(*period.bounds())
    rows = [{'kind': r['kind'], 'basis': r['basis'], 'amount': r['amount'], 'share_pct': r['share_pct'],
             '_href': '/finance'} for r in data['rows']]
    return {
        'columns': [_col('kind', 'Cost'), _col('basis', 'Taken from'), _col('amount', 'Amount', 'money'),
                    _col('share_pct', 'Share', 'percent')],
        'rows': rows,
        'totals': {'kind': 'Total production cost', 'amount': data['total']},
        'notes': ["Finance's production costing for the period: supplier invoices before tax, chemicals issued at "
                  'cost, hours on production stages x their hourly cost, and expenses by account.',
                  'Cost per kg = total cost / dried output of the drying sessions completed in the period.',
                  f"Production orders planned to start in the period: {data['orders']}. Estimated cost "
                  f"Rs. {data['estimated_order_cost']}, actual Rs. {data['actual_order_cost']}, "
                  f"difference Rs. {data['order_variance']}."],
        'summary': [{'label': 'Total cost', 'value': data['total'], 'kind': 'money'},
                    {'label': 'Dried output', 'value': data['output_kg'], 'kind': 'kg'},
                    {'label': 'Cost per kg', 'value': data['cost_per_kg'], 'kind': 'money'},
                    {'label': 'Orders against estimate', 'value': data['order_variance'], 'kind': 'money'}],
        'chart': {'type': 'bar', 'x': 'kind', 'kind': 'money', 'series': [{'key': 'amount', 'label': 'Amount'}]},
    }


def profit_and_loss(period, user):
    from apps.finance import services as finance

    finance.sync_operations(user)
    data = finance.profit_and_loss(period.start, period.end)
    rows = [{'section': section, 'code': r['code'], 'account': r['name'], 'amount': r['amount'], '_href': '/finance'}
            for section, key in (('Income', 'income'), ('Expenses', 'expenses')) for r in data[key]]
    return {
        'columns': [_col('section', 'Section'), _col('code', 'Code'), _col('account', 'Account'),
                    _col('amount', 'Amount', 'money')],
        'rows': rows,
        'totals': {'section': 'Net profit', 'amount': data['net_profit']},
        'notes': ["Finance's profit and loss statement: the balance of each income and expense account from the "
                  'journal entries dated in the period. Net profit = income - expenses.',
                  'A sale reaches the books when it is invoiced, so income here can differ from order values on the '
                  'Sales page.'],
        'summary': [{'label': 'Income', 'value': data['total_income'], 'kind': 'money'},
                    {'label': 'Expenses', 'value': data['total_expenses'], 'kind': 'money'},
                    {'label': 'Net profit', 'value': data['net_profit'], 'kind': 'money'}],
        'chart': {'type': 'bar', 'x': 'account', 'kind': 'money', 'series': [{'key': 'amount', 'label': 'Amount'}]},
    }


def waste_sustainability(period, user):
    from apps.sustainability import services as sustainability

    figures = sustainability.figures(period.params)
    waste, utilities = figures['waste'], figures['utilities']
    rows = [{'group': group, 'name': r['name'], 'kg': r['kg'], 'share_pct': r['share_pct'], '_href': '/sustainability'}
            for group, key in (('Disposal method', 'by_method'), ('Category', 'by_category'), ('Stage', 'by_stage'),
                               ('Classification', 'by_classification'))
            for r in waste[key]]
    return {
        'columns': [_col('group', 'By'), _col('name', 'Name'), _col('kg', 'Waste', 'kg'),
                    _col('share_pct', 'Share', 'percent')],
        'rows': rows,
        'totals': {'group': 'Waste handled', 'kg': waste['total_kg']},
        'notes': _definitions('Waste handled', 'Diverted from landfill', 'Water per kg', 'Energy per kg') + [
            'The same waste records are listed four ways; the total counts each record once.'],
        'summary': [{'label': 'Waste handled', 'value': waste['total_kg'], 'kind': 'kg'},
                    {'label': 'To landfill', 'value': waste['landfill_kg'], 'kind': 'kg'},
                    {'label': 'Diverted from landfill', 'value': waste['diverted_pct'], 'kind': 'percent'},
                    {'label': 'Hazardous', 'value': waste['hazardous_kg'], 'kind': 'kg'},
                    {'label': 'Disposal cost', 'value': waste['disposal_cost'], 'kind': 'money'},
                    {'label': 'Income from waste', 'value': waste['revenue'], 'kind': 'money'},
                    {'label': 'Water, litres per kg', 'value': utilities['water_l_per_kg'], 'kind': 'number'},
                    {'label': 'Energy, kWh per kg', 'value': utilities['energy_kwh_per_kg'], 'kind': 'number'}],
        'chart': {'type': 'bar', 'x': 'name', 'only': {'key': 'group', 'value': 'Disposal method'}, 'kind': 'kg',
                  'series': [{'key': 'kg', 'label': 'Waste'}]},
    }


def machine_utilisation(period, user):
    from apps.maintenance import services as maintenance

    data = maintenance.performance(period.params)
    # Maintenance works out its own days (last 90 when none are given, never past today)
    period.start, period.end = date.fromisoformat(data['start']), date.fromisoformat(data['end'])
    rows = [{
        'code': m['code'], 'machine': m['name'], 'category': m['category'], 'status': m['status'],
        'work_orders': m['work_orders'], 'breakdowns': m['breakdowns'], 'downtime_hours': m['downtime_hours'],
        'availability_pct': m['availability_pct'], 'mtbf_days': m['mtbf_days'], 'cost': m['cost'],
        'downtime_cost': m['downtime_cost'], '_href': '/maintenance',
    } for m in data['machines']]
    return {
        'columns': [_col('code', 'Code'), _col('machine', 'Machine'), _col('category', 'Category'),
                    _col('status', 'Status'), _col('work_orders', 'Work orders', 'number'),
                    _col('breakdowns', 'Breakdowns', 'number'), _col('downtime_hours', 'Downtime hours', 'number'),
                    _col('availability_pct', 'Availability', 'percent'),
                    _col('mtbf_days', 'Days between breakdowns', 'number'), _col('cost', 'Maintenance cost', 'money'),
                    _col('downtime_cost', 'Downtime cost', 'money')],
        'rows': rows,
        'totals': {'code': 'Total', 'work_orders': sum(r['work_orders'] for r in rows), 'breakdowns': data['breakdowns'],
                   'downtime_hours': data['downtime_hours'], 'availability_pct': data['availability_pct'],
                   'cost': data['cost'], 'downtime_cost': _sum(rows, 'downtime_cost')},
        'notes': [f"Maintenance's performance report over {data['days']} days. Work orders count by the day they were "
                  'reported; cancelled ones are left out.',
                  'Availability = (hours in the period - downtime hours) / hours in the period x 100, on a 24-hour '
                  'day. Downtime cost = downtime hours x the machine\'s hourly operating cost.',
                  'This report always covers a set number of days: with no period it uses the last 90 days, and it '
                  'never runs past today.'],
        'chart': {'type': 'bar', 'x': 'code', 'kind': 'number',
                  'series': [{'key': 'downtime_hours', 'label': 'Downtime hours'}]},
    }


REPORTS = [
    {'key': 'inventory-valuation', 'group': 'Stock', 'title': 'Inventory valuation', 'build': inventory_valuation,
     'description': 'Sellable stock per lot: on hand, reserved, available, and its value at production cost.'},
    {'key': 'stock-movement', 'group': 'Stock', 'title': 'Stock movement', 'build': stock_movement,
     'description': 'What went into and out of sellable stock, by lot and kind of movement.'},
    {'key': 'material-recovery', 'group': 'Production', 'title': 'Material recovery and waste',
     'build': material_recovery,
     'description': 'Input, output, loss and yield of each stage, and the overall recovery rate.'},
    {'key': 'sorting-performance', 'group': 'Production', 'title': 'Sorting performance', 'build': sorting_performance,
     'description': 'Kg taken, sorted and wasted per supervisor and unit, with efficiency.'},
    {'key': 'production-efficiency', 'group': 'Production', 'title': 'Production efficiency',
     'build': production_efficiency,
     'description': 'Production orders: planned against actual output, hours and cost.'},
    {'key': 'chemical-consumption', 'group': 'Production', 'title': 'Chemical consumption',
     'build': chemical_consumption, 'description': 'Quantity and cost of each chemical issued.'},
    {'key': 'quality-performance', 'group': 'Quality', 'title': 'Quality performance', 'build': quality_performance,
     'description': 'Inspections passed, conditional and failed, by stage and by supplier.'},
    {'key': 'supplier-performance', 'group': 'Commercial', 'title': 'Supplier performance',
     'build': supplier_performance, 'dated': False,
     'description': 'Orders, delivered and rejected weight, on-time delivery, prices and what is owed.'},
    {'key': 'customer-sales', 'group': 'Commercial', 'title': 'Customer sales', 'build': customer_sales,
     'description': 'Orders, weight and value by customer, by material and by month.'},
    {'key': 'production-costing', 'group': 'Finance', 'title': 'Production costing', 'build': production_costing,
     'description': 'What production cost, by kind of cost, and per kg of dried output.'},
    {'key': 'profit-and-loss', 'group': 'Finance', 'title': 'Profit and loss', 'build': profit_and_loss,
     'description': 'Income and expenses by account, and the net profit.'},
    {'key': 'waste-sustainability', 'group': 'Sustainability', 'title': 'Waste and sustainability',
     'build': waste_sustainability,
     'description': 'Waste handled by disposal method, category and stage; landfill share, water and energy per kg.'},
    {'key': 'machine-utilisation', 'group': 'Maintenance', 'title': 'Machine utilisation', 'build': machine_utilisation,
     'description': 'Availability, downtime, breakdowns and maintenance cost per machine.'},
]
BY_KEY = {report['key']: report for report in REPORTS}


def catalogue():
    return [{'key': r['key'], 'title': r['title'], 'description': r['description'], 'group': r['group'],
             'dated': r.get('dated', True)} for r in REPORTS]


def run(key, params, user):
    report = BY_KEY.get(key)
    if report is None:
        raise NotFound('There is no report with this name.')
    period = period_from(params) if report.get('dated', True) else Period()
    data = report['build'](period, user)
    return {
        'key': key, 'title': report['title'], 'description': report['description'], 'group': report['group'],
        'period': period.as_dict(), 'generated_at': timezone.localtime().isoformat(timespec='seconds'),
        'summary': [], 'chart': None, **data,
    }


# ─────────────────────────────────────────────────────────────────────────────
# Scheduled e-mail reports (described, not run, by this app)
# ─────────────────────────────────────────────────────────────────────────────

def schedules():
    recipient = bool(getattr(settings, 'MANAGEMENT_EMAIL', ''))
    return {
        'recipient_set': recipient,
        'automatic': False,
        'how': 'The system has no built-in timer. Each report is a command that the server\'s own scheduler (cron on '
               'Linux, Task Scheduler on Windows) must run. Until that is set up, a report is sent only when someone '
               'runs its command.',
        'reports': [
            {'name': 'Daily production summary', 'command': 'python manage.py send_daily_report',
             'suggested': 'Every day at 18:00',
             'contents': "Today's deliveries, sorting sessions and decolorization sessions, as an e-mail with an "
                         'Excel file attached. The same command also checks chemical stock and sends a low-stock alert.'},
            {'name': 'Monthly sales summary', 'command': 'python manage.py send_monthly_report',
             'suggested': 'On the 1st of each month at 08:00',
             'contents': "Last calendar month's orders and payments, as an e-mail with an Excel file attached."},
        ],
    }


# ─────────────────────────────────────────────────────────────────────────────
# Executive dashboard: one small block of figures per module
# ─────────────────────────────────────────────────────────────────────────────

def _finance_block(user, today):
    from apps.finance import services as finance
    from apps.finance.models import Account

    finance.sync_operations(user)
    totals = finance._totals()
    cash = sum((finance.balance_of(a, *totals.get(a.pk, (ZERO, ZERO)))
                for a in Account.objects.filter(is_cash=True, is_active=True)), ZERO)
    owed = finance.balances()
    month = finance.profit_and_loss(today.replace(day=1), today)
    return {'cash': _fixed(cash), 'receivable': owed['total_receivable'], 'payable': owed['total_payable'],
            'profit_month': month['net_profit']}


def _sales_block(user, today):
    from apps.sales import services as sales
    from apps.sales.models import SalesInvoice, SalesOrder

    open_orders = SalesOrder.objects.filter(status__in=('Confirmed', 'Dispatched')).aggregate(
        n=Count('id'), value=Sum('total_price'))
    invoices = list(SalesInvoice.objects.only('id', 'order_id', 'total'))
    states = sales.invoice_states(invoices)
    overdue = [i for i in invoices if states[i.pk]['status'] == 'Overdue']
    return {'open_orders': open_orders['n'], 'open_order_value': _fixed(open_orders['value']),
            'overdue_invoices': len(overdue),
            'overdue_amount': _fixed(sum((i.total - states[i.pk]['paid'] for i in overdue), ZERO))}


def _procurement_block(user, today):
    from apps.procurement.models import PurchaseOrder

    counts = PurchaseOrder.objects.aggregate(
        approval=Count('id', filter=Q(status='Submitted')),
        delivery=Count('id', filter=Q(status__in=PurchaseOrder.OPEN_STATUSES)),
        late=Count('id', filter=Q(status__in=PurchaseOrder.OPEN_STATUSES, expected_date__lt=today)))
    return {'pending_orders': counts['approval'] + counts['delivery'], 'awaiting_approval': counts['approval'],
            'awaiting_delivery': counts['delivery'], 'late_orders': counts['late']}


def _production_block(user, today):
    from apps.production.models import ProductionOrder

    return ProductionOrder.objects.aggregate(
        in_progress=Count('id', filter=Q(status='In Progress')),
        late=Count('id', filter=Q(status__in=ProductionOrder.OPEN_STATUSES, planned_end__lt=today)))


def _quality_block(user, today):
    from apps.quality.models import CorrectiveAction, Inspection

    actions = CorrectiveAction.objects.filter(status='Open').aggregate(
        n=Count('id'), overdue=Count('id', filter=Q(due_date__lt=today)))
    return {'quarantined': Inspection.objects.filter(result='Fail', released_at__isnull=True).count(),
            'open_actions': actions['n'], 'overdue_actions': actions['overdue']}


def _maintenance_block(user, today):
    from apps.maintenance.models import Machine, MaintenanceSchedule

    return {'broken_down': Machine.objects.filter(status='Broken down').count(),
            'overdue_schedules': MaintenanceSchedule.objects.filter(is_active=True, next_due_on__lt=today).count()}


def _sustainability_block(user, today):
    from apps.sustainability import services as sustainability

    figures = sustainability.figures({'date_filter': 'this_month'})
    return {'recovery_pct': figures['recovery']['rate_pct'], 'landfill_kg': figures['waste']['landfill_kg'],
            'waste_kg': figures['waste']['total_kg']}


def _documents_block(user, today):
    from apps.documents import services as documents

    visible = documents.visible_documents(user)
    return {'expired': documents.filter_status(visible, 'Expired', today).count(),
            'expiring_soon': documents.filter_status(visible, 'Expiring soon', today).count(),
            'expiring_days': documents.EXPIRING_DAYS}


def _workforce_block(user, today):
    from apps.workforce import services as workforce

    summary = workforce.summary()
    return {'present_today': summary['present_today'] + summary['late_today'],
            'on_leave_today': summary['on_leave_today'], 'employees': summary['employees']}


EXECUTIVE_BLOCKS = {
    'finance': _finance_block, 'sales': _sales_block, 'procurement': _procurement_block,
    'production': _production_block, 'quality': _quality_block, 'maintenance': _maintenance_block,
    'sustainability': _sustainability_block, 'documents': _documents_block, 'workforce': _workforce_block,
}


def executive(user):
    """Each module's figures, or None for a module whose figures could not be worked out."""
    today = timezone.localdate()
    result = {'as_of': today.isoformat()}
    for name, build in EXECUTIVE_BLOCKS.items():
        try:
            with transaction.atomic():   # a failure in one block must not spoil the others
                result[name] = build(user, today)
        except Exception:
            logger.exception('Executive dashboard: the %s figures failed', name)
            result[name] = None
    return result
