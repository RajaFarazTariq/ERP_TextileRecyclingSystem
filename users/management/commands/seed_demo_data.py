"""
seed_demo_data.py
─────────────────────────────────────────────────────────────────────────────
Place this file at:
  users/management/commands/seed_demo_data.py

Run with:
  python manage.py seed_demo_data          ← fresh seed (deletes old demo data first)
  python manage.py seed_demo_data --keep   ← skip deletion, only add missing records

ALL numeric operations use Decimal to avoid TypeError with Django DecimalField.
─────────────────────────────────────────────────────────────────────────────
"""

from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import timedelta
from decimal import Decimal
import random

from users.models import CustomUser
from warehouse.models import Vendor, FactoryUnit, Stock
from sorting.models import FabricStock, SortingSession
from decolorization.models import ChemicalStock, Tank, ChemicalIssuance, DecolorizationSession
from sales.models import SalesOrder, DispatchTracking, Payment


# ── Helper: safe Decimal multiply (works with int, float, Decimal) ──────────
def d(value):
    """Convert any number to Decimal safely."""
    return Decimal(str(value))


def rand_decimal(lo, hi):
    """Return a random Decimal between lo and hi (2 decimal places)."""
    return d(round(random.uniform(lo, hi), 2))


# ── Helper: Decimal-safe percentage of a Decimal value ──────────────────────
def pct(decimal_value, lo_pct, hi_pct):
    """
    Return decimal_value * random percentage between lo_pct and hi_pct.
    Result is rounded to 2 decimal places.
    E.g. pct(Decimal('5000'), 88, 97) → Decimal('4650.00')
    """
    factor = rand_decimal(lo_pct / 100, hi_pct / 100)
    return (decimal_value * factor).quantize(d('0.01'))


class Command(BaseCommand):
    help = 'Seeds the database with demo data. Use --keep to skip deletion.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--keep', action='store_true',
            help='Skip deletion of existing demo data (only add missing records)'
        )

    def handle(self, *args, **options):
        keep = options.get('keep', False)

        self.stdout.write(self.style.WARNING(
            '\n🌱 Seeding demo data...' +
            (' (--keep: skipping deletion)' if keep else ' (deleting old demo data first)')
        ))

        # ── STEP 0: Delete old demo data (unless --keep) ─────────────────────
        if not keep:
            self.stdout.write('Clearing old demo data...')
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
            # Delete demo users but keep admin
            CustomUser.objects.filter(username__in=[
                'warehouse_user', 'sorting_user', 'decolor_user', 'drying_user'
            ]).delete()
            self.stdout.write('  ✓ Old data cleared')

        # ═════════════════════════════════════════════════════════════════════
        # 1. USERS
        # ═════════════════════════════════════════════════════════════════════
        self.stdout.write('\nCreating users...')

        users_map = {}
        user_data = [
            ('warehouse_user', 'warehouse@erp.com', 'Demo@1234', 'warehouse_supervisor'),
            ('sorting_user',   'sorting@erp.com',   'Demo@1234', 'sorting_supervisor'),
            ('decolor_user',   'decolor@erp.com',   'Demo@1234', 'decolorization_supervisor'),
            ('drying_user',    'drying@erp.com',     'Demo@1234', 'drying_supervisor'),
        ]
        for username, email, password, role in user_data:
            user, created = CustomUser.objects.get_or_create(
                username=username,
                defaults={'email': email, 'role': role, 'is_active': True}
            )
            if created:
                user.set_password(password)
                user.save()
            elif not user.is_active:
                # Fix inactive users
                user.is_active = True
                user.save()
            users_map[role] = user
            self.stdout.write(f'  ✓ {username} ({role})')

        admin = CustomUser.objects.filter(role='admin').first()
        if not admin:
            admin = CustomUser.objects.create_superuser(
                'admin', 'admin@erp.com', 'Admin@1234'
            )
            self.stdout.write('  ✓ admin created')
        else:
            self.stdout.write(f'  ✓ admin ({admin.username}) — existing')

        # ═════════════════════════════════════════════════════════════════════
        # 2. WAREHOUSE — 15 vendors, 5 units, 120 stock entries
        # ═════════════════════════════════════════════════════════════════════
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
                name=name,
                defaults={'contact': contact, 'address': address}
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
        city_codes = ['LHR', 'KHI', 'FSD', 'MLT', 'RWP', 'ISB', 'PSH', 'QTA']

        stocks = []
        for i in range(120):
            slip_no  = f'WS-{i+1:04d}'
            our_w    = d(random.randint(1500, 8000))
            unload_w = our_w - d(random.randint(5, 50))

            s, _ = Stock.objects.get_or_create(
                vendor_weight_slip=slip_no,
                defaults={
                    'vendor':               vendors[i % len(vendors)],
                    'fabric_type':          fabric_types[i % len(fabric_types)],
                    'vehicle_no':           f'{random.choice(city_codes)}-{random.randint(1000,9999)}',
                    'our_weight':           our_w,
                    'unloading_weight':     unload_w,
                    'unit':                 units[i % len(units)],
                    'status':               stock_statuses[i % len(stock_statuses)],
                }
            )
            stocks.append(s)

        self.stdout.write(f'  ✓ {len(stocks)} stock entries')
        self.stdout.write(f'  ✓ {len(vendors)} vendors')
        self.stdout.write(f'  ✓ {len(units)} factory units')

        # ═════════════════════════════════════════════════════════════════════
        # 3. SORTING — 80 fabric stocks, sorting sessions
        # ═════════════════════════════════════════════════════════════════════
        self.stdout.write('\nCreating sorting data...')

        sort_sup = users_map.get('sorting_supervisor', admin)
        quality_suffixes = ['Grade A', 'Grade B', 'Grade C', 'Premium', 'Standard']
        sort_statuses    = ['Sorted', 'Sorted', 'Sorted', 'In Sorting', 'In Warehouse']

        fabrics = []
        for i, stock in enumerate(stocks[:80]):
            mat_type = f'{stock.fabric_type} {quality_suffixes[i % len(quality_suffixes)]}'
            status   = sort_statuses[i % len(sort_statuses)]

            # --- All arithmetic is Decimal-safe ---
            init_q = stock.unloading_weight   # already Decimal from model

            if status == 'In Warehouse':
                sorted_q  = d(0)
                remaining = init_q
            elif status == 'In Sorting':
                sorted_q  = pct(init_q, 40, 60)   # partially sorted
                remaining = init_q - sorted_q
            else:  # Sorted
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

        # Sorting sessions — one per fabric that has been touched
        session_statuses = ['Completed', 'Completed', 'Completed', 'In Progress', 'On Hold']
        session_count = 0
        for i, fabric in enumerate(fabrics):
            if fabric.status == 'In Warehouse':
                continue   # not started yet

            sess_status = session_statuses[i % len(session_statuses)]
            qty_taken   = fabric.initial_quantity
            qty_sorted  = fabric.sorted_quantity if sess_status in ('Completed', 'In Progress') else d(0)
            waste       = qty_taken - qty_sorted if sess_status == 'Completed' else d(0)

            _, created = SortingSession.objects.get_or_create(
                fabric=fabric,
                unit=units[i % len(units)].name,
                defaults={
                    'supervisor':      sort_sup,
                    'quantity_taken':  qty_taken,
                    'quantity_sorted': qty_sorted,
                    'waste_quantity':  waste,
                    'status':          sess_status,
                    'end_date':        timezone.now() - timedelta(days=random.randint(1, 90))
                                       if sess_status == 'Completed' else None,
                }
            )
            if created:
                session_count += 1

        self.stdout.write(f'  ✓ {session_count} sorting sessions')

        # ═════════════════════════════════════════════════════════════════════
        # 4. DECOLORIZATION — 6 chemicals, 48 tanks, issuances, sessions
        # ═════════════════════════════════════════════════════════════════════
        self.stdout.write('\nCreating decolorization data...')

        chemical_data = [
            ('Sodium Hypochlorite', 5000, 3800, 1200, 'Liters'),
            ('Hydrogen Peroxide',   4000, 3000, 1000, 'Liters'),
            ('Acetic Acid',         3000, 2200,  800, 'Liters'),
            ('Sodium Carbonate',    3500, 2500, 1000, 'Kg'),
            ('Optical Brightener',  2000, 1400,  600, 'Kg'),
            ('Caustic Soda',        4500, 3200, 1300, 'Kg'),
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

        decolor_sup  = users_map.get('decolorization_supervisor', admin)
        tank_names   = ['Tank A', 'Tank B', 'Tank C', 'Tank D', 'Tank E', 'Tank F']
        tank_statuses = ['Completed', 'Completed', 'Completed', 'Processing', 'Empty']

        sorted_fabrics = [f for f in fabrics if f.status == 'Sorted']

        tanks = []
        issuance_count  = 0
        d_session_count = 0

        for i in range(min(48, len(sorted_fabrics))):
            batch_id = f'BATCH-{i+1:04d}'
            fabric   = sorted_fabrics[i % len(sorted_fabrics)]
            status   = tank_statuses[i % len(tank_statuses)]

            # Decimal-safe fabric quantity
            fabric_qty = fabric.sorted_quantity if status != 'Empty' else d(0)
            start_d    = timezone.now() - timedelta(days=random.randint(10, 120))

            tank, t_created = Tank.objects.get_or_create(
                batch_id=batch_id,
                defaults={
                    'name':                 tank_names[i % len(tank_names)],
                    'capacity':             d(5000),
                    'fabric':               fabric,
                    'fabric_quantity':      fabric_qty,
                    'tank_status':          status,
                    'supervisor':           decolor_sup,
                    'start_date':           start_d,
                    'expected_completion':  start_d + timedelta(days=7),
                    'actual_completion':    start_d + timedelta(days=random.randint(5, 9))
                                            if status == 'Completed' else None,
                }
            )
            tanks.append(tank)

            if not t_created:
                continue  # skip issuances/sessions for existing tanks

            # Chemical issuances — 2 or 3 per tank
            selected_chems = random.sample(chemicals, random.randint(2, 3))
            for chem in selected_chems:
                qty_issued = d(random.randint(50, 250))
                ChemicalIssuance.objects.create(
                    chemical=chem,
                    tank=tank,
                    issued_by=decolor_sup,
                    quantity=qty_issued,
                )
                issuance_count += 1

            # Decolorization session
            d_statuses_list = ['Completed', 'Completed', 'In Progress', 'On Hold']
            d_status  = d_statuses_list[i % len(d_statuses_list)]
            input_q   = fabric_qty

            if d_status == 'Completed':
                # Decimal-safe: multiply Decimal by Decimal
                output_q = pct(input_q, 91, 97)
                waste_q  = input_q - output_q
            else:
                output_q = d(0)
                waste_q  = d(0)

            DecolorizationSession.objects.create(
                tank=tank,
                fabric=fabric,
                supervisor=decolor_sup,
                input_quantity=input_q,
                output_quantity=output_q,
                waste_quantity=waste_q,
                status=d_status,
                end_date=timezone.now() - timedelta(days=random.randint(1, 60))
                         if d_status == 'Completed' else None,
            )
            d_session_count += 1

        self.stdout.write(f'  ✓ {len(tanks)} tanks')
        self.stdout.write(f'  ✓ {issuance_count} chemical issuances')
        self.stdout.write(f'  ✓ {d_session_count} decolorization sessions')

        # ═════════════════════════════════════════════════════════════════════
        # 5. SALES — 150 orders, dispatches, payments
        # ═════════════════════════════════════════════════════════════════════
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

        order_statuses = ['Confirmed', 'Completed', 'Dispatched', 'Draft', 'Cancelled']
        pay_statuses   = ['Paid',      'Paid',       'Partial',    'Pending', 'Pending']
        quality_grades = ['Grade A',   'Grade B',    'Grade C',    'Premium', 'Standard']
        price_ranges   = {
            'Grade A':  (85,  110),
            'Grade B':  (65,   84),
            'Grade C':  (45,   64),
            'Premium':  (115, 150),
            'Standard': (55,   80),
        }

        processed_fabrics = [f for f in fabrics if f.status == 'Sorted']
        if not processed_fabrics:
            processed_fabrics = fabrics  # fallback — use all if none are Sorted

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

        for i in range(150):
            buyer_name, buyer_contact = buyers[i % len(buyers)]
            fabric  = processed_fabrics[i % len(processed_fabrics)]
            quality = quality_grades[i % len(quality_grades)]
            lo, hi  = price_ranges[quality]

            # All Decimal — no int/float mixing
            weight  = d(random.randint(800, 4000))
            price   = d(random.randint(lo, hi))
            total   = weight * price          # Decimal × Decimal = Decimal

            status  = order_statuses[i % len(order_statuses)]
            pay_st  = pay_statuses[i % len(pay_statuses)]

            # Unique buyer name per iteration avoids get_or_create collisions
            unique_buyer = f'{buyer_name} #{i+1}'

            order, o_created = SalesOrder.objects.get_or_create(
                buyer_name=unique_buyer,
                defaults={
                    'buyer_contact': buyer_contact,
                    'fabric':        fabric,
                    'fabric_quality': quality,
                    'weight_sold':   weight,
                    'price_per_kg':  price,
                    'total_price':   total,
                    'status':        status,
                    'payment_status': pay_st,
                    'created_by':    admin,
                }
            )
            if o_created:
                order_count += 1

            # Dispatch — for non-draft, non-cancelled orders
            if status in ('Completed', 'Dispatched', 'Confirmed'):
                if not DispatchTracking.objects.filter(sales_order=order).exists():
                    driver_name, driver_contact = drivers[i % len(drivers)]
                    d_status  = dispatch_statuses[i % len(dispatch_statuses)]
                    d_weight  = pct(weight, 85, 100)   # Decimal-safe

                    DispatchTracking.objects.create(
                        sales_order=order,
                        vehicle_number=f'{random.choice(city_codes)}-{random.randint(1000,9999)}',
                        driver_name=driver_name,
                        driver_contact=driver_contact,
                        dispatched_weight=d_weight,
                        dispatch_status=d_status,
                        dispatched_by=admin,
                        delivery_date=(
                            timezone.now() - timedelta(days=random.randint(1, 30))
                            if d_status == 'Delivered' else None
                        ),
                    )
                    dispatch_count += 1

            # Payment — for Paid / Partial orders
            if pay_st in ('Paid', 'Partial'):
                if not Payment.objects.filter(sales_order=order).exists():
                    if pay_st == 'Paid':
                        amount = total
                    else:
                        amount = pct(total, 30, 60)   # Decimal-safe

                    method = payment_methods[i % len(payment_methods)]
                    ref    = f'TXN-{i+1:05d}' if method in ('Bank Transfer', 'Online Transfer') else None

                    Payment.objects.create(
                        sales_order=order,
                        amount=amount,
                        payment_method=method,
                        reference_number=ref,
                        received_by=admin,
                    )
                    payment_count += 1

        self.stdout.write(f'  ✓ {order_count} sales orders')
        self.stdout.write(f'  ✓ {dispatch_count} dispatch records')
        self.stdout.write(f'  ✓ {payment_count} payments')

        # ═════════════════════════════════════════════════════════════════════
        # SUMMARY
        # ═════════════════════════════════════════════════════════════════════
        self.stdout.write(self.style.SUCCESS('\n✅ Demo data seeded successfully!\n'))
        self.stdout.write('─' * 60)
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
        self.stdout.write('─' * 60)
        self.stdout.write('\nDemo Credentials:')
        self.stdout.write('─' * 60)
        self.stdout.write('  Admin:           admin          / Admin@1234')
        self.stdout.write('  Warehouse:       warehouse_user / Demo@1234')
        self.stdout.write('  Sorting:         sorting_user   / Demo@1234')
        self.stdout.write('  Decolorization:  decolor_user   / Demo@1234')
        self.stdout.write('  Drying:          drying_user    / Demo@1234')
        self.stdout.write('─' * 60)
