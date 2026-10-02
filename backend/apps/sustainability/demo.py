"""Demo records for the Sustainability module (called by the seed command)."""
from datetime import timedelta
from decimal import Decimal

from django.utils import timezone

from apps.sorting.models import FabricStock
from apps.users.models import CustomUser
from .models import SustainabilityTarget, UtilityReading, WasteCategory, WasteRecord
from .services import months_back

CATEGORIES = [
    ('Fibre dust', 'Recyclable', 'Dust and short fibres collected from sorting and drying.'),
    ('Offcuts', 'Reusable', 'Clean fabric pieces too small to process.'),
    ('Contaminated fabric', 'General', 'Fabric with oil, paint or other dirt that cannot be processed.'),
    ('Chemical sludge', 'Hazardous', 'Residue from the decolorization tanks.'),
    ('Wastewater sludge', 'Hazardous', 'Solids removed from process water.'),
    ('Packaging', 'Recyclable', 'Bale wrap, straps, drums and cartons.'),
]

# category, stage, recorded by, disposal method, taken by, base kg, cost per kg, revenue per kg
WASTE = [
    ('Fibre dust', 'Sorting', 'sorting_user', 'Sold as by-product', 'Punjab Fibre Fill', 140, 0, 18),
    ('Fibre dust', 'Drying', 'drying_user', 'Recycled internally', '', 60, 0, 0),
    ('Offcuts', 'Sorting', 'sorting_user', 'Reused', 'Wiper cloth unit', 95, 0, 0),
    ('Contaminated fabric', 'Warehouse', 'warehouse_user', 'Landfill', 'City Waste Services', 70, 6, 0),
    ('Contaminated fabric', 'Sorting', 'sorting_user', 'Incinerated', 'Kiln fuel contractor', 45, 4, 0),
    ('Chemical sludge', 'Decolorization', 'decolor_user', 'Treated', 'EnviroTreat (Pvt) Ltd', 55, 22, 0),
    ('Wastewater sludge', 'Decolorization', 'decolor_user', 'Treated', 'EnviroTreat (Pvt) Ltd', 80, 15, 0),
    ('Packaging', 'Warehouse', 'warehouse_user', 'Sent to recycler', 'Lahore Paper & Plastics', 110, 0, 9),
]

# utility, area, recorded by, base quantity per month, cost per unit
UTILITIES = [
    ('Water', 'Decolorization', 'decolor_user', 620, 95),
    ('Water', '', 'admin', 180, 95),
    ('Electricity', '', 'admin', 21500, 48),
    ('Electricity', 'Drying', 'drying_user', 9800, 48),
    ('Gas', 'Drying', 'drying_user', 3400, 130),
    ('Steam', 'Decolorization', 'decolor_user', 5200, 9),
    ('Diesel', 'Warehouse', 'warehouse_user', 380, 285),
]

TARGETS = [
    ('recovery_rate', 'At least', '75'),
    ('landfill_share', 'At most', '15'),
    ('water_per_kg', 'At most', '60'),
    ('energy_per_kg', 'At most', '2.5'),
    ('chemical_per_kg', 'At most', '40'),
]

MONTHS = 6


def _d(value):
    return Decimal(str(value)).quantize(Decimal('0.01'))


def add_demo_sustainability(admin):
    """Six months of waste records and utility readings, and one target per figure."""
    today = timezone.localdate()
    users = {u.username: u for u in CustomUser.objects.filter(
        username__in=['warehouse_user', 'sorting_user', 'decolor_user', 'drying_user'])}
    categories = {}
    for name, classification, description in CATEGORIES:
        categories[name], _ = WasteCategory.objects.get_or_create(
            name=name, defaults={'classification': classification, 'description': description})
    lots = list(FabricStock.objects.order_by('-id')[:8])

    n = 0
    for back, first in enumerate(reversed(months_back(today, MONTHS))):
        # Two rounds of disposals a month, with the amounts drifting down towards today
        for round_no, day_of_month in enumerate((5, 18)):
            day = min(first.replace(day=day_of_month), today)
            for i, (name, stage, username, method, taken_by, kg, cost, revenue) in enumerate(WASTE):
                if (i + back + round_no) % 3 == 0:
                    continue
                n += 1
                quantity = _d(kg * (0.55 + 0.08 * back) * (0.9 + 0.05 * ((i + round_no) % 4)))
                WasteRecord.objects.create(
                    date=day, category=categories[name], stage=stage, quantity_kg=quantity,
                    fabric=lots[n % len(lots)] if lots and stage in ('Sorting', 'Drying') and n % 2 else None,
                    disposal_method=method, disposed_to=taken_by,
                    disposal_cost=_d(quantity * cost), revenue=_d(quantity * revenue),
                    disposal_reference=f'GP-{day:%y%m}-{n:03d}' if taken_by else '',
                    notes='Weighed at the gate before leaving.' if method in ('Landfill', 'Treated') else '',
                    recorded_by=users.get(username, admin),
                )

        # One reading per meter at the end of the month; the running month is read up to today
        month_end = today if back == 0 else (first + timedelta(days=32)).replace(day=1) - timedelta(days=1)
        part = Decimal(today.day) / 30 if back == 0 else Decimal(1)
        for i, (utility, stage, username, base, rate) in enumerate(UTILITIES):
            quantity = _d(base * part * Decimal(str(0.92 + 0.03 * ((back + i) % 5))))
            UtilityReading.objects.create(
                date=month_end, utility=utility, quantity=quantity, cost=_d(quantity * rate), stage=stage,
                meter_reference=f'{utility[:2].upper()}-{(stage or "MAIN")[:4].upper()}-01',
                notes='Month-end meter reading.' if back else 'Reading so far this month.',
                recorded_by=users.get(username, admin),
            )

    for metric, direction, value in TARGETS:
        SustainabilityTarget.objects.get_or_create(
            metric=metric, is_active=True,
            defaults={'direction': direction, 'target_value': _d(value), 'period': str(today.year)})


def wipe_demo_sustainability():
    """Remove every record of the module; add_demo_sustainability() puts the default categories back."""
    WasteRecord.objects.all().delete()
    UtilityReading.objects.all().delete()
    SustainabilityTarget.objects.all().delete()
    WasteCategory.objects.all().delete()
