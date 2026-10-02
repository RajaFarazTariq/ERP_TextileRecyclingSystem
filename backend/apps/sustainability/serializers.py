from django.utils import timezone
from rest_framework import serializers

from .models import SustainabilityTarget, UtilityReading, WasteCategory, WasteRecord


def _not_negative(data, *names):
    for name in names:
        if data.get(name) is not None and data[name] < 0:
            raise serializers.ValidationError({name: ["Can't be negative."]})


def _not_in_future(data):
    if data.get('date') and data['date'] > timezone.localdate():
        raise serializers.ValidationError({'date': ["The date can't be in the future."]})


class WasteCategorySerializer(serializers.ModelSerializer):
    records = serializers.IntegerField(source='records.count', read_only=True)

    class Meta:
        model = WasteCategory
        fields = ['id', 'name', 'classification', 'description', 'is_active', 'records', 'created_at']


class WasteRecordSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source='category.name', read_only=True)
    classification = serializers.CharField(source='category.classification', read_only=True)
    fabric_material = serializers.CharField(source='fabric.material_type', read_only=True, default=None)
    recorded_by_name = serializers.CharField(source='recorded_by.username', read_only=True)

    class Meta:
        model = WasteRecord
        fields = [
            'id', 'date', 'category', 'category_name', 'classification', 'stage', 'quantity_kg', 'fabric',
            'fabric_material', 'disposal_method', 'disposed_to', 'disposal_cost', 'revenue', 'disposal_reference',
            'notes', 'recorded_by', 'recorded_by_name', 'created_at',
        ]
        read_only_fields = ['recorded_by']

    def validate(self, data):
        if 'quantity_kg' in data and data['quantity_kg'] <= 0:
            raise serializers.ValidationError({'quantity_kg': ['Must be greater than zero.']})
        _not_negative(data, 'disposal_cost', 'revenue')
        _not_in_future(data)
        category = data.get('category')
        if category and not category.is_active and category != getattr(self.instance, 'category', None):
            raise serializers.ValidationError({'category': ['This waste category is not in use.']})
        return data


class UtilityReadingSerializer(serializers.ModelSerializer):
    recorded_by_name = serializers.CharField(source='recorded_by.username', read_only=True)

    class Meta:
        model = UtilityReading
        fields = ['id', 'date', 'utility', 'quantity', 'unit', 'cost', 'stage', 'meter_reference', 'notes',
                  'recorded_by', 'recorded_by_name', 'created_at']
        read_only_fields = ['unit', 'recorded_by']

    def validate(self, data):
        if 'quantity' in data and data['quantity'] <= 0:
            raise serializers.ValidationError({'quantity': ['Must be greater than zero.']})
        _not_negative(data, 'cost')
        _not_in_future(data)
        return data


class TargetSerializer(serializers.ModelSerializer):
    metric_label = serializers.CharField(source='get_metric_display', read_only=True)

    class Meta:
        model = SustainabilityTarget
        fields = ['id', 'metric', 'metric_label', 'target_value', 'direction', 'period', 'is_active', 'created_at']

    def validate(self, data):
        def value(name):
            return data[name] if name in data else getattr(self.instance, name, None)

        if value('target_value') is not None and value('target_value') < 0:
            raise serializers.ValidationError({'target_value': ["Can't be negative."]})
        # One active target per figure, so the dashboard has a single answer
        if value('is_active') is not False:
            others = SustainabilityTarget.objects.filter(metric=value('metric'), is_active=True)
            if self.instance:
                others = others.exclude(pk=self.instance.pk)
            if others.exists():
                raise serializers.ValidationError({'metric': [
                    'There is already an active target for this figure. Edit it, or switch it off first.']})
        return data
