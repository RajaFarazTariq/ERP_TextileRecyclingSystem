# decolorization/views.py
from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from django.utils import timezone

from .models import ChemicalStock, Tank, ChemicalIssuance, DecolorizationSession
from .serializers import (
    ChemicalStockSerializer, TankSerializer,
    ChemicalIssuanceSerializer, DecolorizationSessionSerializer,
)
from core.permissions import IsDecolorizationOrAdmin


class ChemicalStockViewSet(viewsets.ModelViewSet):
    queryset = ChemicalStock.objects.all().order_by('chemical_name')
    serializer_class = ChemicalStockSerializer
    permission_classes = [IsAuthenticated, IsDecolorizationOrAdmin]

    @action(detail=False, methods=['get'])
    def low_stock(self, request):
        low = ChemicalStock.objects.filter(remaining_stock__lt=50)
        serializer = self.get_serializer(low, many=True)
        return Response(serializer.data)


class TankViewSet(viewsets.ModelViewSet):
    queryset = Tank.objects.all().order_by('name')
    serializer_class = TankSerializer
    permission_classes = [IsAuthenticated, IsDecolorizationOrAdmin]

    def get_queryset(self):
        queryset = Tank.objects.all().order_by('name')
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
        serializer.save(fabric_quantity=fabric_qty)

    def perform_update(self, serializer):
        """Same mapping on update."""
        data = self.request.data
        fabric_qty = data.get('fabric_quantity') or data.get('current_load')
        if fabric_qty is not None:
            serializer.save(fabric_quantity=fabric_qty)
        else:
            serializer.save()

    @action(detail=True, methods=['post'])
    def complete(self, request, pk=None):
        tank = self.get_object()
        tank.tank_status = 'Completed'
        tank.actual_completion = timezone.now()
        tank.save()
        return Response(
            {'message': f'Tank {tank.name} marked as completed.'},
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=['post'])
    def start(self, request, pk=None):
        tank = self.get_object()
        tank.tank_status = 'Processing'
        tank.start_date = timezone.now()
        tank.save()
        return Response(
            {'message': f'Tank {tank.name} processing started.'},
            status=status.HTTP_200_OK,
        )


class ChemicalIssuanceViewSet(viewsets.ModelViewSet):
    queryset = ChemicalIssuance.objects.all().order_by('-issued_at')
    serializer_class = ChemicalIssuanceSerializer
    permission_classes = [IsAuthenticated, IsDecolorizationOrAdmin]

    def perform_create(self, serializer):
        issuance = serializer.save()
        # Deduct from chemical stock automatically
        chemical = issuance.chemical
        chemical.issued_quantity += issuance.quantity
        chemical.remaining_stock -= issuance.quantity
        chemical.save()


class DecolorizationSessionViewSet(viewsets.ModelViewSet):
    queryset = DecolorizationSession.objects.all().order_by('-start_date')
    serializer_class = DecolorizationSessionSerializer
    permission_classes = [IsAuthenticated, IsDecolorizationOrAdmin]

    @action(detail=True, methods=['post'])
    def complete(self, request, pk=None):
        session = self.get_object()
        if session.status == 'Completed':
            return Response(
                {'message': 'Session already completed.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        output_quantity = request.data.get('output_quantity', 0)
        waste_quantity  = request.data.get('waste_quantity',  0)

        session.output_quantity = output_quantity
        session.waste_quantity  = waste_quantity
        session.status          = 'Completed'
        session.end_date        = timezone.now()
        session.save()

        # Update tank status
        tank = session.tank
        tank.tank_status       = 'Completed'
        tank.actual_completion = timezone.now()
        tank.save()

        # Update fabric status
        fabric = session.fabric
        fabric.status = 'Sent to Decolorization'
        fabric.save()

        return Response(
            {'message': 'Decolorization session completed successfully.'},
            status=status.HTTP_200_OK,
        )


# ─────────────────────────────────────────────────────────────────────────────
# Fabric stock list — for decolorization forms (tank & session dropdowns).
# Uses IsDecolorizationSupervisor so decolor_user doesn't need sorting
# permissions. Returns only the fields the dropdowns need.
# ─────────────────────────────────────────────────────────────────────────────
@api_view(['GET'])
@permission_classes([IsAuthenticated, IsDecolorizationOrAdmin])
def fabric_stock_for_decolor(request):
    """
    Lightweight fabric stock list for tank/session dropdowns.
    Accessible by decolorization_supervisor without needing sorting permissions.
    """
    from sorting.models import FabricStock
    fabrics = FabricStock.objects.values('id', 'material_type', 'status')
    return Response(list(fabrics))