from rest_framework import serializers
from .models import FabricStock, SortingSession


class FabricStockSerializer(serializers.ModelSerializer):
    stock_fabric_type = serializers.CharField(
        source='stock.fabric_type', read_only=True
    )
    stock_vendor = serializers.CharField(
        source='stock.vendor.name', read_only=True
    )

    class Meta:
        model = FabricStock
        fields = '__all__'

    def validate(self, data):
        if data['initial_quantity'] <= 0:
            raise serializers.ValidationError(
                "Initial quantity must be greater than zero."
            )
        return data


class SortingSessionSerializer(serializers.ModelSerializer):
    fabric_material = serializers.CharField(
        source='fabric.material_type', read_only=True
    )
    supervisor_name = serializers.CharField(
        source='supervisor.username', read_only=True
    )

    class Meta:
        model = SortingSession
        fields = '__all__'

    def validate(self, data):
        if data['quantity_taken'] <= 0:
            raise serializers.ValidationError(
                "Quantity taken must be greater than zero."
            )
        return data