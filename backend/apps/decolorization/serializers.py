from rest_framework import serializers
from .models import ChemicalStock, Tank, ChemicalIssuance, DecolorizationSession


class ChemicalStockSerializer(serializers.ModelSerializer):
    """
    Remaining stock is set from total stock on creation and then maintained by
    issuances. Raising or lowering total stock later (a restock or correction)
    moves remaining stock by the same amount.
    """
    class Meta:
        model = ChemicalStock
        fields = '__all__'
        read_only_fields = ['issued_quantity']
        extra_kwargs = {'remaining_stock': {'required': False}}

    def validate(self, data):
        total_stock = data.get('total_stock', getattr(self.instance, 'total_stock', None))
        if total_stock is not None and total_stock <= 0:
            raise serializers.ValidationError(
                "Total stock must be greater than zero."
            )
        if self.instance is None:
            data['remaining_stock'] = min(data.get('remaining_stock', total_stock), total_stock)
        else:
            data.pop('remaining_stock', None)
            if 'total_stock' in data:
                new_remaining = self.instance.remaining_stock + (data['total_stock'] - self.instance.total_stock)
                if new_remaining < 0:
                    raise serializers.ValidationError({'total_stock': [
                        f'{self.instance.issued_quantity:,.2f} has already been issued; '
                        f'total stock cannot be lower than that.'
                    ]})
                data['remaining_stock'] = new_remaining
        return data


class TankSerializer(serializers.ModelSerializer):
    fabric_material = serializers.CharField(
        source='fabric.material_type', read_only=True
    )
    supervisor_name = serializers.CharField(
        source='supervisor.username', read_only=True
    )

    class Meta:
        model = Tank
        fields = '__all__'


class ChemicalIssuanceSerializer(serializers.ModelSerializer):
    chemical_name = serializers.CharField(
        source='chemical.chemical_name', read_only=True
    )
    tank_name = serializers.CharField(
        source='tank.name', read_only=True
    )
    issued_by_name = serializers.CharField(
        source='issued_by.username', read_only=True
    )

    class Meta:
        model = ChemicalIssuance
        fields = '__all__'
        # Defaults to the logged-in user when not given
        extra_kwargs = {'issued_by': {'required': False}}

    def validate(self, data):
        chemical = data.get('chemical', getattr(self.instance, 'chemical', None))
        quantity = data.get('quantity', getattr(self.instance, 'quantity', None))
        if chemical is None or quantity is None:
            return data
        if quantity <= 0:
            raise serializers.ValidationError({'quantity': ['Must be greater than zero.']})
        # On edit, this issuance's own quantity is already out of remaining stock
        available = chemical.remaining_stock
        if self.instance is not None and self.instance.chemical_id == chemical.id:
            available += self.instance.quantity
        if quantity > available:
            raise serializers.ValidationError(
                f"Not enough stock. Available: {available}"
            )
        return data


class DecolorizationSessionSerializer(serializers.ModelSerializer):
    tank_name = serializers.CharField(
        source='tank.name', read_only=True
    )
    fabric_material = serializers.CharField(
        source='fabric.material_type', read_only=True
    )
    supervisor_name = serializers.CharField(
        source='supervisor.username', read_only=True
    )

    class Meta:
        model = DecolorizationSession
        fields = '__all__'