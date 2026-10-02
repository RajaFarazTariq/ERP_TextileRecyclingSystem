from datetime import timedelta
from decimal import Decimal

from django.db import transaction
from django.utils import timezone
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import mixins, permissions, serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.audit.middleware import AuditedModelMixin
from apps.audit.models import AuditLog
from apps.core.permissions import ALL_ROLES, SharedReadPermission, get_role, is_admin
from . import services
from .models import Machine, MaintenanceSchedule, PartUse, SparePart, WorkOrder
from .serializers import (
    MachineSerializer, PartUseSerializer, ScheduleSerializer, SparePartSerializer, WorkOrderSerializer,
)


class IsMaintenanceUser(permissions.BasePermission):
    """Every role reads, reports problems and records work; deleting is for admins."""
    message = 'Only an admin can delete maintenance records.'

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated or get_role(request.user) not in ALL_ROLES:
            return False
        return request.method != 'DELETE' or is_admin(request.user)


class IsAdminAction(permissions.BasePermission):
    message = 'Only an admin can do this.'

    def has_permission(self, request, view):
        return is_admin(request.user)


complete_request = inline_serializer('WorkOrderCompleteRequest', {
    'work_done': serializers.CharField(),
    'downtime_minutes': serializers.IntegerField(required=False),
    'labour_hours': serializers.DecimalField(max_digits=8, decimal_places=2, required=False),
    'labour_cost': serializers.DecimalField(max_digits=14, decimal_places=2, required=False),
    'other_cost': serializers.DecimalField(max_digits=14, decimal_places=2, required=False),
})
receive_request = inline_serializer('SparePartReceiveRequest', {
    'quantity': serializers.DecimalField(max_digits=12, decimal_places=2),
    'unit_cost': serializers.DecimalField(max_digits=14, decimal_places=2, required=False),
})


class MachineViewSet(AuditedModelMixin, viewsets.ModelViewSet):
    """The machine register. Everyone reads it; admins maintain it."""
    serializer_class = MachineSerializer
    permission_classes = [IsAuthenticated, SharedReadPermission]

    def get_queryset(self):
        qs = Machine.objects.select_related('tank', 'dryer').prefetch_related('work_orders')
        if s := self.request.query_params.get('status'):
            qs = qs.filter(status=s)
        return qs


class ScheduleViewSet(AuditedModelMixin, viewsets.ModelViewSet):
    serializer_class = ScheduleSerializer
    permission_classes = [IsAuthenticated, SharedReadPermission]

    def get_queryset(self):
        qs = MaintenanceSchedule.objects.select_related('machine').prefetch_related('work_orders')
        if machine := self.request.query_params.get('machine'):
            qs = qs.filter(machine_id=machine)
        return qs

    @extend_schema(request=None, responses=WorkOrderSerializer)
    @action(detail=True, methods=['post'], url_path='create-work-order')
    def create_work_order(self, request, pk=None):
        """Raise the preventive work order for this schedule."""
        order = services.create_preventive(self.get_object(), request.user)
        self._log(AuditLog.ACTION_CREATE, order)
        return Response(WorkOrderSerializer(order, context=self.get_serializer_context()).data,
                        status=status.HTTP_201_CREATED)


def _work_orders():
    return (WorkOrder.objects.select_related('machine', 'schedule', 'reported_by', 'assigned_to')
            .prefetch_related('parts__part', 'parts__used_by', 'parts__work_order'))


class WorkOrderViewSet(AuditedModelMixin, viewsets.ModelViewSet):
    serializer_class = WorkOrderSerializer
    permission_classes = [IsAuthenticated, IsMaintenanceUser]

    def get_queryset(self):
        qs = _work_orders()
        params = self.request.query_params
        if s := params.get('status'):
            qs = qs.filter(status=s)
        if kind := params.get('kind'):
            qs = qs.filter(kind=kind)
        if machine := params.get('machine'):
            qs = qs.filter(machine_id=machine)
        return qs

    def perform_create(self, serializer):
        with transaction.atomic():
            order = super().perform_create(serializer, reported_by=self.request.user)
            services.refresh_machine(order.machine)
        return order

    def perform_update(self, serializer):
        with transaction.atomic():
            before = serializer.instance.machine
            order = super().perform_update(serializer)
            services.refresh_machine(order.machine)
            if before.pk != order.machine_id:
                services.refresh_machine(before)
        return order

    def perform_destroy(self, instance):
        with transaction.atomic():
            machine = instance.machine
            super().perform_destroy(instance)
            services.refresh_machine(machine)

    def _step(self, request, change):
        order = self.get_object()
        before = self.snapshot(order)
        change(order)
        self.log_change(order, before)
        return Response(self.get_serializer(self.get_queryset().get(pk=order.pk)).data)

    @extend_schema(request=None, responses=WorkOrderSerializer)
    @action(detail=True, methods=['post'])
    def start(self, request, pk=None):
        return self._step(request, lambda order: services.start(order, request.user))

    @extend_schema(request=complete_request, responses=WorkOrderSerializer)
    @action(detail=True, methods=['post'])
    def complete(self, request, pk=None):
        return self._step(request, lambda order: services.complete(order, request.user, request.data))

    @extend_schema(request=None, responses=WorkOrderSerializer)
    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated, IsAdminAction])
    def cancel(self, request, pk=None):
        return self._step(request, services.cancel)


class SparePartViewSet(AuditedModelMixin, viewsets.ModelViewSet):
    serializer_class = SparePartSerializer
    permission_classes = [IsAuthenticated, SharedReadPermission]
    queryset = SparePart.objects.all()

    @extend_schema(request=receive_request, responses=SparePartSerializer)
    @action(detail=True, methods=['post'])
    def receive(self, request, pk=None):
        """Add received stock to the part."""
        part = self.get_object()
        before = self.snapshot(part)
        part = services.receive(part, request.data)
        self.log_change(part, before)
        return Response(self.get_serializer(part).data)


class PartUseViewSet(AuditedModelMixin, mixins.CreateModelMixin, mixins.DestroyModelMixin,
                     mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    """Parts taken for a work order. A use is removed and entered again rather than edited."""
    serializer_class = PartUseSerializer
    permission_classes = [IsAuthenticated, IsMaintenanceUser]

    def get_queryset(self):
        qs = PartUse.objects.select_related('work_order', 'part', 'used_by')
        if order := self.request.query_params.get('work_order'):
            qs = qs.filter(work_order_id=order)
        return qs

    def perform_destroy(self, instance):
        with transaction.atomic():
            self._log(AuditLog.ACTION_DELETE, instance)
            services.return_part(instance)


class MaintenanceSummaryView(APIView):
    """Figures for the Maintenance dashboard."""
    permission_classes = [IsAuthenticated, IsMaintenanceUser]

    @extend_schema(responses=OpenApiTypes.OBJECT)
    def get(self, request):
        today = timezone.localdate()
        machines = {s: 0 for s, _ in Machine.STATUS_CHOICES}
        for s in Machine.objects.values_list('status', flat=True):
            machines[s] += 1

        active = WorkOrder.objects.exclude(status__in=WorkOrder.CLOSED)
        month = list(services.orders_between(today.replace(day=1), today).prefetch_related('parts'))
        overdue = (MaintenanceSchedule.objects.filter(is_active=True, next_due_on__lt=today)
                   .select_related('machine'))
        parts = [p for p in SparePart.objects.all() if p.low]
        return Response({
            'machines': sum(machines.values()),
            'machines_by_status': [{'status': s, 'count': n} for s, n in machines.items()],
            'open_work_orders': active.filter(status='Open').count(),
            'in_progress_work_orders': active.filter(status='In progress').count(),
            'urgent_work_orders': active.filter(priority='Urgent').count(),
            'overdue_schedules': [{
                'id': s.pk, 'task': s.task, 'machine_code': s.machine.code, 'machine_name': s.machine.name,
                'next_due_on': s.next_due_on.isoformat(), 'days_overdue': (today - s.next_due_on).days,
            } for s in overdue],
            'due_this_week': MaintenanceSchedule.objects.filter(
                is_active=True, next_due_on__gte=today, next_due_on__lte=today + timedelta(days=7)).count(),
            'breakdowns_this_month': sum(1 for o in month if o.is_breakdown),
            'downtime_hours_this_month': services.fixed(Decimal(sum(o.downtime_minutes for o in month)) / 60),
            'cost_this_month': services.fixed(sum((o.total_cost for o in month), Decimal('0'))),
            'low_parts': [{
                'id': p.pk, 'code': p.code, 'name': p.name, 'unit': p.unit,
                'stock_quantity': services.fixed(p.stock_quantity), 'reorder_level': services.fixed(p.reorder_level),
            } for p in parts],
        })


class PerformanceView(APIView):
    """Breakdowns, downtime, cost and availability per machine over a period."""
    permission_classes = [IsAuthenticated, IsMaintenanceUser]

    @extend_schema(responses=OpenApiTypes.OBJECT)
    def get(self, request):
        return Response(services.performance(request.query_params))
