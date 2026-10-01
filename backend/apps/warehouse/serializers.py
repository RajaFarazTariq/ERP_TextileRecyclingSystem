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
    po_number = serializers.CharField(source='po_line.order.number', read_only=True, default=None)
    po_material = serializers.CharField(source='po_line.material', read_only=True, default=None)

    class Meta:
        model = Stock
        fields = '__all__'

    def validate(self, data):
        our_weight = data.get('our_weight', getattr(self.instance, 'our_weight', None))
        if our_weight is not None and our_weight <= 0:
            raise serializers.ValidationError(
                "Weight must be greater than zero."
            )
        # Optional link to a purchase order line (goods receipt)
        if 'po_line' in data or ('vendor' in data and getattr(self.instance, 'po_line', None)):
            from apps.procurement.services import check_receipt
            check_receipt(
                data.get('po_line', getattr(self.instance, 'po_line', None)),
                data.get('vendor', getattr(self.instance, 'vendor', None)),
                current_line_id=getattr(self.instance, 'po_line_id', None),
            )
        return data