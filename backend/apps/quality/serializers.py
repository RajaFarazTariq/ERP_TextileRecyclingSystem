from django.db import transaction
from django.utils import timezone
from rest_framework import serializers
from rest_framework.exceptions import PermissionDenied

from apps.core.permissions import is_admin
from . import services
from .models import CorrectiveAction, Inspection, InspectionResult, QualityStandard, StandardCheck


def _check_limits(data):
    low, high = data.get('min_value'), data.get('max_value')
    if low is not None and high is not None and low > high:
        raise serializers.ValidationError({'min_value': ["The minimum can't be above the maximum."]})


# ── Standards ───────────────────────────────────────────────────────────────

class StandardCheckSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(required=False)

    class Meta:
        model = StandardCheck
        fields = ['id', 'name', 'kind', 'unit', 'min_value', 'max_value']

    def validate(self, data):
        _check_limits(data)
        if data.get('kind') == 'Measure' and data.get('min_value') is None and data.get('max_value') is None:
            raise serializers.ValidationError({'min_value': ['Give a measurement a minimum, a maximum or both.']})
        return data


class StandardSerializer(serializers.ModelSerializer):
    checks = StandardCheckSerializer(many=True)
    inspections = serializers.IntegerField(source='inspections.count', read_only=True)

    class Meta:
        model = QualityStandard
        fields = ['id', 'name', 'stage', 'material_type', 'is_active', 'notes', 'created_at', 'checks', 'inspections']

    def validate_checks(self, checks):
        if not checks:
            raise serializers.ValidationError('Add at least one check.')
        return checks

    def _save_checks(self, standard, checks):
        standard.checks.all().delete()
        for check in checks:
            check.pop('id', None)
            StandardCheck.objects.create(standard=standard, **check)

    @transaction.atomic
    def create(self, validated):
        checks = validated.pop('checks')
        standard = QualityStandard.objects.create(**validated)
        self._save_checks(standard, checks)
        return standard

    @transaction.atomic
    def update(self, instance, validated):
        checks = validated.pop('checks', None)
        for k, v in validated.items():
            setattr(instance, k, v)
        instance.save()
        if checks is not None:
            self._save_checks(instance, checks)
        return instance


# ── Corrective actions ──────────────────────────────────────────────────────

class CorrectiveActionSerializer(serializers.ModelSerializer):
    inspection_number = serializers.CharField(source='inspection.number', read_only=True)
    owner_name = serializers.CharField(source='owner.username', read_only=True, default=None)
    created_by_name = serializers.CharField(source='created_by.username', read_only=True)
    overdue = serializers.SerializerMethodField()

    class Meta:
        model = CorrectiveAction
        fields = ['id', 'inspection', 'inspection_number', 'kind', 'description', 'owner', 'owner_name', 'due_date',
                  'status', 'completed_at', 'completion_note', 'created_by', 'created_by_name', 'created_at', 'overdue']
        read_only_fields = ['status', 'completed_at', 'completion_note', 'created_by']

    def get_overdue(self, obj) -> bool:
        return obj.status == 'Open' and obj.due_date is not None and obj.due_date < timezone.localdate()

    def validate(self, data):
        inspection = data.get('inspection', getattr(self.instance, 'inspection', None))
        services.check_may_inspect(self.context['request'].user, inspection.stage)
        if self.instance and 'inspection' in data and data['inspection'] != self.instance.inspection:
            raise serializers.ValidationError({'inspection': ["An action can't be moved to another inspection."]})
        return data


# ── Inspections ─────────────────────────────────────────────────────────────

class InspectionResultSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(required=False)
    passed = serializers.BooleanField(required=False, allow_null=True, default=None)

    class Meta:
        model = InspectionResult
        fields = ['id', 'name', 'kind', 'unit', 'min_value', 'max_value', 'value', 'passed', 'note']

    def validate(self, data):
        _check_limits(data)
        data['passed'] = services.judge(data.get('kind', 'Measure'), data.get('value'),
                                        data.get('min_value'), data.get('max_value'), data.get('passed'))
        return data


class InspectionSerializer(serializers.ModelSerializer):
    results = InspectionResultSerializer(many=True, required=False)
    actions = CorrectiveActionSerializer(many=True, read_only=True)
    material = serializers.SerializerMethodField()
    vendor_name = serializers.SerializerMethodField()
    target = serializers.SerializerMethodField()
    standard_name = serializers.CharField(source='standard.name', read_only=True, default=None)
    inspector_name = serializers.CharField(source='inspector.username', read_only=True)
    released_by_name = serializers.CharField(source='released_by.username', read_only=True, default=None)
    quarantined = serializers.BooleanField(read_only=True)
    failed_checks = serializers.SerializerMethodField()

    class Meta:
        model = Inspection
        fields = [
            'id', 'number', 'stage', 'stock', 'fabric', 'target', 'material', 'vendor_name', 'standard',
            'standard_name', 'inspector', 'inspector_name', 'inspected_on', 'sample_kg', 'composition', 'result',
            'rejection_reason', 'notes', 'quarantined', 'released_by', 'released_by_name', 'released_at',
            'release_note', 'created_at', 'results', 'failed_checks', 'actions',
        ]
        read_only_fields = ['number', 'inspector', 'released_by', 'released_at', 'release_note']

    def _stock(self, obj):
        return obj.stock or (obj.fabric.stock if obj.fabric else None)

    def get_material(self, obj) -> str:
        return obj.fabric.material_type if obj.fabric else obj.stock.fabric_type

    def get_vendor_name(self, obj) -> str:
        return self._stock(obj).vendor.name

    def get_target(self, obj) -> str:
        return f'Lot #{obj.fabric_id}' if obj.fabric_id else f'Delivery #{obj.stock_id}'

    def get_failed_checks(self, obj) -> int:
        return sum(1 for r in obj.results.all() if not r.passed)

    def validate(self, data):
        user = self.context['request'].user
        current = self.instance

        def value(name):
            return data[name] if name in data else getattr(current, name, None)

        if current is not None:
            if current.released_at:
                raise serializers.ValidationError({'result': ["A released inspection can't be changed."]})
            if current.result == 'Fail' and not is_admin(user):
                raise PermissionDenied('Only an admin can change a failed inspection.')

        stage = value('stage')
        services.check_may_inspect(user, stage)

        stock, fabric = value('stock'), value('fabric')
        if stage == 'Incoming':
            if stock is None:
                raise serializers.ValidationError({'stock': ['Choose the delivery that was inspected.']})
            data['fabric'] = None
        else:
            if fabric is None:
                raise serializers.ValidationError({'fabric': ['Choose the fabric lot that was inspected.']})
            data['stock'] = None

        standard = value('standard')
        if standard is not None and standard.stage != stage:
            raise serializers.ValidationError({'standard': [f'This standard is for {standard.stage.lower()} inspections.']})

        sample = value('sample_kg')
        if sample is not None and sample <= 0:
            raise serializers.ValidationError({'sample_kg': ['Must be greater than zero.']})

        result = value('result')
        results = data['results'] if 'results' in data else [
            {'passed': r.passed} for r in current.results.all()] if current else []
        if result == 'Pass' and any(not r['passed'] for r in results):
            raise serializers.ValidationError({'result': [
                "A check failed, so the result can't be Pass. Choose Conditional or Fail."
            ]})
        if result == 'Fail':
            if not (value('rejection_reason') or '').strip():
                raise serializers.ValidationError({'rejection_reason': ['Say why the material failed.']})
        else:
            data['rejection_reason'] = ''
            if result == 'Conditional' and not (value('notes') or '').strip():
                raise serializers.ValidationError({'notes': ['Write the condition under which the material is accepted.']})
        return data

    def _save_results(self, inspection, results):
        inspection.results.all().delete()
        for result in results:
            result.pop('id', None)
            InspectionResult.objects.create(inspection=inspection, **result)

    @transaction.atomic
    def create(self, validated):
        results = validated.pop('results', [])
        inspection = Inspection.objects.create(**validated)
        self._save_results(inspection, results)
        return inspection

    @transaction.atomic
    def update(self, instance, validated):
        results = validated.pop('results', None)
        for k, v in validated.items():
            setattr(instance, k, v)
        instance.save()
        if results is not None:
            self._save_results(instance, results)
        return instance
