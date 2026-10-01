# sales/management/commands/customer_duplicates.py
"""
List customers whose names look alike (e.g. "Ali Traders" / "Ali Trader"),
so a person can decide which to merge (admin: POST /api/sales/customers/<id>/merge/).

    python manage.py customer_duplicates [--threshold 0.85]
"""
from django.core.management.base import BaseCommand

from apps.sales.views import find_similar_customers


class Command(BaseCommand):
    help = 'List customers with similar names for manual review'

    def add_arguments(self, parser):
        parser.add_argument('--threshold', type=float, default=0.85)

    def handle(self, *args, **options):
        pairs = find_similar_customers(options['threshold'])
        if not pairs:
            self.stdout.write(self.style.SUCCESS('No similar customer names found.'))
            return
        for p in pairs:
            self.stdout.write(f"{p['similarity']:.2f}  #{p['a']['id']} {p['a']['name']!r}  ~  "
                              f"#{p['b']['id']} {p['b']['name']!r}")
        self.stdout.write(f'{len(pairs)} pair(s) to review.')
