from rest_framework import serializers

from apps.inventory import services as inventory
from . import services
from .models import (
    Customer, DispatchTracking, Payment, Product, ProductPrice, SalesInvoice, SalesOrder, SalesQuotation, SalesReturn,
)


class CustomerSerializer(serializers.ModelSerializer):
    order_count = serializers.IntegerField(read_only=True, default=0)
    balance = serializers.SerializerMethodField()
    over_limit = serializers.SerializerMethodField()

    class Meta:
        model = Customer
        fields = ['id', 'name', 'contact', 'address', 'notes', 'created_at', 'order_count',
                  'email', 'category', 'credit_limit', 'payment_terms_days', 'is_active', 'balance', 'over_limit']

    def _balance(self, obj):
        balances = self.context.get('balances')
        if balances is None:
            balances = services.customer_balances([obj.pk])
        return balances[obj.pk]['balance'] if obj.pk in balances else services.ZERO

    def get_balance(self, obj) -> str:
        return f'{self._balance(obj):.2f}'

    def get_over_limit(self, obj) -> bool:
        return bool(obj.credit_limit) and self._balance(obj) > obj.credit_limit

    def validate_credit_limit(self, value):
        if value < 0:
            raise serializers.ValidationError("Can't be negative.")
        return value

    def validate_name(self, value):
        from .models import normalize_name
        clash = Customer.objects.filter(normalized_name=normalize_name(value))
        if self.instance:
            clash = clash.exclude(pk=self.instance.pk)
        if clash.exists():
            raise serializers.ValidationError('A customer with this name already exists.')
        return value


class PaymentSerializer(serializers.ModelSerializer):
    received_by_name = serializers.CharField(
        source='received_by.username', read_only=True
    )

    class Meta:
        model = Payment
        fields = '__all__'
        # Defaults to the logged-in user when not given
        extra_kwargs = {'received_by': {'required': False}}


class DispatchTrackingSerializer(serializers.ModelSerializer):
    dispatched_by_name = serializers.CharField(
        source='dispatched_by.username', read_only=True
    )
    order_buyer = serializers.CharField(
        source='sales_order.buyer_name', read_only=True
    )
    challan_number = serializers.SerializerMethodField()

    def get_challan_number(self, obj) -> str:
        return f'DC-{obj.pk:05d}'

    class Meta:
        model = DispatchTracking
        fields = '__all__'
        # Defaults to the logged-in user when not given
        extra_kwargs = {'dispatched_by': {'required': False}}

    def validate(self, data):
        order  = data.get('sales_order', getattr(self.instance, 'sales_order', None))
        weight = data.get('dispatched_weight', getattr(self.instance, 'dispatched_weight', None))
        if weight is not None and weight <= 0:
            raise serializers.ValidationError({'dispatched_weight': ['Must be greater than zero.']})
        changed = self.instance is None or 'sales_order' in data or 'dispatched_weight' in data
        if order is not None and weight is not None and changed:
            inventory.check_dispatch(order, weight, dispatch_id=getattr(self.instance, 'pk', None))
        return data


class SalesOrderSerializer(serializers.ModelSerializer):
    created_by_name = serializers.CharField(
        source='created_by.username', read_only=True
    )
    fabric_material = serializers.CharField(
        source='fabric.material_type', read_only=True
    )
    customer_name = serializers.CharField(source='customer.name', read_only=True, default=None)
    dispatches = DispatchTrackingSerializer(many=True, read_only=True)
    payments = PaymentSerializer(many=True, read_only=True)
    product_name = serializers.CharField(source='product.name', read_only=True, default=None)
    quotation_number = serializers.CharField(source='quotation.number', read_only=True, default=None)
    invoiced_weight = serializers.SerializerMethodField()
    returned_weight = serializers.SerializerMethodField()
    credited = serializers.SerializerMethodField()

    class Meta:
        model = SalesOrder
        fields = '__all__'
        # Always the logged-in user who created the order
        read_only_fields = ['created_by']
        # Either a customer or a typed buyer name is enough (see validate)
        extra_kwargs = {'buyer_name': {'required': False, 'allow_blank': True}}

    def get_invoiced_weight(self, obj) -> str:
        return f'{sum((i.weight for i in obj.invoices.all()), services.ZERO):.2f}'

    def get_returned_weight(self, obj) -> str:
        return f'{sum((r.weight for r in obj.returns.all() if r.status != "Rejected"), services.ZERO):.2f}'

    def get_credited(self, obj) -> str:
        return f'{sum((r.credit_amount for r in obj.returns.all() if r.status == "Approved"), services.ZERO):.2f}'

    def _percent(self, value):
        if value < 0 or value > 100:
            raise serializers.ValidationError('Must be between 0 and 100.')
        return value

    validate_discount_pct = _percent
    validate_tax_pct = _percent

    def validate(self, data):
        weight_sold = data.get('weight_sold', getattr(self.instance, 'weight_sold', None))
        price_per_kg = data.get('price_per_kg', getattr(self.instance, 'price_per_kg', None))
        if weight_sold is not None and weight_sold <= 0:
            raise serializers.ValidationError(
                "Weight sold must be greater than zero."
            )
        if price_per_kg is not None and price_per_kg <= 0:
            raise serializers.ValidationError(
                "Price per kg must be greater than zero."
            )

        customer = data.get('customer', getattr(self.instance, 'customer', None))
        buyer    = data.get('buyer_name', getattr(self.instance, 'buyer_name', '')) or ''
        if not buyer.strip() and customer is None:
            raise serializers.ValidationError({'buyer_name': ['Enter a buyer name or choose a customer.']})

        # Confirmed/Dispatched orders hold dried stock: check it is available
        # whenever an order enters that state or its fabric/weight changes.
        status = data.get('status', getattr(self.instance, 'status', 'Draft'))
        fabric = data.get('fabric', getattr(self.instance, 'fabric', None))
        if status in inventory.RESERVING_STATUSES and fabric is not None and weight_sold is not None:
            was_reserving = self.instance is not None and self.instance.status in inventory.RESERVING_STATUSES
            relevant_change = (
                not was_reserving
                or ('fabric' in data and data['fabric'] != self.instance.fabric)
                or ('weight_sold' in data and data['weight_sold'] != self.instance.weight_sold)
            )
            if relevant_change:
                inventory.check_order_reservation(fabric.pk, weight_sold,
                                                  order_id=getattr(self.instance, 'pk', None))
        return data


# ── Products and price list ─────────────────────────────────────────────────

class ProductPriceSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductPrice
        fields = ['id', 'customer_category', 'price_per_kg']

    def validate_price_per_kg(self, value):
        if value <= 0:
            raise serializers.ValidationError('Must be greater than zero.')
        return value


class ProductSerializer(serializers.ModelSerializer):
    prices = ProductPriceSerializer(many=True, required=False)

    class Meta:
        model = Product
        fields = ['id', 'name', 'material_type', 'grade', 'specification', 'price_per_kg', 'is_active', 'created_at', 'prices']

    def validate_price_per_kg(self, value):
        if value <= 0:
            raise serializers.ValidationError('Must be greater than zero.')
        return value

    def validate_prices(self, value):
        categories = [p['customer_category'] for p in value]
        if len(categories) != len(set(categories)):
            raise serializers.ValidationError('Each customer category can have one price.')
        return value

    def _set_prices(self, product, prices):
        product.prices.all().delete()
        for price in prices:
            ProductPrice.objects.create(product=product, **price)

    def create(self, validated):
        prices = validated.pop('prices', [])
        product = Product.objects.create(**validated)
        self._set_prices(product, prices)
        return product

    def update(self, instance, validated):
        prices = validated.pop('prices', None)
        for k, v in validated.items():
            setattr(instance, k, v)
        instance.save()
        if prices is not None:
            self._set_prices(instance, prices)
        return instance


# ── Quotations ──────────────────────────────────────────────────────────────

class SalesQuotationSerializer(serializers.ModelSerializer):
    customer_name = serializers.CharField(source='customer.name', read_only=True)
    product_name = serializers.CharField(source='product.name', read_only=True, default=None)
    fabric_material = serializers.CharField(source='fabric.material_type', read_only=True, default=None)
    created_by_name = serializers.CharField(source='created_by.username', read_only=True)
    expired = serializers.SerializerMethodField()

    class Meta:
        model = SalesQuotation
        fields = '__all__'
        read_only_fields = ['status', 'created_by', 'order', 'decided_at', 'rejection_reason']

    def get_expired(self, obj) -> bool:
        from django.utils import timezone
        return obj.status in ('Draft', 'Sent') and obj.valid_until is not None and obj.valid_until < timezone.localdate()

    def validate(self, data):
        if self.instance is not None and self.instance.status not in ('Draft', 'Sent'):
            raise serializers.ValidationError(
                f'A quotation that is {self.instance.status.lower()} can\'t be changed.')
        for field in ('weight', 'price_per_kg'):
            if data.get(field) is not None and data[field] <= 0:
                raise serializers.ValidationError({field: ['Must be greater than zero.']})
        for field in ('discount_pct', 'tax_pct'):
            if data.get(field) is not None and not 0 <= data[field] <= 100:
                raise serializers.ValidationError({field: ['Must be between 0 and 100.']})
        return data


# ── Invoices ────────────────────────────────────────────────────────────────

class SalesInvoiceSerializer(serializers.ModelSerializer):
    customer_name = serializers.CharField(source='order.buyer_name', read_only=True)
    customer_contact = serializers.CharField(source='order.buyer_contact', read_only=True, default=None)
    customer_address = serializers.CharField(source='order.buyer_address', read_only=True, default=None)
    fabric_material = serializers.CharField(source='order.fabric.material_type', read_only=True)
    fabric_quality = serializers.CharField(source='order.fabric_quality', read_only=True)
    discount_pct = serializers.DecimalField(source='order.discount_pct', max_digits=5, decimal_places=2, read_only=True)
    tax_pct = serializers.DecimalField(source='order.tax_pct', max_digits=5, decimal_places=2, read_only=True)
    created_by_name = serializers.CharField(source='created_by.username', read_only=True)
    paid = serializers.SerializerMethodField()
    status = serializers.SerializerMethodField()

    class Meta:
        model = SalesInvoice
        fields = '__all__'
        read_only_fields = ['order', 'weight', 'price_per_kg', 'subtotal', 'discount_amount', 'tax_amount', 'total', 'created_by']

    def _state(self, obj):
        states = self.context.get('invoice_states')
        if states is None or obj.pk not in states:
            states = services.invoice_states([obj])
        return states[obj.pk]

    def get_paid(self, obj) -> str:
        return f"{self._state(obj)['paid']:.2f}"

    def get_status(self, obj) -> str:
        return self._state(obj)['status']

    def validate(self, data):
        invoice_date = data.get('invoice_date', getattr(self.instance, 'invoice_date', None))
        due = data.get('due_date', getattr(self.instance, 'due_date', None))
        if invoice_date and due and due < invoice_date:
            raise serializers.ValidationError({'due_date': ["Can't be before the invoice date."]})
        return data


# ── Returns ─────────────────────────────────────────────────────────────────

class SalesReturnSerializer(serializers.ModelSerializer):
    customer_name = serializers.CharField(source='order.buyer_name', read_only=True)
    fabric_material = serializers.CharField(source='order.fabric.material_type', read_only=True)
    created_by_name = serializers.CharField(source='created_by.username', read_only=True)
    decided_by_name = serializers.CharField(source='decided_by.username', read_only=True, default=None)

    class Meta:
        model = SalesReturn
        fields = '__all__'
        read_only_fields = ['status', 'credit_amount', 'decided_by', 'decided_at', 'created_by', 'rejection_reason']

    def validate(self, data):
        if self.instance is not None and self.instance.status != 'Requested':
            raise serializers.ValidationError(f'This return is already {self.instance.status.lower()} and can\'t be changed.')
        order = data.get('order', getattr(self.instance, 'order', None))
        weight = data.get('weight', getattr(self.instance, 'weight', None))
        if order is not None:
            services.check_return(order, weight, exclude_id=getattr(self.instance, 'pk', None))
        return data
