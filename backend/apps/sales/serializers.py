from rest_framework import serializers

from apps.inventory import services as inventory
from .models import Customer, SalesOrder, DispatchTracking, Payment


class CustomerSerializer(serializers.ModelSerializer):
    order_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = Customer
        fields = ['id', 'name', 'contact', 'address', 'notes', 'created_at', 'order_count']

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

    class Meta:
        model = SalesOrder
        fields = '__all__'
        # Always the logged-in user who created the order
        read_only_fields = ['created_by']
        # Either a customer or a typed buyer name is enough (see validate)
        extra_kwargs = {'buyer_name': {'required': False, 'allow_blank': True}}

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
