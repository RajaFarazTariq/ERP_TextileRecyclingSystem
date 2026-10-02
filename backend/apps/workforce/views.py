from datetime import date

from django.db import transaction
from django.utils import timezone
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import serializers, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.audit.middleware import AuditedModelMixin
from apps.audit.models import AuditLog
from apps.core.filters import filter_by_date_params
from apps.core.permissions import IsAdminUser
from . import services
from .models import Attendance, Department, Employee, JobRole, LeaveRequest, Shift, TaskAssignment
from .serializers import (
    AttendanceSerializer, DepartmentSerializer, EmployeeSerializer, JobRoleSerializer, LeaveRequestSerializer,
    ShiftSerializer, TaskSerializer,
)

# Employee data is personal: admins only, for reading as well as writing
ADMIN_ONLY = [IsAuthenticated, IsAdminUser]

note_request = inline_serializer('WorkforceNoteRequest', {'note': serializers.CharField(required=False)})


class DepartmentViewSet(AuditedModelMixin, viewsets.ModelViewSet):
    serializer_class = DepartmentSerializer
    permission_classes = ADMIN_ONLY
    queryset = Department.objects.prefetch_related('employees')


class JobRoleViewSet(AuditedModelMixin, viewsets.ModelViewSet):
    serializer_class = JobRoleSerializer
    permission_classes = ADMIN_ONLY
    queryset = JobRole.objects.select_related('department')


class ShiftViewSet(AuditedModelMixin, viewsets.ModelViewSet):
    serializer_class = ShiftSerializer
    permission_classes = ADMIN_ONLY
    queryset = Shift.objects.all()


class EmployeeViewSet(AuditedModelMixin, viewsets.ModelViewSet):
    serializer_class = EmployeeSerializer
    permission_classes = ADMIN_ONLY

    def get_queryset(self):
        qs = Employee.objects.select_related('department', 'job_role', 'shift', 'user')
        params = self.request.query_params
        if s := params.get('status'):
            qs = qs.filter(status=s)
        if department := params.get('department'):
            qs = qs.filter(department_id=department)
        return qs


def _day(text):
    try:
        return date.fromisoformat(str(text))
    except ValueError:
        raise ValidationError({'date': ['Enter a date as YYYY-MM-DD.']})


class AttendanceViewSet(AuditedModelMixin, viewsets.ModelViewSet):
    serializer_class = AttendanceSerializer
    permission_classes = ADMIN_ONLY

    def get_queryset(self):
        qs = Attendance.objects.select_related('employee__department', 'shift')
        params = self.request.query_params
        if employee := params.get('employee'):
            qs = qs.filter(employee_id=employee)
        if s := params.get('status'):
            qs = qs.filter(status=s)
        if day := params.get('date'):
            qs = qs.filter(date=_day(day))
        return filter_by_date_params(qs, params, 'date')

    def perform_create(self, serializer):
        return super().perform_create(serializer, recorded_by=self.request.user)

    @extend_schema(responses=OpenApiTypes.OBJECT)
    @action(detail=False, methods=['get'])
    def sheet(self, request):
        """Current staff for one day, with what is already recorded and who has approved leave."""
        day = _day(request.query_params.get('date') or timezone.localdate())
        records = {a.employee_id: a for a in self.get_queryset().filter(date=day)}
        leave = dict(LeaveRequest.objects.filter(status='Approved', start_date__lte=day, end_date__gte=day)
                     .values_list('employee_id', 'leave_type'))
        staff = (Employee.objects.select_related('department', 'job_role', 'shift')
                 .filter(joined_on__lte=day).exclude(status='Left'))
        return Response({'date': str(day), 'rows': [{
            'employee': e.pk, 'number': e.number, 'full_name': e.full_name,
            'department_name': e.department.name, 'job_role_title': e.job_role.title,
            'shift': e.shift_id, 'shift_name': e.shift.name if e.shift else None,
            'on_leave': e.pk in leave, 'leave_type': leave.get(e.pk),
            'record': self.get_serializer(records[e.pk]).data if e.pk in records else None,
        } for e in staff]})

    @extend_schema(request=OpenApiTypes.OBJECT, responses=AttendanceSerializer(many=True))
    @action(detail=False, methods=['post'])
    def mark(self, request):
        """Mark a whole list for one date: adds the missing records and updates the existing ones."""
        day = _day(request.data.get('date') or '')
        shift = request.data.get('shift')
        records = request.data.get('records')
        if not isinstance(records, list) or not records:
            raise ValidationError({'records': ['Mark at least one employee.']})
        ids = [r.get('employee') for r in records if isinstance(r, dict)]
        if len(ids) != len(records) or len(set(ids)) != len(ids):
            raise ValidationError({'records': ['Give each employee once.']})

        existing = {a.employee_id: a for a in Attendance.objects.filter(date=day, employee_id__in=ids)}
        defaults = dict(Employee.objects.filter(pk__in=ids).values_list('id', 'shift_id'))
        names = dict(Employee.objects.filter(pk__in=ids).values_list('id', 'full_name'))
        saved, problems = [], []
        with transaction.atomic():
            for record in records:
                current = existing.get(record['employee'])
                data = {**record, 'date': str(day)}
                if shift:
                    data['shift'] = shift
                elif 'shift' not in data and current is None:
                    data['shift'] = defaults.get(record['employee'])
                serializer = self.get_serializer(current, data=data, partial=current is not None)
                if not serializer.is_valid():
                    who = names.get(record['employee'], f'Employee {record["employee"]}')
                    problems += [f'{who}: {message}' for messages in serializer.errors.values() for message in messages]
                    continue
                if current is None:
                    item = serializer.save(recorded_by=request.user)
                    self._log(AuditLog.ACTION_CREATE, item)
                else:
                    before = self.snapshot(current)
                    item = serializer.save()
                    self.log_change(item, before)
                saved.append(item.pk)
            if problems:
                raise ValidationError({'records': problems})
        return Response(self.get_serializer(self.get_queryset().filter(pk__in=saved), many=True).data)


class LeaveRequestViewSet(AuditedModelMixin, viewsets.ModelViewSet):
    serializer_class = LeaveRequestSerializer
    permission_classes = ADMIN_ONLY

    def get_queryset(self):
        qs = LeaveRequest.objects.select_related('employee__department', 'decided_by')
        params = self.request.query_params
        if s := params.get('status'):
            qs = qs.filter(status=s)
        if employee := params.get('employee'):
            qs = qs.filter(employee_id=employee)
        return qs

    def _decide(self, request, approve):
        leave = self.get_object()
        before = self.snapshot(leave)
        services.decide_leave(leave, request.user, approve, str(request.data.get('note', '')))
        self.log_change(leave, before)
        return Response(self.get_serializer(leave).data)

    @extend_schema(request=note_request, responses=LeaveRequestSerializer)
    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        return self._decide(request, True)

    @extend_schema(request=note_request, responses=LeaveRequestSerializer)
    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        return self._decide(request, False)


class TaskViewSet(AuditedModelMixin, viewsets.ModelViewSet):
    serializer_class = TaskSerializer
    permission_classes = ADMIN_ONLY

    def get_queryset(self):
        qs = TaskAssignment.objects.select_related('employee', 'assigned_by')
        params = self.request.query_params
        if s := params.get('status'):
            qs = qs.filter(status=s)
        if employee := params.get('employee'):
            qs = qs.filter(employee_id=employee)
        if area := params.get('area'):
            qs = qs.filter(area=area)
        return filter_by_date_params(qs, params, 'date')

    def perform_create(self, serializer):
        return super().perform_create(serializer, assigned_by=self.request.user)


class WorkforceSummaryView(APIView):
    """Figures for the Workforce dashboard: headcount, today's attendance, leave and hours this month."""
    permission_classes = ADMIN_ONLY

    @extend_schema(responses=OpenApiTypes.OBJECT)
    def get(self, request):
        return Response(services.summary())


class ProductivityView(APIView):
    """Attendance and finished work per employee for a period (the DateFilter params)."""
    permission_classes = ADMIN_ONLY

    @extend_schema(responses=OpenApiTypes.OBJECT)
    def get(self, request):
        return Response(services.productivity(request.query_params))
