from datetime import time, timedelta

from django.test import TestCase
from django.utils import timezone

from apps.core.testing import ROLES, client_for, make_user
from . import services
from .demo import add_demo_workforce, wipe_demo_workforce
from .models import Attendance, Department, Employee, JobRole, LeaveRequest, Shift, TaskAssignment

API = '/api/workforce'


class WorkforceTestCase(TestCase):
    def setUp(self):
        self.admin = make_user('admin')
        self.api = client_for(self.admin)
        self.today = timezone.localdate()
        self.sorting = Department.objects.create(name='Sorting')
        self.sorter = JobRole.objects.create(title='Sorter', department=self.sorting)
        self.morning = Shift.objects.create(name='Morning', start_time=time(6), end_time=time(14))
        self.night = Shift.objects.create(name='Night', start_time=time(22), end_time=time(6))
        self.ali = self.employee('Ali Raza')
        self.sara = self.employee('Sara Khan', shift=self.night)

    def employee(self, name, **kwargs):
        kwargs.setdefault('department', self.sorting)
        kwargs.setdefault('job_role', self.sorter)
        kwargs.setdefault('shift', self.morning)
        kwargs.setdefault('joined_on', self.today - timedelta(days=200))
        return Employee.objects.create(full_name=name, **kwargs)

    def post(self, path, data, client=None):
        return (client or self.api).post(f'{API}/{path}/', data, format='json')

    def attend(self, employee=None, **data):
        data.setdefault('date', str(self.today))
        data.setdefault('status', 'Present')
        return self.post('attendance', {'employee': (employee or self.ali).pk, **data})

    def leave(self, start=1, end=3, employee=None, **data):
        return self.post('leave', {
            'employee': (employee or self.ali).pk, 'leave_type': 'Annual',
            'start_date': str(self.today + timedelta(days=start)), 'end_date': str(self.today + timedelta(days=end)),
            **data,
        })


class PermissionTests(WorkforceTestCase):
    PATHS = ['departments', 'job-roles', 'shifts', 'employees', 'attendance', 'attendance/sheet', 'leave', 'tasks',
             'summary', 'productivity']

    def test_only_admins_read_or_write(self):
        for role in ROLES:
            client = client_for(make_user(role))
            expected = 200 if role == 'admin' else 403
            for path in self.PATHS:
                self.assertEqual(client.get(f'{API}/{path}/').status_code, expected, f'{role} GET {path}')
        supervisor = client_for(make_user('warehouse_supervisor'))
        self.assertEqual(self.post('departments', {'name': 'Drying'}, supervisor).status_code, 403)
        self.assertEqual(self.post('attendance/mark', {'date': str(self.today), 'records': []}, supervisor).status_code, 403)
        self.assertEqual(supervisor.get(f'{API}/employees/{self.ali.pk}/').status_code, 403)
        self.assertEqual(supervisor.delete(f'{API}/employees/{self.ali.pk}/').status_code, 403)
        leave = self.leave().data
        self.assertEqual(supervisor.post(f'{API}/leave/{leave["id"]}/approve/').status_code, 403)

    def test_signed_out_users_get_nothing(self):
        from rest_framework.test import APIClient
        self.assertEqual(APIClient().get(f'{API}/employees/').status_code, 401)


class SetupTests(WorkforceTestCase):
    def test_shift_hours_cross_midnight(self):
        shifts = {s['name']: s for s in self.api.get(f'{API}/shifts/').data}
        self.assertEqual(shifts['Morning']['hours'], '8.00')
        self.assertEqual(shifts['Night']['hours'], '8.00')
        res = self.post('shifts', {'name': 'Odd', 'start_time': '08:00', 'end_time': '08:00'})
        self.assertEqual(res.status_code, 400)
        self.assertIn('end_time', res.data)

    def test_names_are_unique(self):
        self.assertEqual(self.post('departments', {'name': 'Sorting'}).status_code, 400)
        self.assertEqual(self.post('job-roles', {'title': 'Sorter'}).status_code, 400)
        self.assertEqual(self.post('shifts', {'name': 'Night', 'start_time': '20:00', 'end_time': '04:00'}).status_code, 400)

    def test_a_department_in_use_cannot_be_deleted(self):
        self.assertEqual(self.api.delete(f'{API}/departments/{self.sorting.pk}/').status_code, 409)
        empty = Department.objects.create(name='Empty')
        self.assertEqual(self.api.delete(f'{API}/departments/{empty.pk}/').status_code, 204)

    def test_department_counts_current_staff(self):
        self.employee('Gone', status='Left', left_on=self.today)
        self.assertEqual(self.api.get(f'{API}/departments/').data[0]['employees'], 2)


class EmployeeTests(WorkforceTestCase):
    def new(self, **extra):
        return self.post('employees', {
            'full_name': 'Bilal Ahmed', 'department': self.sorting.pk, 'job_role': self.sorter.pk,
            'joined_on': str(self.today - timedelta(days=30)), **extra,
        })

    def test_code_is_set_by_the_server(self):
        res = self.new(number='X-1')
        self.assertEqual(res.status_code, 201, res.data)
        self.assertEqual(res.data['number'], f'EMP-{res.data["id"]:05d}')
        self.assertEqual(res.data['status'], 'Active')
        self.assertEqual(res.data['employment_type'], 'Permanent')
        self.assertEqual(res.data['department_name'], 'Sorting')

    def test_a_login_belongs_to_one_employee(self):
        user = make_user('sorting_supervisor')
        self.assertEqual(self.new(user=user.pk).status_code, 201)
        res = self.new(full_name='Other', user=user.pk)
        self.assertEqual(res.status_code, 400)
        self.assertIn('Bilal Ahmed', str(res.data['user']))

    def test_leaving_date_follows_the_status(self):
        res = self.api.patch(f'{API}/employees/{self.ali.pk}/', {'status': 'Left'}, format='json')
        self.assertEqual(res.data['left_on'], str(self.today))
        res = self.api.patch(f'{API}/employees/{self.ali.pk}/', {'status': 'Active'}, format='json')
        self.assertIsNone(res.data['left_on'])
        res = self.api.patch(f'{API}/employees/{self.ali.pk}/',
                             {'status': 'Left', 'left_on': str(self.today - timedelta(days=900))}, format='json')
        self.assertEqual(res.status_code, 400)
        self.assertIn('left_on', res.data)

    def test_status_filter_and_protected_delete(self):
        self.employee('Gone', status='Left', left_on=self.today)
        self.assertEqual(len(self.api.get(f'{API}/employees/?status=Left').data), 1)
        self.assertEqual(len(self.api.get(f'{API}/employees/').data), 3)
        self.attend()
        self.assertEqual(self.api.delete(f'{API}/employees/{self.ali.pk}/').status_code, 409)
        self.assertEqual(self.api.delete(f'{API}/employees/{self.sara.pk}/').status_code, 204)


class AttendanceTests(WorkforceTestCase):
    def test_hours_come_from_the_times(self):
        res = self.attend(check_in='06:00', check_out='14:30')
        self.assertEqual(res.status_code, 201, res.data)
        self.assertEqual(res.data['hours_worked'], '8.50')
        night = self.attend(self.sara, check_in='22:00', check_out='06:15')
        self.assertEqual(night.data['hours_worked'], '8.25')
        self.assertEqual(self.attend(self.employee('No times')).data['hours_worked'], '0.00')

    def test_typed_hours_are_kept(self):
        res = self.attend(check_in='06:00', check_out='14:00', hours_worked='7.5')
        self.assertEqual(res.data['hours_worked'], '7.50')
        url = f'{API}/attendance/{res.data["id"]}/'
        # Another field changes: the typed hours stay
        self.assertEqual(self.api.patch(url, {'notes': 'Lunch'}, format='json').data['hours_worked'], '7.50')
        # The times change: the hours follow them
        self.assertEqual(self.api.patch(url, {'check_out': '16:00'}, format='json').data['hours_worked'], '10.00')
        # Hours cleared: worked out again
        self.assertEqual(self.api.patch(url, {'hours_worked': None, 'check_out': '15:00'}, format='json').data['hours_worked'], '9.00')

    def test_absent_and_leave_have_no_hours(self):
        res = self.attend(status='Absent', check_in='06:00', check_out='14:00', overtime_hours='2')
        self.assertEqual(res.status_code, 201, res.data)
        self.assertIsNone(res.data['check_in'])
        self.assertEqual((res.data['hours_worked'], res.data['overtime_hours']), ('0.00', '0.00'))

    def test_one_record_per_employee_per_day(self):
        self.assertEqual(self.attend().status_code, 201)
        res = self.attend(status='Late')
        self.assertEqual(res.status_code, 400)
        self.assertIn('already has attendance', str(res.data['date']))
        self.assertEqual(self.attend(date=str(self.today - timedelta(days=1))).status_code, 201)

    def test_bad_input_is_refused(self):
        self.assertIn('date', self.attend(date=str(self.today + timedelta(days=1))).data)
        self.assertIn('check_in', self.attend(check_out='14:00').data)
        self.assertEqual(self.attend(hours_worked='30').status_code, 400)
        self.assertEqual(self.attend(overtime_hours='-1').status_code, 400)

    def mark(self, records, **extra):
        return self.post('attendance/mark', {'date': str(self.today), 'records': records, **extra})

    def test_mark_adds_and_updates_in_one_request(self):
        self.attend(status='Absent')
        res = self.mark([
            {'employee': self.ali.pk, 'status': 'Present', 'check_in': '06:00', 'check_out': '14:00'},
            {'employee': self.sara.pk, 'status': 'Late', 'check_in': '22:30', 'check_out': '06:00'},
        ])
        self.assertEqual(res.status_code, 200, res.data)
        self.assertEqual(Attendance.objects.count(), 2)
        ali, sara = Attendance.objects.get(employee=self.ali), Attendance.objects.get(employee=self.sara)
        self.assertEqual((ali.status, str(ali.hours_worked)), ('Present', '8.00'))
        self.assertEqual((sara.status, str(sara.hours_worked)), ('Late', '7.50'))
        # No shift chosen: a new record takes the employee's usual shift
        self.assertEqual(sara.shift, self.night)
        self.assertEqual(sara.recorded_by, self.admin)

        res = self.mark([{'employee': self.sara.pk, 'status': 'Leave'}], shift=self.morning.pk)
        self.assertEqual(res.status_code, 200, res.data)
        sara.refresh_from_db()
        self.assertEqual((sara.status, sara.check_in, sara.shift), ('Leave', None, self.morning))
        self.assertEqual(Attendance.objects.count(), 2)

    def test_mark_saves_nothing_when_one_row_is_wrong(self):
        res = self.mark([
            {'employee': self.ali.pk, 'status': 'Present'},
            {'employee': self.sara.pk, 'status': 'Present', 'check_out': '06:00'},
        ])
        self.assertEqual(res.status_code, 400)
        self.assertIn('Sara Khan', res.data['records'][0])
        self.assertEqual(Attendance.objects.count(), 0)
        self.assertEqual(self.mark([]).status_code, 400)
        self.assertEqual(self.mark([{'employee': self.ali.pk}, {'employee': self.ali.pk}]).status_code, 400)
        self.assertEqual(self.post('attendance/mark', {'date': 'soon', 'records': [{'employee': self.ali.pk}]}).status_code, 400)

    def test_sheet_lists_staff_with_records_and_leave(self):
        self.employee('Gone', status='Left', left_on=self.today)
        self.employee('Not yet', joined_on=self.today + timedelta(days=3))
        leave = self.leave(start=0, end=1, employee=self.sara, leave_type='Sick').data
        self.attend(check_in='06:00', check_out='14:00')
        rows = {r['full_name']: r for r in self.api.get(f'{API}/attendance/sheet/?date={self.today}').data['rows']}
        self.assertEqual(sorted(rows), ['Ali Raza', 'Sara Khan'])
        self.assertEqual(rows['Ali Raza']['record']['status'], 'Present')
        self.assertIsNone(rows['Sara Khan']['record'])
        self.assertFalse(rows['Sara Khan']['on_leave'])            # still pending
        self.api.post(f'{API}/leave/{leave["id"]}/approve/')
        sara = next(r for r in self.api.get(f'{API}/attendance/sheet/?date={self.today}').data['rows']
                    if r['full_name'] == 'Sara Khan')
        self.assertEqual((sara['on_leave'], sara['leave_type'], sara['shift']), (True, 'Sick', self.night.pk))
        # Approving leave writes no attendance
        self.assertFalse(Attendance.objects.filter(employee=self.sara).exists())

    def test_list_filters_by_date(self):
        self.attend()
        self.attend(date=str(self.today - timedelta(days=400)))
        self.assertEqual(len(self.api.get(f'{API}/attendance/').data), 2)
        self.assertEqual(len(self.api.get(f'{API}/attendance/?date={self.today}').data), 1)
        self.assertEqual(len(self.api.get(f'{API}/attendance/?start={self.today}').data), 1)


class LeaveTests(WorkforceTestCase):
    def test_days_count_both_ends(self):
        res = self.leave(start=1, end=3)
        self.assertEqual(res.status_code, 201, res.data)
        self.assertEqual((res.data['days'], res.data['status']), (3, 'Pending'))
        self.assertEqual(self.leave(start=10, end=10).data['days'], 1)

    def test_end_cannot_be_before_start(self):
        res = self.leave(start=5, end=4)
        self.assertEqual(res.status_code, 400)
        self.assertIn('end_date', res.data)

    def test_no_overlap_with_pending_or_approved_leave(self):
        first = self.leave(start=1, end=3).data
        self.assertIn('start_date', self.leave(start=3, end=5).data)            # touches the last day
        self.assertEqual(self.leave(start=4, end=5).status_code, 201)             # the day after is fine
        self.assertEqual(self.leave(start=1, end=3, employee=self.sara).status_code, 201)   # someone else
        self.api.post(f'{API}/leave/{first["id"]}/approve/')
        self.assertEqual(self.leave(start=2, end=2).status_code, 400)
        # Rejected leave doesn't block
        other = self.leave(start=20, end=22).data
        self.api.post(f'{API}/leave/{other["id"]}/reject/', {'note': 'Busy week'}, format='json')
        self.assertEqual(self.leave(start=21, end=21).status_code, 201)

    def test_approve_and_reject(self):
        leave = self.leave().data
        res = self.api.post(f'{API}/leave/{leave["id"]}/approve/')
        self.assertEqual(res.status_code, 200, res.data)
        self.assertEqual((res.data['status'], res.data['decided_by_name']), ('Approved', self.admin.username))
        self.assertIsNotNone(res.data['decided_at'])
        self.assertEqual(self.api.post(f'{API}/leave/{leave["id"]}/reject/').status_code, 400)
        res = self.api.patch(f'{API}/leave/{leave["id"]}/', {'reason': 'Changed'}, format='json')
        self.assertEqual(res.status_code, 400)

        other = self.leave(start=10, end=11).data
        res = self.api.post(f'{API}/leave/{other["id"]}/reject/', {'note': 'Busy week'}, format='json')
        self.assertEqual((res.data['status'], res.data['decision_note']), ('Rejected', 'Busy week'))

    def test_status_cannot_be_set_directly(self):
        res = self.leave(status='Approved')
        self.assertEqual(res.data['status'], 'Pending')

    def test_a_pending_request_can_be_moved(self):
        leave = self.leave(start=1, end=3).data
        res = self.api.patch(f'{API}/leave/{leave["id"]}/', {'end_date': str(self.today + timedelta(days=5))}, format='json')
        self.assertEqual(res.status_code, 200, res.data)
        self.assertEqual(res.data['days'], 5)


class TaskTests(WorkforceTestCase):
    def test_tasks(self):
        res = self.post('tasks', {'employee': self.ali.pk, 'title': 'Sort cotton', 'date': str(self.today),
                                  'area': 'Sorting', 'reference': 'Sorting session #12'})
        self.assertEqual(res.status_code, 201, res.data)
        self.assertEqual((res.data['status'], res.data['assigned_by_name']), ('Assigned', self.admin.username))
        res = self.api.patch(f'{API}/tasks/{res.data["id"]}/',
                             {'status': 'Done', 'hours_spent': '4', 'output_kg': '120'}, format='json')
        self.assertEqual((res.data['status'], res.data['output_kg']), ('Done', '120.00'))
        self.assertEqual(self.post('tasks', {'employee': self.ali.pk, 'title': 'X', 'date': str(self.today),
                                             'area': 'Kitchen'}).status_code, 400)
        self.assertEqual(self.post('tasks', {'employee': self.ali.pk, 'title': 'X', 'date': str(self.today),
                                             'output_kg': '-5'}).status_code, 400)
        self.assertEqual(len(self.api.get(f'{API}/tasks/?status=Done').data), 1)
        self.assertEqual(len(self.api.get(f'{API}/tasks/?area=Drying').data), 0)


class ReportTests(WorkforceTestCase):
    def setUp(self):
        super().setUp()
        self.drying = Department.objects.create(name='Drying')
        self.omar = self.employee('Omar Farooq', department=self.drying)
        self.employee('Gone', status='Left', left_on=self.today - timedelta(days=50))
        day = self.today
        self.attend(check_in='06:00', check_out='14:00', overtime_hours='1.5')           # Ali: present, 8 h
        self.attend(self.sara, status='Late', check_in='22:30', check_out='06:00')        # Sara: late, 7.5 h
        self.attend(self.omar, status='Absent')
        for employee, hours, kg in [(self.ali, '4', '200'), (self.ali, '2', None), (self.omar, None, '50')]:
            TaskAssignment.objects.create(employee=employee, title='Work', date=day, status='Done',
                                          hours_spent=hours, output_kg=kg)
        TaskAssignment.objects.create(employee=self.ali, title='Later', date=day, status='Assigned', output_kg='999')

    def test_summary(self):
        self.api.post(f'{API}/leave/{self.leave(start=0, end=0, employee=self.omar).data["id"]}/approve/')
        self.leave(start=5, end=6)
        s = self.api.get(f'{API}/summary/').data
        self.assertEqual((s['active_employees'], s['employees']), (3, 3))
        self.assertEqual((s['present_today'], s['late_today'], s['absent_today']), (1, 1, 1))
        self.assertEqual((s['on_leave_today'], s['not_marked_today'], s['pending_leave_requests']), (1, 0, 1))
        self.assertEqual((s['hours_this_month'], s['overtime_this_month']), ('15.50', '1.50'))
        self.assertEqual(s['open_tasks'], 1)
        self.assertEqual(s['by_department'], [
            {'department': self.sorting.pk, 'name': 'Sorting', 'employees': 2},
            {'department': self.drying.pk, 'name': 'Drying', 'employees': 1},
        ])
        self.assertEqual(len(s['trend']), 7)
        self.assertEqual(s['trend'][-1], {'date': str(self.today), 'Present': 1, 'Late': 1, 'Half day': 0,
                                          'Absent': 1, 'Leave': 0})

    def test_productivity(self):
        report = self.api.get(f'{API}/productivity/?date_filter=today').data
        rows = {r['full_name']: r for r in report['employees']}
        self.assertEqual(sorted(rows), ['Ali Raza', 'Omar Farooq', 'Sara Khan'])      # no figures for the one who left
        ali = rows['Ali Raza']
        self.assertEqual((ali['days_present'], ali['absences'], ali['late_days']), (1, 0, 0))
        self.assertEqual((ali['hours_worked'], ali['overtime_hours']), ('8.00', '1.50'))
        self.assertEqual((ali['tasks_done'], ali['output_kg'], ali['kg_per_hour']), (2, '200.00', '50.00'))
        sara = rows['Sara Khan']
        self.assertEqual((sara['days_present'], sara['late_days'], sara['hours_worked']), (1, 1, '7.50'))
        self.assertIsNone(sara['kg_per_hour'])
        omar = rows['Omar Farooq']
        self.assertEqual((omar['absences'], omar['output_kg'], omar['kg_per_hour']), (1, '50.00', None))

        departments = {d['name']: d for d in report['departments']}
        self.assertEqual((departments['Sorting']['employees'], departments['Sorting']['hours_worked']), (2, '15.50'))
        self.assertEqual(departments['Sorting']['kg_per_hour'], '50.00')
        self.assertEqual(departments['Drying']['absences'], 1)
        totals = report['totals']
        self.assertEqual((totals['employees'], totals['days_present'], totals['absences'], totals['late_days']), (3, 2, 1, 1))
        self.assertEqual((totals['tasks_done'], totals['output_kg'], totals['hours_worked']), (3, '250.00', '15.50'))

    def test_productivity_respects_the_period(self):
        old = self.today - timedelta(days=500)
        report = self.api.get(f'{API}/productivity/?start={old}&end={old}').data
        self.assertEqual(report['totals']['days_present'], 0)
        self.assertEqual(report['totals']['output_kg'], '0.00')
        self.assertEqual(len(report['employees']), 3)


class DemoDataTests(TestCase):
    def test_demo_data_fills_every_tab(self):
        admin = make_user('admin', username='admin')
        make_user('sorting_supervisor', username='sorting_user')
        add_demo_workforce(admin)
        self.assertEqual(Employee.objects.get(user__username='sorting_user').department.name, 'Sorting')
        for model in (Department, JobRole, Shift, Employee, Attendance, LeaveRequest, TaskAssignment):
            self.assertTrue(model.objects.exists(), model.__name__)
        self.assertEqual(set(LeaveRequest.objects.values_list('status', flat=True)), {'Pending', 'Approved', 'Rejected'})
        self.assertEqual(client_for(admin).get(f'{API}/summary/').status_code, 200)
        self.assertEqual(client_for(admin).get(f'{API}/productivity/').status_code, 200)
        self.assertEqual(services.hours_between(time(22), time(6)), 8)
        wipe_demo_workforce()
        self.assertFalse(Employee.objects.exists())
        self.assertFalse(Department.objects.exists())
