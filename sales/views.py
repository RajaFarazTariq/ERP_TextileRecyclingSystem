from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from django.utils import timezone
from django.db.models import Sum, Count
from .models import SalesOrder, DispatchTracking, Payment
from .serializers import (
    SalesOrderSerializer,
    DispatchTrackingSerializer,
    PaymentSerializer
)
from .permissions import IsSalesUser


class SalesOrderViewSet(viewsets.ModelViewSet):
    queryset = SalesOrder.objects.all().order_by('-created_at')
    serializer_class = SalesOrderSerializer
    permission_classes = [IsAuthenticated, IsSalesUser]

    def get_queryset(self):
        queryset = SalesOrder.objects.all().order_by('-created_at')
        status_filter = self.request.query_params.get('status')
        payment_status = self.request.query_params.get('payment_status')
        buyer = self.request.query_params.get('buyer')

        if status_filter:
            queryset = queryset.filter(status=status_filter)
        if payment_status:
            queryset = queryset.filter(payment_status=payment_status)
        if buyer:
            queryset = queryset.filter(buyer_name__icontains=buyer)

        return queryset

    @action(detail=True, methods=['post'])
    def confirm(self, request, pk=None):
        order = self.get_object()
        order.status = 'Confirmed'
        order.save()
        return Response(
            {"message": f"Order #{order.id} confirmed."},
            status=status.HTTP_200_OK
        )

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        order = self.get_object()
        order.status = 'Cancelled'
        order.save()
        return Response(
            {"message": f"Order #{order.id} cancelled."},
            status=status.HTTP_200_OK
        )

    @action(detail=False, methods=['get'])
    def summary(self, request):
        total_orders = SalesOrder.objects.count()
        total_revenue = SalesOrder.objects.aggregate(
            total=Sum('total_price')
        )['total'] or 0
        pending_payments = SalesOrder.objects.filter(
            payment_status='Pending'
        ).count()
        completed_orders = SalesOrder.objects.filter(
            status='Completed'
        ).count()

        return Response({
            'total_orders': total_orders,
            'total_revenue': total_revenue,
            'pending_payments': pending_payments,
            'completed_orders': completed_orders,
        })


class DispatchTrackingViewSet(viewsets.ModelViewSet):
    queryset = DispatchTracking.objects.all().order_by('-dispatch_date')
    serializer_class = DispatchTrackingSerializer
    permission_classes = [IsAuthenticated, IsSalesUser]

    def get_queryset(self):
        queryset = DispatchTracking.objects.all().order_by('-dispatch_date')
        status_filter = self.request.query_params.get('status')
        if status_filter:
            queryset = queryset.filter(dispatch_status=status_filter)
        return queryset

    @action(detail=True, methods=['post'])
    def mark_delivered(self, request, pk=None):
        dispatch = self.get_object()
        dispatch.dispatch_status = 'Delivered'
        dispatch.delivery_date = timezone.now()
        dispatch.save()

        # Update sales order status
        order = dispatch.sales_order
        order.status = 'Completed'
        order.save()

        return Response(
            {"message": "Marked as delivered and order completed."},
            status=status.HTTP_200_OK
        )


class PaymentViewSet(viewsets.ModelViewSet):
    queryset = Payment.objects.all().order_by('-payment_date')
    serializer_class = PaymentSerializer
    permission_classes = [IsAuthenticated, IsSalesUser]

    def perform_create(self, serializer):
        payment = serializer.save()

        # Update sales order payment status
        order = payment.sales_order
        total_paid = sum(
            p.amount for p in order.payments.all()
        )

        if total_paid >= order.total_price:
            order.payment_status = 'Paid'
        elif total_paid > 0:
            order.payment_status = 'Partial'
        else:
            order.payment_status = 'Pending'

        order.save()