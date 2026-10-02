"""Workforce rules: hours between two times, leave overlap and decisions, and the reports."""
from datetime import timedelta
from decimal import Decimal

from django.db.models import Count, Sum
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.core.filters import filter_by_date_params
from .models import Attendance, Employee, LeaveRequest, TaskAssignment

ZERO = Decimal('0')
CENT = Decimal('0.01')
# Statuses that mean the person came to work
PRESENT = ('Present', 'Late', 'Half day')
OPEN_LEAVE = ('Pending', 'Approved')


def fixed(value):
    return f'{value or ZERO:.2f}'


def hours_between(start, end):
    """Hours from `start` to `end`; an end at or before the start is on the next day."""
    if start is None or end is None:
        return ZERO
    minutes = (end.hour * 60 + end.minute) - (start.hour * 60 + start.minute)
    if minutes <= 0:
        minutes += 24 * 60
    return (Decimal(minutes) / 60).quantize(CENT)


# ── Leave ───────────────────────────────────────────────────────────────────

def check_leave(employee, start, end, exclude=None):
    if end < start:
        raise ValidationError({'end_date': ["The last day can't be before the first day."]})
    clash = LeaveRequest.objects.filter(employee=employee, status__in=OPEN_LEAVE,
                                        start_date__lte=end, end_date__gte=start)
    if exclude is not None:
        clash = clash.exclude(pk=exclude.pk)
    other = clash.first()
    if other:
        raise ValidationError({'start_date': [
            f'{employee.full_name} already has {other.status.lower()} leave from '
            f'{other.start_date:%d %b %Y} to {other.end_date:%d %b %Y}.'
        ]})


def decide_leave(leave, user, approve, note=''):
    if leave.status != 'Pending':
        raise ValidationError({'status': [f'This request is already {leave.status.lower()}.']})
    leave.status = 'Approved' if approve else 'Rejected'
    leave.decided_by = user
    leave.decided_at = timezone.now()
    leave.decision_note = note.strip()
    leave.save()


def on_leave_ids(day):
    """Employees with approved leave on `day`."""
    return set(LeaveRequest.objects.filter(status='Approved', start_date__lte=day, end_date__gte=day)
               .values_list('employee_id', flat=True))


# ── Reports ─────────────────────────────────────────────────────────────────

def summary():
    today = timezone.localdate()
    staff = Employee.objects.exclude(status='Left')
    marked = dict(Attendance.objects.filter(date=today).order_by().values_list('status').annotate(n=Count('id')))
    month = Attendance.objects.filter(date__year=today.year, date__month=today.month).aggregate(
        hours=Sum('hours_worked'), overtime=Sum('overtime_hours'))

    days = [today - timedelta(days=n) for n in range(6, -1, -1)]
    trend = {d: {'date': str(d), 'Present': 0, 'Late': 0, 'Half day': 0, 'Absent': 0, 'Leave': 0} for d in days}
    for day, status, n in (Attendance.objects.filter(date__gte=days[0], date__lte=today).order_by()
                           .values_list('date', 'status').annotate(n=Count('id'))):
        trend[day][status] = n

    departments = (staff.values('department', 'department__name').annotate(employees=Count('id'))
                   .order_by('-employees', 'department__name'))
    headcount = staff.count()
    return {
        'active_employees': staff.filter(status='Active').count(),
        'employees': headcount,
        'by_department': [{'department': d['department'], 'name': d['department__name'], 'employees': d['employees']}
                          for d in departments],
        'present_today': marked.get('Present', 0) + marked.get('Half day', 0),
        'late_today': marked.get('Late', 0),
        'absent_today': marked.get('Absent', 0),
        'on_leave_today': len(on_leave_ids(today) & set(staff.values_list('id', flat=True))),
        'not_marked_today': max(headcount - Attendance.objects.filter(date=today, employee__in=staff).count(), 0),
        'pending_leave_requests': LeaveRequest.objects.filter(status='Pending').count(),
        'open_tasks': TaskAssignment.objects.exclude(status='Done').count(),
        'hours_this_month': fixed(month['hours']),
        'overtime_this_month': fixed(month['overtime']),
        'trend': list(trend.values()),
    }


def _blank():
    return {'days_present': 0, 'absences': 0, 'late_days': 0, 'leave_days': 0, 'hours_worked': ZERO,
            'overtime_hours': ZERO, 'tasks_done': 0, 'output_kg': ZERO, 'rated_kg': ZERO, 'rated_hours': ZERO}


def _finish(row):
    """Decimals as strings; kg per hour from the finished tasks that have both an output and hours."""
    rated_kg, rated_hours = row.pop('rated_kg'), row.pop('rated_hours')
    row['kg_per_hour'] = fixed(rated_kg / rated_hours) if rated_hours else None
    for key in ('hours_worked', 'overtime_hours', 'output_kg'):
        row[key] = fixed(row[key])
    return row


def productivity(params):
    """Attendance and finished work per employee in a period, with totals per department."""
    attendance = filter_by_date_params(Attendance.objects.all(), params, 'date')
    tasks = filter_by_date_params(TaskAssignment.objects.filter(status='Done'), params, 'date')

    figures = {}
    for a in attendance.values('employee_id', 'status', 'hours_worked', 'overtime_hours'):
        row = figures.setdefault(a['employee_id'], _blank())
        row['days_present'] += int(a['status'] in PRESENT)
        row['absences'] += int(a['status'] == 'Absent')
        row['late_days'] += int(a['status'] == 'Late')
        row['leave_days'] += int(a['status'] == 'Leave')
        row['hours_worked'] += a['hours_worked']
        row['overtime_hours'] += a['overtime_hours']
    for t in tasks.values('employee_id', 'hours_spent', 'output_kg'):
        row = figures.setdefault(t['employee_id'], _blank())
        row['tasks_done'] += 1
        row['output_kg'] += t['output_kg'] or ZERO
        if t['output_kg'] and t['hours_spent']:
            row['rated_kg'] += t['output_kg']
            row['rated_hours'] += t['hours_spent']

    # Current staff always show; people who left show only if they have figures in the period
    employees = [e for e in Employee.objects.select_related('department', 'job_role')
                 if e.status != 'Left' or e.pk in figures]
    rows, departments, total = [], {}, {'employees': 0, **_blank()}
    for e in employees:
        row = figures.get(e.pk) or _blank()
        dept = departments.setdefault(e.department_id, {
            'department': e.department_id, 'name': e.department.name, 'employees': 0, **_blank()})
        for group in (dept, total):
            group['employees'] += 1
            for key, value in row.items():
                group[key] += value
        rows.append(_finish({'employee': e.pk, 'number': e.number, 'full_name': e.full_name,
                             'department_name': e.department.name, 'job_role_title': e.job_role.title, **row}))

    return {
        'employees': rows,
        'departments': sorted((_finish(d) for d in departments.values()), key=lambda d: d['name']),
        'totals': _finish(total),
    }
