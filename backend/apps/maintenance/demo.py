"""Demo records for the Maintenance module. Called from the seed command."""
from datetime import timedelta
from decimal import Decimal

from django.db import transaction
from django.utils import timezone

from apps.decolorization.models import Tank
from apps.drying.models import Dryer
from apps.users.models import CustomUser
from . import services
from .models import Machine, MaintenanceSchedule, PartUse, SparePart, WorkOrder


def wipe_demo_maintenance():
    PartUse.objects.all().delete()
    WorkOrder.objects.all().delete()
    MaintenanceSchedule.objects.all().delete()
    SparePart.objects.all().delete()
    Machine.objects.all().delete()


@transaction.atomic
def add_demo_maintenance(admin):
    today = timezone.localdate()
    now = timezone.now()

    def user(name):
        return CustomUser.objects.filter(username=name).first() or admin

    sorter, decolor, drier, keeper = (user(n) for n in ('sorting_user', 'decolor_user', 'drying_user', 'warehouse_user'))
    tank = Tank.objects.order_by('id').first()
    dryer = Dryer.objects.order_by('id').first()

    def machine(code, name, category, location, maker, model, cost, installed_days_ago, **extra):
        return Machine.objects.create(
            code=code, name=name, category=category, location=location, manufacturer=maker, model=model,
            serial_number=f'{code}-{2000 + len(code) * 137}', hourly_operating_cost=Decimal(cost),
            installed_on=today - timedelta(days=installed_days_ago), **extra)

    sorting_line = machine('SL-01', 'Sorting conveyor line 1', 'Sorting line', 'Sorting hall', 'Valvan', 'Fibersort 2',
                           '1800', 900, specifications='Belt 1.2 m wide, 12 sorting stations, 7.5 kW drive')
    shredder = machine('SH-01', 'Fabric shredder', 'Shredder', 'Sorting hall', 'Dell Orco', 'DV-1000', '2400', 760,
                       specifications='1000 mm working width, 45 kW, up to 800 kg per hour')
    tank_machine = machine('TK-01', 'Decolorization tank 1', 'Tank', 'Wet processing', 'Thies', 'iMaster H2O', '3200',
                           1100, tank=tank, specifications='Stainless steel, steam heated, circulation pump 11 kW')
    dryer_machine = machine('DR-01', 'Tumble dryer 1', 'Dryer', 'Drying hall', 'Biancalani', 'Airo 24', '2800', 640,
                            dryer=dryer, specifications='Gas heated, 300 kg per batch')
    baler = machine('BL-01', 'Hydraulic baler', 'Baler', 'Dispatch bay', 'Bramidan', 'B30', '900', 1300,
                    specifications='30 t press force, bale size 120 x 80 cm')
    boiler = machine('UT-01', 'Steam boiler', 'Utility', 'Boiler room', 'Forbes Marshall', 'Marshall B', '4500', 1500,
                     specifications='2 t/h, 10.5 bar, gas fired')
    machine('UT-02', 'Air compressor', 'Utility', 'Boiler room', 'Atlas Copco', 'GA 22', '700', 420, status='Idle',
            notes='Standby unit; runs when the main compressor is serviced.')
    machine('SH-00', 'Old rag cutter', 'Shredder', 'Store', 'Local', 'RC-2', '0', 3200, status='Retired',
            notes='Replaced by SH-01.')

    def part(code, name, unit, stock, reorder, cost, location):
        return SparePart.objects.create(code=code, name=name, unit=unit, stock_quantity=Decimal(stock),
                                        reorder_level=Decimal(reorder), unit_cost=Decimal(cost), location=location)

    belt = part('BLT-A68', 'V-belt A68', 'pcs', '14', '6', '850', 'Rack A1')
    bearing = part('BRG-6205', 'Bearing 6205-2RS', 'pcs', '9', '8', '620', 'Rack A2')
    blade = part('BLD-SH10', 'Shredder blade set', 'set', '3', '2', '18500', 'Rack B1')
    oil = part('OIL-H46', 'Hydraulic oil ISO 46', 'L', '120', '60', '540', 'Oil store')
    seal = part('SEL-P11', 'Pump mechanical seal', 'pcs', '4', '2', '7400', 'Rack A3')
    part('FLT-D24', 'Dryer lint filter', 'pcs', '6', '4', '2300', 'Rack C1')
    part('GRS-L2', 'Lithium grease EP2', 'kg', '18', '10', '950', 'Oil store')

    def schedule(target, task, every, last_days_ago, instructions=''):
        return MaintenanceSchedule.objects.create(
            machine=target, task=task, every_days=every, instructions=instructions,
            start_date=today - timedelta(days=every), last_done_on=today - timedelta(days=last_days_ago))

    grease = schedule(sorting_line, 'Grease conveyor bearings', 30, 12, 'Lithium grease on all 24 bearing points.')
    schedule(shredder, 'Check and turn shredder blades', 45, 20, 'Turn blades when the edge is rounded.')
    descale = schedule(tank_machine, 'Descale tank and check pump seal', 60, 68, 'Drain, descale with citric acid, inspect the seal.')
    filters = schedule(dryer_machine, 'Clean lint filters and burner', 14, 17, 'Blow out filters; check the flame sensor.')
    schedule(baler, 'Check hydraulic oil level and hoses', 90, 35)
    schedule(boiler, 'Boiler blowdown and safety valve test', 30, 2)

    def finished(target, title, days_ago, minutes, labour_hours, labour_cost, other_cost, work_done, reporter,
                 breakdown=False, parts=(), kind='Corrective', priority='Normal', linked=None):
        reported = now - timedelta(days=days_ago)
        order = WorkOrder.objects.create(
            machine=target, kind=kind, schedule=linked, title=title, priority=priority, status='Done',
            is_breakdown=breakdown, reported_by=reporter, assigned_to=reporter, reported_at=reported,
            started_at=reported + timedelta(minutes=30), completed_at=reported + timedelta(minutes=30 + minutes),
            downtime_minutes=minutes, labour_hours=Decimal(labour_hours), labour_cost=Decimal(labour_cost),
            other_cost=Decimal(other_cost), work_done=work_done)
        for spare, quantity in parts:
            PartUse.objects.create(work_order=order, part=spare, quantity=Decimal(quantity), unit_cost=spare.unit_cost,
                                   used_by=reporter)
        return order

    finished(shredder, 'Shredder jammed, blades blunt', 71, 380, '6', '3600', '0', 'Cleared the jam and fitted a new blade set.',
             sorter, breakdown=True, parts=[(blade, '1')], priority='Urgent')
    finished(sorting_line, 'Conveyor belt slipping', 58, 95, '1.5', '900', '0', 'Replaced two worn V-belts and set the tension.',
             sorter, breakdown=True, parts=[(belt, '2')], priority='High')
    finished(tank_machine, 'Circulation pump leaking', 44, 310, '5', '3000', '1200', 'Replaced the mechanical seal and tested for leaks.',
             decolor, breakdown=True, parts=[(seal, '1')], priority='High')
    finished(dryer_machine, 'Clean lint filters and burner', 31, 60, '1', '600', '0', 'Filters cleaned, flame sensor wiped.',
             drier, kind='Preventive', linked=filters)
    finished(baler, 'Top up hydraulic oil', 26, 40, '0.5', '300', '0', 'Topped up 20 L; no leak found.', keeper, parts=[(oil, '20')])
    finished(shredder, 'Main bearing running hot', 19, 240, '4', '2400', '500', 'Replaced both main bearings and re-greased.',
             sorter, breakdown=True, parts=[(bearing, '2')], priority='High')
    finished(tank_machine, 'Steam valve stuck open', 12, 150, '2.5', '1500', '2800', 'Valve actuator replaced by the supplier.',
             decolor, breakdown=True, priority='Urgent')
    finished(sorting_line, 'Grease conveyor bearings', 12, 45, '1', '600', '0', 'All bearing points greased.', sorter,
             kind='Preventive', linked=grease)
    finished(dryer_machine, 'Drum door seal torn', 6, 120, '2', '1200', '3500', 'Fitted a new door seal.', drier, breakdown=True)
    finished(boiler, 'Boiler blowdown and safety valve test', 2, 30, '1', '600', '0', 'Blowdown done; valve lifts at 10.5 bar.', admin,
             kind='Preventive')

    # Work in hand: one breakdown being repaired, one preventive job waiting, one report nobody has picked up
    repair = WorkOrder.objects.create(
        machine=baler, title='Baler ram does not return', description='Ram stays down after pressing. Oil on the floor under the cylinder.',
        priority='Urgent', is_breakdown=True, reported_by=keeper, assigned_to=keeper, reported_at=now - timedelta(hours=5))
    services.start(repair, keeper)
    services.use_part(repair, oil, Decimal('15'), keeper)
    services.create_preventive(descale, admin)
    services.create_preventive(filters, admin)
    WorkOrder.objects.create(
        machine=sorting_line, title='Guard rattling at station 7', description='Loose guard panel, not urgent.',
        priority='Low', reported_by=sorter, reported_at=now - timedelta(days=1))
    cancelled = WorkOrder.objects.create(
        machine=boiler, title='Pressure gauge reads low', description='Gauge was replaced during the service.',
        reported_by=admin, reported_at=now - timedelta(days=9), status='Cancelled')
    services.refresh_machine(cancelled.machine)

    # Stock after the jobs above, with two parts at or below their reorder level
    for spare, used in ((belt, 2), (bearing, 2), (blade, 1), (oil, 20), (seal, 1)):
        spare.refresh_from_db()
        spare.stock_quantity -= used
        spare.save(update_fields=['stock_quantity'])
