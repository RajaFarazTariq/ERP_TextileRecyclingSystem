# notifications/management/commands/seed_demo_2days.py
"""
Realistic 2-day factory demo data.

Simulates a real textile recycling factory day:
  Yesterday (Day 1): Morning truck arrival → sorting starts → decolorization batch → sale confirmed
  Today     (Day 2): Follow-up deliveries → sessions completed → dispatch → payment received

Usage:
    python manage.py seed_demo_2days

To wipe and re-seed:
    python manage.py seed_demo_2days --flush
"""

from django.core.management.base import BaseCommand
from django.utils import timezone
from django.contrib.auth import get_user_model
from datetime import timedelta, date
from decimal import Decimal

User = get_user_model()


class Command(BaseCommand):
    help = 'Seed realistic 2-day demo data (yesterday + today) across all modules'

    def add_arguments(self, parser):
        parser.add_argument(
            '--flush',
            action='store_true',
            help='Delete all existing demo data before seeding',
        )

    def handle(self, *args, **options):
        if options['flush']:
            self.stdout.write('Flushing existing data...')
            self._flush()

        today     = date.today()
        yesterday = today - timedelta(days=1)

        self.stdout.write(self.style.WARNING(f'\nSeeding demo data for {yesterday} and {today}...\n'))

        users      = self._ensure_users()
        vendors    = self._ensure_vendors()
        units      = self._ensure_units()
        chemicals  = self._ensure_chemicals()
        stocks     = self._seed_warehouse(yesterday, today, vendors, units, users)
        fabrics    = self._seed_fabric_stock(yesterday, stocks)
        sessions   = self._seed_sorting(yesterday, today, fabrics, users, units)
        tanks      = self._ensure_tanks(users)
        self._seed_decolorization(yesterday, today, fabrics, tanks, chemicals, users)
        self._seed_sales(yesterday, today, fabrics, users)

        self.stdout.write(self.style.SUCCESS('\n✓ Demo data seeded successfully!\n'))
        self.stdout.write('  You can now view entries in all modules.')
        self.stdout.write('  Reports for yesterday and today should show data.')

    # ─────────────────────────────────────────────────────────────────────────
    # FLUSH
    # ─────────────────────────────────────────────────────────────────────────
    def _flush(self):
        from warehouse.models import Stock, Vendor, FactoryUnit
        from sorting.models import FabricStock, SortingSession
        from decolorization.models import Tank, ChemicalIssuance, DecolorizationSession
        from sales.models import SalesOrder, Payment, DispatchTracking

        DecolorizationSession.objects.all().delete()
        ChemicalIssuance.objects.all().delete()
        SortingSession.objects.all().delete()
        Payment.objects.all().delete()
        DispatchTracking.objects.all().delete()
        SalesOrder.objects.all().delete()
        Tank.objects.all().delete()
        FabricStock.objects.all().delete()
        Stock.objects.all().delete()
        self.stdout.write('  Flushed transaction data (vendors/units/chemicals/users kept).')

    # ─────────────────────────────────────────────────────────────────────────
    # USERS
    # ─────────────────────────────────────────────────────────────────────────
    def _ensure_users(self):
        roles = {
            'erp_admin':    'admin',
            'wh_user':      'warehouse_supervisor',
            'sort_user':    'sorting_supervisor',
            'decolor_user': 'decolorization_supervisor',
        }
        users = {}
        for username, role in roles.items():
            u, created = User.objects.get_or_create(username=username)
            if created or not u.has_usable_password():
                u.set_password('pass1234')
            u.role = role
            u.save()
            users[username] = u
            status = 'created' if created else 'exists'
            self.stdout.write(f'  User [{status}] {username} / role={role}')
        return users

    # ─────────────────────────────────────────────────────────────────────────
    # VENDORS
    # ─────────────────────────────────────────────────────────────────────────
    def _ensure_vendors(self):
        from warehouse.models import Vendor
        vendor_data = [
            ('Ali Traders',      '0312-4455667', 'Near Ring Road, Lahore'),
            ('Pak Fiber Co.',    '0321-9988776', 'Kot Lakhpat Industrial Area, Lahore'),
            ('Raza & Sons',      '0333-1122334', 'Sundar Industrial Estate, Lahore'),
            ('Punjab Textiles',  '0345-6677889', 'Manga Mandi, Lahore'),
        ]
        vendors = []
        for name, contact, address in vendor_data:
            v, created = Vendor.objects.get_or_create(
                name=name,
                defaults={'contact': contact, 'address': address}
            )
            vendors.append(v)
        self.stdout.write(f'  Vendors: {len(vendors)} ready')
        return vendors

    # ─────────────────────────────────────────────────────────────────────────
    # FACTORY UNITS
    # ─────────────────────────────────────────────────────────────────────────
    def _ensure_units(self):
        from warehouse.models import FactoryUnit
        unit_names = ['Unit A', 'Unit B', 'Unit C']
        units = []
        for name in unit_names:
            u, _ = FactoryUnit.objects.get_or_create(name=name)
            units.append(u)
        self.stdout.write(f'  Factory Units: {len(units)} ready')
        return units

    # ─────────────────────────────────────────────────────────────────────────
    # CHEMICALS
    # ─────────────────────────────────────────────────────────────────────────
    def _ensure_chemicals(self):
        from decolorization.models import ChemicalStock
        chem_data = [
            ('Sodium Hypochlorite', 500, 380, 'Liters'),
            ('Hydrogen Peroxide',   300, 240, 'Liters'),
            ('Caustic Soda',        200, 165, 'Kg'),
            ('Acetic Acid',         150, 120, 'Liters'),
        ]
        chemicals = []
        for name, total, remaining, unit in chem_data:
            c, created = ChemicalStock.objects.get_or_create(
                chemical_name=name,
                defaults={
                    'total_stock':     Decimal(str(total)),
                    'issued_quantity': Decimal(str(total - remaining)),
                    'remaining_stock': Decimal(str(remaining)),
                    'unit_of_measure': unit,
                }
            )
            chemicals.append(c)
        self.stdout.write(f'  Chemicals: {len(chemicals)} ready')
        return chemicals

    # ─────────────────────────────────────────────────────────────────────────
    # WAREHOUSE — Day 1 & Day 2 truck arrivals
    # ─────────────────────────────────────────────────────────────────────────
    def _seed_warehouse(self, yesterday, today, vendors, units, users):
        from warehouse.models import Stock

        wh_user = users['wh_user']

        # Real factory pattern:
        # Day 1 morning: 3 trucks arrive early (08:00–11:00), supervisor receives and weighs
        # Day 2 morning: 2 more trucks arrive, one rejected for quality
        entries = [
            # ── Yesterday (Day 1) ──────────────────────────────────────────
            {
                'day': yesterday, 'hour': 8, 'minute': 15,
                'vendor': vendors[0],   # Ali Traders
                'fabric_type': 'Cotton White Rags',
                'vendor_weight_slip': 'AT-2026-0409-001',
                'vehicle_no': 'LHR-4821',
                'our_weight':       4850,
                'unloading_weight': 4780,   # 70 kg difference (tare/moisture)
                'unit': units[0],
                'status': 'Approved',
                'note': 'Morning shift first truck — cotton white batch'
            },
            {
                'day': yesterday, 'hour': 9, 'minute': 40,
                'vendor': vendors[1],   # Pak Fiber
                'fabric_type': 'Polyester Mixed Cuts',
                'vendor_weight_slip': 'PF-2026-0409-014',
                'vehicle_no': 'LHR-7733',
                'our_weight':       3200,
                'unloading_weight': 3155,
                'unit': units[1],
                'status': 'Approved',
                'note': 'Polyester batch for Tank B-02'
            },
            {
                'day': yesterday, 'hour': 11, 'minute': 5,
                'vendor': vendors[2],   # Raza & Sons
                'fabric_type': 'Cotton Denim Scraps',
                'vendor_weight_slip': 'RS-2026-0409-007',
                'vehicle_no': 'LHR-2290',
                'our_weight':       2600,
                'unloading_weight': 2545,
                'unit': units[0],
                'status': 'Approved',
                'note': 'Denim scraps, heavier moisture content'
            },
            {
                'day': yesterday, 'hour': 14, 'minute': 30,
                'vendor': vendors[3],   # Punjab Textiles
                'fabric_type': 'Synthetic Blend Offcuts',
                'vendor_weight_slip': 'PT-2026-0409-022',
                'vehicle_no': 'LHR-5541',
                'our_weight':       1900,
                'unloading_weight': 1870,
                'unit': units[2],
                'status': 'Received',   # not yet approved, supervisor reviewing
                'note': 'Afternoon delivery, quality check pending'
            },
            # ── Today (Day 2) ──────────────────────────────────────────────
            {
                'day': today, 'hour': 7, 'minute': 55,
                'vendor': vendors[0],   # Ali Traders — repeat delivery
                'fabric_type': 'Cotton White Rags',
                'vendor_weight_slip': 'AT-2026-0410-002',
                'vehicle_no': 'LHR-4821',
                'our_weight':       5100,
                'unloading_weight': 5040,
                'unit': units[0],
                'status': 'Approved',
                'note': 'Day 2 — Ali Traders second delivery this week'
            },
            {
                'day': today, 'hour': 10, 'minute': 20,
                'vendor': vendors[1],   # Pak Fiber
                'fabric_type': 'Polyester Fine Cuts',
                'vendor_weight_slip': 'PF-2026-0410-015',
                'vehicle_no': 'LHR-8820',
                'our_weight':       2800,
                'unloading_weight': 2760,
                'unit': units[1],
                'status': 'Approved',
                'note': 'Fine cut polyester, good condition'
            },
            {
                'day': today, 'hour': 12, 'minute': 10,
                'vendor': vendors[2],   # Raza & Sons — rejected
                'fabric_type': 'Mixed Cotton (Dirty)',
                'vendor_weight_slip': 'RS-2026-0410-008',
                'vehicle_no': 'LHR-3391',
                'our_weight':       1500,
                'unloading_weight': 1500,
                'unit': units[2],
                'status': 'Rejected',   # rejected — contaminated
                'note': 'Rejected: contamination detected, returned to vendor'
            },
        ]

        stocks = []
        for e in entries:
            dt = timezone.make_aware(
                timezone.datetime(e['day'].year, e['day'].month, e['day'].day,
                                  e['hour'], e['minute'], 0)
            )
            s = Stock.objects.create(
                vendor=e['vendor'],
                fabric_type=e['fabric_type'],
                vendor_weight_slip=e['vendor_weight_slip'],
                vehicle_no=e['vehicle_no'],
                our_weight=Decimal(str(e['our_weight'])),
                unloading_weight=Decimal(str(e['unloading_weight'])),
                unit=e['unit'],
                status=e['status'],
                created_at=dt,
            )
            stocks.append(s)

        approved = [s for s in stocks if s.status == 'Approved']
        self.stdout.write(
            f'  Warehouse: {len(stocks)} stock entries '
            f'({len(approved)} approved, 1 received, 1 rejected)'
        )
        return stocks

    # ─────────────────────────────────────────────────────────────────────────
    # FABRIC STOCK — created from approved warehouse entries
    # ─────────────────────────────────────────────────────────────────────────
    def _seed_fabric_stock(self, yesterday, stocks):
        from sorting.models import FabricStock

        # Only approved stocks move forward to sorting.
        # stocks list order (from _seed_warehouse):
        #   [0] Cotton White Rags       — yesterday 08:15 — Approved  → fabric[0]
        #   [1] Polyester Mixed Cuts    — yesterday 09:40 — Approved  → fabric[1]
        #   [2] Cotton Denim Scraps     — yesterday 11:05 — Approved  → fabric[2]
        #   [3] Synthetic Blend Offcuts — yesterday 14:30 — Received  (skipped)
        #   [4] Cotton White Rags       — today     07:55 — Approved  → fabric[3]
        #   [5] Polyester Fine Cuts     — today     10:20 — Approved  → fabric[4]
        #   [6] Mixed Cotton (Dirty)    — today     12:10 — Rejected  (skipped)

        # (stock_index, material_type, initial_qty, sorted_qty, remaining_qty, status, day, hour)
        fabric_data = [
            (0, 'Cotton White Rags',    4780, 4200,  580, 'Sorted',       yesterday,  9),
            (1, 'Polyester Mixed Cuts', 3155, 2800,  355, 'In Sorting',   yesterday, 10),
            (2, 'Cotton Denim Scraps',  2545,    0, 2545, 'In Warehouse', yesterday, 12),
            (4, 'Cotton White Rags',    5040,  800, 4240, 'In Sorting',   yesterday,  8),
            (5, 'Polyester Fine Cuts',  2760,    0, 2760, 'In Warehouse', yesterday, 11),
        ]

        fabrics = []
        for stock_idx, mat, init, srtd, rem, status, day, hour in fabric_data:
            dt = timezone.make_aware(
                timezone.datetime(day.year, day.month, day.day, hour, 0, 0)
            )
            f = FabricStock.objects.create(
                stock=stocks[stock_idx],          # ← required ForeignKey — was missing
                material_type=mat,
                initial_quantity=Decimal(str(init)),
                sorted_quantity=Decimal(str(srtd)),
                remaining_quantity=Decimal(str(rem)),
                status=status,
                created_at=dt,
            )
            fabrics.append(f)

        self.stdout.write(f'  Fabric Stock: {len(fabrics)} batches created')
        return fabrics

    # ─────────────────────────────────────────────────────────────────────────
    # SORTING SESSIONS
    # ─────────────────────────────────────────────────────────────────────────
    def _seed_sorting(self, yesterday, today, fabrics, users, units):
        from sorting.models import SortingSession

        sort_user = users['sort_user']
        admin     = users['erp_admin']

        # Real flow: supervisor starts session, workers sort, session completed
        sessions_data = [
            # Day 1 — Cotton White session started and completed same day
            {
                'fabric_idx': 0,    # Cotton White Rags (4780 kg)
                'supervisor': sort_user,
                'unit': units[0].name,
                'quantity_taken':  4780,
                'quantity_sorted': 4200,
                'waste_quantity':  580,
                'status': 'Completed',
                'start': (yesterday, 9, 30),
                'end':   (yesterday, 16, 45),
                'notes': 'Full day session — cotton white batch sorted. 580kg waste removed (buttons, zips, non-fabric).'
            },
            # Day 1 — Polyester session started, still in progress
            {
                'fabric_idx': 1,    # Polyester Mixed Cuts (3155 kg)
                'supervisor': sort_user,
                'unit': units[1].name,
                'quantity_taken':  2800,
                'quantity_sorted': 1600,
                'waste_quantity':  120,
                'status': 'In Progress',
                'start': (yesterday, 13, 0),
                'end':   None,
                'notes': 'Afternoon shift started. 1200 kg still to be sorted (carried to Day 2).'
            },
            # Day 2 — New session on Day 2 cotton batch
            {
                'fabric_idx': 3,    # Second Cotton White (5040 kg)
                'supervisor': sort_user,
                'unit': units[0].name,
                'quantity_taken':  2000,
                'quantity_sorted': 800,
                'waste_quantity':  95,
                'status': 'In Progress',
                'start': (today, 8, 0),
                'end':   None,
                'notes': 'Day 2 morning session — first 2000 kg batch from todays arrival.'
            },
            # Day 2 — Completed small session (Polyester Fine Cuts partial)
            {
                'fabric_idx': 4,    # Polyester Fine Cuts (2760 kg)
                'supervisor': sort_user,
                'unit': units[1].name,
                'quantity_taken':  1200,
                'quantity_sorted': 1100,
                'waste_quantity':  100,
                'status': 'Completed',
                'start': (today, 10, 30),
                'end':   (today, 14, 0),
                'notes': 'Quick session — fine cuts, low waste. 100 kg non-recoverable synthetic.'
            },
        ]

        sessions = []
        for sd in sessions_data:
            f     = fabrics[sd['fabric_idx']]
            start = timezone.make_aware(
                timezone.datetime(*sd['start'][0].timetuple()[:3], sd['start'][1], sd['start'][2])
            )
            end = None
            if sd['end']:
                end = timezone.make_aware(
                    timezone.datetime(*sd['end'][0].timetuple()[:3], sd['end'][1], sd['end'][2])
                )

            sess = SortingSession.objects.create(
                fabric=f,
                supervisor=sd['supervisor'],
                unit=sd['unit'],
                quantity_taken=Decimal(str(sd['quantity_taken'])),
                quantity_sorted=Decimal(str(sd['quantity_sorted'])),
                waste_quantity=Decimal(str(sd['waste_quantity'])),
                status=sd['status'],
                start_date=start,
                end_date=end,
                notes=sd.get('notes', ''),
            )
            sessions.append(sess)

        completed = sum(1 for s in sessions if s.status == 'Completed')
        self.stdout.write(
            f'  Sorting Sessions: {len(sessions)} sessions '
            f'({completed} completed, {len(sessions)-completed} in progress)'
        )
        return sessions

    # ─────────────────────────────────────────────────────────────────────────
    # TANKS
    # ─────────────────────────────────────────────────────────────────────────
    def _ensure_tanks(self, users):
        from decolorization.models import Tank

        decolor_user = users['decolor_user']

        tank_data = [
            ('Tank A-01', 'BATCH-2026-0409-A1', 5000, 'Completed'),
            ('Tank A-02', 'BATCH-2026-0409-A2', 5000, 'Processing'),
            ('Tank B-01', 'BATCH-2026-0410-B1', 4000, 'Filled'),
            ('Tank B-02', 'BATCH-2026-0410-B2', 4000, 'Empty'),
        ]

        tanks = []
        for name, batch_id, capacity, status in tank_data:
            t, created = Tank.objects.get_or_create(
                batch_id=batch_id,
                defaults={
                    'name':         name,
                    'capacity':     Decimal(str(capacity)),
                    'tank_status':  status,
                    'fabric_quantity': Decimal('0'),
                    'supervisor':   decolor_user,
                }
            )
            tanks.append(t)

        self.stdout.write(f'  Tanks: {len(tanks)} ready')
        return tanks

    # ─────────────────────────────────────────────────────────────────────────
    # DECOLORIZATION SESSIONS + ISSUANCES
    # ─────────────────────────────────────────────────────────────────────────
    def _seed_decolorization(self, yesterday, today, fabrics, tanks, chemicals, users):
        from decolorization.models import DecolorizationSession, ChemicalIssuance, Tank

        decolor_user = users['decolor_user']

        # ── Day 1: Tank A-01 session — Cotton White was processed and completed
        t1 = tanks[0]  # Tank A-01 — Completed
        t1.fabric           = fabrics[0]  # Cotton White Rags
        t1.fabric_quantity  = Decimal('4200')
        t1.start_date       = timezone.make_aware(
            timezone.datetime(yesterday.year, yesterday.month, yesterday.day, 17, 0)
        )
        t1.actual_completion = timezone.make_aware(
            timezone.datetime(yesterday.year, yesterday.month, yesterday.day, 23, 30)
        )
        t1.notes = 'Cotton white batch processed. Full decolorization cycle completed in 6.5 hrs.'
        t1.save()

        s1_start = t1.start_date
        s1_end   = t1.actual_completion
        s1 = DecolorizationSession.objects.create(
            tank=t1,
            fabric=fabrics[0],
            supervisor=decolor_user,
            input_quantity=Decimal('4200'),
            output_quantity=Decimal('3900'),
            waste_quantity=Decimal('300'),
            status='Completed',
            start_date=s1_start,
            end_date=s1_end,
            notes='Successful batch. 300 kg waste (residual impurities + press loss). Output: 3900 kg clean fabric.'
        )

        # Chemical issuances for Tank A-01 session
        issuances_d1 = [
            (chemicals[0], 45, yesterday, 17, 10),  # Sodium Hypochlorite 45L
            (chemicals[2], 12, yesterday, 17, 15),  # Caustic Soda 12kg
            (chemicals[1], 20, yesterday, 18, 0),   # Hydrogen Peroxide 20L (second dose)
        ]
        for chem, qty, day, hour, minute in issuances_d1:
            dt = timezone.make_aware(
                timezone.datetime(day.year, day.month, day.day, hour, minute)
            )
            ChemicalIssuance.objects.create(
                chemical=chem,
                tank=t1,
                issued_by=decolor_user,
                quantity=Decimal(str(qty)),
                issued_at=dt,
                notes=f'Issued for Tank A-01 batch BATCH-2026-0409-A1',
            )
            chem.issued_quantity += Decimal(str(qty))
            chem.remaining_stock -= Decimal(str(qty))
            chem.save()

        # ── Day 1/2: Tank A-02 — Polyester batch, currently processing (overnight)
        t2 = tanks[1]  # Tank A-02 — Processing
        t2.fabric          = fabrics[1]  # Polyester Mixed Cuts
        t2.fabric_quantity = Decimal('2800')
        t2.start_date      = timezone.make_aware(
            timezone.datetime(yesterday.year, yesterday.month, yesterday.day, 22, 0)
        )
        t2.expected_completion = timezone.make_aware(
            timezone.datetime(today.year, today.month, today.day, 10, 0)
        )
        t2.notes = 'Overnight polyester cycle. Expected completion 10:00 today.'
        t2.save()

        s2 = DecolorizationSession.objects.create(
            tank=t2,
            fabric=fabrics[1],
            supervisor=decolor_user,
            input_quantity=Decimal('2800'),
            output_quantity=Decimal('0'),
            waste_quantity=Decimal('0'),
            status='In Progress',
            start_date=t2.start_date,
            end_date=None,
            notes='Overnight processing cycle. Output to be recorded on completion.'
        )

        issuances_d1_t2 = [
            (chemicals[0], 38, yesterday, 22, 10),  # Sodium Hypochlorite
            (chemicals[3], 15, yesterday, 22, 15),  # Acetic Acid
        ]
        for chem, qty, day, hour, minute in issuances_d1_t2:
            dt = timezone.make_aware(
                timezone.datetime(day.year, day.month, day.day, hour, minute)
            )
            ChemicalIssuance.objects.create(
                chemical=chem,
                tank=t2,
                issued_by=decolor_user,
                quantity=Decimal(str(qty)),
                issued_at=dt,
            )
            chem.issued_quantity += Decimal(str(qty))
            chem.remaining_stock -= Decimal(str(qty))
            chem.save()

        # ── Today: Tank B-01 — Filled, waiting to start
        t3 = tanks[2]  # Tank B-01 — Filled
        t3.fabric          = fabrics[3]  # Cotton White (second batch)
        t3.fabric_quantity = Decimal('3200')
        t3.notes           = 'Loaded this morning. Awaiting supervisor sign-off to start cycle.'
        t3.save()

        total_sessions = 2
        self.stdout.write(
            f'  Decolorization: {total_sessions} sessions '
            f'(1 completed, 1 in progress), Tank B-01 filled & ready'
        )

    # ─────────────────────────────────────────────────────────────────────────
    # SALES — Orders, Dispatch, Payments
    # ─────────────────────────────────────────────────────────────────────────
    def _seed_sales(self, yesterday, today, fabrics, users):
        from sales.models import SalesOrder, Payment, DispatchTracking

        admin = users['erp_admin']

        # ── Order 1 — Yesterday: confirmed and dispatched today
        o1_created = timezone.make_aware(
            timezone.datetime(yesterday.year, yesterday.month, yesterday.day, 11, 0)
        )
        o1 = SalesOrder.objects.create(
            buyer_name='Karachi Textiles Pvt Ltd',
            buyer_contact='021-35240000',
            buyer_address='SITE Area, Karachi',
            fabric=fabrics[0],
            fabric_quality='Grade A — Cotton White',
            weight_sold=Decimal('3900'),
            price_per_kg=Decimal('85'),
            total_price=Decimal('331500'),
            status='Dispatched',
            payment_status='Partial',
            created_by=admin,
            notes='Bulk order — Grade A cotton white. Payment partial on confirmation.',
            created_at=o1_created,
        )

        # Dispatch for Order 1 — happens today morning
        d1_date = timezone.make_aware(
            timezone.datetime(today.year, today.month, today.day, 9, 15)
        )
        DispatchTracking.objects.create(
            sales_order=o1,
            vehicle_number='LHR-9920',
            driver_name='Imran Hussain',
            driver_contact='0300-1234567',
            dispatched_weight=Decimal('3900'),
            dispatch_status='Dispatched',
            dispatched_by=admin,
            dispatch_date=d1_date,
            notes='Full order loaded. ETA Karachi 2 days.',
        )

        # Partial payment received yesterday
        Payment.objects.create(
            sales_order=o1,
            amount=Decimal('150000'),
            payment_method='Bank Transfer',
            reference_number='MCB-TT-2026-84291',
            received_by=admin,
            payment_date=timezone.make_aware(
                timezone.datetime(yesterday.year, yesterday.month, yesterday.day, 15, 30)
            ),
            notes='Advance payment 45% on order confirmation.',
        )

        # ── Order 2 — Yesterday: confirmed, not yet dispatched
        o2_created = timezone.make_aware(
            timezone.datetime(yesterday.year, yesterday.month, yesterday.day, 14, 0)
        )
        o2 = SalesOrder.objects.create(
            buyer_name='Faisalabad Cotton Mills',
            buyer_contact='041-8812345',
            buyer_address='Jaranwala Road, Faisalabad',
            fabric=fabrics[1],
            fabric_quality='Grade B — Polyester Mixed',
            weight_sold=Decimal('2600'),
            price_per_kg=Decimal('62'),
            total_price=Decimal('161200'),
            status='Confirmed',
            payment_status='Pending',
            created_by=admin,
            notes='Standard order. Full payment expected before dispatch.',
            created_at=o2_created,
        )

        # ── Order 3 — Today: draft order, just raised
        o3_created = timezone.make_aware(
            timezone.datetime(today.year, today.month, today.day, 10, 45)
        )
        o3 = SalesOrder.objects.create(
            buyer_name='Islamabad Garments Ltd',
            buyer_contact='051-4434400',
            buyer_address='I-9 Industrial Area, Islamabad',
            fabric=fabrics[3],
            fabric_quality='Grade A — Cotton White (Day 2 batch)',
            weight_sold=Decimal('4500'),
            price_per_kg=Decimal('88'),
            total_price=Decimal('396000'),
            status='Draft',
            payment_status='Pending',
            created_by=admin,
            notes='New inquiry converted to draft. Awaiting stock quality confirmation.',
            created_at=o3_created,
        )

        # ── Order 4 — Yesterday: completed, fully paid
        o4_created = timezone.make_aware(
            timezone.datetime(yesterday.year, yesterday.month, yesterday.day, 9, 0)
        )
        o4 = SalesOrder.objects.create(
            buyer_name='Gujranwala Thread House',
            buyer_contact='055-3821000',
            buyer_address='Industrial Zone, Gujranwala',
            fabric=fabrics[4],
            fabric_quality='Grade B — Polyester Fine',
            weight_sold=Decimal('1100'),
            price_per_kg=Decimal('70'),
            total_price=Decimal('77000'),
            status='Completed',
            payment_status='Paid',
            created_by=admin,
            notes='Small order fulfilled same day.',
            created_at=o4_created,
        )

        # Dispatch for Order 4 — yesterday
        DispatchTracking.objects.create(
            sales_order=o4,
            vehicle_number='LHR-5512',
            driver_name='Shahid Iqbal',
            driver_contact='0311-9876543',
            dispatched_weight=Decimal('1100'),
            dispatch_status='Delivered',
            dispatched_by=admin,
            dispatch_date=timezone.make_aware(
                timezone.datetime(yesterday.year, yesterday.month, yesterday.day, 16, 0)
            ),
            notes='Small local delivery, delivered same day.',
        )

        # Full payment for Order 4 — yesterday
        Payment.objects.create(
            sales_order=o4,
            amount=Decimal('77000'),
            payment_method='Cash',
            reference_number='',
            received_by=admin,
            payment_date=timezone.make_aware(
                timezone.datetime(yesterday.year, yesterday.month, yesterday.day, 10, 0)
            ),
            notes='Full cash payment received before dispatch.',
        )

        # Today — remaining payment on Order 1
        Payment.objects.create(
            sales_order=o1,
            amount=Decimal('100000'),
            payment_method='Cheque',
            reference_number='HBL-CHQ-2026-448821',
            received_by=admin,
            payment_date=timezone.make_aware(
                timezone.datetime(today.year, today.month, today.day, 11, 30)
            ),
            notes='Second installment received before truck departure.',
        )

        # Update Order 1 payment status to Partial (81500 still pending)
        o1.payment_status = 'Partial'
        o1.save()

        self.stdout.write(
            f'  Sales: 4 orders (1 completed+paid, 1 dispatched+partial, '
            f'1 confirmed, 1 draft), 3 dispatches, 3 payments'
        )
