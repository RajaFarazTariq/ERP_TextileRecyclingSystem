"""
Workforce: departments, job roles, shifts, employees, daily attendance, leave
requests and task assignments.

An employee may be linked to a login (`CustomUser`), but most floor workers
have none. Pay is not handled here. Approving leave doesn't write attendance;
the attendance sheet only suggests "Leave" for that day.
"""
from django.db import models

from apps.procurement.models import NumberedModel
from apps.users.models import CustomUser

HOURS = {'max_digits': 5, 'decimal_places': 2}
KG = {'max_digits': 12, 'decimal_places': 2}


class Department(models.Model):
    name = models.CharField(max_length=100, unique=True)
    description = models.TextField(blank=True, default='')
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return self.name


class JobRole(models.Model):
    title = models.CharField(max_length=100, unique=True)
    department = models.ForeignKey(Department, on_delete=models.PROTECT, null=True, blank=True,
                                   related_name='job_roles')
    description = models.TextField(blank=True, default='')

    class Meta:
        ordering = ['title']

    def __str__(self):
        return self.title


class Shift(models.Model):
    """A working shift. The end may be on the next day (e.g. 22:00 to 06:00)."""
    name = models.CharField(max_length=100, unique=True)
    start_time = models.TimeField()
    end_time = models.TimeField()
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ['start_time', 'name']

    def __str__(self):
        return self.name


class Employee(NumberedModel):
    PREFIX = 'EMP'
    TYPE_CHOICES = [('Permanent', 'Permanent'), ('Contract', 'Contract'), ('Daily wage', 'Daily wage')]
    STATUS_CHOICES = [('Active', 'Active'), ('On leave', 'On leave'), ('Left', 'Left')]

    full_name = models.CharField(max_length=150)
    department = models.ForeignKey(Department, on_delete=models.PROTECT, related_name='employees')
    job_role = models.ForeignKey(JobRole, on_delete=models.PROTECT, related_name='employees')
    shift = models.ForeignKey(Shift, on_delete=models.SET_NULL, null=True, blank=True, related_name='employees',
                              help_text='The shift this person usually works')
    user = models.OneToOneField(CustomUser, on_delete=models.SET_NULL, null=True, blank=True,
                                related_name='employee', help_text='Their login, if they have one')
    phone = models.CharField(max_length=30, blank=True, default='')
    cnic = models.CharField(max_length=20, blank=True, default='')
    address = models.TextField(blank=True, default='')
    emergency_contact = models.CharField(max_length=255, blank=True, default='')
    joined_on = models.DateField()
    employment_type = models.CharField(max_length=15, choices=TYPE_CHOICES, default='Permanent')
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='Active')
    left_on = models.DateField(null=True, blank=True)
    notes = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['full_name', 'id']

    def __str__(self):
        return f'{self.number or "Employee"} {self.full_name}'


class Attendance(models.Model):
    """One record per employee per day."""
    STATUS_CHOICES = [('Present', 'Present'), ('Absent', 'Absent'), ('Late', 'Late'),
                      ('Half day', 'Half day'), ('Leave', 'Leave')]

    employee = models.ForeignKey(Employee, on_delete=models.PROTECT, related_name='attendance')
    date = models.DateField()
    shift = models.ForeignKey(Shift, on_delete=models.SET_NULL, null=True, blank=True, related_name='attendance')
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='Present')
    check_in = models.TimeField(null=True, blank=True)
    check_out = models.TimeField(null=True, blank=True)
    hours_worked = models.DecimalField(**HOURS, default=0)
    overtime_hours = models.DecimalField(**HOURS, default=0)
    notes = models.CharField(max_length=255, blank=True, default='')
    recorded_by = models.ForeignKey(CustomUser, on_delete=models.SET_NULL, null=True, blank=True, related_name='+')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-date', 'employee__full_name']
        constraints = [models.UniqueConstraint(fields=['employee', 'date'], name='one_attendance_per_day')]

    def __str__(self):
        return f'{self.employee.full_name} {self.date}: {self.status}'


class LeaveRequest(models.Model):
    TYPE_CHOICES = [('Annual', 'Annual'), ('Sick', 'Sick'), ('Casual', 'Casual'), ('Unpaid', 'Unpaid')]
    STATUS_CHOICES = [('Pending', 'Pending'), ('Approved', 'Approved'), ('Rejected', 'Rejected')]

    employee = models.ForeignKey(Employee, on_delete=models.PROTECT, related_name='leave_requests')
    leave_type = models.CharField(max_length=10, choices=TYPE_CHOICES, default='Annual')
    start_date = models.DateField()
    end_date = models.DateField()
    days = models.PositiveIntegerField(default=1, editable=False)   # both ends count
    reason = models.TextField(blank=True, default='')
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='Pending', editable=False)
    decided_by = models.ForeignKey(CustomUser, on_delete=models.PROTECT, null=True, blank=True, related_name='+')
    decided_at = models.DateTimeField(null=True, blank=True)
    decision_note = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-start_date', '-id']

    def __str__(self):
        return f'{self.employee.full_name}: {self.leave_type} leave from {self.start_date}'

    def save(self, *args, **kwargs):
        self.days = (self.end_date - self.start_date).days + 1
        super().save(*args, **kwargs)


class TaskAssignment(models.Model):
    AREA_CHOICES = [('Warehouse', 'Warehouse'), ('Sorting', 'Sorting'), ('Decolorization', 'Decolorization'),
                    ('Drying', 'Drying'), ('Maintenance', 'Maintenance'), ('Other', 'Other')]
    STATUS_CHOICES = [('Assigned', 'Assigned'), ('In progress', 'In progress'), ('Done', 'Done')]

    employee = models.ForeignKey(Employee, on_delete=models.PROTECT, related_name='tasks')
    title = models.CharField(max_length=150)
    description = models.TextField(blank=True, default='')
    date = models.DateField()
    area = models.CharField(max_length=20, choices=AREA_CHOICES, blank=True, default='')
    reference = models.CharField(max_length=150, blank=True, default='',
                                 help_text='What the task is about, e.g. "Tank A-01" or "Sorting session #12"')
    status = models.CharField(max_length=12, choices=STATUS_CHOICES, default='Assigned')
    hours_spent = models.DecimalField(**HOURS, null=True, blank=True)
    output_kg = models.DecimalField(**KG, null=True, blank=True)
    assigned_by = models.ForeignKey(CustomUser, on_delete=models.SET_NULL, null=True, blank=True, related_name='+')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-date', '-id']

    def __str__(self):
        return f'{self.title} ({self.employee.full_name})'
