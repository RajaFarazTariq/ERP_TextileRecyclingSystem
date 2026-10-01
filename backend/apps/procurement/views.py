from collections import defaultdict
from decimal import Decimal

from django.db.models import Prefetch
from django.utils import timezone
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import mixins, permissions, serializers, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.audit.middleware import AuditedModelMixin
from apps.audit.models import AuditLog, log_action
from apps.core.filters import filter_by_date_params
from apps.core.permissions import SAFE_METHODS, get_role, is_admin
from apps.warehouse.models import Stock, Vendor
from . import services
from .models import (
    PurchaseOrder, PurchaseOrderLine, PurchaseRequisition, PurchaseReturn, SupplierInvoice,
    SupplierPayment, SupplierQuotation,
)
from .serializers import (
    OpenLineSerializer, PurchaseOrderSerializer, PurchaseReturnSerializer, QuotationSerializer,
    RequisitionSerializer, SupplierInvoiceSerializer, SupplierPaymentSerializer,
)

ZERO = Decimal('0')


class IsProcurementUser(permissions.BasePermission):
    """Procurement is for admins and warehouse supervisors (prices are sensitive)."""
    message = 'Only admins and warehouse supervisors can use Procurement.'

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated
                    and get_role(request.user) in ('admin', 'warehouse_supervisor'))


class IsAdminForWrites(permissions.BasePermission):
    """Supplier payments: everyone in procurement can see them, only admins record them."""
    message = 'Only an admin can record supplier payments.'

    def has_permission(self, request, view):
        return request.method in SAFE_METHODS or is_admin(request.user)


class IsAdminAction(permissions.BasePermission):
    message = 'Only an admin can approve or reject.'

    def has_permission(self, request, view):
        return is_admin(request.user)


reason_request = inline_serializer('DecisionRequest', {'reason': serializers.CharField(required=False)})


class TransitionMixin:
    """Runs a status change, logs it, and returns the fresh record."""

    def _transition(self, request, fn, *args):
        obj = self.get_object()
        old = obj.status
        fn(obj, *args)
        obj.refresh_from_db()
        log_action(request.user, AuditLog.ACTION_UPDATE, obj, request=request,
                   changes={'status': {'old': old, 'new': obj.status}})
        return Response(self.get_serializer(self.get_queryset().get(pk=obj.pk)).data)


class RequisitionViewSet(TransitionMixin, AuditedModelMixin, viewsets.ModelViewSet):
    serializer_class = RequisitionSerializer
    permission_classes = [IsAuthenticated, IsProcurementUser]

    def get_queryset(self):
        qs = (PurchaseRequisition.objects.select_related('requested_by', 'decided_by', 'unit')
              .prefetch_related('lines', 'purchase_orders'))
        if s := self.request.query_params.get('status'):
            qs = qs.filter(status=s)
        return filter_by_date_params(qs, self.request.query_params, 'created_at')

    def perform_create(self, serializer):
        return super().perform_create(serializer, requested_by=self.request.user)

    def perform_destroy(self, instance):
        if instance.status not in ('Draft', 'Rejected', 'Cancelled'):
            raise ValidationError({'status': ['Only draft, rejected or cancelled requests can be deleted.']})
        return super().perform_destroy(instance)

    @extend_schema(request=None, responses=RequisitionSerializer)
    @action(detail=True, methods=['post'])
    def submit(self, request, pk=None):
        return self._transition(request, services.submit_requisition)

    @extend_schema(request=None, responses=RequisitionSerializer)
    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated, IsProcurementUser, IsAdminAction])
    def approve(self, request, pk=None):
        return self._transition(request, services.decide_requisition, request.user, True)

    @extend_schema(request=reason_request, responses=RequisitionSerializer)
    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated, IsProcurementUser, IsAdminAction])
    def reject(self, request, pk=None):
        return self._transition(request, services.decide_requisition, request.user, False,
                                str(request.data.get('reason', '')))

    @extend_schema(request=None, responses=RequisitionSerializer)
    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        def cancel(req):
            if req.status in ('Ordered', 'Cancelled'):
                raise ValidationError({'status': [f'A {req.status.lower()} request can\'t be cancelled.']})
            req.status = 'Cancelled'
            req.save(update_fields=['status'])
        return self._transition(request, cancel)


class PurchaseOrderViewSet(TransitionMixin, AuditedModelMixin, viewsets.ModelViewSet):
    serializer_class = PurchaseOrderSerializer
    permission_classes = [IsAuthenticated, IsProcurementUser]

    def get_queryset(self):
        qs = (PurchaseOrder.objects.select_related('vendor', 'created_by', 'approved_by', 'requisition')
              .prefetch_related('lines__receipts', 'invoices'))
        params = self.request.query_params
        if s := params.get('status'):
            qs = qs.filter(status__in=s.split(','))
        if v := params.get('vendor'):
            qs = qs.filter(vendor_id=v)
        return filter_by_date_params(qs, params, 'order_date')

    def perform_create(self, serializer):
        return super().perform_create(serializer, created_by=self.request.user)

    def perform_destroy(self, instance):
        if instance.status not in ('Draft', 'Submitted', 'Cancelled'):
            raise ValidationError({'status': ['Approved orders can\'t be deleted; cancel or close them instead.']})
        return super().perform_destroy(instance)

    @extend_schema(request=None, responses=PurchaseOrderSerializer)
    @action(detail=True, methods=['post'])
    def submit(self, request, pk=None):
        return self._transition(request, services.submit_order)

    @extend_schema(request=None, responses=PurchaseOrderSerializer)
    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated, IsProcurementUser, IsAdminAction])
    def approve(self, request, pk=None):
        return self._transition(request, services.approve_order, request.user)

    @extend_schema(request=None, responses=PurchaseOrderSerializer)
    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        return self._transition(request, services.cancel_order)

    @extend_schema(request=None, responses=PurchaseOrderSerializer)
    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated, IsProcurementUser, IsAdminAction])
    def close(self, request, pk=None):
        return self._transition(request, services.close_order)


class OpenLineViewSet(mixins.ListModelMixin, viewsets.GenericViewSet):
    """PO lines that can still receive goods, for the warehouse delivery form (any warehouse user)."""
    serializer_class = OpenLineSerializer
    permission_classes = [IsAuthenticated, IsProcurementUser]

    def get_queryset(self):
        qs = (PurchaseOrderLine.objects.select_related('order')
              .prefetch_related('receipts')
              .filter(order__status__in=PurchaseOrder.OPEN_STATUSES)
              .order_by('order__expected_date', 'order_id', 'id'))
        if v := self.request.query_params.get('vendor'):
            qs = qs.filter(order__vendor_id=v)
        return qs


class PurchaseReturnViewSet(AuditedModelMixin, viewsets.ModelViewSet):
    serializer_class = PurchaseReturnSerializer
    permission_classes = [IsAuthenticated, IsProcurementUser]

    def get_queryset(self):
        qs = PurchaseReturn.objects.select_related('receipt__vendor', 'receipt__po_line__order', 'created_by')
        return filter_by_date_params(qs, self.request.query_params, 'return_date')

    def perform_create(self, serializer):
        return super().perform_create(serializer, created_by=self.request.user)


class QuotationViewSet(AuditedModelMixin, viewsets.ModelViewSet):
    serializer_class = QuotationSerializer
    permission_classes = [IsAuthenticated, IsProcurementUser]

    def get_queryset(self):
        qs = SupplierQuotation.objects.select_related('vendor', 'requisition')
        if m := self.request.query_params.get('material'):
            qs = qs.filter(material__icontains=m)
        return qs


class SupplierInvoiceViewSet(AuditedModelMixin, viewsets.ModelViewSet):
    serializer_class = SupplierInvoiceSerializer
    permission_classes = [IsAuthenticated, IsProcurementUser]

    def get_queryset(self):
        qs = SupplierInvoice.objects.select_related('vendor', 'purchase_order').prefetch_related('payments')
        params = self.request.query_params
        if s := params.get('status'):
            qs = qs.filter(status=s)
        if v := params.get('vendor'):
            qs = qs.filter(vendor_id=v)
        return filter_by_date_params(qs, params, 'invoice_date')


class SupplierPaymentViewSet(AuditedModelMixin, viewsets.ModelViewSet):
    serializer_class = SupplierPaymentSerializer
    permission_classes = [IsAuthenticated, IsProcurementUser, IsAdminForWrites]

    def get_queryset(self):
        qs = SupplierPayment.objects.select_related('invoice__vendor', 'paid_by')
        return filter_by_date_params(qs, self.request.query_params, 'payment_date')

    def perform_create(self, serializer):
        if serializer.validated_data.get('paid_by'):
            return super().perform_create(serializer)
        return super().perform_create(serializer, paid_by=self.request.user)


# ── Reports ─────────────────────────────────────────────────────────────────

def _orders_with_lines():
    return PurchaseOrder.objects.select_related('vendor').prefetch_related(
        Prefetch('lines', queryset=PurchaseOrderLine.objects.prefetch_related('receipts')))


class ProcurementSummaryView(APIView):
    """Figures for the Procurement dashboard."""
    permission_classes = [IsAuthenticated, IsProcurementUser]

    @extend_schema(responses=OpenApiTypes.OBJECT)
    def get(self, request):
        today = timezone.localdate()
        month_start = today.replace(day=1)
        open_orders = list(_orders_with_lines().filter(status__in=('Submitted',) + PurchaseOrder.OPEN_STATUSES))
        invoices = list(SupplierInvoice.objects.prefetch_related('payments'))
        unpaid = [inv for inv in invoices if inv.status != 'Paid']
        late_orders = [o for o in open_orders if o.expected_date and o.expected_date < today
                       and o.status in PurchaseOrder.OPEN_STATUSES]
        return Response({
            'pending_requisitions': PurchaseRequisition.objects.filter(status='Submitted').count(),
            'pending_orders': sum(1 for o in open_orders if o.status == 'Submitted'),
            'open_orders': sum(1 for o in open_orders if o.status in PurchaseOrder.OPEN_STATUSES),
            'open_order_value': sum((o.total_amount for o in open_orders if o.status in PurchaseOrder.OPEN_STATUSES), ZERO),
            'late_orders': len(late_orders),
            'spend_this_month': sum((inv.total for inv in invoices if inv.invoice_date >= month_start), ZERO),
            'payables': sum((services.outstanding(inv) for inv in unpaid), ZERO),
            'overdue_payables': sum((services.outstanding(inv) for inv in unpaid if inv.due_date and inv.due_date < today), ZERO),
            'overdue_invoices': sum(1 for inv in unpaid if inv.due_date and inv.due_date < today),
        })


class SupplierPerformanceView(APIView):
    """Per supplier: orders, delivered and rejected weight, on-time delivery, prices and what is owed."""
    permission_classes = [IsAuthenticated, IsProcurementUser]

    @extend_schema(responses=OpenApiTypes.OBJECT)
    def get(self, request):
        rows = {v.pk: {
            'vendor': v.pk, 'name': v.name, 'category': v.category, 'is_active': v.is_active,
            'orders': 0, 'ordered_kg': ZERO, 'received_kg': ZERO, 'rejected_kg': ZERO, 'spend': ZERO,
            'on_time': 0, 'delivered_orders': 0, 'deliveries': 0, 'payable': ZERO,
            'inspections': 0, 'failed_inspections': 0,
        } for v in Vendor.objects.all()}

        for order in _orders_with_lines().exclude(status__in=('Draft', 'Cancelled')):
            row = rows[order.vendor_id]
            row['orders'] += 1
            dates = []
            for line in order.lines.all():
                row['ordered_kg'] += line.quantity_kg
                row['spend'] += line.amount
                for receipt in line.receipts.all():
                    dates.append(timezone.localdate(receipt.created_at))
            if order.status in ('Received', 'Closed') and dates and order.expected_date:
                row['delivered_orders'] += 1
                row['on_time'] += int(max(dates) <= order.expected_date)

        # All deliveries count towards weight and rejection, with or without a PO
        for receipt in Stock.objects.only('vendor_id', 'our_weight', 'status'):
            row = rows[receipt.vendor_id]
            row['deliveries'] += 1
            if receipt.status == 'Rejected':
                row['rejected_kg'] += receipt.our_weight
            else:
                row['received_kg'] += receipt.our_weight

        for inv in SupplierInvoice.objects.prefetch_related('payments').exclude(status='Paid'):
            rows[inv.vendor_id]['payable'] += services.outstanding(inv)

        from apps.quality.models import Inspection
        for vendor_id, result in Inspection.objects.filter(stage='Incoming').values_list('stock__vendor_id', 'result'):
            rows[vendor_id]['inspections'] += 1
            rows[vendor_id]['failed_inspections'] += int(result == 'Fail')

        result = []
        for row in rows.values():
            delivered = row['received_kg'] + row['rejected_kg']
            row['rejected_pct'] = round(float(row['rejected_kg'] / delivered * 100), 1) if delivered else None
            row['on_time_pct'] = round(row['on_time'] / row['delivered_orders'] * 100, 1) if row['delivered_orders'] else None
            row['avg_price_per_kg'] = round(row['spend'] / row['ordered_kg'], 2) if row['ordered_kg'] else None
            row['quality_pass_pct'] = (round((row['inspections'] - row['failed_inspections']) / row['inspections'] * 100, 1)
                                       if row['inspections'] else None)
            result.append(row)
        result.sort(key=lambda r: (-r['received_kg'], r['name']))
        return Response(result)


class PriceComparisonView(APIView):
    """For each material: every supplier's quoted and ordered prices, cheapest first."""
    permission_classes = [IsAuthenticated, IsProcurementUser]

    @extend_schema(responses=OpenApiTypes.OBJECT)
    def get(self, request):
        q = (request.query_params.get('material') or '').strip()
        today = timezone.localdate()
        prices = defaultdict(lambda: defaultdict(lambda: {'quotes': [], 'orders': []}))
        names = {}
        quotes = SupplierQuotation.objects.select_related('vendor')
        lines = PurchaseOrderLine.objects.select_related('order__vendor').exclude(order__status__in=('Draft', 'Cancelled'))
        if q:
            quotes = quotes.filter(material__icontains=q)
            lines = lines.filter(material__icontains=q)
        for quote in quotes:
            key = ' '.join(quote.material.split()).casefold()
            names.setdefault(key, quote.material)
            prices[key][quote.vendor.name]['quotes'].append({
                'price': quote.price_per_kg, 'date': quote.quoted_on,
                'valid': quote.valid_until is None or quote.valid_until >= today,
            })
        for line in lines:
            key = ' '.join(line.material.split()).casefold()
            names.setdefault(key, line.material)
            prices[key][line.order.vendor.name]['orders'].append({'price': line.unit_price, 'date': line.order.order_date})

        result = []
        for key, vendors in prices.items():
            offers = []
            for vendor, data in vendors.items():
                valid_quotes = [p['price'] for p in data['quotes'] if p['valid']]
                ordered = sorted(data['orders'], key=lambda p: p['date'])
                offers.append({
                    'vendor': vendor,
                    'best_quote': min(valid_quotes) if valid_quotes else None,
                    'last_order_price': ordered[-1]['price'] if ordered else None,
                    'avg_order_price': round(sum(p['price'] for p in ordered) / len(ordered), 2) if ordered else None,
                    'orders': len(ordered),
                })
            best = lambda o: o['best_quote'] if o['best_quote'] is not None else o['last_order_price']  # noqa: E731
            offers.sort(key=lambda o: (best(o) is None, best(o) or 0))
            result.append({'material': names[key], 'offers': offers})
        result.sort(key=lambda r: r['material'].casefold())
        return Response(result)

