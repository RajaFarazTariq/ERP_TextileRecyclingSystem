from django.utils import timezone
from rest_framework import serializers

from . import services
from .models import Attendance, Department, Employee, JobRole, LeaveRequest, Shift, TaskAssignment

NOT_AT_WORK = ('Absent', 'Leave')


class DepartmentSerializer(serializers.ModelSerializer):
    employees = serializers.SerializerMethodField()

    class Meta:
        model = Department
        fields = ['id', 'name', 'description', 'is_active', 'employees']

    def get_employees(self, obj) -> int:
        return sum(1 for e in obj.employees.all() if e.status != 'Left')


class JobRoleSerializer(serializers.ModelSerializer):
    department_name = serializers.CharField(source='department.name', read_only=True, default=None)

    class Meta:
        model = JobRole
        fields = ['id', 'title', 'department', 'department_name', 'description']


class ShiftSerializer(serializers.ModelSerializer):
    hours = serializers.SerializerMethodField()

    class Meta:
        model = Shift
        fields = ['id', 'name', 'start_time', 'end_time', 'is_active', 'hours']

    def get_hours(self, obj) -> str:
        return services.fixed(services.hours_between(obj.start_time, obj.end_time))

    def validate(self, data):
        start = data.get('start_time', getattr(self.instance, 'start_time', None))
        end = data.get('end_time', getattr(self.instance, 'end_time', None))
        if start == end:
            raise serializers.ValidationError({'end_time': ["The end can't be the same as the start."]})
        return data


class EmployeeSerializer(serializers.ModelSerializer):
    department_name = serializers.CharField(source='department.name', read_only=True)
    job_role_title = serializers.CharField(source='job_role.title', read_only=True)
    shift_name = serializers.CharField(source='shift.name', read_only=True, default=None)
    username = serializers.CharField(source='user.username', read_only=True, default=None)

    class Meta:
        model = Employee
        fields = [
            'id', 'number', 'full_name', 'department', 'department_name', 'job_role', 'job_role_title',
            'shift', 'shift_name', 'user', 'username', 'phone', 'cnic', 'address', 'emergency_contact',
            'joined_on', 'employment_type', 'status', 'left_on', 'notes', 'created_at',
        ]
        read_only_fields = ['number']
        extra_kwargs = {'user': {'validators': []}}

    def validate_user(self, user):
        if user is not None:
            taken = Employee.objects.filter(user=user)
            if self.instance:
                taken = taken.exclude(pk=self.instance.pk)
            if other := taken.first():
                raise serializers.ValidationError(f'This login already belongs to {other.full_name}.')
        return user

    def validate(self, data):
        def value(name):
            return data[name] if name in data else getattr(self.instance, name, None)

        if value('status') == 'Left':
            if value('left_on') is None:
                data['left_on'] = timezone.localdate()
            if data.get('left_on', value('left_on')) < value('joined_on'):
                raise serializers.ValidationError({'left_on': ["The leaving date can't be before the joining date."]})
        else:
            data['left_on'] = None
        return data


class AttendanceSerializer(serializers.ModelSerializer):
    employee_name = serializers.CharField(source='employee.full_name', read_only=True)
    employee_number = serializers.CharField(source='employee.number', read_only=True)
    department_name = serializers.CharField(source='employee.department.name', read_only=True)
    shift_name = serializers.CharField(source='shift.name', read_only=True, default=None)
    hours_worked = serializers.DecimalField(max_digits=5, decimal_places=2, required=False, allow_null=True,
                                            min_value=0, max_value=24)
    overtime_hours = serializers.DecimalField(max_digits=5, decimal_places=2, required=False,
                                              min_value=0, max_value=24)

    class Meta:
        model = Attendance
        fields = ['id', 'employee', 'employee_name', 'employee_number', 'department_name', 'date', 'shift',
                  'shift_name', 'status', 'check_in', 'check_out', 'hours_worked', 'overtime_hours', 'notes']
        validators = []   # one record per day is checked below, with a clearer message

    def validate(self, data):
        current = self.instance

        def value(name):
            return data[name] if name in data else getattr(current, name, None)

        employee, day = value('employee'), value('date')
        if current and employee != current.employee:
            raise serializers.ValidationError({'employee': ["A record can't be moved to another employee."]})
        if day > timezone.localdate():
            raise serializers.ValidationError({'date': ["Attendance can't be marked for a future date."]})
        same_day = Attendance.objects.filter(employee=employee, date=day)
        if current:
            same_day = same_day.exclude(pk=current.pk)
        if same_day.exists():
            raise serializers.ValidationError({'date': [
                f'{employee.full_name} already has attendance for {day:%d %b %Y}. Edit that record instead.'
            ]})

        if value('status') in NOT_AT_WORK:
            data.update(check_in=None, check_out=None, hours_worked=services.ZERO, overtime_hours=services.ZERO)
            return data

        check_in, check_out = value('check_in'), value('check_out')
        if check_out and not check_in:
            raise serializers.ValidationError({'check_in': ['Enter the check-in time too.']})
        # Hours typed by hand are kept; otherwise they follow the check-in and check-out times
        if data.get('hours_worked') is None:
            times_changed = current is None or (check_in, check_out) != (current.check_in, current.check_out)
            if times_changed or 'hours_worked' in data:
                data['hours_worked'] = services.hours_between(check_in, check_out)
            else:
                data.pop('hours_worked', None)
        return data


class LeaveRequestSerializer(serializers.ModelSerializer):
    employee_name = serializers.CharField(source='employee.full_name', read_only=True)
    employee_number = serializers.CharField(source='employee.number', read_only=True)
    department_name = serializers.CharField(source='employee.department.name', read_only=True)
    decided_by_name = serializers.CharField(source='decided_by.username', read_only=True, default=None)

    class Meta:
        model = LeaveRequest
        fields = ['id', 'employee', 'employee_name', 'employee_number', 'department_name', 'leave_type',
                  'start_date', 'end_date', 'days', 'reason', 'status', 'decided_by', 'decided_by_name',
                  'decided_at', 'decision_note', 'created_at']
        read_only_fields = ['days', 'status', 'decided_by', 'decided_at', 'decision_note']

    def validate(self, data):
        current = self.instance

        def value(name):
            return data[name] if name in data else getattr(current, name, None)

        if current and current.status != 'Pending':
            raise serializers.ValidationError({'status': [
                f"This request is already {current.status.lower()} and can't be changed."
            ]})
        services.check_leave(value('employee'), value('start_date'), value('end_date'), exclude=current)
        return data


class TaskSerializer(serializers.ModelSerializer):
    employee_name = serializers.CharField(source='employee.full_name', read_only=True)
    employee_number = serializers.CharField(source='employee.number', read_only=True)
    assigned_by_name = serializers.CharField(source='assigned_by.username', read_only=True, default=None)
    hours_spent = serializers.DecimalField(max_digits=5, decimal_places=2, required=False, allow_null=True, min_value=0)
    output_kg = serializers.DecimalField(max_digits=12, decimal_places=2, required=False, allow_null=True, min_value=0)

    class Meta:
        model = TaskAssignment
        fields = ['id', 'employee', 'employee_name', 'employee_number', 'title', 'description', 'date', 'area',
                  'reference', 'status', 'hours_spent', 'output_kg', 'assigned_by', 'assigned_by_name', 'created_at']
        read_only_fields = ['assigned_by']
