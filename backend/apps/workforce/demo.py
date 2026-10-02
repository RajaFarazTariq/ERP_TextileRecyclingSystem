"""Demo records for the Workforce module, added on top of the main demo data."""
import random
from datetime import time, timedelta
from decimal import Decimal

from django.utils import timezone

from apps.users.models import CustomUser
from . import services
from .models import Attendance, Department, Employee, JobRole, LeaveRequest, Shift, TaskAssignment

DEPARTMENTS = [
    ('Warehouse', 'Receiving, weighing and storing material'),
    ('Sorting', 'Sorting fabric by type and colour'),
    ('Decolorization', 'Tanks and chemical treatment'),
    ('Drying', 'Dryers and finished output'),
    ('Maintenance', 'Machines, power and repairs'),
    ('Administration', 'Office, accounts and security'),
]
ROLES = [
    ('Supervisor', None), ('Loader', 'Warehouse'), ('Weighbridge operator', 'Warehouse'),
    ('Sorter', 'Sorting'), ('Tank operator', 'Decolorization'), ('Chemical handler', 'Decolorization'),
    ('Dryer operator', 'Drying'), ('Packer', 'Drying'), ('Technician', 'Maintenance'),
    ('Electrician', 'Maintenance'), ('Office assistant', 'Administration'), ('Security guard', 'Administration'),
]
SHIFTS = [('Morning', time(6, 0), time(14, 0)), ('Evening', time(14, 0), time(22, 0)), ('Night', time(22, 0), time(6, 0))]

# name, department, role, shift, type, login (if any)
PEOPLE = [
    ('Imran Qureshi', 'Warehouse', 'Supervisor', 'Morning', 'Permanent', 'warehouse_user'),
    ('Bilal Ahmed', 'Warehouse', 'Loader', 'Morning', 'Daily wage', None),
    ('Rashid Mehmood', 'Warehouse', 'Loader', 'Evening', 'Daily wage', None),
    ('Tariq Hussain', 'Warehouse', 'Weighbridge operator', 'Morning', 'Permanent', None),
    ('Saima Bibi', 'Sorting', 'Supervisor', 'Morning', 'Permanent', 'sorting_user'),
    ('Nasreen Akhtar', 'Sorting', 'Sorter', 'Morning', 'Contract', None),
    ('Shazia Parveen', 'Sorting', 'Sorter', 'Morning', 'Contract', None),
    ('Kashif Ali', 'Sorting', 'Sorter', 'Evening', 'Daily wage', None),
    ('Rubina Kausar', 'Sorting', 'Sorter', 'Evening', 'Contract', None),
    ('Adnan Malik', 'Decolorization', 'Supervisor', 'Morning', 'Permanent', 'decolor_user'),
    ('Waqas Javed', 'Decolorization', 'Tank operator', 'Morning', 'Permanent', None),
    ('Zubair Khan', 'Decolorization', 'Tank operator', 'Night', 'Permanent', None),
    ('Naveed Iqbal', 'Decolorization', 'Chemical handler', 'Morning', 'Contract', None),
    ('Farhan Saeed', 'Drying', 'Supervisor', 'Morning', 'Permanent', 'drying_user'),
    ('Asif Raza', 'Drying', 'Dryer operator', 'Evening', 'Permanent', None),
    ('Hamza Yousaf', 'Drying', 'Packer', 'Evening', 'Daily wage', None),
    ('Ghulam Mustafa', 'Maintenance', 'Technician', 'Morning', 'Permanent', None),
    ('Shahid Anwar', 'Maintenance', 'Electrician', 'Night', 'Contract', None),
    ('Ayesha Siddiqui', 'Administration', 'Office assistant', 'Morning', 'Permanent', None),
    ('Muhammad Aslam', 'Administration', 'Security guard', 'Night', 'Contract', None),
]
# title, area, reference, kg per hour (None = no output to weigh)
TASKS = [
    ('Unload truck', 'Warehouse', 'Gate 2', 420), ('Weigh incoming bales', 'Warehouse', 'Weighbridge', None),
    ('Sort mixed cotton', 'Sorting', 'Sorting table 3', 38), ('Sort by colour', 'Sorting', 'Sorting table 1', 32),
    ('Load tank', 'Decolorization', 'Tank A-01', 110), ('Clean tank', 'Decolorization', 'Tank B-02', None),
    ('Run dryer batch', 'Drying', 'Dryer 1', 95), ('Pack dried fabric', 'Drying', 'Packing line', 150),
    ('Service dryer motor', 'Maintenance', 'Dryer 2', None), ('Check wiring', 'Maintenance', 'Main panel', None),
]


def wipe_demo_workforce():
    for model in (TaskAssignment, LeaveRequest, Attendance, Employee, Shift, JobRole, Department):
        model.objects.all().delete()


def add_demo_workforce(admin):
    rng = random.Random(7)
    today = timezone.localdate()
    departments = {name: Department.objects.get_or_create(name=name, defaults={'description': text})[0]
                   for name, text in DEPARTMENTS}
    roles = {title: JobRole.objects.get_or_create(title=title, defaults={'department': departments.get(dept)})[0]
             for title, dept in ROLES}
    shifts = {name: Shift.objects.get_or_create(name=name, defaults={'start_time': start, 'end_time': end})[0]
              for name, start, end in SHIFTS}

    employees = []
    for i, (name, dept, role, shift, kind, login) in enumerate(PEOPLE):
        user = CustomUser.objects.filter(username=login, employee__isnull=True).first() if login else None
        employees.append(Employee.objects.create(
            full_name=name, department=departments[dept], job_role=roles[role], shift=shifts[shift], user=user,
            phone=f'0300-55501{i:02d}', cnic=f'35202-{1000000 + i * 7919}-{i % 9 + 1}',
            address=f'House {12 + i}, Street {i % 7 + 1}, Faisalabad',
            emergency_contact=f'Family: 0321-55502{i:02d}',
            joined_on=today - timedelta(days=120 + i * 45), employment_type=kind,
        ))
    # One person has left, one is on long leave
    gone, away = employees[8], employees[15]
    gone.status, gone.left_on = 'Left', today - timedelta(days=20)
    gone.save()
    away.status = 'On leave'
    away.save()

    def leave(employee, kind, start, days, status, reason):
        item = LeaveRequest.objects.create(employee=employee, leave_type=kind, start_date=today + timedelta(days=start),
                                           end_date=today + timedelta(days=start + days - 1), reason=reason)
        if status != 'Pending':
            services.decide_leave(item, admin, status == 'Approved',
                                  '' if status == 'Approved' else 'Too many people are off that week.')
        return item

    leave(away, 'Sick', -3, 10, 'Approved', 'Surgery and recovery')
    leave(employees[5], 'Casual', 0, 1, 'Approved', 'Family event')
    leave(employees[10], 'Annual', -12, 3, 'Approved', 'Visit to home town')
    leave(employees[2], 'Annual', 4, 5, 'Pending', 'Wedding in the family')
    leave(employees[13], 'Casual', 2, 1, 'Pending', 'Bank work')
    leave(employees[17], 'Unpaid', 6, 4, 'Pending', 'Personal')
    leave(employees[6], 'Annual', 1, 6, 'Rejected', 'Travel')
    leave(employees[1], 'Sick', -6, 2, 'Approved', 'Fever')

    # Attendance for the last four weeks (Sunday is the day off); today is left for the user to mark
    approved = list(LeaveRequest.objects.filter(status='Approved'))
    records = []
    for back in range(28, 0, -1):
        day = today - timedelta(days=back)
        if day.weekday() == 6:
            continue
        for e in employees:
            if e.joined_on > day or (e.left_on and day > e.left_on):
                continue
            shift = e.shift
            on_leave = any(l.employee_id == e.pk and l.start_date <= day <= l.end_date for l in approved)
            roll = rng.random()
            status = 'Leave' if on_leave else 'Absent' if roll < 0.05 else 'Late' if roll < 0.14 \
                else 'Half day' if roll < 0.18 else 'Present'
            record = Attendance(employee=e, date=day, shift=shift, status=status, recorded_by=admin)
            if status in services.PRESENT:
                late = rng.choice([15, 25, 40]) if status == 'Late' else 0
                start = shift.start_time.hour * 60 + late
                length = 4 * 60 if status == 'Half day' else 8 * 60 - late
                extra = rng.choice([60, 90, 120]) if status == 'Present' and rng.random() < 0.15 else 0
                end = (start + length + extra) % (24 * 60)
                record.check_in = time(start // 60, start % 60)
                record.check_out = time(end // 60, end % 60)
                record.hours_worked = services.hours_between(record.check_in, record.check_out)
                record.overtime_hours = Decimal(extra) / 60
                if status == 'Late':
                    record.notes = rng.choice(['Transport problem', 'Came late', ''])
            records.append(record)
    Attendance.objects.bulk_create(records)

    workers = [e for e in employees if e.status == 'Active' and e.department.name != 'Administration']
    for back in range(14, -2, -1):
        day = today - timedelta(days=back)
        if day.weekday() == 6:
            continue
        for _ in range(3):
            title, area, reference, rate = rng.choice(TASKS)
            team = [e for e in workers if e.department.name == area] or workers
            status = 'Done' if back > 1 else rng.choice(['Assigned', 'In progress']) if back <= 0 \
                else rng.choice(['Done', 'In progress'])
            hours = Decimal(rng.choice(['2', '3.5', '4', '6', '8'])) if status == 'Done' else None
            output = (hours * rate * Decimal(rng.choice(['0.85', '1', '1.1']))).quantize(Decimal('1')) \
                if hours and rate else None
            TaskAssignment.objects.create(
                employee=rng.choice(team), title=title, area=area, reference=reference, date=day, status=status,
                hours_spent=hours, output_kg=output, assigned_by=admin,
                description='' if rng.random() < 0.6 else 'Finish before the shift ends.',
            )
