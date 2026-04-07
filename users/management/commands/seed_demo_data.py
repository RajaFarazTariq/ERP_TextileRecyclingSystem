"""
seed_demo_data.py
─────────────────────────────────────────────────────────────────────────────
Place this file at:
  users/management/commands/seed_demo_data.py

Run with:
  python manage.py seed_demo_data          ← fresh seed (wipes all data first)
  python manage.py seed_demo_data --keep   ← only add missing records

Data spans April 2024 to today (2 full years).
Every month has data so all reporting pages work correctly.

ALL numeric operations use Decimal to avoid TypeError with Django DecimalField.
─────────────────────────────────────────────────────────────────────────────
"""

from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import datetime, timedelta
from decimal import Decimal
import random
import calendar

from users.models import CustomUser
from warehouse.models import Vendor, FactoryUnit, Stock
from sorting.models import FabricStock, SortingSession
from decolorization.models import ChemicalStock, Tank, ChemicalIssuance, DecolorizationSession
from sales.models import SalesOrder, DispatchTracking, Payment


# ─── Type-safe Decimal helpers ────────────────────────────────────────────────

def d(value):
    """Convert any number to Decimal safely."""
    return Decimal(str(value))


def rand_decimal(lo, hi):
    """Return a random Decimal between lo and hi."""
    return d(round(random.uniform(lo, hi), 2))


def pct(decimal_value, lo_pct, hi_pct):
    """
    Multiply decimal_value by a random percentage in [lo_pct, hi_pct].
    Always returns Decimal. Safe for all Django DecimalField operations.
    """
    factor = rand_decimal(lo_pct / 100, hi_pct / 100)
    return (decimal_value * factor).quantize(d('0.01'))


# ─── Date helpers ─────────────────────────────────────────────────────────────

NOW = timezone.now()


def dt_for_month(year, month):
    """
    Return a timezone-aware datetime for a random day/time in the given year/month.
    If the month is the current month, cap the day at today.
    """
    _, last_day = calendar.monthrange(year, month)

    # For current month don't pick a future date
    if year == NOW.year and month == NOW.month:
        last_day = NOW.day

    chosen_day  = random.randint(1, last_day)
    chosen_hour = random.randint(7, 18)
    chosen_min  = random.randint(0, 59)
    naive = datetime(year, month, chosen_day, chosen_hour, chosen_min)
    return timezone.make_aware(naive)


def months_back(n):
    """
    Return a list of (year, month) tuples going back n months from today.
    Index 0 = current month, index n-1 = oldest.
    """
    result = []
    y, m = NOW.year, NOW.month
    for _ in range(n):
        result.append((y, m))
        m -= 1
        if m == 0:
            m = 12
            y -= 1
    return result


# ─────────────────────────────────────────────────────────────────────────────
# Management command
# ─────────────────────────────────────────────────────────────────────────────

class Command(BaseCommand):
    help = 'Seed 2 years of historical demo data (Apr 2024 to today).'

    def add_arguments(self, parser):
        parser.add_argument(
            '--keep', action='store_true',
            help='Skip deletion — only add missing records'
        )

    def handle(self, *args, **options):
        keep = options.get('keep', False)

        self.stdout.write(self.style.WARNING(
            '\n🌱 Seeding 2-year historical demo data...' +
            (' (--keep mode)' if keep else ' (wiping existing data first)')
        ))

        # ── STEP 0: Wipe ──────────────────────────────────────────────────────
        if not keep:
            self.stdout.write('Clearing existing data...')
            Payment.objects.all().delete()
            DispatchTracking.objects.all().delete()
            SalesOrder.objects.all().delete()
            DecolorizationSession.objects.all().delete()
            ChemicalIssuance.objects.all().delete()
            Tank.objects.all().delete()
            ChemicalStock.objects.all().delete()
            SortingSession.objects.all().delete()
            FabricStock.objects.all().delete()
            Stock.objects.all().delete()
            FactoryUnit.objects.all().delete()
            Vendor.objects.all().delete()
            CustomUser.objects.filter(username__in=[
                'warehouse_user', 'sorting_user', 'decolor_user', 'drying_user'
            ]).delete()
            self.stdout.write('  ✓ All old data cleared')

        # ══════════════════════════════════════════════════════════════════════
        # 1. USERS
        # ══════════════════════════════════════════════════════════════════════
        self.stdout.write('\nCreating users...')
        users_map = {}
        for username, email, password, role in [
            ('warehouse_user', 'warehouse@erp.com', 'Demo@1234', 'warehouse_supervisor'),
            ('sorting_user',   'sorting@erp.com',   'Demo@1234', 'sorting_supervisor'),
            ('decolor_user',   'decolor@erp.com',   'Demo@1234', 'decolorization_supervisor'),
            ('drying_user',    'drying@erp.com',     'Demo@1234', 'drying_supervisor'),
        ]:
            user, created = CustomUser.objects.get_or_create(
                username=username,
                defaults={'email': email, 'role': role, 'is_active': True}
            )
            if created:
                user.set_password(password)
                user.save()
            elif not user.is_active:
                user.is_active = True
                user.save()
            users_map[role] = user
            self.stdout.write(f'  ✓ {username} ({role})')

        admin = CustomUser.objects.filter(role='admin').first()
        if not admin:
            admin = CustomUser.objects.create_superuser(
                'admin', 'admin@erp.com', 'Admin@1234'
            )
            self.stdout.write('  ✓ admin (created)')
        else:
            self.stdout.write(f'  ✓ admin ({admin.username}) — existing')

        # ══════════════════════════════════════════════════════════════════════
        # 2. WAREHOUSE — 15 vendors, 5 units, 300 stock entries over 24 months
        # ══════════════════════════════════════════════════════════════════════
        self.stdout.write('\nCreating warehouse data...')

        vendor_data = [
            ('Ali Traders',          '03001234567', 'Karachi, Pakistan'),
            ('Hassan Textiles',      '03111234567', 'Lahore, Pakistan'),
            ('Raza Fabrics',         '03211234567', 'Faisalabad, Pakistan'),
            ('Malik Enterprises',    '03331234567', 'Multan, Pakistan'),
            ('Khan & Sons',          '03451234567', 'Rawalpindi, Pakistan'),
            ('Punjab Textile Mills', '03001112233', 'Lahore, Pakistan'),
            ('Sindh Fabrics Co.',    '03111223344', 'Hyderabad, Pakistan'),
            ('Baloch Weave House',   '03221334455', 'Quetta, Pakistan'),
            ('Frontier Cloth Mart',  '03331445566', 'Peshawar, Pakistan'),
            ('Capital Yarn Works',   '03441556677', 'Islamabad, Pakistan'),
            ('Crescent Textiles',    '03001667788', 'Sialkot, Pakistan'),
            ('Star Fabric Depot',    '03111778899', 'Gujranwala, Pakistan'),
            ('Green Cloth House',    '03221889900', 'Bahawalpur, Pakistan'),
            ('Golden Fiber Co.',     '03331990011', 'Sargodha, Pakistan'),
            ('National Yarn Depot',  '03441001122', 'Sheikhupura, Pakistan'),
        ]
        vendors = []
        for name, contact, address in vendor_data:
            v, _ = Vendor.objects.get_or_create(
                name=name, defaults={'contact': contact, 'address': address}
            )
            vendors.append(v)

        unit_names = ['Unit 1', 'Unit 2', 'Unit 3', 'Unit 4', 'Unit 5']
        units = []
        for name in unit_names:
            u, _ = FactoryUnit.objects.get_or_create(name=name)
            units.append(u)

        fabric_types = [
            'Cotton White', 'Cotton Colored', 'Cotton Dark',
            'Polyester Mixed', 'Polyester White', 'Polyester Dark',
            'Synthetic Blend', 'Denim Fabric', 'Linen Mix',
            'Silk Blend', 'Wool Mix', 'Acrylic Fiber',
            'Nylon Fabric', 'Rayon Mix', 'Viscose Blend',
        ]
        stock_statuses = ['Approved', 'Approved', 'Approved', 'Received', 'Pending']
        city_codes     = ['LHR', 'KHI', 'FSD', 'MLT', 'RWP', 'ISB', 'PSH', 'QTA']

        # 24 months of history
        month_list = months_back(24)

        stocks = []
        for i in range(300):
            slip_no  = f'WS-{i+1:04d}'
            our_w    = d(random.randint(1500, 8000))
            unload_w = our_w - d(random.randint(5, 50))

            # Spread evenly across 24 months
            year, month = month_list[i % len(month_list)]
            received_at = dt_for_month(year, month)

            s, _ = Stock.objects.get_or_create(
                vendor_weight_slip=slip_no,
                defaults={
                    'vendor':           vendors[i % len(vendors)],
                    'fabric_type':      fabric_types[i % len(fabric_types)],
                    'vehicle_no':       f'{random.choice(city_codes)}-{random.randint(1000,9999)}',
                    'our_weight':       our_w,
                    'unloading_weight': unload_w,
                    'unit':             units[i % len(units)],
                    'status':           stock_statuses[i % len(stock_statuses)],
                }
            )
            # Backdate auto_now_add field via update()
            Stock.objects.filter(pk=s.pk).update(created_at=received_at)
            stocks.append(s)

        self.stdout.write(f'  ✓ {len(stocks)} stock entries spread over 24 months')
        self.stdout.write(f'  ✓ {len(vendors)} vendors | {len(units)} factory units')

        # ══════════════════════════════════════════════════════════════════════
        # 3. SORTING — 200 fabric stocks + sessions across 2 years
        # ══════════════════════════════════════════════════════════════════════
        self.stdout.write('\nCreating sorting data...')

        sort_sup      = users_map.get('sorting_supervisor', admin)
        qual_suffixes = ['Grade A', 'Grade B', 'Grade C', 'Premium', 'Standard']
        sort_statuses = ['Sorted', 'Sorted', 'Sorted', 'In Sorting', 'In Warehouse']

        fabrics = []
        for i, stock in enumerate(stocks[:200]):
            mat_type = f'{stock.fabric_type} {qual_suffixes[i % len(qual_suffixes)]}'
            status   = sort_statuses[i % len(sort_statuses)]
            init_q   = stock.unloading_weight   # already Decimal

            if status == 'In Warehouse':
                sorted_q  = d(0)
                remaining = init_q
            elif status == 'In Sorting':
                sorted_q  = pct(init_q, 40, 60)
                remaining = init_q - sorted_q
            else:   # Sorted
                sorted_q  = pct(init_q, 88, 97)
                remaining = init_q - sorted_q

            f, _ = FabricStock.objects.get_or_create(
                material_type=mat_type,
                defaults={
                    'stock':              stock,
                    'initial_quantity':   init_q,
                    'sorted_quantity':    sorted_q,
                    'remaining_quantity': remaining,
                    'status':             status,
                }
            )
            fabrics.append(f)

        self.stdout.write(f'  ✓ {len(fabrics)} fabric stocks')

        sess_statuses = ['Completed', 'Completed', 'Completed', 'In Progress', 'On Hold']
        session_count = 0
        for i, fabric in enumerate(fabrics):
            if fabric.status == 'In Warehouse':
                continue

            sess_status = sess_statuses[i % len(sess_statuses)]
            qty_taken   = fabric.initial_quantity
            qty_sorted  = fabric.sorted_quantity if sess_status in ('Completed', 'In Progress') else d(0)
            waste       = qty_taken - qty_sorted  if sess_status == 'Completed' else d(0)

            year, month = month_list[i % len(month_list)]
            sess_start  = dt_for_month(year, month)
            sess_end    = sess_start + timedelta(days=random.randint(2, 7)) \
                          if sess_status == 'Completed' else None

            unit_name = units[i % len(units)].name
            _, created = SortingSession.objects.get_or_create(
                fabric=fabric,
                unit=unit_name,
                defaults={
                    'supervisor':      sort_sup,
                    'quantity_taken':  qty_taken,
                    'quantity_sorted': qty_sorted,
                    'waste_quantity':  waste,
                    'status':          sess_status,
                    'end_date':        sess_end,
                }
            )
            if created:
                SortingSession.objects.filter(fabric=fabric, unit=unit_name).update(
                    start_date=sess_start
                )
                session_count += 1

        self.stdout.write(f'  ✓ {session_count} sorting sessions')

        # ══════════════════════════════════════════════════════════════════════
        # 4. DECOLORIZATION — 6 chemicals, 120 tanks across 2 years
        # ══════════════════════════════════════════════════════════════════════
        self.stdout.write('\nCreating decolorization data...')

        chemical_data = [
            ('Sodium Hypochlorite', 10000, 7800, 2200, 'Liters'),
            ('Hydrogen Peroxide',    8000, 6100, 1900, 'Liters'),
            ('Acetic Acid',          6000, 4500, 1500, 'Liters'),
            ('Sodium Carbonate',     7000, 5200, 1800, 'Kg'),
            ('Optical Brightener',   4000, 3000, 1000, 'Kg'),
            ('Caustic Soda',         9000, 6800, 2200, 'Kg'),
        ]
        chemicals = []
        for name, total, issued, remaining, uom in chemical_data:
            c, _ = ChemicalStock.objects.get_or_create(
                chemical_name=name,
                defaults={
                    'total_stock':     d(total),
                    'issued_quantity': d(issued),
                    'remaining_stock': d(remaining),
                    'unit_of_measure': uom,
                }
            )
            chemicals.append(c)

        self.stdout.write(f'  ✓ {len(chemicals)} chemicals')

        decolor_sup   = users_map.get('decolorization_supervisor', admin)
        tank_names    = ['Tank A', 'Tank B', 'Tank C', 'Tank D', 'Tank E', 'Tank F']
        tank_statuses = ['Completed', 'Completed', 'Completed', 'Processing', 'Empty']

        sorted_fabrics = [f for f in fabrics if f.status == 'Sorted']

        tanks           = []
        issuance_count  = 0
        d_session_count = 0

        for i in range(min(120, len(sorted_fabrics))):
            batch_id   = f'BATCH-{i+1:04d}'
            fabric     = sorted_fabrics[i % len(sorted_fabrics)]
            t_status   = tank_statuses[i % len(tank_statuses)]
            fabric_qty = fabric.sorted_quantity if t_status != 'Empty' else d(0)

            year, month  = month_list[i % len(month_list)]
            tank_start   = dt_for_month(year, month)
            tank_exp     = tank_start + timedelta(days=7)
            tank_actual  = tank_start + timedelta(days=random.randint(5, 9)) \
                           if t_status == 'Completed' else None

            tank, t_created = Tank.objects.get_or_create(
                batch_id=batch_id,
                defaults={
                    'name':                tank_names[i % len(tank_names)],
                    'capacity':            d(5000),
                    'fabric':              fabric,
                    'fabric_quantity':     fabric_qty,
                    'tank_status':         t_status,
                    'supervisor':          decolor_sup,
                    'start_date':          tank_start,
                    'expected_completion': tank_exp,
                    'actual_completion':   tank_actual,
                }
            )
            tanks.append(tank)

            if not t_created:
                continue

            # Chemical issuances 2-3 per tank
            for chem in random.sample(chemicals, random.randint(2, 3)):
                ChemicalIssuance.objects.create(
                    chemical=chem,
                    tank=tank,
                    issued_by=decolor_sup,
                    quantity=d(random.randint(50, 300)),
                )
                issuance_count += 1

            # One decolorization session per tank
            d_stat_opts = ['Completed', 'Completed', 'In Progress', 'On Hold']
            d_stat    = d_stat_opts[i % len(d_stat_opts)]
            input_q   = fabric_qty

            if d_stat == 'Completed':
                output_q = pct(input_q, 91, 97)
                waste_q  = input_q - output_q
                sess_end = tank_actual or tank_start + timedelta(days=6)
            else:
                output_q = d(0)
                waste_q  = d(0)
                sess_end = None

            DecolorizationSession.objects.create(
                tank=tank,
                fabric=fabric,
                supervisor=decolor_sup,
                input_quantity=input_q,
                output_quantity=output_q,
                waste_quantity=waste_q,
                status=d_stat,
                end_date=sess_end,
            )
            # Backdate start_date on the session
            DecolorizationSession.objects.filter(
                tank=tank, fabric=fabric
            ).update(start_date=tank_start)
            d_session_count += 1

        self.stdout.write(f'  ✓ {len(tanks)} tanks')
        self.stdout.write(f'  ✓ {issuance_count} chemical issuances')
        self.stdout.write(f'  ✓ {d_session_count} decolorization sessions')

        # ══════════════════════════════════════════════════════════════════════
        # 5. SALES — 15 orders per month × 24 months = 360 orders
        #    Every month from Apr 2024 → today guaranteed to have data
        # ══════════════════════════════════════════════════════════════════════
        self.stdout.write('\nCreating sales data...')

        buyers = [
            ('Karachi Textiles Ltd',   '03001112222'),
            ('Lahore Garments Co',     '03111112222'),
            ('Faisalabad Mills',       '03211112222'),
            ('Multan Fabrics House',   '03331112222'),
            ('Rawalpindi Traders',     '03451112222'),
            ('Islamabad Exports',      '03211113333'),
            ('Sialkot Textiles',       '03001113333'),
            ('Peshawar Garments',      '03451113333'),
            ('Quetta Cloth House',     '03001114444'),
            ('Hyderabad Fabric Mart',  '03111114444'),
            ('Gujranwala Weave Co',    '03221114444'),
            ('Sargodha Cotton Mills',  '03331114444'),
            ('Bahawalpur Silk Works',  '03441114444'),
            ('Sheikhupura Yarn Depot', '03001115555'),
            ('Chiniot Textile Hub',    '03111115555'),
            ('Jhang Fabric Traders',   '03221115555'),
            ('Rahim Yar Khan Mills',   '03331115555'),
            ('Sukkur Cloth Exporters', '03441115555'),
            ('Larkana Textile Mart',   '03001116666'),
            ('Nawabshah Fabric House', '03111116666'),
        ]

        quality_grades = ['Grade A', 'Grade B', 'Grade C', 'Premium', 'Standard']
        price_ranges   = {
            'Grade A':  (85,  110),
            'Grade B':  (65,   84),
            'Grade C':  (45,   64),
            'Premium':  (115, 150),
            'Standard': (55,   80),
        }

        processed_fabrics = [f for f in fabrics if f.status == 'Sorted']
        if not processed_fabrics:
            processed_fabrics = fabrics   # fallback

        drivers = [
            ('Muhammad Ali',  '03001234567'), ('Ahmad Khan',   '03111234567'),
            ('Hassan Raza',   '03221234567'), ('Bilal Ahmed',  '03331234567'),
            ('Usman Tariq',   '03441234567'), ('Farhan Malik', '03001345678'),
            ('Imran Hussain', '03111345678'), ('Zubair Iqbal', '03221345678'),
            ('Waseem Baig',   '03331345678'), ('Adnan Cheema', '03441345678'),
        ]
        dispatch_statuses = ['Delivered', 'Delivered', 'Dispatched', 'Pending']
        payment_methods   = ['Bank Transfer', 'Cash', 'Cheque', 'Online Transfer']

        order_count    = 0
        dispatch_count = 0
        payment_count  = 0
        order_idx      = 0

        # Go through every month from oldest to newest
        for year, month in reversed(month_list):
            is_current_month = (year == NOW.year and month == NOW.month)
            is_recent        = (NOW.year - year) * 12 + (NOW.month - month) <= 2

            for j in range(15):   # 15 orders per month
                i = order_idx
                order_idx += 1

                buyer_name, buyer_contact = buyers[i % len(buyers)]
                fabric  = processed_fabrics[i % len(processed_fabrics)]
                quality = quality_grades[i % len(quality_grades)]
                lo, hi  = price_ranges[quality]

                weight = d(random.randint(800, 4000))
                price  = d(random.randint(lo, hi))
                total  = weight * price

                # Status logic:
                # Current month → mostly Confirmed/Draft (business in progress)
                # Recent 2 months → mostly Completed with some Dispatched
                # Older months → fully closed out (Completed or Cancelled)
                if is_current_month:
                    status = random.choice(['Confirmed', 'Confirmed', 'Draft', 'Dispatched'])
                    pay_st = random.choice(['Pending', 'Pending', 'Partial'])
                elif is_recent:
                    status = random.choice(['Completed', 'Completed', 'Dispatched', 'Confirmed'])
                    pay_st = random.choice(['Paid', 'Paid', 'Partial'])
                else:
                    # Older data — realistic mix of outcomes
                    status_pool = ['Completed', 'Completed', 'Completed',
                                   'Confirmed', 'Dispatched', 'Cancelled']
                    pay_pool    = ['Paid', 'Paid', 'Paid', 'Partial', 'Pending']
                    status = random.choice(status_pool)
                    pay_st = random.choice(pay_pool)

                order_date = dt_for_month(year, month)
                unique_buyer = f'{buyer_name} #{i+1}'

                order, o_created = SalesOrder.objects.get_or_create(
                    buyer_name=unique_buyer,
                    defaults={
                        'buyer_contact':  buyer_contact,
                        'fabric':         fabric,
                        'fabric_quality': quality,
                        'weight_sold':    weight,
                        'price_per_kg':   price,
                        'total_price':    total,
                        'status':         status,
                        'payment_status': pay_st,
                        'created_by':     admin,
                    }
                )
                # Backdate both created_at and updated_at
                SalesOrder.objects.filter(pk=order.pk).update(
                    created_at=order_date,
                    updated_at=order_date,
                )
                if o_created:
                    order_count += 1

                # ── Dispatch ──────────────────────────────────────────────────
                if status in ('Completed', 'Dispatched', 'Confirmed'):
                    if not DispatchTracking.objects.filter(sales_order=order).exists():
                        d_status = dispatch_statuses[i % len(dispatch_statuses)]
                        # Older completed orders should be Delivered
                        if not is_current_month and status == 'Completed':
                            d_status = 'Delivered'

                        dispatch_date = order_date + timedelta(days=random.randint(1, 5))
                        delivery_date = dispatch_date + timedelta(days=random.randint(1, 7)) \
                                        if d_status == 'Delivered' else None

                        disp = DispatchTracking.objects.create(
                            sales_order=order,
                            vehicle_number=f'{random.choice(city_codes)}-{random.randint(1000,9999)}',
                            driver_name=drivers[i % len(drivers)][0],
                            driver_contact=drivers[i % len(drivers)][1],
                            dispatched_weight=pct(weight, 85, 100),
                            dispatch_status=d_status,
                            dispatched_by=admin,
                            delivery_date=delivery_date,
                        )
                        # Backdate dispatch_date
                        DispatchTracking.objects.filter(pk=disp.pk).update(
                            dispatch_date=dispatch_date
                        )
                        dispatch_count += 1

                # ── Payment ───────────────────────────────────────────────────
                if pay_st in ('Paid', 'Partial'):
                    if not Payment.objects.filter(sales_order=order).exists():
                        amount   = total if pay_st == 'Paid' else pct(total, 30, 65)
                        method   = payment_methods[i % len(payment_methods)]
                        ref      = f'TXN-{i+1:05d}' if method in ('Bank Transfer', 'Online Transfer') else None
                        pay_date = order_date + timedelta(days=random.randint(1, 10))

                        pmt = Payment.objects.create(
                            sales_order=order,
                            amount=amount,
                            payment_method=method,
                            reference_number=ref,
                            received_by=admin,
                        )
                        # Backdate payment_date
                        Payment.objects.filter(pk=pmt.pk).update(payment_date=pay_date)
                        payment_count += 1

        self.stdout.write(f'  ✓ {order_count} sales orders (15/month × 24 months)')
        self.stdout.write(f'  ✓ {dispatch_count} dispatch records')
        self.stdout.write(f'  ✓ {payment_count} payments')

        # ══════════════════════════════════════════════════════════════════════
        # SUMMARY
        # ══════════════════════════════════════════════════════════════════════
        self.stdout.write(self.style.SUCCESS('\n✅ Demo data seeded successfully!\n'))
        self.stdout.write('─' * 65)
        self.stdout.write(f'  Date Range:               Apr 2024 → {NOW.strftime("%b %Y")}')
        self.stdout.write(f'  Vendors:                  {Vendor.objects.count()}')
        self.stdout.write(f'  Factory Units:            {FactoryUnit.objects.count()}')
        self.stdout.write(f'  Stock Entries:            {Stock.objects.count()}')
        self.stdout.write(f'  Fabric Stocks:            {FabricStock.objects.count()}')
        self.stdout.write(f'  Sorting Sessions:         {SortingSession.objects.count()}')
        self.stdout.write(f'  Chemicals:                {ChemicalStock.objects.count()}')
        self.stdout.write(f'  Tanks:                    {Tank.objects.count()}')
        self.stdout.write(f'  Chemical Issuances:       {ChemicalIssuance.objects.count()}')
        self.stdout.write(f'  Decolorization Sessions:  {DecolorizationSession.objects.count()}')
        self.stdout.write(f'  Sales Orders:             {SalesOrder.objects.count()}')
        self.stdout.write(f'  Dispatches:               {DispatchTracking.objects.count()}')
        self.stdout.write(f'  Payments:                 {Payment.objects.count()}')
        self.stdout.write('─' * 65)

        # Monthly order distribution bar chart
        self.stdout.write('\nMonthly sales order distribution (last 12 months):')
        self.stdout.write('─' * 65)
        for year, month in sorted(month_list[:12], reverse=True):
            count = SalesOrder.objects.filter(
                created_at__year=year,
                created_at__month=month
            ).count()
            bar = '█' * min(count, 20)
            self.stdout.write(
                f'  {calendar.month_abbr[month]:3} {year}:  {bar} {count} orders'
            )

        self.stdout.write('\nDemo Credentials:')
        self.stdout.write('─' * 65)
        self.stdout.write('  Admin:           admin          / Admin@1234')
        self.stdout.write('  Warehouse:       warehouse_user / Demo@1234')
        self.stdout.write('  Sorting:         sorting_user   / Demo@1234')
        self.stdout.write('  Decolorization:  decolor_user   / Demo@1234')
        self.stdout.write('  Drying:          drying_user    / Demo@1234')
        self.stdout.write('─' * 65)
