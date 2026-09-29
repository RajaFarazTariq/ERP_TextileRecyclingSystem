# warehouse/views.py
from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from .models import Vendor, FactoryUnit, Stock
from .serializers import VendorSerializer, FactoryUnitSerializer, StockSerializer
from apps.audit.middleware import AuditedModelMixin
from apps.core.filters import filter_by_date_params
from apps.core.permissions import IsWarehouseOrAdmin


class VendorViewSet(AuditedModelMixin, viewsets.ModelViewSet):
    queryset = Vendor.objects.all().order_by('-created_at')
    serializer_class = VendorSerializer
    permission_classes = [IsAuthenticated, IsWarehouseOrAdmin]


class FactoryUnitViewSet(AuditedModelMixin, viewsets.ModelViewSet):
    queryset = FactoryUnit.objects.all()
    serializer_class = FactoryUnitSerializer
    permission_classes = [IsAuthenticated, IsWarehouseOrAdmin]


class StockViewSet(AuditedModelMixin, viewsets.ModelViewSet):
    queryset = Stock.objects.all().order_by('-created_at')
    serializer_class = StockSerializer
    permission_classes = [IsAuthenticated, IsWarehouseOrAdmin]

    def get_queryset(self):
        qs = Stock.objects.select_related('vendor', 'unit').order_by('-created_at')

        # ── Existing filters (your original code) ────────────────────────────
        status_filter = self.request.query_params.get('status')
        vendor        = self.request.query_params.get('vendor')
        unit          = self.request.query_params.get('unit')

        if status_filter:
            qs = qs.filter(status=status_filter)
        if vendor:
            qs = qs.filter(vendor__id=vendor)
        if unit:
            qs = qs.filter(unit__id=unit)

        qs = filter_by_date_params(qs, self.request.query_params, 'created_at')

        return qs

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        if serializer.is_valid():
            self.perform_create(serializer)
            return Response(
                {'message': 'Stock added successfully!', 'data': serializer.data},
                status=status.HTTP_201_CREATED,
            )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)