from rest_framework import serializers
from .models import Vendor, FactoryUnit, Stock


class VendorSerializer(serializers.ModelSerializer):
    class Meta:
        model = Vendor
        fields = '__all__'


class FactoryUnitSerializer(serializers.ModelSerializer):
    class Meta:
        model = FactoryUnit
        fields = '__all__'


class StockSerializer(serializers.ModelSerializer):
    vendor_name = serializers.CharField(
        source='vendor.name', read_only=True
    )
    unit_name = serializers.CharField(
        source='unit.name', read_only=True
    )

    class Meta:
        model = Stock
        fields = '__all__'

    def validate(self, data):
        if data['our_weight'] <= 0:
            raise serializers.ValidationError(
                "Weight must be greater than zero."
            )
        return data