# decolorization/views.py
import logging

from django.db import transaction
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema
from decimal import Decimal

from rest_framework import serializers, viewsets, status
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView
from django.utils import timezone
from apps.audit.middleware import AuditedModelMixin
from .models import ChemicalIssuance, ChemicalLot, ChemicalStock, DecolorizationSession, Recipe, Tank
from .serializers import (
    ChemicalStockSerializer, TankSerializer,
    ChemicalIssuanceSerializer, DecolorizationSessionSerializer,
    ChemicalLotSerializer, RecipeSerializer,
)
from apps.core.filters import filter_by_date_params
from apps.core.permissions import has_duty, IsDecolorizationOrAdmin
from apps.core.quantities import parse_kg, check_not_more_than_input
from apps.notifications.tasks import alert_if_chemical_became_low

logger = logging.getLogger(__name__)

ZERO = Decimal('0')


def _fixed(value):
    return f'{value:.2f}'


class ChemicalStockViewSet(AuditedModelMixin, viewsets.ModelViewSet):
    queryset = ChemicalStock.objects.select_related('supplier').order_by('chemical_name')
    serializer_class = ChemicalStockSerializer
    permission_classes = [IsAuthenticated, IsDecolorizationOrAdmin]

    @action(detail=False, methods=['get'])
    def low_stock(self, request):
        low = ChemicalStock.objects.filter(remaining_stock__lt=50)
        serializer = self.get_serializer(low, many=True)
        return Response(serializer.data)


class TankViewSet(AuditedModelMixin, viewsets.ModelViewSet):
    queryset = Tank.objects.all().order_by('name')
    serializer_class = TankSerializer
    permission_classes = [IsAuthenticated, IsDecolorizationOrAdmin]

    def get_queryset(self):
        queryset = Tank.objects.select_related('fabric', 'supervisor').order_by('name')
        status_filter = self.request.query_params.get('status')
        if status_filter:
            queryset = queryset.filter(tank_status=status_filter)
        return queryset

    def perform_create(self, serializer):
        """
        The frontend form sends 'current_load' but the model field is
        'fabric_quantity'. Map it here so both names are accepted.
        """
        data = self.request.data
        # If current_load is provided but fabric_quantity is not, copy it over
        fabric_qty = data.get('fabric_quantity') or data.get('current_load') or 0
        super().perform_create(serializer, fabric_quantity=fabric_qty)

    def perform_update(self, serializer):
        """Same mapping on update."""
        data = self.request.data
        fabric_qty = data.get('fabric_quantity') or data.get('current_load')
        if fabric_qty is not None:
            super().perform_update(serializer, fabric_quantity=fabric_qty)
        else:
            super().perform_update(serializer)

    @action(detail=True, methods=['post'])
    def complete(self, request, pk=None):
        tank = self.get_object()
        before = self.snapshot(tank)
        tank.tank_status = 'Completed'
        tank.actual_completion = timezone.now()
        tank.save()
        self.log_change(tank, before)
        return Response(
            {'message': f'Tank {tank.name} marked as completed.'},
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=['post'])
    def start(self, request, pk=None):
        tank = self.get_object()
        before = self.snapshot(tank)
        tank.tank_status = 'Processing'
        tank.start_date = timezone.now()
        tank.save()
        self.log_change(tank, before)
        return Response(
            {'message': f'Tank {tank.name} processing started.'},
            status=status.HTTP_200_OK,
        )


class ChemicalIssuanceViewSet(AuditedModelMixin, viewsets.ModelViewSet):
    queryset = ChemicalIssuance.objects.select_related('chemical', 'tank', 'issued_by').order_by('-issued_at')
    serializer_class = ChemicalIssuanceSerializer
    permission_classes = [IsAuthenticated, IsDecolorizationOrAdmin]

    def perform_create(self, serializer):
        data = serializer.validated_data
        extra = {'unit_cost': data['chemical'].unit_cost}
        if 'issued_by' not in data:
            extra['issued_by'] = self.request.user
        if data.get('session') is None:
            # Link to the batch in the tank when there is exactly one running
            running = list(DecolorizationSession.objects.filter(tank=data['tank'], status='In Progress')[:2])
            if len(running) == 1:
                extra['session'] = running[0]
        issuance = super().perform_create(serializer, **extra)
        # Deduct from chemical stock automatically
        chemical = ChemicalStock.objects.select_for_update().get(pk=issuance.chemical_id)
        before = self.snapshot(chemical)
        chemical.issued_quantity += issuance.quantity
        chemical.remaining_stock -= issuance.quantity
        chemical.save()
        self.log_change(chemical, before)

        self._alert(chemical, before)

    def perform_update(self, serializer):
        old = serializer.instance
        old_chemical_id, old_quantity = old.chemical_id, old.quantity
        new_chemical = serializer.validated_data.get('chemical')
        if new_chemical is not None and new_chemical.pk != old_chemical_id:
            issuance = super().perform_update(serializer, unit_cost=new_chemical.unit_cost)
        else:
            issuance = super().perform_update(serializer)
        # Return the old quantity, then take the new one (the chemical may have changed)
        self._adjust(old_chemical_id, old_quantity)
        chemical = ChemicalStock.objects.get(pk=issuance.chemical_id)
        before = self.snapshot(chemical)
        self._adjust(issuance.chemical_id, -issuance.quantity)
        chemical.refresh_from_db()
        self._alert(chemical, before)

    def perform_destroy(self, instance):
        chemical_id, quantity = instance.chemical_id, instance.quantity
        with transaction.atomic():
            super().perform_destroy(instance)
            self._adjust(chemical_id, quantity)

    def _adjust(self, chemical_id, quantity):
        """Add `quantity` back to remaining stock (negative takes it out)."""
        chemical = ChemicalStock.objects.select_for_update().get(pk=chemical_id)
        before = self.snapshot(chemical)
        chemical.remaining_stock += quantity
        chemical.issued_quantity -= quantity
        chemical.save()
        self.log_change(chemical, before)

    def _alert(self, chemical, before):
        try:
            alert_if_chemical_became_low(chemical, remaining_before=before['remaining_stock'])
        except Exception as e:   # an email failure must not fail the issuance
            logger.error(f"Low-stock alert failed: {e}")

    def create(self, request, *args, **kwargs):
        with transaction.atomic():
            return super().create(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        with transaction.atomic():
            return super().update(request, *args, **kwargs)


class DecolorizationSessionViewSet(AuditedModelMixin, viewsets.ModelViewSet):
    queryset = (DecolorizationSession.objects
                .select_related('tank', 'fabric', 'supervisor', 'recipe_version__recipe', 'approved_by')
                .prefetch_related('issuances').order_by('-start_date'))
    serializer_class = DecolorizationSessionSerializer
    permission_classes = [IsAuthenticated, IsDecolorizationOrAdmin]

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        """An admin signs off the batch record. It doesn't block or change anything else."""
        if not has_duty(request.user, 'approve_batches'):
            raise PermissionDenied('Your role is not allowed to approve a batch.')
        session = self.get_object()
        if session.approved_at:
            return Response({'message': 'This batch is already approved.'}, status=status.HTTP_400_BAD_REQUEST)
        before = self.snapshot(session)
        session.approved_by = request.user
        session.approved_at = timezone.now()
        session.save(update_fields=['approved_by', 'approved_at'])
        self.log_change(session, before)
        return Response(self.get_serializer(session).data)

    @extend_schema(responses=OpenApiTypes.OBJECT)
    @action(detail=True, methods=['get'])
    def consumption(self, request, pk=None):
        """Chemicals planned by the recipe against what was issued to this batch."""
        return Response(consumption(self.get_object()))

    @action(detail=True, methods=['post'])
    @transaction.atomic
    def complete(self, request, pk=None):
        session = self.get_object()
        if session.status == 'Completed':
            return Response(
                {'message': 'Session already completed.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        output_quantity = parse_kg(request.data, 'output_quantity')
        waste_quantity  = parse_kg(request.data, 'waste_quantity')
        check_not_more_than_input(session.input_quantity, output_quantity, waste_quantity)

        session_before = self.snapshot(session)
        session.output_quantity = output_quantity
        session.waste_quantity  = waste_quantity
        session.status          = 'Completed'
        session.end_date        = timezone.now()
        session.save()
        self.log_change(session, session_before)

        # Update tank status
        tank = session.tank
        tank_before = self.snapshot(tank)
        tank.tank_status       = 'Completed'
        tank.actual_completion = timezone.now()
        tank.save()
        self.log_change(tank, tank_before)

        # Update fabric status
        fabric = session.fabric
        fabric_before = self.snapshot(fabric)
        fabric.status = 'Sent to Decolorization'
        fabric.save()
        self.log_change(fabric, fabric_before)

        return Response(
            {'message': 'Decolorization session completed successfully.'},
            status=status.HTTP_200_OK,
        )


# ─────────────────────────────────────────────────────────────────────────────
# Fabric stock list — for decolorization forms (tank & session dropdowns).
# Uses IsDecolorizationSupervisor so decolor_user doesn't need sorting
# permissions. Returns only the fields the dropdowns need.
# ─────────────────────────────────────────────────────────────────────────────
@extend_schema(responses=OpenApiTypes.OBJECT)
@api_view(['GET'])
@permission_classes([IsAuthenticated, IsDecolorizationOrAdmin])
def fabric_stock_for_decolor(request):
    """
    Lightweight fabric stock list for tank/session dropdowns.
    Accessible by decolorization_supervisor without needing sorting permissions.
    """
    from apps.sorting.models import FabricStock
    fabrics = FabricStock.objects.values('id', 'material_type', 'status')
    return Response(list(fabrics))

@extend_schema(responses=OpenApiTypes.OBJECT)
@api_view(['GET'])
@permission_classes([IsAuthenticated, IsDecolorizationOrAdmin])
def suppliers_for_decolor(request):
    """Supplier names for the chemical and lot forms (the supplier list itself belongs to the warehouse)."""
    from apps.warehouse.models import Vendor
    return Response(list(Vendor.objects.order_by('name').values('id', 'name', 'is_active')))


# ─────────────────────────────────────────────────────────────────────────────
# Phase 5: chemical lots, recipes, consumption and usage
# ─────────────────────────────────────────────────────────────────────────────
class ChemicalLotViewSet(AuditedModelMixin, viewsets.ModelViewSet):
    """Receiving a lot adds its quantity to the chemical's stock; deleting it takes the quantity back out."""
    queryset = ChemicalLot.objects.select_related('chemical', 'supplier', 'received_by')
    serializer_class = ChemicalLotSerializer
    permission_classes = [IsAuthenticated, IsDecolorizationOrAdmin]

    def get_queryset(self):
        queryset = super().get_queryset()
        if chemical := self.request.query_params.get('chemical'):
            queryset = queryset.filter(chemical_id=chemical)
        return queryset

    def _move(self, chemical_id, quantity, unit_cost=None):
        chemical = ChemicalStock.objects.select_for_update().get(pk=chemical_id)
        if chemical.remaining_stock + quantity < 0:
            raise serializers.ValidationError(
                f'Only {chemical.remaining_stock:,.2f} {chemical.unit_of_measure} of this chemical is left, '
                f'so part of this lot has already been issued. It can no longer be deleted.'
            )
        before = self.snapshot(chemical)
        chemical.total_stock += quantity
        chemical.remaining_stock += quantity
        if unit_cost:
            chemical.unit_cost = unit_cost
        chemical.save()
        self.log_change(chemical, before)

    @transaction.atomic
    def perform_create(self, serializer):
        lot = super().perform_create(serializer, received_by=self.request.user)
        self._move(lot.chemical_id, lot.quantity, lot.unit_cost)

    @transaction.atomic
    def perform_destroy(self, instance):
        chemical_id, quantity = instance.chemical_id, instance.quantity
        self._move(chemical_id, -quantity)
        super().perform_destroy(instance)


class RecipeViewSet(AuditedModelMixin, viewsets.ModelViewSet):
    queryset = Recipe.objects.prefetch_related('versions__lines__chemical', 'versions__created_by', 'versions__sessions')
    serializer_class = RecipeSerializer
    permission_classes = [IsAuthenticated, IsDecolorizationOrAdmin]


def consumption(session):
    """Planned (recipe x input weight) against issued chemicals for one session."""
    version = session.recipe_version
    factor = session.input_quantity / Decimal('100')
    rows = {}

    def row(chemical):
        return rows.setdefault(chemical.pk, {
            'chemical': chemical.pk, 'chemical_name': chemical.chemical_name, 'unit': chemical.unit_of_measure,
            'planned': ZERO, 'actual': ZERO, 'planned_cost': ZERO, 'actual_cost': ZERO,
        })

    if version is not None:
        for line in version.lines.select_related('chemical'):
            r = row(line.chemical)
            r['planned'] += line.quantity_per_100kg * factor
            r['planned_cost'] += line.quantity_per_100kg * factor * line.chemical.unit_cost
    for issuance in session.issuances.select_related('chemical'):
        r = row(issuance.chemical)
        r['actual'] += issuance.quantity
        r['actual_cost'] += issuance.quantity * issuance.unit_cost

    lines = sorted(rows.values(), key=lambda r: r['chemical_name'])
    planned_cost = sum((r['planned_cost'] for r in lines), ZERO)
    actual_cost = sum((r['actual_cost'] for r in lines), ZERO)
    for r in lines:
        r['variance'] = _fixed(r['actual'] - r['planned'])
        for key in ('planned', 'actual', 'planned_cost', 'actual_cost'):
            r[key] = _fixed(r[key])
    planned_water = (version.water_liters_per_100kg * factor
                     if version is not None and version.water_liters_per_100kg is not None else None)
    return {
        'session': session.pk,
        'recipe': f'{version.recipe.name} v{version.version}' if version else None,
        'input_quantity': _fixed(session.input_quantity),
        'lines': lines,
        'planned_cost': _fixed(planned_cost),
        'actual_cost': _fixed(actual_cost),
        'cost_per_kg': _fixed(actual_cost / session.input_quantity) if session.input_quantity else None,
        'process': {
            'planned_temperature_c': version.temperature_c if version else None,
            'temperature_c': session.temperature_c,
            'planned_duration_minutes': version.duration_minutes if version else None,
            'duration_minutes': session.duration_minutes,
            'planned_water_liters': _fixed(planned_water) if planned_water is not None else None,
            'water_liters': session.water_liters,
        },
    }


class ChemicalUsageView(APIView):
    """Chemical usage and cost for a period (the DateFilter query params apply to the issue date)."""
    permission_classes = [IsAuthenticated, IsDecolorizationOrAdmin]

    @extend_schema(responses=OpenApiTypes.OBJECT)
    def get(self, request):
        issuances = filter_by_date_params(
            ChemicalIssuance.objects.select_related('chemical', 'session'), request.query_params, 'issued_at')
        rows, sessions, total_cost, batch_cost = {}, {}, ZERO, ZERO
        for i in issuances:
            r = rows.setdefault(i.chemical_id, {
                'chemical': i.chemical_id, 'chemical_name': i.chemical.chemical_name,
                'unit': i.chemical.unit_of_measure, 'quantity': ZERO, 'cost': ZERO, 'issuances': 0,
            })
            cost = i.quantity * i.unit_cost
            r['quantity'] += i.quantity
            r['cost'] += cost
            r['issuances'] += 1
            total_cost += cost
            if i.session_id:
                sessions[i.session_id] = i.session.input_quantity
                batch_cost += cost
        chemicals = sorted(rows.values(), key=lambda r: (-r['cost'], r['chemical_name']))
        for r in chemicals:
            r['quantity'], r['cost'] = _fixed(r['quantity']), _fixed(r['cost'])
        treated = sum(sessions.values(), ZERO)
        return Response({
            'chemicals': chemicals,
            'total_cost': _fixed(total_cost),
            'issuances': sum(r['issuances'] for r in chemicals),
            'batches': len(sessions),
            'treated_kg': _fixed(treated),
            # Only issuances tied to a batch count here, so the cost and the weight cover the same work
            'batch_cost': _fixed(batch_cost),
            'cost_per_kg': _fixed(batch_cost / treated) if treated else None,
        })
