# sales/views.py
import difflib
import re

from django.db import transaction
from django.db.models import Count, Sum
from django.utils import timezone
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import serializers, viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.audit.middleware import AuditedModelMixin
from apps.audit.models import AuditLog, log_action
from apps.core.filters import filter_by_date_params
from apps.core.permissions import IsAdminUser, IsSalesOrAdmin
from apps.inventory import services as inventory
from rest_framework.views import APIView

from . import services
from .models import (
    Customer, DispatchTracking, Payment, Product, SalesInvoice, SalesOrder, SalesQuotation, SalesReturn, normalize_name,
)
from .serializers import (
    CustomerSerializer,
    SalesOrderSerializer,
    DispatchTrackingSerializer,
    PaymentSerializer,
    ProductSerializer,
    SalesInvoiceSerializer,
    SalesQuotationSerializer,
    SalesReturnSerializer,
)


def _customer_kwargs(serializer):
    """
    Keep order.customer and order.buyer_name consistent: a chosen customer
    fills in a blank buyer name, and a typed buyer name is linked to the
    matching customer (created if new).
    """
    data     = serializer.validated_data
    instance = serializer.instance
    customer = data.get('customer')
    buyer    = (data.get('buyer_name') or '').strip()

    if customer is not None:
        return {} if buyer else {'buyer_name': customer.name}
    if buyer and (instance is None or 'buyer_name' in data):
        customer, _ = Customer.objects.get_or_create(
            normalized_name=normalize_name(buyer), defaults={'name': buyer},
        )
        return {'customer': customer}
    return {}


class CustomerViewSet(AuditedModelMixin, viewsets.ModelViewSet):
    serializer_class = CustomerSerializer
    permission_classes = [IsAuthenticated, IsSalesOrAdmin]

    def get_queryset(self):
        qs = Customer.objects.annotate(order_count=Count('orders'))
        if q := self.request.query_params.get('search'):
            qs = qs.filter(name__icontains=q)
        return qs

    def get_serializer_context(self):
        context = super().get_serializer_context()
        if self.action == 'list':
            context['balances'] = services.customer_balances()
        return context

    @extend_schema(responses=OpenApiTypes.OBJECT)
    @action(detail=True, methods=['get'])
    def statement(self, request, pk=None):
        """Everything between us and this customer, oldest first, with a running balance."""
        return Response(customer_statement(self.get_object()))

    @extend_schema(responses=OpenApiTypes.OBJECT)
    @action(detail=False, methods=['get'])
    def duplicates(self, request):
        """Pairs of customers whose names look alike, for a person to review."""
        return Response(find_similar_customers())

    @extend_schema(
        request=inline_serializer('CustomerMergeRequest', {'into': serializers.IntegerField()}),
        responses=CustomerSerializer,
    )
    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated, IsAdminUser])
    def merge(self, request, pk=None):
        """Move this customer's orders to another customer, then remove this one."""
        source = self.get_object()
        try:
            target = Customer.objects.get(pk=request.data.get('into'))
        except (Customer.DoesNotExist, ValueError, TypeError):
            return Response({'into': ['Choose the customer to merge into.']}, status=status.HTTP_400_BAD_REQUEST)
        if target.pk == source.pk:
            return Response({'into': ['Cannot merge a customer into itself.']}, status=status.HTTP_400_BAD_REQUEST)
        with transaction.atomic():
            moved = SalesOrder.objects.filter(customer=source).update(customer=target)
            SalesQuotation.objects.filter(customer=source).update(customer=target)
            log_action(request.user, AuditLog.ACTION_DELETE, source, request=request,
                       changes={'merged_into': {'old': None, 'new': target.pk}, 'orders_moved': moved})
            source.delete()
        target = self.get_queryset().get(pk=target.pk)
        return Response(CustomerSerializer(target).data)


def find_similar_customers(threshold=0.85):
    """
    Pairs of customers with near-identical names. Names that differ only in
    their numbers ("Store #1" / "Store #2") are treated as different customers.
    """
    customers = list(Customer.objects.order_by('normalized_name').values('id', 'name', 'normalized_name'))
    for c in customers:
        c['letters'] = re.sub(r'\d+', '', c['normalized_name'])
    pairs = []
    for i, a in enumerate(customers):
        for b in customers[i + 1:]:
            if a['letters'] == b['letters']:
                continue   # only the numbers differ
            matcher = difflib.SequenceMatcher(None, a['normalized_name'], b['normalized_name'])
            if matcher.real_quick_ratio() < threshold or matcher.quick_ratio() < threshold:
                continue   # cheap upper bounds rule most pairs out
            ratio = matcher.ratio()
            if ratio >= threshold:
                pairs.append({'a': {'id': a['id'], 'name': a['name']},
                              'b': {'id': b['id'], 'name': b['name']},
                              'similarity': round(ratio, 2)})
    return sorted(pairs, key=lambda p: -p['similarity'])


class SalesOrderViewSet(AuditedModelMixin, viewsets.ModelViewSet):
    queryset = SalesOrder.objects.all().order_by('-created_at')
    serializer_class = SalesOrderSerializer
    permission_classes = [IsAuthenticated, IsSalesOrAdmin]

    def get_queryset(self):
        qs = (SalesOrder.objects.select_related('fabric', 'created_by', 'customer', 'product', 'quotation')
              .prefetch_related('dispatches__dispatched_by', 'payments__received_by', 'invoices', 'returns')
              .order_by('-created_at'))

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

        qs = filter_by_date_params(qs, self.request.query_params, 'created_at')

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

        with transaction.atomic():   # stock check and save happen together
            serializer = self.get_serializer(data=data)
            if serializer.is_valid():
                self.perform_create(serializer)
                return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def perform_create(self, serializer):
        return super().perform_create(serializer, created_by=self.request.user,
                                      **_customer_kwargs(serializer))

    def perform_update(self, serializer):
        return super().perform_update(serializer, **_customer_kwargs(serializer))

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
        with transaction.atomic():   # stock check and save happen together
            instance = self.get_object()
            serializer = self.get_serializer(instance, data=data, partial=partial)
            if serializer.is_valid():
                self.perform_update(serializer)
                return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    # ── Your original actions (unchanged) ─────────────────────────────────────
    @action(detail=True, methods=['post'])
    def confirm(self, request, pk=None):
        with transaction.atomic():
            order = self.get_object()
            if order.status not in inventory.RESERVING_STATUSES:
                inventory.check_order_reservation(order.fabric_id, order.weight_sold, order_id=order.pk)
            before = self.snapshot(order)
            warning = services.credit_warning(order)   # a warning only: the order is confirmed either way
            order.status = 'Confirmed'
            order.save()
            self.log_change(order, before)
        return Response({'message': f'Order #{order.id} confirmed.', 'credit_warning': warning},
                        status=status.HTTP_200_OK)

    @extend_schema(
        request=inline_serializer('InvoiceRequest', {
            'weight': serializers.DecimalField(max_digits=12, decimal_places=2, required=False),
            'invoice_date': serializers.DateField(required=False),
            'notes': serializers.CharField(required=False),
        }),
        responses=SalesInvoiceSerializer,
    )
    @action(detail=True, methods=['post'])
    def invoice(self, request, pk=None):
        """Raise an invoice for dispatched goods (everything not yet invoiced, unless a weight is given)."""
        body = inline_invoice_request(data=request.data)
        body.is_valid(raise_exception=True)
        invoice = services.create_invoice(self.get_object(), request.user, **body.validated_data)
        log_action(request.user, AuditLog.ACTION_CREATE, invoice, request=request)
        return Response(SalesInvoiceSerializer(invoice).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        order = self.get_object()
        before = self.snapshot(order)
        order.status = 'Cancelled'
        order.save()
        self.log_change(order, before)
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


class DispatchTrackingViewSet(AuditedModelMixin, viewsets.ModelViewSet):
    queryset = DispatchTracking.objects.all().order_by('-dispatch_date')
    serializer_class = DispatchTrackingSerializer
    permission_classes = [IsAuthenticated, IsSalesOrAdmin]

    def get_queryset(self):
        qs = DispatchTracking.objects.select_related('sales_order', 'dispatched_by').order_by('-dispatch_date')

        # ── Existing filter ───────────────────────────────────────────────────
        status_filter = self.request.query_params.get('status')
        if status_filter:
            qs = qs.filter(dispatch_status=status_filter)

        qs = filter_by_date_params(qs, self.request.query_params, 'dispatch_date')

        return qs

    def create(self, request, *args, **kwargs):
        with transaction.atomic():   # stock check and save happen together
            return super().create(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        with transaction.atomic():
            return super().update(request, *args, **kwargs)

    def perform_create(self, serializer):
        if 'dispatched_by' in serializer.validated_data:
            return super().perform_create(serializer)
        return super().perform_create(serializer, dispatched_by=self.request.user)

    # ── Your original action (unchanged) ─────────────────────────────────────
    @action(detail=True, methods=['post'])
    def mark_delivered(self, request, pk=None):
        dispatch = self.get_object()
        dispatch_before = self.snapshot(dispatch)
        dispatch.dispatch_status = 'Delivered'
        dispatch.delivery_date   = timezone.now()
        dispatch.save()
        self.log_change(dispatch, dispatch_before)
        order        = dispatch.sales_order
        order_before = self.snapshot(order)
        order.status = 'Completed'
        order.save()
        self.log_change(order, order_before)
        return Response(
            {'message': 'Marked as delivered and order completed.'},
            status=status.HTTP_200_OK,
        )


class PaymentViewSet(AuditedModelMixin, viewsets.ModelViewSet):
    queryset = Payment.objects.all().order_by('-payment_date')
    serializer_class = PaymentSerializer
    permission_classes = [IsAuthenticated, IsSalesOrAdmin]

    def get_queryset(self):
        qs = Payment.objects.select_related('received_by').order_by('-payment_date')

        qs = filter_by_date_params(qs, self.request.query_params, 'payment_date')

        return qs

    # ── Your original perform_create (unchanged) ──────────────────────────────
    def perform_create(self, serializer):
        if 'received_by' in serializer.validated_data:
            payment = super().perform_create(serializer)
        else:
            payment = super().perform_create(serializer, received_by=self.request.user)
        # Paid / Partial / Pending against the order total, less credits for approved returns
        services.refresh_payment_status(payment.sales_order)


# ─────────────────────────────────────────────────────────────────────────────
# Phase 5: products, quotations, invoices, returns, statements, performance
# ─────────────────────────────────────────────────────────────────────────────
class inline_invoice_request(serializers.Serializer):
    weight = serializers.DecimalField(max_digits=12, decimal_places=2, required=False)
    invoice_date = serializers.DateField(required=False)
    notes = serializers.CharField(required=False, allow_blank=True)


class ProductViewSet(AuditedModelMixin, viewsets.ModelViewSet):
    queryset = Product.objects.prefetch_related('prices')
    serializer_class = ProductSerializer
    permission_classes = [IsAuthenticated, IsSalesOrAdmin]


class SalesQuotationViewSet(AuditedModelMixin, viewsets.ModelViewSet):
    queryset = SalesQuotation.objects.select_related('customer', 'product', 'fabric', 'created_by', 'order')
    serializer_class = SalesQuotationSerializer
    permission_classes = [IsAuthenticated, IsSalesOrAdmin]

    def get_queryset(self):
        return filter_by_date_params(super().get_queryset(), self.request.query_params, 'created_at')

    def perform_create(self, serializer):
        return super().perform_create(serializer, created_by=self.request.user)

    def perform_destroy(self, instance):
        if instance.status == 'Converted':
            raise serializers.ValidationError('This quotation became an order and can\'t be deleted.')
        super().perform_destroy(instance)

    def _transition(self, request, fn, *args):
        with transaction.atomic():
            quotation = self.get_object()
            before = self.snapshot(quotation)
            result = fn(quotation, *args)
            self.log_change(quotation, before)
        return quotation, result

    @action(detail=True, methods=['post'])
    def send(self, request, pk=None):
        quotation, _ = self._transition(request, services.send_quotation)
        return Response(self.get_serializer(quotation).data)

    @action(detail=True, methods=['post'])
    def accept(self, request, pk=None):
        quotation, _ = self._transition(request, services.accept_quotation)
        return Response(self.get_serializer(quotation).data)

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        quotation, _ = self._transition(request, services.reject_quotation, request.data.get('reason', ''))
        return Response(self.get_serializer(quotation).data)

    @action(detail=True, methods=['post'])
    def convert(self, request, pk=None):
        """Make a Draft sales order from an accepted quotation."""
        from apps.sorting.models import FabricStock
        fabric = None
        if fabric_id := request.data.get('fabric'):
            fabric = FabricStock.objects.filter(pk=fabric_id).first()
            if fabric is None:
                return Response({'fabric': ['Choose the fabric lot to sell from.']}, status=status.HTTP_400_BAD_REQUEST)
        quotation, order = self._transition(request, services.convert_quotation, request.user, fabric)
        log_action(request.user, AuditLog.ACTION_CREATE, order, request=request)
        return Response({**self.get_serializer(quotation).data, 'order': order.pk})


class SalesInvoiceViewSet(AuditedModelMixin, viewsets.ModelViewSet):
    """Invoices are raised from an order (orders/<id>/invoice/); here they are listed, dated and deleted."""
    queryset = SalesInvoice.objects.select_related('order__fabric', 'created_by')
    serializer_class = SalesInvoiceSerializer
    permission_classes = [IsAuthenticated, IsSalesOrAdmin]
    http_method_names = ['get', 'patch', 'delete', 'head', 'options']

    def get_queryset(self):
        qs = super().get_queryset()
        if order := self.request.query_params.get('order'):
            qs = qs.filter(order_id=order)
        return filter_by_date_params(qs, self.request.query_params, 'invoice_date')

    def list(self, request, *args, **kwargs):
        invoices = list(self.filter_queryset(self.get_queryset()))
        context = {**self.get_serializer_context(), 'invoice_states': services.invoice_states(invoices)}
        return Response(SalesInvoiceSerializer(invoices, many=True, context=context).data)


class SalesReturnViewSet(AuditedModelMixin, viewsets.ModelViewSet):
    queryset = SalesReturn.objects.select_related('order__fabric', 'created_by', 'decided_by')
    serializer_class = SalesReturnSerializer
    permission_classes = [IsAuthenticated, IsSalesOrAdmin]

    def get_queryset(self):
        return filter_by_date_params(super().get_queryset(), self.request.query_params, 'return_date')

    def perform_create(self, serializer):
        return super().perform_create(serializer, created_by=self.request.user)

    def perform_destroy(self, instance):
        if instance.status == 'Approved':
            raise serializers.ValidationError('An approved return has credited the customer and can\'t be deleted.')
        super().perform_destroy(instance)

    def _decide(self, request, fn, *args):
        with transaction.atomic():
            sales_return = self.get_object()
            before = self.snapshot(sales_return)
            fn(sales_return, request.user, *args)
            self.log_change(sales_return, before)
        return Response(self.get_serializer(sales_return).data)

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        return self._decide(request, services.approve_return)

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        return self._decide(request, services.reject_return, request.data.get('reason', ''))


def _fixed(value):
    return f'{value:.2f}'


def customer_statement(customer):
    zero = services.ZERO
    rows = []
    for o in customer.orders.filter(status__in=services.BILLED_STATUSES).select_related('fabric'):
        rows.append({'date': o.created_at, 'kind': 'Order', 'reference': f'Order #{o.pk}',
                     'detail': f'{o.weight_sold:,.2f} kg {o.fabric.material_type}', 'debit': o.total_price, 'credit': zero})
    for p in Payment.objects.filter(sales_order__customer=customer):
        rows.append({'date': p.payment_date, 'kind': 'Payment', 'reference': f'Order #{p.sales_order_id}',
                     'detail': p.payment_method + (f' {p.reference_number}' if p.reference_number else ''),
                     'debit': zero, 'credit': p.amount})
    for r in SalesReturn.objects.filter(order__customer=customer, status='Approved'):
        rows.append({'date': r.decided_at, 'kind': 'Return', 'reference': r.number,
                     'detail': f'{r.weight:,.2f} kg returned', 'debit': zero, 'credit': r.credit_amount})
    rows.sort(key=lambda r: r['date'])
    balance = zero
    for r in rows:
        balance += r['debit'] - r['credit']
        r.update(debit=_fixed(r['debit']), credit=_fixed(r['credit']), balance=_fixed(balance))
    figures = services.customer_balances([customer.pk])[customer.pk]
    today = timezone.localdate()
    invoices = SalesInvoice.objects.filter(order__customer=customer)
    states = services.invoice_states(invoices)
    overdue = sum((i.total - states[i.pk]['paid'] for i in invoices if states[i.pk]['status'] == 'Overdue'), zero)
    return {
        'customer': customer.pk, 'name': customer.name, 'as_of': today,
        'billed': _fixed(figures['billed']), 'paid': _fixed(figures['paid']), 'credited': _fixed(figures['credited']),
        'balance': _fixed(figures['balance']), 'overdue': _fixed(overdue),
        'credit_limit': _fixed(customer.credit_limit),
        'over_limit': bool(customer.credit_limit) and figures['balance'] > customer.credit_limit,
        'transactions': rows,
    }


class SalesPerformanceView(APIView):
    """Sales by customer, product and month for a period (orders that are confirmed or further)."""
    permission_classes = [IsAuthenticated, IsSalesOrAdmin]

    @extend_schema(responses=OpenApiTypes.OBJECT)
    def get(self, request):
        zero = services.ZERO
        orders = filter_by_date_params(
            SalesOrder.objects.filter(status__in=services.BILLED_STATUSES).select_related('fabric', 'customer'),
            request.query_params, 'created_at')
        customers, products, months = {}, {}, {}
        revenue = weight = zero
        count = 0
        for o in orders:
            count += 1
            revenue += o.total_price
            weight += o.weight_sold
            month = timezone.localtime(o.created_at).strftime('%Y-%m')
            for bucket, key, name in ((customers, o.customer_id, o.buyer_name),
                                      (products, o.fabric.material_type, o.fabric.material_type),
                                      (months, month, month)):
                row = bucket.setdefault(key, {'name': name, 'orders': 0, 'kg': zero, 'revenue': zero})
                row['orders'] += 1
                row['kg'] += o.weight_sold
                row['revenue'] += o.total_price

        def rows(bucket, by_name=False):
            ordered = sorted(bucket.values(), key=(lambda r: r['name']) if by_name else (lambda r: -r['revenue']))
            return [{**r, 'kg': _fixed(r['kg']), 'revenue': _fixed(r['revenue'])} for r in ordered]

        quotations = filter_by_date_params(SalesQuotation.objects.all(), request.query_params, 'created_at')
        decided = quotations.filter(status__in=('Accepted', 'Rejected', 'Converted')).count()
        won = quotations.filter(status__in=('Accepted', 'Converted')).count()
        returns = filter_by_date_params(SalesReturn.objects.filter(status='Approved'), request.query_params, 'return_date')
        returned = returns.aggregate(kg=Sum('weight'), credit=Sum('credit_amount'))
        return Response({
            'orders': count, 'revenue': _fixed(revenue), 'kg': _fixed(weight),
            'average_price': _fixed(revenue / weight) if weight else None,
            'by_customer': rows(customers), 'by_product': rows(products), 'by_month': rows(months, by_name=True),
            'quotations': quotations.count(),
            'quotation_win_pct': round(won * 100 / decided, 1) if decided else None,
            'returned_kg': _fixed(returned['kg'] or zero), 'returned_credit': _fixed(returned['credit'] or zero),
        })
