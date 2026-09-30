from rest_framework import serializers
from .models import FabricStock, SortingSession


class FabricStockSerializer(serializers.ModelSerializer):
    stock_fabric_type = serializers.CharField(
        source='stock.fabric_type', read_only=True
    )
    stock_vendor = serializers.CharField(
        source='stock.vendor.name', read_only=True
    )

    # Sellable dried stock for this lot (see apps.inventory)
    dried_available_kg = serializers.SerializerMethodField()

    class Meta:
        model = FabricStock
        fields = '__all__'
        # Maintained by sorting sessions; remaining starts equal to initial
        read_only_fields = ['sorted_quantity']
        extra_kwargs = {'remaining_quantity': {'required': False}}

    def get_dried_available_kg(self, obj) -> float:
        figures = self.context.get('availability')
        if figures is None:
            from apps.inventory.services import available
            return float(available(obj.pk))
        row = figures.get(obj.pk)
        return float(row['available']) if row else 0.0

    def validate(self, data):
        initial_quantity = data.get('initial_quantity', getattr(self.instance, 'initial_quantity', None))
        if initial_quantity is not None and initial_quantity <= 0:
            raise serializers.ValidationError(
                "Initial quantity must be greater than zero."
            )
        if self.instance is None:
            data['remaining_quantity'] = min(data.get('remaining_quantity', initial_quantity), initial_quantity)
        else:
            data.pop('remaining_quantity', None)
            if 'initial_quantity' in data:
                new_remaining = self.instance.remaining_quantity + (
                    data['initial_quantity'] - self.instance.initial_quantity)
                if new_remaining < 0:
                    raise serializers.ValidationError({'initial_quantity': [
                        'More than this has already been sorted.'
                    ]})
                data['remaining_quantity'] = new_remaining
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
        quantity_taken = data.get('quantity_taken', getattr(self.instance, 'quantity_taken', None))
        if quantity_taken is not None and quantity_taken <= 0:
            raise serializers.ValidationError(
                "Quantity taken must be greater than zero."
            )
        return data