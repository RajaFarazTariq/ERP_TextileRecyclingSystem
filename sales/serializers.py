from rest_framework import serializers
from .models import SalesOrder, DispatchTracking, Payment


class PaymentSerializer(serializers.ModelSerializer):
    received_by_name = serializers.CharField(
        source='received_by.username', read_only=True
    )

    class Meta:
        model = Payment
        fields = '__all__'


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


class SalesOrderSerializer(serializers.ModelSerializer):
    created_by_name = serializers.CharField(
        source='created_by.username', read_only=True
    )
    fabric_material = serializers.CharField(
        source='fabric.material_type', read_only=True
    )
    dispatches = DispatchTrackingSerializer(many=True, read_only=True)
    payments = PaymentSerializer(many=True, read_only=True)

    class Meta:
        model = SalesOrder
        fields = '__all__'

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
        return data