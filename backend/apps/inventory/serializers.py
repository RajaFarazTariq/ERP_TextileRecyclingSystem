from rest_framework import serializers

from .models import StockMovement


class StockMovementSerializer(serializers.ModelSerializer):
    fabric_material = serializers.CharField(source='fabric.material_type', read_only=True)
    created_by_name = serializers.CharField(source='created_by.username', read_only=True, default=None)

    class Meta:
        model = StockMovement
        fields = '__all__'


class AdjustmentSerializer(serializers.Serializer):
    fabric   = serializers.IntegerField()
    quantity = serializers.DecimalField(max_digits=12, decimal_places=2,
                                        help_text='Positive adds stock, negative removes it')
    note     = serializers.CharField(max_length=255, help_text='Reason, e.g. "Physical count 2026-10-01"')

    def validate_quantity(self, value):
        if value == 0:
            raise serializers.ValidationError('Quantity cannot be zero.')
        return value

    def validate_fabric(self, value):
        from apps.sorting.models import FabricStock
        if not FabricStock.objects.filter(pk=value).exists():
            raise serializers.ValidationError('Fabric lot not found.')
        return value


class FabricAvailabilitySerializer(serializers.Serializer):
    fabric          = serializers.IntegerField()
    material_type   = serializers.CharField()
    on_hand_kg      = serializers.DecimalField(max_digits=12, decimal_places=2)
    reserved_kg     = serializers.DecimalField(max_digits=12, decimal_places=2)
    available_kg    = serializers.DecimalField(max_digits=12, decimal_places=2)
