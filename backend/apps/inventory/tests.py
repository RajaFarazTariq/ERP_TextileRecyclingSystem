"""Phase 3: dried-stock ledger, reservations, dispatch rules, adjustments, backfill."""
import importlib
from decimal import Decimal

from django.apps import apps as django_apps
from django.test import TestCase

from apps.core.testing import (
    make_user, client_for, make_fabric, make_order, make_drying_session, make_dried_stock,
)
from apps.sales.models import DispatchTracking, SalesOrder
from . import services
from .models import StockMovement

D = Decimal


class LedgerSyncTests(TestCase):
    def setUp(self):
        self.fabric = make_fabric()

    def test_completed_drying_adds_stock_and_edits_resync(self):
        session = make_drying_session(fabric=self.fabric, input_quantity=D('500'))
        self.assertEqual(services.on_hand(self.fabric.pk), 0)          # not completed yet

        session.status, session.output_quantity = 'Completed', D('450')
        session.save()
        self.assertEqual(services.on_hand(self.fabric.pk), D('450'))

        session.output_quantity = D('430')                              # corrected later
        session.save()
        self.assertEqual(services.on_hand(self.fabric.pk), D('430'))
        self.assertEqual(StockMovement.objects.filter(source_type='DryingSession').count(), 2)

        session.delete()
        self.assertEqual(services.on_hand(self.fabric.pk), 0)

    def test_completing_through_the_api_adds_stock(self):
        session = make_drying_session(fabric=self.fabric, input_quantity=D('200'), status='In Progress')
        client_for(make_user('drying_supervisor')).post(
            f'/api/drying/sessions/{session.id}/complete/', {'output_quantity': '180', 'waste_quantity': '5'},
            format='json')
        self.assertEqual(services.on_hand(self.fabric.pk), D('180'))

    def test_moving_output_to_another_lot(self):
        other = make_fabric()
        session = make_dried_stock(self.fabric, '100')
        session.fabric = other
        session.save()
        self.assertEqual(services.on_hand(self.fabric.pk), 0)
        self.assertEqual(services.on_hand(other.pk), D('100'))


class ReservationTests(TestCase):
    def setUp(self):
        self.admin = make_user('admin')
        self.client = client_for(self.admin)
        self.fabric = make_fabric()
        make_dried_stock(self.fabric, '1000')

    def order_payload(self, weight, status='Draft', **extra):
        return {'buyer_name': 'Buyer', 'fabric': self.fabric.id, 'fabric_quality': 'A',
                'weight_sold': weight, 'price_per_kg': '10', 'status': status, **extra}

    def test_draft_orders_are_not_checked(self):
        res = self.client.post('/api/sales/orders/', self.order_payload('5000'), format='json')
        self.assertEqual(res.status_code, 201)

    def test_confirm_reserves_and_blocks_overselling(self):
        a = make_order(fabric=self.fabric, created_by=self.admin, weight='700')
        b = make_order(fabric=self.fabric, created_by=self.admin, weight='400')

        self.assertEqual(self.client.post(f'/api/sales/orders/{a.id}/confirm/').status_code, 200)
        self.assertEqual(services.available(self.fabric.pk), D('300'))

        res = self.client.post(f'/api/sales/orders/{b.id}/confirm/')
        self.assertEqual(res.status_code, 400)
        self.assertIn('300.00 kg', str(res.data))
        b.refresh_from_db()
        self.assertEqual(b.status, 'Draft')

        # cancelling releases the reservation
        self.client.post(f'/api/sales/orders/{a.id}/cancel/')
        self.assertEqual(self.client.post(f'/api/sales/orders/{b.id}/confirm/').status_code, 200)

    def test_creating_or_editing_a_confirmed_order_is_checked(self):
        res = self.client.post('/api/sales/orders/', self.order_payload('1200', status='Confirmed'), format='json')
        self.assertEqual(res.status_code, 400)
        res = self.client.post('/api/sales/orders/', self.order_payload('900', status='Confirmed'), format='json')
        self.assertEqual(res.status_code, 201)
        oid = res.data['id']
        self.assertEqual(self.client.patch(f'/api/sales/orders/{oid}/', {'weight_sold': '1100'}, format='json').status_code, 400)
        self.assertEqual(self.client.patch(f'/api/sales/orders/{oid}/', {'weight_sold': '1000'}, format='json').status_code, 200)

    def test_orders_confirmed_before_tracking_can_still_be_edited(self):
        legacy = make_order(fabric=self.fabric, created_by=self.admin, weight='5000', status='Confirmed')
        res = self.client.patch(f'/api/sales/orders/{legacy.id}/', {'notes': 'call buyer'}, format='json')
        self.assertEqual(res.status_code, 200)


class DispatchTests(TestCase):
    def setUp(self):
        self.admin = make_user('admin')
        self.client = client_for(self.admin)
        self.fabric = make_fabric()
        make_dried_stock(self.fabric, '1000')
        self.order = make_order(fabric=self.fabric, created_by=self.admin, weight='600', status='Confirmed')

    def dispatch(self, weight, order=None):
        return self.client.post('/api/sales/dispatch/', {
            'sales_order': (order or self.order).id, 'vehicle_number': 'LHR-1', 'dispatched_weight': weight,
        }, format='json')

    def test_partial_dispatches_move_stock_out(self):
        self.assertEqual(self.dispatch('250').status_code, 201)
        self.assertEqual(services.on_hand(self.fabric.pk), D('750'))
        self.assertEqual(services.reserved(self.fabric.pk), D('350'))
        self.assertEqual(services.available(self.fabric.pk), D('400'))   # unchanged by dispatch
        self.assertEqual(self.dispatch('350').status_code, 201)
        self.assertEqual(services.on_hand(self.fabric.pk), D('400'))
        self.assertEqual(services.reserved(self.fabric.pk), 0)

    def test_cannot_dispatch_more_than_ordered_or_unconfirmed(self):
        self.assertEqual(self.dispatch('601').status_code, 400)
        draft = make_order(fabric=self.fabric, created_by=self.admin, weight='10')
        res = self.dispatch('5', order=draft)
        self.assertEqual(res.status_code, 400)
        self.assertIn('Confirm the order', str(res.data))

    def test_editing_and_deleting_a_dispatch_resyncs_stock(self):
        did = self.dispatch('200').data['id']
        self.client.patch(f'/api/sales/dispatch/{did}/', {'dispatched_weight': '150'}, format='json')
        self.assertEqual(services.on_hand(self.fabric.pk), D('850'))
        self.assertEqual(self.client.patch(f'/api/sales/dispatch/{did}/', {'dispatched_weight': '700'},
                                           format='json').status_code, 400)
        self.client.delete(f'/api/sales/dispatch/{did}/')
        self.assertEqual(services.on_hand(self.fabric.pk), D('1000'))

    def test_legacy_oversold_order_cannot_ship_stock_that_is_not_there(self):
        empty = make_fabric()
        legacy = make_order(fabric=empty, created_by=self.admin, weight='100', status='Confirmed')
        res = self.dispatch('50', order=legacy)
        self.assertEqual(res.status_code, 400)
        self.assertIn('on hand', str(res.data))


class AdjustmentAndReportingTests(TestCase):
    def setUp(self):
        self.admin = make_user('admin')
        self.fabric = make_fabric()
        make_dried_stock(self.fabric, '100')

    def adjust(self, user, **data):
        return client_for(user).post('/api/inventory/movements/adjust/',
                                     {'fabric': self.fabric.id, **data}, format='json')

    def test_admin_adjustment_with_reason(self):
        self.assertEqual(self.adjust(make_user('warehouse_supervisor'), quantity='-5', note='count').status_code, 403)
        self.assertEqual(self.adjust(self.admin, quantity='-5', note='').status_code, 400)
        self.assertEqual(self.adjust(self.admin, quantity='-500', note='count').status_code, 400)
        res = self.adjust(self.admin, quantity='-5', note='Physical count')
        self.assertEqual(res.status_code, 201)
        self.assertEqual(services.on_hand(self.fabric.pk), D('95'))
        self.assertEqual(res.data['created_by_name'], self.admin.username)

    def test_stock_endpoint_and_fabric_list(self):
        make_order(fabric=self.fabric, created_by=self.admin, weight='30', status='Confirmed')
        client = client_for(make_user('sorting_supervisor'))
        rows = client.get('/api/inventory/movements/stock/').data
        row = next(r for r in rows if r['fabric'] == self.fabric.id)
        self.assertEqual((D(row['on_hand_kg']), D(row['reserved_kg']), D(row['available_kg'])),
                         (D('100'), D('30'), D('70')))
        fabrics = {f['id']: f for f in client.get('/api/sorting/fabric-stock/').data}
        self.assertEqual(fabrics[self.fabric.id]['dried_available_kg'], 70.0)
        ledger = client.get(f'/api/inventory/movements/?fabric={self.fabric.id}').data
        self.assertEqual([m['movement_type'] for m in ledger], ['DRYING_OUTPUT'])


class BackfillMigrationTests(TestCase):
    """The data migrations build the ledger and customers from existing records only."""

    def test_ledger_backfill(self):
        admin = make_user('admin')
        fabric = make_fabric()
        make_dried_stock(fabric, '300')
        make_drying_session(fabric=fabric, output_quantity=D('50'))      # not completed: ignored
        order = make_order(fabric=fabric, created_by=admin, weight='100', status='Confirmed')
        DispatchTracking.objects.create(sales_order=order, vehicle_number='V', dispatched_weight=D('80'),
                                        dispatched_by=admin)
        StockMovement.objects.all().delete()                               # as before the migration

        migration = importlib.import_module('apps.inventory.migrations.0002_backfill_movements')
        migration.forwards(django_apps, None)
        self.assertEqual(services.on_hand(fabric.pk), D('220'))
        self.assertEqual(StockMovement.objects.filter(note=migration.NOTE).count(), 2)

    def test_customer_backfill_merges_exact_matches_only(self):
        from apps.sales.models import Customer
        admin = make_user('admin')
        for name in ('Ali Traders', '  ali   TRADERS ', 'Ali Trader'):
            make_order(created_by=admin, buyer_name=name)
        SalesOrder.objects.update(customer=None)
        Customer.objects.all().delete()

        migration = importlib.import_module('apps.sales.migrations.0004_backfill_customers')
        migration.forwards(django_apps, None)
        self.assertEqual(Customer.objects.count(), 2)
        ali = Customer.objects.get(normalized_name='ali traders')
        self.assertEqual(ali.orders.count(), 2)
        # original text is untouched
        self.assertEqual(sorted(SalesOrder.objects.values_list('buyer_name', flat=True)),
                         sorted(['Ali Traders', '  ali   TRADERS ', 'Ali Trader']))


# ─────────────────────────────────────────────────────────────────────────────
# Concurrency (PostgreSQL only: SQLite has no row locks)
# ─────────────────────────────────────────────────────────────────────────────
import threading
import unittest

from django.db import connection, connections
from django.test import TransactionTestCase


@unittest.skipUnless(connection.vendor == 'postgresql', 'row locking needs PostgreSQL')
class ConcurrentConfirmTests(TransactionTestCase):
    def test_two_simultaneous_confirms_cannot_oversell(self):
        admin = make_user('admin')
        fabric = make_fabric()
        make_dried_stock(fabric, '100')
        orders = [make_order(fabric=fabric, created_by=admin, weight='80') for _ in range(2)]
        barrier = threading.Barrier(2)
        results = []

        def confirm(order):
            try:
                barrier.wait()
                results.append(client_for(admin).post(f'/api/sales/orders/{order.id}/confirm/').status_code)
            finally:
                connections.close_all()

        threads = [threading.Thread(target=confirm, args=(o,)) for o in orders]
        for t in threads:
            t.start()
        for t in threads:
            t.join()

        self.assertEqual(sorted(results), [200, 400])
        self.assertEqual(SalesOrder.objects.filter(status='Confirmed').count(), 1)
        self.assertGreaterEqual(services.available(fabric.pk), 0)
