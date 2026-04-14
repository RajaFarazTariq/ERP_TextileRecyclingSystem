# notifications/management/commands/seed_drying_data.py
"""
Seeds drying module with data that links to existing records.

Reads completed DecolorizationSessions and Sorted FabricStocks already
in the database (from seed_demo_data.py or seed_demo_2days.py) and
creates matching Dryer machines + DryingSession records that flow
naturally through the pipeline.

Usage:
    python manage.py seed_drying_data
"""

import random
from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import timedelta
from decimal import Decimal

from users.models import CustomUser
from sorting.models import FabricStock
from decolorization.models import DecolorizationSession
from drying.models import Dryer, DryingSession


class Command(BaseCommand):
    help = 'Seeds Drying module with data linked to existing decolorization sessions'

    def handle(self, *args, **options):
        self.stdout.write('\n🌀 Seeding Drying module data...\n')

        drying_user = self._ensure_drying_user()
        dryers      = self._seed_dryers()
        self._seed_sessions(dryers, drying_user)

        self.stdout.write(self.style.SUCCESS('\n✅ Drying data seeded successfully!\n'))

    # ─────────────────────────────────────────────────────────────────────────
    # USER
    # ─────────────────────────────────────────────────────────────────────────
    def _ensure_drying_user(self):
        user, created = CustomUser.objects.get_or_create(
            username='drying_user',
            defaults={
                'email': 'drying@erp.com',
                'role':  'drying_supervisor',
                'is_active': True,
            }
        )
        if created:
            user.set_password('Demo@1234')
            user.save()
            self.stdout.write('  ✓ drying_user created (drying@erp.com / Demo@1234)')
        else:
            self.stdout.write('  ✓ drying_user already exists')

        # Ensure role is set even if user existed before
        if user.role != 'drying_supervisor':
            user.role = 'drying_supervisor'
            user.save()

        return user

    # ─────────────────────────────────────────────────────────────────────────
    # DRYERS
    # ─────────────────────────────────────────────────────────────────────────
    def _seed_dryers(self):
        """
        4 dryers — mix of types matching a real textile factory.
        get_or_create by name so re-running is safe.
        """
        dryer_specs = [
            # (name,          dryer_type,  capacity_kg, status)
            ('Dryer D-01',   'Tumble',    3000,        'Available'),
            ('Dryer D-02',   'Tumble',    3000,        'Available'),
            ('Dryer D-03',   'Conveyor',  5000,        'Available'),
            ('Dryer D-04',   'Chamber',   4000,        'Maintenance'),
        ]

        dryers = []
        created_count = 0
        for name, dtype, cap, status in dryer_specs:
            d, created = Dryer.objects.get_or_create(
                name=name,
                defaults={
                    'dryer_type': dtype,
                    'capacity':   Decimal(str(cap)),
                    'status':     status,
                    'notes':      f'{dtype} dryer — capacity {cap} kg/batch',
                }
            )
            dryers.append(d)
            if created:
                created_count += 1

        self.stdout.write(
            f'  ✓ {len(dryers)} dryers ready ({created_count} newly created)'
        )
        return dryers

    # ─────────────────────────────────────────────────────────────────────────
    # SESSIONS
    # ─────────────────────────────────────────────────────────────────────────
    def _seed_sessions(self, dryers, drying_user):
        """
        Create DryingSessions linked to existing completed DecolorizationSessions.

        Strategy:
          - Take completed DecolorizationSessions that have output_quantity > 0
          - Skip any already linked to a DryingSession (safe re-run)
          - Create sessions with realistic temperature/duration and output kg
          - Status mix: Completed (majority), In Progress (a few), Pending (a few)
        """

        # Only use the 2 available dryers for sessions
        available_dryers = [d for d in dryers if d.status != 'Maintenance']
        if not available_dryers:
            self.stdout.write('  ⚠ No available dryers — skipping sessions')
            return

        # Get completed decolorization sessions with actual output
        completed_decolor = list(
            DecolorizationSession.objects.filter(
                status='Completed',
                output_quantity__gt=0,
            ).select_related('fabric', 'tank').order_by('end_date')
        )

        if not completed_decolor:
            self.stdout.write(
                '  ⚠ No completed DecolorizationSessions found.\n'
                '    Run seed_demo_data first: python manage.py seed_demo_data'
            )
            return

        # Also collect fabrics with status 'Sorted' that have no decolor session
        # These are fabrics that went directly to drying (e.g. from 2days demo)
        linked_fabric_ids = set(s.fabric_id for s in completed_decolor)
        extra_fabrics = list(
            FabricStock.objects.filter(
                status='Sorted'
            ).exclude(
                id__in=linked_fabric_ids
            )[:10]
        )

        # Already linked — don't duplicate
        already_linked = set(
            DryingSession.objects.filter(
                decolor_session__isnull=False
            ).values_list('decolor_session_id', flat=True)
        )

        # Session parameters: temperature, duration, output efficiency
        # Real textile drying: 70-90°C for 60-120 min, ~8-12% moisture loss
        session_configs = [
            # (temp_c,  duration_min,  output_pct, waste_pct, status)
            (80,       90,             0.90,       0.01,      'Completed'),
            (85,       75,             0.89,       0.02,      'Completed'),
            (75,       110,            0.91,       0.01,      'Completed'),
            (82,       85,             0.88,       0.02,      'Completed'),
            (78,       100,            0.90,       0.01,      'Completed'),
            (80,       90,             0.89,       0.01,      'Completed'),
            (85,       80,             0.91,       0.02,      'Completed'),
            (75,       120,            0.90,       0.01,      'Completed'),
            (80,       90,             0.00,       0.00,      'In Progress'),
            (82,       90,             0.00,       0.00,      'In Progress'),
            (78,       100,            0.00,       0.00,      'Pending'),
            (80,       90,             0.00,       0.00,      'Pending'),
        ]

        created_count  = 0
        skipped_count  = 0
        dryer_idx      = 0
        config_idx     = 0

        # ── Sessions from decolorization output ──────────────────────────────
        for decolor_sess in completed_decolor:
            if decolor_sess.id in already_linked:
                skipped_count += 1
                continue

            if DryingSession.objects.filter(
                fabric=decolor_sess.fabric,
                decolor_session=decolor_sess
            ).exists():
                skipped_count += 1
                continue

            cfg        = session_configs[config_idx % len(session_configs)]
            temp, dur, out_pct, waste_pct, status = cfg
            dryer      = available_dryers[dryer_idx % len(available_dryers)]
            input_qty  = float(decolor_sess.output_quantity)

            if input_qty <= 0:
                continue

            output_qty = round(input_qty * out_pct,  2) if status == 'Completed' else 0
            waste_qty  = round(input_qty * waste_pct, 2) if status == 'Completed' else 0

            # Timing: drying happens 1-3 days after decolorization completed
            days_after = random.randint(1, 3)
            if decolor_sess.end_date:
                start_dt = decolor_sess.end_date + timedelta(days=days_after)
            else:
                start_dt = timezone.now() - timedelta(days=random.randint(5, 60))

            end_dt = (start_dt + timedelta(minutes=dur + random.randint(-10, 10))
                      if status == 'Completed' else None)

            notes_map = {
                'Completed':   f'Batch dried at {temp}°C for {dur} min. Output moisture <5%. Passed QC.',
                'In Progress': f'Currently drying at {temp}°C. Started at {start_dt.strftime("%H:%M")} today.',
                'Pending':     'Batch loaded and ready. Waiting for dryer to be free.',
            }

            DryingSession.objects.create(
                dryer             = dryer,
                fabric            = decolor_sess.fabric,
                decolor_session   = decolor_sess,
                supervisor        = drying_user,
                input_quantity    = Decimal(str(input_qty)),
                output_quantity   = Decimal(str(output_qty)),
                waste_quantity    = Decimal(str(waste_qty)),
                temperature_celsius = Decimal(str(temp)),
                duration_minutes  = dur if status == 'Completed' else None,
                status            = status,
                start_date        = start_dt if status in ('Completed', 'In Progress') else None,
                end_date          = end_dt,
                notes             = notes_map[status],
            )

            # Update dryer status to reflect in-progress sessions
            if status == 'In Progress' and dryer.status == 'Available':
                dryer.status = 'Running'
                dryer.save()

            # Update fabric status to show it's been dried and is ready for sale
            if status == 'Completed':
                fabric = decolor_sess.fabric
                if fabric.status != 'Sorted':
                    fabric.status = 'Sorted'
                    fabric.save()

            created_count += 1
            dryer_idx     += 1
            config_idx    += 1

        # ── Extra sessions from standalone Sorted fabrics ─────────────────────
        for fabric in extra_fabrics:
            if DryingSession.objects.filter(fabric=fabric).exists():
                skipped_count += 1
                continue

            cfg        = session_configs[config_idx % len(session_configs)]
            temp, dur, out_pct, waste_pct, status = cfg
            dryer      = available_dryers[dryer_idx % len(available_dryers)]
            input_qty  = float(fabric.remaining_quantity or fabric.sorted_quantity or 0)

            if input_qty <= 0:
                continue

            output_qty = round(input_qty * out_pct,  2) if status == 'Completed' else 0
            waste_qty  = round(input_qty * waste_pct, 2) if status == 'Completed' else 0

            start_dt = timezone.now() - timedelta(days=random.randint(1, 30))
            end_dt   = (start_dt + timedelta(minutes=dur)
                        if status == 'Completed' else None)

            DryingSession.objects.create(
                dryer               = dryer,
                fabric              = fabric,
                decolor_session     = None,
                supervisor          = drying_user,
                input_quantity      = Decimal(str(input_qty)),
                output_quantity     = Decimal(str(output_qty)),
                waste_quantity      = Decimal(str(waste_qty)),
                temperature_celsius = Decimal(str(temp)),
                duration_minutes    = dur if status == 'Completed' else None,
                status              = status,
                start_date          = start_dt if status in ('Completed', 'In Progress') else None,
                end_date            = end_dt,
                notes               = f'Direct drying — fabric from sorting. {temp}°C, {dur} min.',
            )

            created_count += 1
            dryer_idx     += 1
            config_idx    += 1

        # ── Final dryer statuses ──────────────────────────────────────────────
        # Set dryers that aren't Running back to Available
        for d in available_dryers:
            if d.status not in ('Running', 'Maintenance', 'Cooling'):
                d.status = 'Available'
                d.save()

        total = created_count + skipped_count
        self.stdout.write(
            f'  ✓ {created_count} drying sessions created '
            f'({skipped_count} skipped — already exist or no matching data)'
        )

        # ── Summary ───────────────────────────────────────────────────────────
        all_sessions   = DryingSession.objects.all()
        completed      = all_sessions.filter(status='Completed').count()
        in_progress    = all_sessions.filter(status='In Progress').count()
        pending        = all_sessions.filter(status='Pending').count()
        running_dryers = Dryer.objects.filter(status='Running').count()

        self.stdout.write('\n' + '─' * 50)
        self.stdout.write(f'  Total Drying Sessions : {all_sessions.count()}')
        self.stdout.write(f'    Completed           : {completed}')
        self.stdout.write(f'    In Progress         : {in_progress}')
        self.stdout.write(f'    Pending             : {pending}')
        self.stdout.write(f'  Dryers Running        : {running_dryers} / {Dryer.objects.count()}')
        self.stdout.write('─' * 50)
        self.stdout.write('\nLogin as drying_user / Demo@1234 to view the Drying module.')
