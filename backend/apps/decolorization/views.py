# decolorization/views.py
import logging

from django.db import transaction
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema
from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from django.utils import timezone
from apps.audit.middleware import AuditedModelMixin
from .models import ChemicalStock, Tank, ChemicalIssuance, DecolorizationSession
from .serializers import (
    ChemicalStockSerializer, TankSerializer,
    ChemicalIssuanceSerializer, DecolorizationSessionSerializer,
)
from apps.core.permissions import IsDecolorizationOrAdmin
from apps.core.quantities import parse_kg, check_not_more_than_input
from apps.notifications.tasks import alert_if_chemical_became_low

logger = logging.getLogger(__name__)


class ChemicalStockViewSet(AuditedModelMixin, viewsets.ModelViewSet):
    queryset = ChemicalStock.objects.all().order_by('chemical_name')
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
        if 'issued_by' in serializer.validated_data:
            issuance = super().perform_create(serializer)
        else:
            issuance = super().perform_create(serializer, issued_by=self.request.user)
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
    queryset = DecolorizationSession.objects.select_related('tank', 'fabric', 'supervisor').order_by('-start_date')
    serializer_class = DecolorizationSessionSerializer
    permission_classes = [IsAuthenticated, IsDecolorizationOrAdmin]

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