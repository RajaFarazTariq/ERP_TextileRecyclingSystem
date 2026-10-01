# inventory/views.py
from drf_spectacular.utils import extend_schema
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.audit.models import AuditLog, log_action
from apps.core.permissions import IsAdminUser, SharedReadPermission
from apps.sorting.models import FabricStock
from . import services
from .models import StockMovement
from .serializers import (
    AdjustmentSerializer, FabricAvailabilitySerializer, StockMovementSerializer,
)


class StockMovementViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Dried-stock ledger. Readable by every role.
    Filters: ?fabric=<id>, ?movement_type=DRYING_OUTPUT|DISPATCH|ADJUSTMENT
    """
    serializer_class   = StockMovementSerializer
    permission_classes = [IsAuthenticated, SharedReadPermission]

    def get_queryset(self):
        qs = StockMovement.objects.select_related('fabric', 'created_by')
        if fabric := self.request.query_params.get('fabric'):
            qs = qs.filter(fabric_id=fabric)
        if kind := self.request.query_params.get('movement_type'):
            qs = qs.filter(movement_type=kind)
        return qs

    @extend_schema(request=AdjustmentSerializer, responses=StockMovementSerializer)
    @action(detail=False, methods=['post'], permission_classes=[IsAuthenticated, IsAdminUser])
    def adjust(self, request):
        """Admin-only manual correction with a required reason."""
        data = AdjustmentSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        movement = services.post_adjustment(
            data.validated_data['fabric'], data.validated_data['quantity'],
            data.validated_data['note'], request.user,
        )
        log_action(request.user, AuditLog.ACTION_CREATE, movement, request=request,
                   changes={'quantity': {'old': None, 'new': float(movement.quantity)},
                            'note': {'old': None, 'new': movement.note}})
        return Response(StockMovementSerializer(movement).data, status=status.HTTP_201_CREATED)

    @extend_schema(responses=FabricAvailabilitySerializer(many=True))
    @action(detail=False, methods=['get'])
    def stock(self, request):
        """On-hand, reserved and available dried kg per fabric lot (lots with any activity)."""
        figures = services.availability_map()
        names = dict(FabricStock.objects.filter(pk__in=figures).values_list('pk', 'material_type'))
        rows = [
            {'fabric': f, 'material_type': names.get(f, ''), 'on_hand_kg': v['on_hand'],
             'reserved_kg': v['reserved'], 'available_kg': v['available']}
            for f, v in sorted(figures.items())
        ]
        return Response(FabricAvailabilitySerializer(rows, many=True).data)
