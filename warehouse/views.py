# warehouse/views.py
from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from datetime import date, timedelta

from .models import Vendor, FactoryUnit, Stock
from .serializers import VendorSerializer, FactoryUnitSerializer, StockSerializer

try:
    from core.permissions import IsWarehouseOrAdmin
except ImportError:
    # Fallback if core app not set up yet
    from rest_framework.permissions import IsAuthenticated as IsWarehouseOrAdmin


class VendorViewSet(viewsets.ModelViewSet):
    queryset = Vendor.objects.all().order_by('-created_at')
    serializer_class = VendorSerializer
    permission_classes = [IsAuthenticated, IsWarehouseOrAdmin]


class FactoryUnitViewSet(viewsets.ModelViewSet):
    queryset = FactoryUnit.objects.all()
    serializer_class = FactoryUnitSerializer
    permission_classes = [IsAuthenticated, IsWarehouseOrAdmin]


class StockViewSet(viewsets.ModelViewSet):
    queryset = Stock.objects.all().order_by('-created_at')
    serializer_class = StockSerializer
    permission_classes = [IsAuthenticated, IsWarehouseOrAdmin]

    def get_queryset(self):
        qs = Stock.objects.all().order_by('-created_at')

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

        # ── Date filters (new — used by DateFilter component on frontend) ────
        # ?date_filter=today | this_week | this_month | this_year
        # ?year=2025
        # ?month=2025-03  (YYYY-MM)
        # ?start=2025-01-01&end=2025-03-31
        today       = date.today()
        date_filter = self.request.query_params.get('date_filter')

        if date_filter == 'today':
            qs = qs.filter(created_at__date=today)
        elif date_filter == 'this_week':
            week_start = today - timedelta(days=today.weekday())
            qs = qs.filter(created_at__date__gte=week_start)
        elif date_filter == 'this_month':
            qs = qs.filter(created_at__year=today.year, created_at__month=today.month)
        elif date_filter == 'this_year':
            qs = qs.filter(created_at__year=today.year)

        if yr := self.request.query_params.get('year'):
            try:
                qs = qs.filter(created_at__year=int(yr))
            except ValueError:
                pass

        if mo := self.request.query_params.get('month'):
            try:
                y, m = mo.split('-')
                qs = qs.filter(created_at__year=int(y), created_at__month=int(m))
            except (ValueError, AttributeError):
                pass

        if st := self.request.query_params.get('start'):
            try:
                qs = qs.filter(created_at__date__gte=date.fromisoformat(st))
            except ValueError:
                pass

        if en := self.request.query_params.get('end'):
            try:
                qs = qs.filter(created_at__date__lte=date.fromisoformat(en))
            except ValueError:
                pass

        return qs

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(
                {'message': 'Stock added successfully!', 'data': serializer.data},
                status=status.HTTP_201_CREATED,
            )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)