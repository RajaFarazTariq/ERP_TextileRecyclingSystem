"""
Environmental figures, worked out from records the factory already keeps.

Nothing here is typed in as a percentage. The sources are:
  - deliveries          warehouse.Stock (our_weight), by the day received
  - stage input/output  completed sorting, decolorization and drying sessions,
                        by the day they were completed (end_date)
  - waste handled       WasteRecord, by its date
  - water, power, fuel  UtilityReading, by its date
  - chemicals           decolorization.ChemicalIssuance, by the day issued
"""
from datetime import date
from decimal import ROUND_HALF_UP, Decimal

from django.utils import timezone

from apps.core.filters import filter_by_date_params
from apps.decolorization.models import ChemicalIssuance, DecolorizationSession
from apps.drying.models import DryingSession
from apps.sorting.models import SortingSession
from apps.warehouse.models import Stock
from .models import STAGES, SustainabilityTarget, UtilityReading, WasteCategory, WasteRecord

ZERO = Decimal('0')
CENT = Decimal('0.01')
DATE_PARAMS = ('date_filter', 'year', 'month', 'start', 'end')

DEFINITIONS = [
    {'name': 'Material in',
     'text': 'Our weight of the deliveries received in the period. Rejected deliveries are left out.'},
    {'name': 'Process loss',
     'text': 'For each stage: input minus output of the sessions completed in the period, in kg and as a share '
             'of the input. "Recorded waste" is the waste weight entered on those sessions; the rest of the loss '
             'is moisture, dust and weighing differences.'},
    {'name': 'Recovery rate',
     'text': 'Dried output of the drying sessions completed in the period, divided by the weight taken into the '
             'sorting sessions completed in the period. Material sorted in one period can be dried in the next, '
             'so short periods can read high or low; a year gives the truest figure.'},
    {'name': 'Stage yields combined',
     'text': 'Sorting yield x decolorization yield x drying yield for the period: what 100 kg entering sorting '
             'would come out as if it went through all three stages at these yields.'},
    {'name': 'Waste handled',
     'text': 'Total weight of the waste records dated in the period.'},
    {'name': 'Diverted from landfill',
     'text': 'Share of the waste handled that was not sent to landfill. Every other disposal method counts as '
             'diverted, including incinerated and treated waste.'},
    {'name': 'Water per kg',
     'text': 'Water utility readings (m3 x 1000 = litres) divided by the dried output in kg. The water written on '
             'decolorization sessions is shown next to it and is not added in.'},
    {'name': 'Energy per kg',
     'text': 'Electricity readings in kWh divided by the dried output in kg. Gas, steam and diesel are listed in '
             'their own units and are not converted to kWh.'},
    {'name': 'Chemicals',
     'text': 'Chemical issuances in the period: quantity per chemical, and cost as quantity x the unit cost kept '
             'on each issuance. Chemical cost per kg is that cost divided by the dried output in kg.'},
]


def _dec(value):
    """Database sums can come back as floats on SQLite; always work in 2-decimal Decimals."""
    return Decimal(str(value or 0)).quantize(CENT, rounding=ROUND_HALF_UP)


def _fixed(value):
    return None if value is None else f'{_dec(value):.2f}'


def _ratio(part, whole, scale=1):
    """part / whole x scale as a Decimal, or None when there is nothing to divide by."""
    return _dec(part * scale / whole) if whole else None


def _pct(part, whole):
    return _ratio(part, whole, 100)


def _total(rows, index):
    return sum((_dec(row[index]) for row in rows), ZERO)


def _day(value):
    """Calendar day of a date or an aware datetime."""
    return timezone.localtime(value).date() if hasattr(value, 'hour') else value


def with_default_period(params):
    """The date parameters as sent, or "this month" when none were sent."""
    if any(params.get(key) for key in DATE_PARAMS):
        return params
    return {'date_filter': 'this_month'}


def months_back(today, n):
    """First days of the last n months, oldest first."""
    year, month = today.year, today.month
    months = []
    for _ in range(n):
        months.append(date(year, month, 1))
        year, month = (year - 1, 12) if month == 1 else (year, month - 1)
    return months[::-1]


# ── Rows: (day, numbers...) per source, either for a period or since a day ───

def _rows(queryset, field, columns, params=None, since=None):
    if params is not None:
        queryset = filter_by_date_params(queryset, params, field)
    if since is not None:
        is_datetime = queryset.model._meta.get_field(field).get_internal_type() == 'DateTimeField'
        queryset = queryset.filter(**{f'{field}__date__gte' if is_datetime else f'{field}__gte': since})
    return [(_day(row[0]), *row[1:]) for row in queryset.values_list(field, *columns)]


def _sources(params=None, since=None):
    done = {'status': 'Completed', 'end_date__isnull': False}
    args = {'params': params, 'since': since}
    return {
        'deliveries': _rows(Stock.objects.exclude(status='Rejected'), 'created_at', ['our_weight'], **args),
        'Sorting': _rows(SortingSession.objects.filter(**done), 'end_date',
                         ['quantity_taken', 'quantity_sorted', 'waste_quantity'], **args),
        'Decolorization': _rows(DecolorizationSession.objects.filter(**done), 'end_date',
                                ['input_quantity', 'output_quantity', 'waste_quantity', 'water_liters'], **args),
        'Drying': _rows(DryingSession.objects.filter(**done), 'end_date',
                        ['input_quantity', 'output_quantity', 'waste_quantity'], **args),
        'waste': _rows(WasteRecord.objects.all(), 'date',
                       ['quantity_kg', 'category__classification', 'disposal_method', 'stage', 'category__name',
                        'disposal_cost', 'revenue'], **args),
        'utilities': _rows(UtilityReading.objects.all(), 'date', ['utility', 'quantity', 'cost'], **args),
        'chemicals': _rows(ChemicalIssuance.objects.all(), 'issued_at',
                           ['quantity', 'unit_cost', 'chemical_id', 'chemical__chemical_name',
                            'chemical__unit_of_measure'], **args),
    }


# ── Figures for one set of rows ─────────────────────────────────────────────

def _stage(name, rows):
    taken, made, waste = _total(rows, 1), _total(rows, 2), _total(rows, 3)
    loss = taken - made
    return {
        'stage': name, 'sessions': len(rows),
        'input_kg': taken, 'output_kg': made, 'loss_kg': loss, 'loss_pct': _pct(loss, taken),
        'waste_kg': waste, 'other_loss_kg': loss - waste, 'yield_pct': _pct(made, taken),
    }


def _recovery(stages):
    """
    Overall recovery rate % = dried output / material that entered processing x 100.

      dried output       = output_quantity of the drying sessions completed in the period
      entered processing = quantity_taken of the sorting sessions completed in the period

    None when no sorting session was completed. `stage_yield_pct` multiplies the
    three stage yields instead, which does not depend on when a lot moved on.
    """
    sorting, decolor, drying = stages
    entered, dried = sorting['input_kg'], drying['output_kg']
    combined = Decimal('100')
    for stage in stages:
        if not stage['input_kg']:
            combined = None
            break
        combined = combined * stage['output_kg'] / stage['input_kg']
    return {
        'input_kg': entered, 'output_kg': dried, 'rate_pct': _pct(dried, entered),
        'loss_kg': entered - dried if entered else None,
        'stage_yield_pct': None if combined is None else _dec(combined),
    }


def _grouped(rows, index, order=None):
    """Waste weight per value of one column, largest first (or in `order`)."""
    totals = {}
    for row in rows:
        totals[row[index]] = totals.get(row[index], ZERO) + _dec(row[1])
    whole = sum(totals.values(), ZERO)
    names = [n for n in order if n in totals] if order else sorted(totals, key=lambda n: (-totals[n], n))
    return [{'name': n, 'kg': _fixed(totals[n]), 'share_pct': _fixed(_pct(totals[n], whole))} for n in names]


def _waste(rows):
    total = _total(rows, 1)
    landfill = sum((_dec(r[1]) for r in rows if r[3] == 'Landfill'), ZERO)
    hazardous = sum((_dec(r[1]) for r in rows if r[2] == 'Hazardous'), ZERO)
    return {
        'records': len(rows), 'total_kg': total, 'landfill_kg': landfill, 'diverted_kg': total - landfill,
        'diverted_pct': _pct(total - landfill, total), 'landfill_pct': _pct(landfill, total),
        'hazardous_kg': hazardous, 'disposal_cost': _total(rows, 6), 'revenue': _total(rows, 7),
        'by_classification': _grouped(rows, 2, [c for c, _ in WasteCategory.CLASSIFICATION_CHOICES]),
        'by_method': _grouped(rows, 3),
        'by_stage': _grouped(rows, 4, STAGES),
        'by_category': _grouped(rows, 5),
    }


def _utilities(rows, session_water, dried):
    by_utility = {}
    for _, utility, quantity, cost in rows:
        entry = by_utility.setdefault(utility, {'quantity': ZERO, 'cost': ZERO, 'readings': 0})
        entry['quantity'] += _dec(quantity)
        entry['cost'] += _dec(cost)
        entry['readings'] += 1
    water = by_utility.get('Water', {}).get('quantity', ZERO)
    energy = by_utility.get('Electricity', {}).get('quantity', ZERO)
    return {
        'water_m3': water, 'water_l_per_kg': _ratio(water * 1000, dried),
        'session_water_liters': session_water,
        'energy_kwh': energy, 'energy_kwh_per_kg': _ratio(energy, dried),
        'total_cost': sum((u['cost'] for u in by_utility.values()), ZERO),
        'by_utility': [
            {'utility': name, 'unit': unit, 'quantity': _fixed(by_utility[name]['quantity']),
             'cost': _fixed(by_utility[name]['cost']), 'readings': by_utility[name]['readings']}
            for name, unit in UtilityReading.UNITS.items() if name in by_utility
        ],
    }


def _chemicals(rows, dried):
    items = {}
    for _, quantity, unit_cost, chemical, name, unit in rows:
        entry = items.setdefault(chemical, {'chemical': chemical, 'chemical_name': name, 'unit': unit,
                                            'quantity': ZERO, 'cost': ZERO, 'issuances': 0})
        entry['quantity'] += _dec(quantity)
        entry['cost'] += _dec(_dec(quantity) * _dec(unit_cost))
        entry['issuances'] += 1
    total = sum((i['cost'] for i in items.values()), ZERO)
    return {
        'issuances': len(rows), 'total_cost': total, 'cost_per_kg': _ratio(total, dried),
        'items': [{**i, 'quantity': _fixed(i['quantity']), 'cost': _fixed(i['cost'])}
                  for i in sorted(items.values(), key=lambda i: (-i['cost'], i['chemical_name']))],
    }


def _strings(figures):
    """Decimals to '0.00' strings, one level deep (lists inside are already formatted)."""
    return {key: _fixed(value) if isinstance(value, Decimal) else value for key, value in figures.items()}


def figures(params):
    """Everything the report shows for the period described by the DateFilter params."""
    src = _sources(params=params)
    stages = [_stage(name, src[name]) for name in ('Sorting', 'Decolorization', 'Drying')]
    dried = stages[2]['output_kg']
    session_water = sum((_dec(r[4]) for r in src['Decolorization'] if r[4] is not None), ZERO)
    recovery = _recovery(stages)
    waste = _waste(src['waste'])
    utilities = _utilities(src['utilities'], session_water, dried)
    chemicals = _chemicals(src['chemicals'], dried)
    actuals = {
        'recovery_rate': recovery['rate_pct'],
        'landfill_share': waste['landfill_pct'],
        'water_per_kg': utilities['water_l_per_kg'],
        'energy_per_kg': utilities['energy_kwh_per_kg'],
        'chemical_per_kg': chemicals['cost_per_kg'],
    }
    return {
        'material_in': {'deliveries': len(src['deliveries']), 'kg': _fixed(_total(src['deliveries'], 1))},
        'stages': [_strings(s) for s in stages],
        'recovery': _strings(recovery),
        'waste': _strings(waste),
        'utilities': _strings(utilities),
        'chemicals': _strings(chemicals),
        'targets': targets(actuals),
        'definitions': DEFINITIONS,
    }


def targets(actuals):
    """Each active target with the calculated value; `met` is None when there is nothing to measure yet."""
    result = []
    for target in SustainabilityTarget.objects.filter(is_active=True):
        actual = actuals.get(target.metric)
        if actual is None:
            met = None
        elif target.direction == 'At least':
            met = actual >= target.target_value
        else:
            met = actual <= target.target_value
        result.append({
            'id': target.pk, 'metric': target.metric, 'metric_label': target.get_metric_display(),
            'direction': target.direction, 'target_value': _fixed(target.target_value), 'period': target.period,
            'actual': _fixed(actual), 'met': met,
        })
    return result


def trend(months=12):
    """Month by month: material into sorting, dried output, recovery %, waste handled, water and electricity."""
    firsts = months_back(timezone.localdate(), months)
    src = _sources(since=firsts[0])
    buckets = {m: {'input': ZERO, 'output': ZERO, 'waste': ZERO, 'water': ZERO, 'energy': ZERO} for m in firsts}

    def add(rows, key, index, only=None):
        for row in rows:
            bucket = buckets.get(row[0].replace(day=1))
            if bucket is not None and (only is None or row[1] == only):
                bucket[key] += _dec(row[index])

    add(src['Sorting'], 'input', 1)
    add(src['Drying'], 'output', 2)
    add(src['waste'], 'waste', 1)
    add(src['utilities'], 'water', 2, only='Water')
    add(src['utilities'], 'energy', 2, only='Electricity')
    return [{
        'month': m.strftime('%Y-%m'),
        'input_kg': _fixed(b['input']), 'output_kg': _fixed(b['output']),
        'recovery_pct': _fixed(_pct(b['output'], b['input'])),
        'waste_kg': _fixed(b['waste']), 'water_m3': _fixed(b['water']), 'energy_kwh': _fixed(b['energy']),
    } for m, b in buckets.items()]
