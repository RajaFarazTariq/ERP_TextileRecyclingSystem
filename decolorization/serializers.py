from rest_framework import serializers
from .models import ChemicalStock, Tank, ChemicalIssuance, DecolorizationSession


class ChemicalStockSerializer(serializers.ModelSerializer):
    class Meta:
        model = ChemicalStock
        fields = '__all__'

    def validate(self, data):
        if data['total_stock'] <= 0:
            raise serializers.ValidationError(
                "Total stock must be greater than zero."
            )
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

    def validate(self, data):
        chemical = data['chemical']
        quantity = data['quantity']
        if quantity > chemical.remaining_stock:
            raise serializers.ValidationError(
                f"Not enough stock. Available: {chemical.remaining_stock}"
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