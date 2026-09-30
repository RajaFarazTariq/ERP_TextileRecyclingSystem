# sorting/views.py
from decimal import Decimal

from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.core.quantities import parse_kg, check_not_more_than_input

from .models import FabricStock, SortingSession
from .serializers import FabricStockSerializer, SortingSessionSerializer
from apps.core.permissions import IsSortingOrAdmin          # ← central RBAC
from apps.audit.middleware import AuditedModelMixin

class FabricStockViewSet(AuditedModelMixin, viewsets.ModelViewSet):
    queryset = FabricStock.objects.all().order_by('-created_at')
    serializer_class = FabricStockSerializer
    permission_classes = [IsAuthenticated, IsSortingOrAdmin]
    # IsSortingOrAdmin:
    #   GET  → any logged-in role (warehouse, decolor, etc. can read fabric)
    #   POST/PUT/DELETE → sorting_supervisor or admin only

    def get_serializer_context(self):
        # One pass over the ledger for the whole list instead of one per lot
        from apps.inventory.services import availability_map
        context = super().get_serializer_context()
        if self.action == 'list':
            context['availability'] = availability_map()
        return context

    def get_queryset(self):
        queryset = FabricStock.objects.select_related('stock__vendor').order_by('-created_at')
        status_filter = self.request.query_params.get('status')
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        return queryset


class SortingSessionViewSet(AuditedModelMixin, viewsets.ModelViewSet):
    queryset = SortingSession.objects.all().order_by('-start_date')
    serializer_class = SortingSessionSerializer
    permission_classes = [IsAuthenticated, IsSortingOrAdmin]

    def get_queryset(self):
        queryset = SortingSession.objects.select_related('fabric', 'supervisor').order_by('-start_date')
        status_filter = self.request.query_params.get('status')
        unit = self.request.query_params.get('unit')
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        if unit:
            queryset = queryset.filter(unit=unit)
        return queryset

    @action(detail=True, methods=['post'])
    @transaction.atomic
    def complete(self, request, pk=None):
        session = self.get_object()

        if session.status == 'Completed':
            return Response(
                {'message': 'Session already completed.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        quantity_sorted = parse_kg(request.data, 'quantity_sorted')
        waste_quantity  = parse_kg(request.data, 'waste_quantity')
        check_not_more_than_input(session.quantity_taken, quantity_sorted, waste_quantity,
                                  output_field='quantity_sorted')
        processed = quantity_sorted + waste_quantity

        # Lock the lot so two sessions can't process the same kg at once
        fabric = FabricStock.objects.select_for_update().get(pk=session.fabric_id)
        if processed > fabric.remaining_quantity:
            raise ValidationError({'quantity_sorted': [
                f'Only {fabric.remaining_quantity:,.2f} kg of this fabric is left unsorted.'
            ]})

        session_before = self.snapshot(session)
        session.quantity_sorted = quantity_sorted
        session.waste_quantity  = waste_quantity
        session.status          = 'Completed'
        session.end_date        = timezone.now()
        session.save()
        self.log_change(session, session_before)

        # Update fabric stock: sorted and wasted kg both leave the unsorted pool
        fabric_before = self.snapshot(fabric)
        fabric.sorted_quantity    += quantity_sorted
        fabric.remaining_quantity -= processed

        if fabric.remaining_quantity <= Decimal('0'):
            fabric.status = 'Sorted'

        fabric.save()
        self.log_change(fabric, fabric_before)

        return Response(
            {'message': 'Sorting session completed successfully.'},
            status=status.HTTP_200_OK,
        )