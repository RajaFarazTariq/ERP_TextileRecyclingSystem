from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from .models import Vendor, FactoryUnit, Stock
from .serializers import VendorSerializer, FactoryUnitSerializer, StockSerializer
from .permissions import IsWarehouseSupervisor


class VendorViewSet(viewsets.ModelViewSet):
    queryset = Vendor.objects.all().order_by('-created_at')
    serializer_class = VendorSerializer
    permission_classes = [IsAuthenticated, IsWarehouseSupervisor]


class FactoryUnitViewSet(viewsets.ModelViewSet):
    queryset = FactoryUnit.objects.all()
    serializer_class = FactoryUnitSerializer
    permission_classes = [IsAuthenticated, IsWarehouseSupervisor]


class StockViewSet(viewsets.ModelViewSet):
    queryset = Stock.objects.all().order_by('-created_at')
    serializer_class = StockSerializer
    permission_classes = [IsAuthenticated, IsWarehouseSupervisor]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(
                {
                    "message": "Stock added successfully!",
                    "data": serializer.data
                },
                status=status.HTTP_201_CREATED
            )
        return Response(
            serializer.errors,
            status=status.HTTP_400_BAD_REQUEST
        )

    def get_queryset(self):
        queryset = Stock.objects.all().order_by('-created_at')
        status_filter = self.request.query_params.get('status')
        vendor = self.request.query_params.get('vendor')
        unit = self.request.query_params.get('unit')

        if status_filter:
            queryset = queryset.filter(status=status_filter)
        if vendor:
            queryset = queryset.filter(vendor__id=vendor)
        if unit:
            queryset = queryset.filter(unit__id=unit)

        return queryset