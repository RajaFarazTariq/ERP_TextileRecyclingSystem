from datetime import timedelta
from decimal import Decimal

from django.utils import timezone
from rest_framework.test import APITestCase

from apps.core.testing import client_for, make_decolor_session, make_dryer, make_drying_session, make_tank, make_user
from .models import Machine, MaintenanceSchedule, SparePart, WorkOrder

API = '/api/maintenance'


class MaintenanceTestCase(APITestCase):
    def setUp(self):
        self.admin = make_user('admin')
        self.sorter = make_user('sorting_supervisor')
        self.dryer_user = make_user('drying_supervisor')
        self.as_admin = client_for(self.admin)
        self.as_sorter = client_for(self.sorter)
        self.as_dryer = client_for(self.dryer_user)
        self.machine = Machine.objects.create(code='SH-01', name='Shredder', hourly_operating_cost=Decimal('500'))

    def report(self, client=None, **data):
        data.setdefault('machine', self.machine.pk)
        data.setdefault('title', 'Belt slipping')
        return (client or self.as_sorter).post(f'{API}/work-orders/', data, format='json')

    def order(self, **data):
        res = self.report(**data)
        self.assertEqual(res.status_code, 201, res.data)
        return res.data

    def act(self, order, name, client=None, **body):
        return (client or self.as_sorter).post(f'{API}/work-orders/{order["id"]}/{name}/', body, format='json')

    def status_of(self, machine=None):
        return Machine.objects.get(pk=(machine or self.machine).pk).status

    def part(self, stock='10', cost='250', **extra):
        return SparePart.objects.create(code=extra.pop('code', 'BLT-1'), name='Drive belt', stock_quantity=Decimal(stock),
                                        unit_cost=Decimal(cost), **extra)


class MachineTests(MaintenanceTestCase):
    def test_admins_register_machines_and_everyone_reads_them(self):
        data = {'code': 'BL-01', 'name': 'Baler', 'category': 'Baler'}
        self.assertEqual(self.as_sorter.post(f'{API}/machines/', data, format='json').status_code, 403)
        res = self.as_admin.post(f'{API}/machines/', data, format='json')
        self.assertEqual(res.status_code, 201, res.data)
        self.assertEqual(res.data['status'], 'Running')
        self.assertEqual(len(self.as_sorter.get(f'{API}/machines/').data), 2)
        self.assertEqual(self.as_sorter.delete(f'{API}/machines/{res.data["id"]}/').status_code, 403)
        self.assertEqual(self.as_admin.delete(f'{API}/machines/{res.data["id"]}/').status_code, 204)

    def test_code_is_unique_and_links_are_one_of_tank_or_dryer(self):
        res = self.as_admin.post(f'{API}/machines/', {'code': 'SH-01', 'name': 'Again'}, format='json')
        self.assertEqual(res.status_code, 400)
        res = self.as_admin.post(f'{API}/machines/', {
            'code': 'TK-01', 'name': 'Tank', 'tank': make_tank().pk, 'dryer': make_dryer().pk}, format='json')
        self.assertEqual(res.status_code, 400)
        self.assertIn('dryer', res.data)

    def test_a_machine_with_work_orders_cannot_be_deleted(self):
        self.order()
        self.assertEqual(self.as_admin.delete(f'{API}/machines/{self.machine.pk}/').status_code, 409)


class WorkOrderTests(MaintenanceTestCase):
    def test_any_role_reports_a_breakdown(self):
        order = self.order(is_breakdown=True, priority='Urgent')
        self.assertTrue(order['number'].startswith('WO-'))
        self.assertEqual((order['kind'], order['status'], order['reported_by']), ('Corrective', 'Open', self.sorter.pk))
        self.assertEqual(self.status_of(), 'Broken down')

    def test_only_an_admin_plans_preventive_work_and_assigns_people(self):
        self.assertEqual(self.report(kind='Preventive').status_code, 403)
        self.assertEqual(self.report(assigned_to=self.dryer_user.pk).status_code, 403)
        res = self.report(self.as_admin, kind='Preventive', assigned_to=self.dryer_user.pk)
        self.assertEqual(res.status_code, 201, res.data)
        self.assertEqual(res.data['assigned_to_name'], self.dryer_user.username)

    def test_start_and_complete_set_the_machine_status(self):
        order = self.order()
        self.assertEqual(self.status_of(), 'Running')
        res = self.act(order, 'start')
        self.assertEqual(res.status_code, 200, res.data)
        self.assertEqual(res.data['status'], 'In progress')
        self.assertIsNotNone(res.data['started_at'])
        self.assertEqual(self.status_of(), 'Under maintenance')
        self.assertEqual(self.act(order, 'start').status_code, 400)

        self.assertIn('work_done', self.act(order, 'complete').data)
        res = self.act(order, 'complete', work_done='Tightened the belt', downtime_minutes=90, labour_hours='1.5',
                       labour_cost='600', other_cost='150')
        self.assertEqual(res.status_code, 200, res.data)
        self.assertEqual(res.data['status'], 'Done')
        self.assertEqual(res.data['downtime_minutes'], 90)
        self.assertEqual(res.data['total_cost'], '750.00')
        self.assertEqual(self.status_of(), 'Running')

    def test_a_breakdown_keeps_the_machine_broken_down_until_it_is_done(self):
        order = self.order(is_breakdown=True)
        self.act(order, 'start')
        self.assertEqual(self.status_of(), 'Broken down')
        self.act(order, 'complete', work_done='Replaced the motor')
        self.assertEqual(self.status_of(), 'Running')

    def test_the_machine_stays_down_while_another_order_is_in_progress(self):
        first, second = self.order(), self.order(title='Oil leak')
        self.act(first, 'start')
        self.act(second, 'start')
        self.act(first, 'complete', work_done='Done')
        self.assertEqual(self.status_of(), 'Under maintenance')

    def test_a_retired_machine_keeps_its_status_and_takes_no_new_orders(self):
        order = self.order()
        Machine.objects.filter(pk=self.machine.pk).update(status='Retired')
        self.act(order, 'start')
        self.assertEqual(self.status_of(), 'Retired')
        self.assertEqual(self.report().status_code, 400)

    def test_only_the_assigned_person_or_an_admin_works_an_assigned_order(self):
        order = self.report(self.as_admin, assigned_to=self.dryer_user.pk).data
        self.assertEqual(self.act(order, 'start').status_code, 403)
        self.assertEqual(self.act(order, 'start', self.as_dryer).status_code, 200)
        self.assertEqual(self.act(order, 'complete', work_done='Fixed').status_code, 403)
        self.assertEqual(self.act(order, 'complete', self.as_admin, work_done='Fixed').status_code, 200)

    def test_only_an_admin_cancels_and_cancelling_restores_the_machine(self):
        order = self.order(is_breakdown=True)
        self.assertEqual(self.act(order, 'cancel').status_code, 403)
        res = self.act(order, 'cancel', self.as_admin)
        self.assertEqual(res.data['status'], 'Cancelled')
        self.assertEqual(self.status_of(), 'Running')

    def test_a_closed_order_cannot_be_changed(self):
        done, cancelled = self.order(), self.order()
        self.act(done, 'complete', work_done='Fixed')
        self.act(cancelled, 'cancel', self.as_admin)
        for order in (done, cancelled):
            res = self.as_admin.patch(f'{API}/work-orders/{order["id"]}/', {'title': 'Changed'}, format='json')
            self.assertEqual(res.status_code, 400)
            self.assertEqual(self.act(order, 'complete', self.as_admin, work_done='Again').status_code, 400)
            self.assertEqual(self.act(order, 'cancel', self.as_admin).status_code, 400)

    def test_who_edits_and_deletes(self):
        order = self.order()
        url = f'{API}/work-orders/{order["id"]}/'
        self.assertEqual(self.as_dryer.patch(url, {'title': 'Mine now'}, format='json').status_code, 403)
        self.assertEqual(self.as_sorter.patch(url, {'title': 'Belt slipping badly'}, format='json').status_code, 200)
        self.assertEqual(self.as_sorter.patch(url, {'assigned_to': self.sorter.pk}, format='json').status_code, 403)
        res = self.as_admin.patch(url, {'assigned_to': self.dryer_user.pk, 'priority': 'High'}, format='json')
        self.assertEqual(res.status_code, 200, res.data)
        # Work figures only come in through the complete action
        self.as_admin.patch(url, {'labour_cost': '999', 'status': 'Done'}, format='json')
        saved = WorkOrder.objects.get(pk=order['id'])
        self.assertEqual((saved.labour_cost, saved.status), (Decimal('0'), 'Open'))
        self.assertEqual(self.as_sorter.delete(url).status_code, 403)
        self.assertEqual(self.as_admin.delete(url).status_code, 204)

    def test_list_filters(self):
        self.order()
        self.act(self.order(), 'start')
        self.assertEqual(len(self.as_dryer.get(f'{API}/work-orders/?status=Open').data), 1)
        self.assertEqual(len(self.as_dryer.get(f'{API}/work-orders/?kind=Preventive').data), 0)


class ScheduleTests(MaintenanceTestCase):
    def schedule(self, **extra):
        data = {'machine': self.machine.pk, 'task': 'Grease bearings', 'every_days': 30, **extra}
        res = self.as_admin.post(f'{API}/schedules/', data, format='json')
        self.assertEqual(res.status_code, 201, res.data)
        return res.data

    def raise_order(self, schedule, client=None):
        return (client or self.as_admin).post(f'{API}/schedules/{schedule["id"]}/create-work-order/')

    def test_next_due_comes_from_the_last_time_or_the_start_date(self):
        today = timezone.localdate()
        self.assertEqual(self.schedule(start_date=str(today + timedelta(days=5)))['next_due_on'],
                         str(today + timedelta(days=5)))
        late = self.schedule(last_done_on=str(today - timedelta(days=40)))
        self.assertEqual(late['next_due_on'], str(today - timedelta(days=10)))
        self.assertTrue(late['overdue'])
        self.assertEqual(late['days_until_due'], -10)

    def test_only_admins_keep_schedules(self):
        res = self.as_sorter.post(f'{API}/schedules/', {'machine': self.machine.pk, 'task': 'X', 'every_days': 7},
                                  format='json')
        self.assertEqual(res.status_code, 403)
        self.assertEqual(self.raise_order(self.schedule(), self.as_sorter).status_code, 403)
        res = self.as_admin.post(f'{API}/schedules/', {'machine': self.machine.pk, 'task': 'X', 'every_days': 0},
                                 format='json')
        self.assertEqual(res.status_code, 400)

    def test_a_schedule_has_one_open_work_order_at_a_time(self):
        schedule = self.schedule(instructions='Use lithium grease')
        res = self.raise_order(schedule)
        self.assertEqual(res.status_code, 201, res.data)
        self.assertEqual((res.data['kind'], res.data['title'], res.data['description'], res.data['schedule']),
                         ('Preventive', 'Grease bearings', 'Use lithium grease', schedule['id']))
        again = self.raise_order(schedule)
        self.assertEqual(again.status_code, 400)
        self.assertIn(res.data['number'], str(again.data))
        listed = self.as_sorter.get(f'{API}/schedules/').data[0]
        self.assertEqual(listed['open_work_order'], res.data['number'])

    def test_completing_the_work_order_moves_the_schedule_forward(self):
        today = timezone.localdate()
        schedule = self.schedule(last_done_on=str(today - timedelta(days=40)))
        order = self.raise_order(schedule).data
        self.assertEqual(self.act(order, 'complete', work_done='Greased').status_code, 200)
        saved = MaintenanceSchedule.objects.get(pk=schedule['id'])
        self.assertEqual((saved.last_done_on, saved.next_due_on), (today, today + timedelta(days=30)))
        self.assertEqual(self.raise_order(schedule).status_code, 201)

    def test_a_cancelled_order_leaves_the_schedule_due(self):
        schedule = self.schedule()
        order = self.raise_order(schedule).data
        self.act(order, 'cancel', self.as_admin)
        self.assertIsNone(MaintenanceSchedule.objects.get(pk=schedule['id']).last_done_on)
        self.assertEqual(self.raise_order(schedule).status_code, 201)

    def test_a_schedule_not_in_use_raises_no_work_order(self):
        self.assertEqual(self.raise_order(self.schedule(is_active=False)).status_code, 400)


class SparePartTests(MaintenanceTestCase):
    def use(self, order, part, quantity, client=None):
        return (client or self.as_sorter).post(
            f'{API}/part-uses/', {'work_order': order['id'], 'part': part.pk, 'quantity': quantity}, format='json')

    def test_admins_keep_parts_and_receive_stock(self):
        data = {'code': 'BRG-6204', 'name': 'Bearing 6204', 'stock_quantity': '4', 'reorder_level': '5', 'unit_cost': '300'}
        self.assertEqual(self.as_sorter.post(f'{API}/parts/', data, format='json').status_code, 403)
        part = self.as_admin.post(f'{API}/parts/', data, format='json').data
        self.assertTrue(part['low'])
        self.assertEqual(part['stock_value'], '1200.00')
        url = f'{API}/parts/{part["id"]}'
        self.assertEqual(self.as_admin.patch(f'{url}/', {'stock_quantity': '50'}, format='json').status_code, 400)
        self.assertEqual(self.as_sorter.post(f'{url}/receive/', {'quantity': '10'}, format='json').status_code, 403)
        self.assertEqual(self.as_admin.post(f'{url}/receive/', {'quantity': '0'}, format='json').status_code, 400)
        res = self.as_admin.post(f'{url}/receive/', {'quantity': '10', 'unit_cost': '320'}, format='json')
        self.assertEqual(res.status_code, 200, res.data)
        self.assertEqual((res.data['stock_quantity'], res.data['unit_cost'], res.data['low']), ('14.00', '320.00', False))

    def test_using_a_part_takes_it_from_stock_and_keeps_the_cost(self):
        order, part = self.order(), self.part()
        res = self.use(order, part, '3')
        self.assertEqual(res.status_code, 201, res.data)
        self.assertEqual((res.data['unit_cost'], res.data['cost']), ('250.00', '750.00'))
        part.refresh_from_db()
        self.assertEqual(part.stock_quantity, Decimal('7'))
        # A later price change doesn't rewrite the job's cost
        SparePart.objects.filter(pk=part.pk).update(unit_cost=Decimal('400'))
        done = self.act(order, 'complete', work_done='New belt', labour_cost='100', other_cost='50').data
        self.assertEqual((done['parts_cost'], done['total_cost']), ('750.00', '900.00'))

    def test_more_than_is_in_stock_is_refused(self):
        order, part = self.order(), self.part(stock='2')
        res = self.use(order, part, '3')
        self.assertEqual(res.status_code, 400)
        self.assertIn('quantity', res.data)
        self.assertEqual(self.use(order, part, '0').status_code, 400)
        part.refresh_from_db()
        self.assertEqual(part.stock_quantity, Decimal('2'))

    def test_removing_a_use_returns_the_stock(self):
        order, part = self.order(), self.part()
        use = self.use(order, part, '4').data
        self.assertEqual(self.as_sorter.delete(f'{API}/part-uses/{use["id"]}/').status_code, 403)
        self.assertEqual(self.as_admin.delete(f'{API}/part-uses/{use["id"]}/').status_code, 204)
        part.refresh_from_db()
        self.assertEqual(part.stock_quantity, Decimal('10'))

    def test_parts_are_fixed_once_the_order_is_closed(self):
        order, part = self.order(), self.part()
        use = self.use(order, part, '1').data
        self.act(order, 'complete', work_done='Fixed')
        self.assertEqual(self.use(order, part, '1').status_code, 400)
        self.assertEqual(self.as_admin.delete(f'{API}/part-uses/{use["id"]}/').status_code, 400)
        self.assertEqual(self.as_admin.delete(f'{API}/work-orders/{order["id"]}/').status_code, 409)
        part.refresh_from_db()
        self.assertEqual(part.stock_quantity, Decimal('9'))

    def test_parts_on_an_order_assigned_to_someone_else(self):
        order = self.report(self.as_admin, assigned_to=self.dryer_user.pk).data
        self.assertEqual(self.use(order, self.part(), '1').status_code, 403)


class ReportTests(MaintenanceTestCase):
    def past(self, days_ago, minutes=0, breakdown=True, machine=None, status='Done', **costs):
        return WorkOrder.objects.create(
            machine=machine or self.machine, title='Stopped', is_breakdown=breakdown, reported_by=self.sorter,
            status=status, reported_at=timezone.now() - timedelta(days=days_ago), downtime_minutes=minutes, **costs)

    def test_summary(self):
        today = timezone.localdate()
        Machine.objects.create(code='BL-01', name='Baler', status='Idle')
        self.past(0, minutes=90, labour_cost=Decimal('400'), other_cost=Decimal('100'))
        self.past(0, minutes=30, breakdown=False, status='Cancelled')
        self.order()
        self.act(self.order(priority='Urgent'), 'start')
        MaintenanceSchedule.objects.create(machine=self.machine, task='Grease', every_days=30,
                                           last_done_on=today - timedelta(days=45))
        MaintenanceSchedule.objects.create(machine=self.machine, task='Inspect', every_days=30, start_date=today)
        self.part(stock='2', reorder_level=Decimal('5'))
        self.part(code='OIL-1', stock='20', reorder_level=Decimal('5'))

        data = self.as_dryer.get(f'{API}/summary/').data
        by_status = {row['status']: row['count'] for row in data['machines_by_status']}
        self.assertEqual((data['machines'], by_status['Under maintenance'], by_status['Idle']), (2, 1, 1))
        self.assertEqual((data['open_work_orders'], data['in_progress_work_orders'], data['urgent_work_orders']), (1, 1, 1))
        self.assertEqual([(s['task'], s['days_overdue']) for s in data['overdue_schedules']], [('Grease', 15)])
        self.assertEqual(data['due_this_week'], 1)
        self.assertEqual((data['breakdowns_this_month'], data['downtime_hours_this_month'], data['cost_this_month']),
                         (1, '1.50', '500.00'))
        self.assertEqual([p['code'] for p in data['low_parts']], ['BLT-1'])

    def test_performance_over_the_last_90_days_by_default(self):
        self.past(40, minutes=600, labour_cost=Decimal('1000'))
        self.past(10, minutes=480, other_cost=Decimal('500'))
        self.past(5, minutes=0, breakdown=False)
        self.past(200, minutes=999)                      # before the period
        self.past(3, minutes=999, status='Cancelled')    # cancelled orders don't count
        idle = Machine.objects.create(code='BL-01', name='Baler')

        data = self.as_dryer.get(f'{API}/performance/').data
        self.assertEqual(data['days'], 90)
        rows = {r['code']: r for r in data['machines']}
        row = rows['SH-01']
        self.assertEqual((row['work_orders'], row['breakdowns'], row['downtime_hours'], row['cost']),
                         (3, 2, '18.00', '1500.00'))
        self.assertEqual(row['downtime_cost'], '9000.00')
        self.assertEqual(row['mtbf_days'], 30.0)
        self.assertEqual(row['availability_pct'], round((2160 - 18) / 2160 * 100, 1))
        self.assertEqual((rows[idle.code]['breakdowns'], rows[idle.code]['mtbf_days'], rows[idle.code]['availability_pct']),
                         (0, None, 100.0))
        self.assertEqual((data['breakdowns'], data['downtime_hours'], data['cost']), (2, '18.00', '1500.00'))
        self.assertEqual(data['availability_pct'], round((4320 - 18) / 4320 * 100, 1))

    def test_performance_for_a_chosen_period(self):
        today = timezone.localdate()
        self.past(40, minutes=600)
        self.past(2, minutes=120)
        start = today - timedelta(days=9)
        data = self.as_admin.get(f'{API}/performance/?start={start}&end={today}').data
        self.assertEqual((data['start'], data['end'], data['days']), (str(start), str(today), 10))
        row = data['machines'][0]
        self.assertEqual((row['breakdowns'], row['downtime_hours'], row['mtbf_days']), (1, '2.00', None))
        self.assertEqual(row['availability_pct'], round((240 - 2) / 240 * 100, 1))
        self.assertEqual(self.as_admin.get(f'{API}/performance/?date_filter=today').data['days'], 1)

    def test_downtime_is_shown_next_to_the_sessions_of_linked_equipment(self):
        tank, dryer = make_tank(), make_dryer()
        tank_machine = Machine.objects.create(code='TK-01', name='Tank one', tank=tank)
        dryer_machine = Machine.objects.create(code='DR-01', name='Dryer one', dryer=dryer)
        make_decolor_session(tank=tank)
        make_decolor_session(tank=tank)
        make_decolor_session()
        make_drying_session(dryer=dryer)
        self.past(1, minutes=120, machine=tank_machine)

        impact = {r['code']: r for r in self.as_sorter.get(f'{API}/performance/').data['impact']}
        self.assertEqual(set(impact), {'TK-01', 'DR-01'})
        self.assertEqual((impact['TK-01']['equipment'], impact['TK-01']['equipment_kind'], impact['TK-01']['sessions'],
                          impact['TK-01']['downtime_hours'], impact['TK-01']['breakdowns']), (tank.name, 'Tank', 2, '2.00', 1))
        self.assertEqual((impact[dryer_machine.code]['sessions'], impact[dryer_machine.code]['downtime_hours']), (1, '0.00'))

    def test_reports_need_a_login(self):
        from rest_framework.test import APIClient
        self.assertIn(APIClient().get(f'{API}/summary/').status_code, (401, 403))


class DemoDataTests(MaintenanceTestCase):
    def test_demo_data_fills_every_screen_and_can_be_wiped(self):
        from .demo import add_demo_maintenance, wipe_demo_maintenance
        wipe_demo_maintenance()
        add_demo_maintenance(self.admin)
        summary = self.as_admin.get(f'{API}/summary/').data
        self.assertTrue(summary['overdue_schedules'] and summary['low_parts'] and summary['open_work_orders'])
        self.assertEqual(Machine.objects.get(code='BL-01').status, 'Broken down')
        self.assertTrue(any(r['mtbf_days'] for r in self.as_admin.get(f'{API}/performance/').data['machines']))
        wipe_demo_maintenance()
        self.assertFalse(Machine.objects.exists() or SparePart.objects.exists() or WorkOrder.objects.exists())
