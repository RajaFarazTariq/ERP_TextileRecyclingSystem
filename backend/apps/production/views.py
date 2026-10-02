from collections import defaultdict
from decimal import Decimal

from django.utils import timezone
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import mixins, permissions, serializers, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.audit.middleware import AuditedModelMixin
from apps.audit.models import AuditLog, log_action
from apps.core.filters import filter_by_date_params
from apps.core.permissions import ALL_ROLES, get_role, has_duty
from apps.core.quantities import parse_kg
from apps.decolorization.models import DecolorizationSession
from apps.drying.models import DryingSession
from apps.sorting.models import SortingSession
from . import services
from .models import BillOfMaterials, MaterialUse, OrderStep, ProcessStage, ProductionOrder, Routing
from .serializers import (
    BomSerializer, MaterialUseSerializer, OrderStepSerializer, ProductionOrderSerializer, RoutingSerializer,
    StageSerializer,
)

ZERO = Decimal('0')


class IsAnyRole(permissions.BasePermission):
    """Any logged-in role; the action itself checks who may do it."""

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and get_role(request.user) in ALL_ROLES)


class IsAdminAction(permissions.BasePermission):
    message = 'Your role is not allowed to plan production.'

    def has_permission(self, request, view):
        return has_duty(request.user, 'plan_production')


class IsPlannerForWrites(permissions.BasePermission):
    """Planning data: everyone with the page reads it; planners maintain it."""
    message = 'Your role is not allowed to plan production.'

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        return request.method in ('GET', 'HEAD', 'OPTIONS') or has_duty(request.user, 'plan_production')


# Planning data: everyone reads it, planners maintain it
PLANNING = [IsAuthenticated, IsPlannerForWrites]
ADMIN_ACTION = [IsAuthenticated, IsAdminAction]


class StageViewSet(AuditedModelMixin, viewsets.ModelViewSet):
    queryset = ProcessStage.objects.all()
    serializer_class = StageSerializer
    permission_classes = PLANNING


class RoutingViewSet(AuditedModelMixin, viewsets.ModelViewSet):
    queryset = Routing.objects.prefetch_related('steps__stage', 'orders')
    serializer_class = RoutingSerializer
    permission_classes = PLANNING


class BomViewSet(AuditedModelMixin, viewsets.ModelViewSet):
    queryset = BillOfMaterials.objects.prefetch_related('lines__chemical', 'orders')
    serializer_class = BomSerializer
    permission_classes = PLANNING


def _orders():
    return (ProductionOrder.objects
            .select_related('fabric', 'unit', 'routing', 'bom', 'created_by', 'released_by')
            .prefetch_related('steps__stage', 'steps__operator', 'steps__order', 'materials__chemical'))


class ProductionOrderViewSet(AuditedModelMixin, viewsets.ModelViewSet):
    serializer_class = ProductionOrderSerializer
    permission_classes = PLANNING

    def get_queryset(self):
        qs = _orders()
        params = self.request.query_params
        if s := params.get('status'):
            qs = qs.filter(status__in=s.split(','))
        if fabric := params.get('fabric'):
            qs = qs.filter(fabric_id=fabric)
        return filter_by_date_params(qs, params, 'planned_start')

    def perform_create(self, serializer):
        return super().perform_create(serializer, created_by=self.request.user)

    def perform_destroy(self, instance):
        if instance.status not in ('Draft', 'Cancelled'):
            raise serializers.ValidationError({'status': ['Only draft or cancelled orders can be deleted.']})
        return super().perform_destroy(instance)

    def _transition(self, request, fn, *args):
        order = self.get_object()
        old = order.status
        fn(order, *args)
        order.refresh_from_db()
        log_action(request.user, AuditLog.ACTION_UPDATE, order, request=request,
                   changes={'status': {'old': old, 'new': order.status}})
        return Response(self.get_serializer(self.get_queryset().get(pk=order.pk)).data)

    @extend_schema(request=None, responses=ProductionOrderSerializer)
    @action(detail=True, methods=['post'], permission_classes=ADMIN_ACTION)
    def release(self, request, pk=None):
        return self._transition(request, services.release, request.user)

    @extend_schema(request=None, responses=ProductionOrderSerializer)
    @action(detail=True, methods=['post'], permission_classes=ADMIN_ACTION)
    def cancel(self, request, pk=None):
        return self._transition(request, services.cancel)

    @extend_schema(request=inline_serializer('CompleteOrderRequest', {'actual_output_kg': serializers.DecimalField(12, 2, required=False)}),
                   responses=ProductionOrderSerializer)
    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated, IsAnyRole])
    def complete(self, request, pk=None):
        services.check_floor_user(request.user)
        output = parse_kg(request.data, 'actual_output_kg') if request.data.get('actual_output_kg') not in (None, '') else None
        return self._transition(request, services.complete, output)

    @extend_schema(responses=OpenApiTypes.OBJECT)
    @action(detail=True, methods=['get'], permission_classes=[IsAuthenticated, IsAnyRole])
    def activity(self, request, pk=None):
        """Sorting, decolorization and drying sessions of the order's fabric lot."""
        order = self.get_object()
        rows = []
        for s in SortingSession.objects.filter(fabric=order.fabric).select_related('supervisor'):
            rows.append({'module': 'sorting', 'id': s.pk, 'status': s.status, 'supervisor': s.supervisor.username,
                         'input_kg': s.quantity_taken, 'output_kg': s.quantity_sorted, 'waste_kg': s.waste_quantity,
                         'date': s.start_date})
        for s in DecolorizationSession.objects.filter(fabric=order.fabric).select_related('supervisor'):
            rows.append({'module': 'decolorization', 'id': s.pk, 'status': s.status, 'supervisor': s.supervisor.username,
                         'input_kg': s.input_quantity, 'output_kg': s.output_quantity, 'waste_kg': s.waste_quantity,
                         'date': s.start_date})
        for s in DryingSession.objects.filter(fabric=order.fabric).select_related('supervisor'):
            rows.append({'module': 'drying', 'id': s.pk, 'status': s.status, 'supervisor': s.supervisor.username,
                         'input_kg': s.input_quantity, 'output_kg': s.output_quantity, 'waste_kg': s.waste_quantity,
                         'date': s.start_date or s.created_at})
        rows.sort(key=lambda r: r['date'], reverse=True)
        return Response(rows)


class OrderStepViewSet(AuditedModelMixin, mixins.ListModelMixin, mixins.RetrieveModelMixin,
                       mixins.UpdateModelMixin, viewsets.GenericViewSet):
    """Steps are created with their order. Supervisors start and complete them; admins assign and skip."""
    serializer_class = OrderStepSerializer
    permission_classes = [IsAuthenticated, IsAnyRole]

    def get_queryset(self):
        qs = OrderStep.objects.select_related('order', 'stage', 'operator')
        params = self.request.query_params
        if order := params.get('order'):
            qs = qs.filter(order_id=order)
        if s := params.get('status'):
            qs = qs.filter(status=s)
        return qs

    def perform_update(self, serializer):
        if not has_duty(self.request.user, 'plan_production'):
            raise PermissionDenied('Only a production planner can change how a step is planned.')
        return super().perform_update(serializer)

    def _act(self, request, fn, *args):
        step = self.get_object()
        before = self.snapshot(step)
        fn(step, *args)
        step.refresh_from_db()
        self.log_change(step, before)
        return Response(self.get_serializer(step).data)

    @extend_schema(request=None, responses=OrderStepSerializer)
    @action(detail=True, methods=['post'])
    def start(self, request, pk=None):
        services.check_floor_user(request.user)
        return self._act(request, services.start_step, request.user)

    @extend_schema(request=OpenApiTypes.OBJECT, responses=OrderStepSerializer)
    @action(detail=True, methods=['post'])
    def complete(self, request, pk=None):
        services.check_floor_user(request.user)
        hours = request.data.get('actual_hours')
        return self._act(
            request, services.complete_step,
            parse_kg(request.data, 'input_kg'), parse_kg(request.data, 'output_kg'), parse_kg(request.data, 'waste_kg'),
            parse_kg(request.data, 'actual_hours') if hours not in (None, '') else None,
        )

    @extend_schema(request=None, responses=OrderStepSerializer)
    @action(detail=True, methods=['post'], permission_classes=ADMIN_ACTION)
    def skip(self, request, pk=None):
        return self._act(request, services.skip_step)


class MaterialUseViewSet(AuditedModelMixin, viewsets.ModelViewSet):
    """Planned and actual material use. Supervisors record actual quantities; admins change the plan."""
    serializer_class = MaterialUseSerializer
    permission_classes = [IsAuthenticated, IsAnyRole]

    def get_queryset(self):
        qs = MaterialUse.objects.select_related('order', 'chemical')
        if order := self.request.query_params.get('order'):
            qs = qs.filter(order_id=order)
        return qs

    def perform_destroy(self, instance):
        if not has_duty(self.request.user, 'plan_production'):
            raise PermissionDenied('Only a production planner can change the planned materials.')
        return super().perform_destroy(instance)


class RequirementsView(APIView):
    """Material requirement planning: what open orders still need, against chemical stock."""
    permission_classes = [IsAuthenticated, IsAnyRole]

    @extend_schema(responses=OpenApiTypes.OBJECT)
    def get(self, request):
        rows = {}
        uses = (MaterialUse.objects.filter(order__status__in=ProductionOrder.OPEN_STATUSES)
                .select_related('order', 'chemical'))
        for use in uses:
            key = f'c{use.chemical_id}' if use.chemical_id else f'm{use.material.strip().casefold()}|{use.unit}'
            row = rows.setdefault(key, {
                'material': use.chemical.chemical_name if use.chemical_id else use.material,
                'chemical': use.chemical_id, 'unit': use.chemical.unit_of_measure if use.chemical_id else use.unit,
                'required': ZERO, 'in_stock': use.chemical.remaining_stock if use.chemical_id else None, 'orders': [],
            })
            # What is still to be used: the plan, less what has been recorded
            row['required'] += max(use.planned_quantity - (use.actual_quantity or ZERO), ZERO)
            if use.order.number not in row['orders']:
                row['orders'].append(use.order.number)
        result = []
        for row in rows.values():
            row['shortage'] = max(row['required'] - row['in_stock'], ZERO) if row['in_stock'] is not None else None
            result.append(row)
        result.sort(key=lambda r: (not r['shortage'], r['material'].casefold()))
        return Response(result)


class ProductionSummaryView(APIView):
    """Figures for the Production dashboard and its performance report."""
    permission_classes = [IsAuthenticated, IsAnyRole]

    @extend_schema(responses=OpenApiTypes.OBJECT)
    def get(self, request):
        today = timezone.localdate()
        orders = list(_orders())
        by_status = defaultdict(int)
        stages = {}
        finished = []
        wip_kg = ZERO
        late = 0
        for order in orders:
            by_status[order.status] += 1
            f = services.figures(order)
            late += int(f['is_late'])
            if order.status == 'In Progress':
                wip_kg += f['actual_input_kg'] or order.planned_input_kg
            if order.status == 'Completed':
                finished.append((order, f))
            for step in order.steps.all():
                if step.status != 'Done':
                    continue
                row = stages.setdefault(step.stage_id, {
                    'stage': step.stage.name, 'steps': 0, 'planned_hours': ZERO, 'actual_hours': ZERO,
                    'input_kg': ZERO, 'output_kg': ZERO, 'waste_kg': ZERO})
                row['steps'] += 1
                row['planned_hours'] += step.planned_hours
                row['actual_hours'] += step.actual_hours or ZERO
                row['input_kg'] += step.input_kg or ZERO
                row['output_kg'] += step.output_kg or ZERO
                row['waste_kg'] += step.waste_kg or ZERO

        month = [(o, f) for o, f in finished if o.completed_at and timezone.localdate(o.completed_at) >= today.replace(day=1)]
        total_in = sum((f['actual_input_kg'] or ZERO for _, f in finished), ZERO)
        total_out = sum((f['output_kg'] or ZERO for _, f in finished), ZERO)
        total_cost = sum((f['total_cost'] for _, f in finished), ZERO)
        return Response({
            'draft': by_status['Draft'],
            'released': by_status['Released'],
            'in_progress': by_status['In Progress'],
            'completed': by_status['Completed'],
            'late': late,
            'wip_kg': wip_kg,
            'completed_this_month': len(month),
            'output_this_month': sum((f['output_kg'] or ZERO for _, f in month), ZERO),
            'planned_output_completed': sum((o.planned_output_kg for o, _ in finished), ZERO),
            'actual_output_completed': total_out,
            'yield_pct': round(float(total_out / total_in * 100), 1) if total_in else None,
            'waste_kg': sum((f['waste_kg'] for _, f in finished), ZERO),
            'planned_cost_completed': sum((f['planned_cost'] for _, f in finished), ZERO),
            'actual_cost_completed': total_cost,
            'cost_per_kg': (total_cost / total_out).quantize(Decimal('0.01')) if total_out else None,
            'stages': list(stages.values()),
        })
