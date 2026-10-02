# inventory/management/commands/reconcile_inventory.py
"""
Check the dried-stock ledger against the records it is built from.

    python manage.py reconcile_inventory          # report only
    python manage.py reconcile_inventory --fix    # re-sync the ledger with its sources

Reports:
  * lots where the ledger differs from completed drying output minus dispatches
    (plus manual adjustments) — --fix posts the missing differences
  * lots with negative on-hand stock
  * confirmed/dispatched orders that are not covered by stock (typically orders
    confirmed before stock tracking existed)
"""
from decimal import Decimal

from django.core.management.base import BaseCommand
from django.db.models import Sum

from apps.drying.models import DryingSession
from apps.inventory import services
from apps.inventory.models import StockMovement
from apps.sales.models import DispatchTracking, SalesReturn


class Command(BaseCommand):
    help = 'Compare the dried-stock ledger with drying sessions and dispatches'

    def add_arguments(self, parser):
        parser.add_argument('--fix', action='store_true', help='Post the missing ledger differences')

    def handle(self, *args, **options):
        zero = Decimal('0')

        expected = {}
        for fabric_id, total in (DryingSession.objects.filter(status='Completed')
                                 .values_list('fabric_id').annotate(t=Sum('output_quantity'))):
            expected[fabric_id] = expected.get(fabric_id, zero) + (total or zero)
        for fabric_id, total in (DispatchTracking.objects.values_list('sales_order__fabric_id')
                                 .annotate(t=Sum('dispatched_weight'))):
            expected[fabric_id] = expected.get(fabric_id, zero) - (total or zero)
        for fabric_id, total in (SalesReturn.objects.filter(status='Approved', restock=True)
                                 .values_list('order__fabric_id').annotate(t=Sum('weight'))):
            expected[fabric_id] = expected.get(fabric_id, zero) + (total or zero)
        for fabric_id, total in (StockMovement.objects.filter(movement_type=StockMovement.ADJUSTMENT)
                                 .values_list('fabric_id').annotate(t=Sum('quantity'))):
            expected[fabric_id] = expected.get(fabric_id, zero) + (total or zero)

        figures = services.availability_map()
        fabric_ids = sorted(set(expected) | set(figures))

        # Compare to the paisa: SQLite adds up decimals as floats, which leaves tiny differences
        cent = Decimal('0.01')
        mismatched = [(f, expected.get(f, zero), figures.get(f, {}).get('on_hand', zero))
                      for f in fabric_ids
                      if Decimal(expected.get(f, zero)).quantize(cent) != Decimal(figures.get(f, {}).get('on_hand', zero)).quantize(cent)]
        negative = [(f, v['on_hand']) for f, v in figures.items() if v['on_hand'] < 0]
        oversold = [(f, v['available']) for f, v in figures.items() if v['available'] < 0]

        self.stdout.write(f'Lots checked: {len(fabric_ids)}')
        self._report('Ledger differs from source records', mismatched,
                     lambda r: f'fabric #{r[0]}: sources say {r[1]:,.2f} kg, ledger has {r[2]:,.2f} kg')
        self._report('Negative on-hand stock', negative,
                     lambda r: f'fabric #{r[0]}: {r[1]:,.2f} kg')
        self._report('Reserved more than on hand (oversold)', oversold,
                     lambda r: f'fabric #{r[0]}: short by {-r[1]:,.2f} kg')

        if options['fix'] and mismatched:
            for session in DryingSession.objects.all():
                services.sync_drying_session(session)
            for dispatch in DispatchTracking.objects.select_related('sales_order'):
                services.sync_dispatch(dispatch)
            for sales_return in SalesReturn.objects.select_related('order'):
                services.sync_sales_return(sales_return)
            self.stdout.write(self.style.SUCCESS('Ledger re-synced with drying sessions, dispatches and returns.'))

    def _report(self, title, rows, fmt):
        if not rows:
            self.stdout.write(self.style.SUCCESS(f'  ✓ {title}: none'))
            return
        self.stdout.write(self.style.WARNING(f'  ! {title}: {len(rows)}'))
        for row in rows[:50]:
            self.stdout.write(f'      {fmt(row)}')
        if len(rows) > 50:
            self.stdout.write(f'      … and {len(rows) - 50} more')
