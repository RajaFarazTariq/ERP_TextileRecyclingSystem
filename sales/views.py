# sales/views.py
from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from django.utils import timezone
from django.db.models import Sum, Count
from datetime import date, timedelta

from .models import SalesOrder, DispatchTracking, Payment
from .serializers import (
    SalesOrderSerializer,
    DispatchTrackingSerializer,
    PaymentSerializer,
)

try:
    from core.permissions import IsSalesOrAdmin
except ImportError:
    from rest_framework.permissions import IsAuthenticated as IsSalesOrAdmin


class SalesOrderViewSet(viewsets.ModelViewSet):
    queryset = SalesOrder.objects.all().order_by('-created_at')
    serializer_class = SalesOrderSerializer
    permission_classes = [IsAuthenticated, IsSalesOrAdmin]

    def get_queryset(self):
        qs = SalesOrder.objects.all().order_by('-created_at')

        # ── Existing filters (your original code) ────────────────────────────
        status_filter  = self.request.query_params.get('status')
        payment_status = self.request.query_params.get('payment_status')
        buyer          = self.request.query_params.get('buyer')

        if status_filter:
            qs = qs.filter(status=status_filter)
        if payment_status:
            qs = qs.filter(payment_status=payment_status)
        if buyer:
            qs = qs.filter(buyer_name__icontains=buyer)

        # ── Date filters (new — used by DateFilter component on frontend) ────
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
        data = request.data.copy()

        # ── Auto-calculate total_price (fixes "This field is required" error) ─
        try:
            weight = float(data.get('weight_sold') or 0)
            price  = float(data.get('price_per_kg') or 0)
            if weight and price:
                data['total_price'] = str(round(weight * price, 2))
        except (ValueError, TypeError):
            pass

        # ── Set safe defaults if fields are missing or blank ─────────────────
        if not data.get('status'):
            data['status'] = 'Draft'
        if not data.get('payment_status'):
            data['payment_status'] = 'Pending'

        serializer = self.get_serializer(data=data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def update(self, request, *args, **kwargs):
        data = request.data.copy()

        # Recalculate total_price on update too
        try:
            weight = float(data.get('weight_sold') or 0)
            price  = float(data.get('price_per_kg') or 0)
            if weight and price:
                data['total_price'] = str(round(weight * price, 2))
        except (ValueError, TypeError):
            pass

        partial  = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=data, partial=partial)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    # ── Your original actions (unchanged) ─────────────────────────────────────
    @action(detail=True, methods=['post'])
    def confirm(self, request, pk=None):
        order = self.get_object()
        order.status = 'Confirmed'
        order.save()
        return Response({'message': f'Order #{order.id} confirmed.'}, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        order = self.get_object()
        order.status = 'Cancelled'
        order.save()
        return Response({'message': f'Order #{order.id} cancelled.'}, status=status.HTTP_200_OK)

    @action(detail=False, methods=['get'])
    def summary(self, request):
        """
        Returns all fields used by Sales.jsx dashboard.
        Your original had 4 fields; this adds total_collected,
        pending_amount, paid_orders, payment_count — all used by
        the updated Sales.jsx summary cards.
        """
        qs             = SalesOrder.objects.all()
        total_revenue  = qs.aggregate(t=Sum('total_price'))['t'] or 0
        total_collected = Payment.objects.aggregate(t=Sum('amount'))['t'] or 0
        pending_amount = max(0, float(total_revenue) - float(total_collected))

        return Response({
            # ── Original fields (kept exactly) ────────────────────────────────
            'total_orders':     qs.count(),
            'total_revenue':    float(total_revenue),
            'pending_payments': qs.filter(payment_status='Pending').count(),
            'completed_orders': qs.filter(status='Completed').count(),
            # ── New fields used by Sales.jsx dashboard cards ──────────────────
            'total_collected':  float(total_collected),
            'pending_amount':   pending_amount,
            'paid_orders':      qs.filter(payment_status='Paid').count(),
            'payment_count':    Payment.objects.count(),
        })


class DispatchTrackingViewSet(viewsets.ModelViewSet):
    queryset = DispatchTracking.objects.all().order_by('-dispatch_date')
    serializer_class = DispatchTrackingSerializer
    permission_classes = [IsAuthenticated, IsSalesOrAdmin]

    def get_queryset(self):
        qs = DispatchTracking.objects.all().order_by('-dispatch_date')

        # ── Existing filter ───────────────────────────────────────────────────
        status_filter = self.request.query_params.get('status')
        if status_filter:
            qs = qs.filter(dispatch_status=status_filter)

        # ── Date filters ──────────────────────────────────────────────────────
        today       = date.today()
        date_filter = self.request.query_params.get('date_filter')

        if date_filter == 'today':
            qs = qs.filter(dispatch_date__date=today)
        elif date_filter == 'this_week':
            week_start = today - timedelta(days=today.weekday())
            qs = qs.filter(dispatch_date__date__gte=week_start)
        elif date_filter == 'this_month':
            qs = qs.filter(dispatch_date__year=today.year, dispatch_date__month=today.month)
        elif date_filter == 'this_year':
            qs = qs.filter(dispatch_date__year=today.year)

        if yr := self.request.query_params.get('year'):
            try:
                qs = qs.filter(dispatch_date__year=int(yr))
            except ValueError:
                pass

        if mo := self.request.query_params.get('month'):
            try:
                y, m = mo.split('-')
                qs = qs.filter(dispatch_date__year=int(y), dispatch_date__month=int(m))
            except (ValueError, AttributeError):
                pass

        if st := self.request.query_params.get('start'):
            try:
                qs = qs.filter(dispatch_date__date__gte=date.fromisoformat(st))
            except ValueError:
                pass

        if en := self.request.query_params.get('end'):
            try:
                qs = qs.filter(dispatch_date__date__lte=date.fromisoformat(en))
            except ValueError:
                pass

        return qs

    # ── Your original action (unchanged) ─────────────────────────────────────
    @action(detail=True, methods=['post'])
    def mark_delivered(self, request, pk=None):
        dispatch = self.get_object()
        dispatch.dispatch_status = 'Delivered'
        dispatch.delivery_date   = timezone.now()
        dispatch.save()
        order        = dispatch.sales_order
        order.status = 'Completed'
        order.save()
        return Response(
            {'message': 'Marked as delivered and order completed.'},
            status=status.HTTP_200_OK,
        )


class PaymentViewSet(viewsets.ModelViewSet):
    queryset = Payment.objects.all().order_by('-payment_date')
    serializer_class = PaymentSerializer
    permission_classes = [IsAuthenticated, IsSalesOrAdmin]

    def get_queryset(self):
        qs = Payment.objects.all().order_by('-payment_date')

        # ── Date filters ──────────────────────────────────────────────────────
        today       = date.today()
        date_filter = self.request.query_params.get('date_filter')

        if date_filter == 'today':
            qs = qs.filter(payment_date__date=today)
        elif date_filter == 'this_week':
            week_start = today - timedelta(days=today.weekday())
            qs = qs.filter(payment_date__date__gte=week_start)
        elif date_filter == 'this_month':
            qs = qs.filter(payment_date__year=today.year, payment_date__month=today.month)
        elif date_filter == 'this_year':
            qs = qs.filter(payment_date__year=today.year)

        if yr := self.request.query_params.get('year'):
            try:
                qs = qs.filter(payment_date__year=int(yr))
            except ValueError:
                pass

        if mo := self.request.query_params.get('month'):
            try:
                y, m = mo.split('-')
                qs = qs.filter(payment_date__year=int(y), payment_date__month=int(m))
            except (ValueError, AttributeError):
                pass

        if st := self.request.query_params.get('start'):
            try:
                qs = qs.filter(payment_date__date__gte=date.fromisoformat(st))
            except ValueError:
                pass

        if en := self.request.query_params.get('end'):
            try:
                qs = qs.filter(payment_date__date__lte=date.fromisoformat(en))
            except ValueError:
                pass

        return qs

    # ── Your original perform_create (unchanged) ──────────────────────────────
    def perform_create(self, serializer):
        payment = serializer.save()
        order   = payment.sales_order
        total_paid = sum(p.amount for p in order.payments.all())
        if total_paid >= order.total_price:
            order.payment_status = 'Paid'
        elif total_paid > 0:
            order.payment_status = 'Partial'
        else:
            order.payment_status = 'Pending'
        order.save()