from decimal import Decimal

from django.db import transaction
from rest_framework import serializers

from . import services
from .models import (
    PurchaseOrder, PurchaseOrderLine, PurchaseRequisition, PurchaseReturn, RequisitionLine,
    SupplierInvoice, SupplierPayment, SupplierQuotation,
)


def _fixed(value):
    """Amounts and weights go out as '1234.50' strings, like the model's DecimalFields."""
    return f'{value:.2f}'


def _positive(value, label='Quantity'):
    if value is None or value <= 0:
        raise serializers.ValidationError(f'{label} must be greater than zero.')
    return value


# ── Requisitions ────────────────────────────────────────────────────────────

class RequisitionLineSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(required=False)

    class Meta:
        model = RequisitionLine
        fields = ['id', 'material', 'quantity_kg', 'notes']

    def validate_quantity_kg(self, value):
        return _positive(value)


class RequisitionSerializer(serializers.ModelSerializer):
    lines = RequisitionLineSerializer(many=True)
    requested_by_name = serializers.CharField(source='requested_by.username', read_only=True)
    decided_by_name = serializers.CharField(source='decided_by.username', read_only=True, default=None)
    unit_name = serializers.CharField(source='unit.name', read_only=True, default=None)
    total_kg = serializers.SerializerMethodField()
    order_numbers = serializers.SerializerMethodField()

    class Meta:
        model = PurchaseRequisition
        fields = [
            'id', 'number', 'requested_by', 'requested_by_name', 'unit', 'unit_name', 'needed_by', 'status',
            'notes', 'decided_by', 'decided_by_name', 'decided_at', 'rejection_reason', 'created_at',
            'lines', 'total_kg', 'order_numbers',
        ]
        read_only_fields = ['number', 'requested_by', 'status', 'decided_by', 'decided_at', 'rejection_reason']

    def get_total_kg(self, obj):
        return _fixed(sum((line.quantity_kg for line in obj.lines.all()), Decimal('0')))

    def get_order_numbers(self, obj):
        return [po.number for po in obj.purchase_orders.all()]

    def validate_lines(self, lines):
        if not lines:
            raise serializers.ValidationError('Add at least one material.')
        return lines

    def validate(self, data):
        if self.instance and self.instance.status not in ('Draft', 'Rejected'):
            raise serializers.ValidationError({'status': [f'A {self.instance.status.lower()} request can no longer be changed.']})
        return data

    @transaction.atomic
    def create(self, validated):
        lines = validated.pop('lines')
        req = PurchaseRequisition.objects.create(**validated)
        for line in lines:
            line.pop('id', None)
            RequisitionLine.objects.create(requisition=req, **line)
        return req

    @transaction.atomic
    def update(self, instance, validated):
        lines = validated.pop('lines', None)
        for k, v in validated.items():
            setattr(instance, k, v)
        if instance.status == 'Rejected':
            instance.status = 'Draft'   # edited after rejection: back to draft for resubmitting
        instance.save()
        if lines is not None:
            instance.lines.all().delete()
            for line in lines:
                line.pop('id', None)
                RequisitionLine.objects.create(requisition=instance, **line)
        return instance


# ── Purchase orders ─────────────────────────────────────────────────────────

class OrderLineSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(required=False)
    amount = serializers.DecimalField(max_digits=16, decimal_places=2, read_only=True)
    received_kg = serializers.SerializerMethodField()
    rejected_kg = serializers.SerializerMethodField()
    returned_kg = serializers.SerializerMethodField()
    remaining_kg = serializers.SerializerMethodField()

    class Meta:
        model = PurchaseOrderLine
        fields = ['id', 'material', 'quantity_kg', 'unit_price', 'amount',
                  'received_kg', 'rejected_kg', 'returned_kg', 'remaining_kg']

    def get_received_kg(self, obj):
        return _fixed(obj.received_kg())

    def get_rejected_kg(self, obj):
        return _fixed(obj.rejected_kg())

    def get_returned_kg(self, obj):
        return _fixed(obj.returned_kg())

    def get_remaining_kg(self, obj):
        return _fixed(services.line_remaining(obj))

    def validate_quantity_kg(self, value):
        return _positive(value)

    def validate_unit_price(self, value):
        if value is None or value < 0:
            raise serializers.ValidationError('Price can\'t be negative.')
        return value


class PurchaseOrderSerializer(serializers.ModelSerializer):
    lines = OrderLineSerializer(many=True)
    vendor_name = serializers.CharField(source='vendor.name', read_only=True)
    created_by_name = serializers.CharField(source='created_by.username', read_only=True)
    approved_by_name = serializers.CharField(source='approved_by.username', read_only=True, default=None)
    requisition_number = serializers.CharField(source='requisition.number', read_only=True, default=None)
    total_amount = serializers.DecimalField(max_digits=16, decimal_places=2, read_only=True)
    ordered_kg = serializers.SerializerMethodField()
    received_kg = serializers.SerializerMethodField()
    invoiced_amount = serializers.SerializerMethodField()

    class Meta:
        model = PurchaseOrder
        fields = [
            'id', 'number', 'vendor', 'vendor_name', 'requisition', 'requisition_number', 'order_date',
            'expected_date', 'status', 'revision', 'notes', 'created_by', 'created_by_name', 'approved_by',
            'approved_by_name', 'approved_at', 'created_at', 'lines', 'total_amount', 'ordered_kg',
            'received_kg', 'invoiced_amount',
        ]
        read_only_fields = ['number', 'status', 'revision', 'created_by', 'approved_by', 'approved_at']

    def get_ordered_kg(self, obj):
        return _fixed(sum((line.quantity_kg for line in obj.lines.all()), Decimal('0')))

    def get_received_kg(self, obj):
        return _fixed(sum((line.received_kg() for line in obj.lines.all()), Decimal('0')))

    def get_invoiced_amount(self, obj):
        return _fixed(sum((inv.total for inv in obj.invoices.all()), Decimal('0')))

    def validate_lines(self, lines):
        if not lines:
            raise serializers.ValidationError('Add at least one line.')
        return lines

    def validate_requisition(self, req):
        if req is not None and req.status not in ('Approved', 'Ordered'):
            raise serializers.ValidationError('Only an approved request can be turned into an order.')
        return req

    def validate(self, data):
        if self.instance:
            services.check_order_editable(self.instance)
            if 'vendor' in data and data['vendor'] != self.instance.vendor and any(
                    line.receipts.exists() for line in self.instance.lines.all()):
                raise serializers.ValidationError({'vendor': ['Goods have been received; the supplier can\'t change.']})
        if (data.get('expected_date') and (data.get('order_date') or getattr(self.instance, 'order_date', None))
                and data['expected_date'] < (data.get('order_date') or self.instance.order_date)):
            raise serializers.ValidationError({'expected_date': ['Expected date can\'t be before the order date.']})
        return data

    @transaction.atomic
    def create(self, validated):
        lines = validated.pop('lines')
        order = PurchaseOrder.objects.create(**validated)
        for line in lines:
            line.pop('id', None)
            PurchaseOrderLine.objects.create(order=order, **line)
        return order

    @transaction.atomic
    def update(self, instance, validated):
        lines = validated.pop('lines', None)
        changed = any(getattr(instance, k) != v for k, v in validated.items() if k not in ('notes',))
        for k, v in validated.items():
            setattr(instance, k, v)
        instance.save()
        if lines is not None:
            existing = {line.pk: line for line in instance.lines.all()}
            keep = set()
            for data in lines:
                line_id = data.pop('id', None)
                line = existing.get(line_id)
                if line:
                    services.check_line_change(line, quantity_kg=data.get('quantity_kg'))
                    if any(getattr(line, k) != v for k, v in data.items()):
                        changed = True
                        for k, v in data.items():
                            setattr(line, k, v)
                        line.save()
                    keep.add(line.pk)
                else:
                    PurchaseOrderLine.objects.create(order=instance, **data)
                    changed = True
            for line_id, line in existing.items():
                if line_id not in keep:
                    services.check_line_change(line, removing=True)
                    line.delete()
                    changed = True
        if changed:
            services.mark_amended(instance)
        return instance


# ── Receipts, returns, quotations ───────────────────────────────────────────

class OpenLineSerializer(serializers.ModelSerializer):
    """A PO line that can still receive goods (for the warehouse delivery form)."""
    order_number = serializers.CharField(source='order.number', read_only=True)
    vendor = serializers.IntegerField(source='order.vendor_id', read_only=True)
    expected_date = serializers.DateField(source='order.expected_date', read_only=True)
    remaining_kg = serializers.SerializerMethodField()

    class Meta:
        model = PurchaseOrderLine
        fields = ['id', 'order', 'order_number', 'vendor', 'material', 'quantity_kg', 'unit_price',
                  'remaining_kg', 'expected_date']

    def get_remaining_kg(self, obj):
        return _fixed(services.line_remaining(obj))


class PurchaseReturnSerializer(serializers.ModelSerializer):
    vendor_name = serializers.CharField(source='receipt.vendor.name', read_only=True)
    receipt_label = serializers.SerializerMethodField()
    created_by_name = serializers.CharField(source='created_by.username', read_only=True)
    order_number = serializers.CharField(source='receipt.po_line.order.number', read_only=True, default=None)

    class Meta:
        model = PurchaseReturn
        fields = ['id', 'number', 'receipt', 'receipt_label', 'vendor_name', 'order_number', 'quantity_kg',
                  'reason', 'return_date', 'created_by', 'created_by_name', 'created_at']
        read_only_fields = ['number', 'created_by']

    def get_receipt_label(self, obj):
        r = obj.receipt
        return f'{r.fabric_type} · {r.vehicle_no} · {r.created_at:%d %b %Y}'

    def validate(self, data):
        receipt = data.get('receipt', getattr(self.instance, 'receipt', None))
        qty = data.get('quantity_kg', getattr(self.instance, 'quantity_kg', None))
        if not (data.get('reason') or getattr(self.instance, 'reason', '')).strip():
            raise serializers.ValidationError({'reason': ['Say why the material is returned.']})
        services.check_return(receipt, qty, return_id=getattr(self.instance, 'pk', None))
        return data


class QuotationSerializer(serializers.ModelSerializer):
    vendor_name = serializers.CharField(source='vendor.name', read_only=True)
    requisition_number = serializers.CharField(source='requisition.number', read_only=True, default=None)

    class Meta:
        model = SupplierQuotation
        fields = ['id', 'vendor', 'vendor_name', 'requisition', 'requisition_number', 'material',
                  'price_per_kg', 'min_quantity_kg', 'quoted_on', 'valid_until', 'notes', 'created_at']

    def validate_price_per_kg(self, value):
        return _positive(value, 'Price')

    def validate(self, data):
        quoted = data.get('quoted_on', getattr(self.instance, 'quoted_on', None))
        valid = data.get('valid_until', getattr(self.instance, 'valid_until', None))
        if quoted and valid and valid < quoted:
            raise serializers.ValidationError({'valid_until': ['Can\'t be before the quote date.']})
        return data


# ── Invoices and payments ───────────────────────────────────────────────────

class SupplierPaymentSerializer(serializers.ModelSerializer):
    paid_by_name = serializers.CharField(source='paid_by.username', read_only=True)
    invoice_number = serializers.CharField(source='invoice.invoice_number', read_only=True)
    vendor_name = serializers.CharField(source='invoice.vendor.name', read_only=True)

    class Meta:
        model = SupplierPayment
        fields = ['id', 'invoice', 'invoice_number', 'vendor_name', 'amount', 'method', 'payment_date',
                  'reference', 'paid_by', 'paid_by_name', 'created_at']
        extra_kwargs = {'paid_by': {'required': False}}

    def validate(self, data):
        invoice = data.get('invoice', getattr(self.instance, 'invoice', None))
        amount = data.get('amount', getattr(self.instance, 'amount', None))
        services.check_payment(invoice, amount, payment_id=getattr(self.instance, 'pk', None))
        return data


class SupplierInvoiceSerializer(serializers.ModelSerializer):
    vendor_name = serializers.CharField(source='vendor.name', read_only=True)
    order_number = serializers.CharField(source='purchase_order.number', read_only=True, default=None)
    total = serializers.DecimalField(max_digits=16, decimal_places=2, read_only=True)
    paid_amount = serializers.SerializerMethodField()
    outstanding = serializers.SerializerMethodField()
    is_overdue = serializers.SerializerMethodField()

    class Meta:
        model = SupplierInvoice
        fields = ['id', 'vendor', 'vendor_name', 'purchase_order', 'order_number', 'invoice_number',
                  'invoice_date', 'due_date', 'amount', 'tax_amount', 'total', 'status', 'paid_amount',
                  'outstanding', 'is_overdue', 'notes', 'created_at']
        read_only_fields = ['status']

    def get_paid_amount(self, obj):
        return _fixed(obj.paid_amount())

    def get_outstanding(self, obj):
        return _fixed(services.outstanding(obj))

    def get_is_overdue(self, obj):
        from django.utils import timezone
        return bool(obj.due_date and obj.status != 'Paid' and obj.due_date < timezone.localdate())

    def validate_amount(self, value):
        return _positive(value, 'Amount')

    def validate_tax_amount(self, value):
        if value is not None and value < 0:
            raise serializers.ValidationError('Tax can\'t be negative.')
        return value

    def validate(self, data):
        vendor = data.get('vendor', getattr(self.instance, 'vendor', None))
        order = data.get('purchase_order', getattr(self.instance, 'purchase_order', None))
        services.check_invoice(vendor, order)
        inv_date = data.get('invoice_date', getattr(self.instance, 'invoice_date', None))
        due = data.get('due_date', getattr(self.instance, 'due_date', None))
        if inv_date and due and due < inv_date:
            raise serializers.ValidationError({'due_date': ['Due date can\'t be before the invoice date.']})
        if self.instance and ('amount' in data or 'tax_amount' in data):
            total = data.get('amount', self.instance.amount) + data.get('tax_amount', self.instance.tax_amount)
            if total < self.instance.paid_amount():
                raise serializers.ValidationError({'amount': ['The total can\'t be less than what has already been paid.']})
        # A supplier's invoice number is used once
        number = data.get('invoice_number', getattr(self.instance, 'invoice_number', None))
        clash = SupplierInvoice.objects.filter(vendor=vendor, invoice_number=number)
        if self.instance:
            clash = clash.exclude(pk=self.instance.pk)
        if clash.exists():
            raise serializers.ValidationError({'invoice_number': ['This supplier already has an invoice with this number.']})
        return data

    def save(self, **kwargs):
        invoice = super().save(**kwargs)
        invoice.refresh_status()
        return invoice
