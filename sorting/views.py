from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from django.utils import timezone
from .models import FabricStock, SortingSession
from .serializers import FabricStockSerializer, SortingSessionSerializer
from .permissions import IsSortingSupervisor


class FabricStockViewSet(viewsets.ModelViewSet):
    queryset = FabricStock.objects.all().order_by('-created_at')
    serializer_class = FabricStockSerializer
    permission_classes = [IsAuthenticated, IsSortingSupervisor]

    def get_queryset(self):
        queryset = FabricStock.objects.all().order_by('-created_at')
        status_filter = self.request.query_params.get('status')
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        return queryset


class SortingSessionViewSet(viewsets.ModelViewSet):
    queryset = SortingSession.objects.all().order_by('-start_date')
    serializer_class = SortingSessionSerializer
    permission_classes = [IsAuthenticated, IsSortingSupervisor]

    def get_queryset(self):
        queryset = SortingSession.objects.all().order_by('-start_date')
        status_filter = self.request.query_params.get('status')
        unit = self.request.query_params.get('unit')
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        if unit:
            queryset = queryset.filter(unit=unit)
        return queryset

    @action(detail=True, methods=['post'])
    def complete(self, request, pk=None):
        session = self.get_object()
        if session.status == 'Completed':
            return Response(
                {"message": "Session already completed."},
                status=status.HTTP_400_BAD_REQUEST
            )
        quantity_sorted = request.data.get('quantity_sorted', 0)
        waste_quantity = request.data.get('waste_quantity', 0)

        session.quantity_sorted = quantity_sorted
        session.waste_quantity = waste_quantity
        session.status = 'Completed'
        session.end_date = timezone.now()
        session.save()

        # Update fabric stock remaining quantity
        fabric = session.fabric
        fabric.sorted_quantity += float(quantity_sorted)
        fabric.remaining_quantity -= float(quantity_sorted)
        if fabric.remaining_quantity <= 0:
            fabric.status = 'Sorted'
        fabric.save()

        return Response(
            {"message": "Sorting session completed successfully."},
            status=status.HTTP_200_OK
        )