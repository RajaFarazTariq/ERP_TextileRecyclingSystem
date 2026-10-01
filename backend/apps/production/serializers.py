from decimal import Decimal

from django.db import transaction
from rest_framework import serializers
from rest_framework.exceptions import PermissionDenied

from apps.core.permissions import is_admin
from . import services
from .models import (
    BillOfMaterials, BomLine, MaterialUse, OrderStep, ProcessStage, ProductionOrder, Routing, RoutingStep,
)


def _fixed(value):
    """Computed amounts go out as '1234.50' strings, like the model's DecimalFields."""
    return None if value is None else f'{value:.2f}'


def _not_negative(value, label):
    if value is not None and value < 0:
        raise serializers.ValidationError(f"{label} can't be negative.")
    return value


class StageSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProcessStage
        fields = ['id', 'name', 'sequence', 'module', 'is_active']


# ── Routings ────────────────────────────────────────────────────────────────

class RoutingStepSerializer(serializers.ModelSerializer):
    stage_name = serializers.CharField(source='stage.name', read_only=True)

    class Meta:
        model = RoutingStep
        fields = ['id', 'stage', 'stage_name', 'sequence', 'planned_hours', 'hourly_cost']
        read_only_fields = ['sequence']   # the order of the list

    def validate_planned_hours(self, value):
        return _not_negative(value, 'Hours')

    def validate_hourly_cost(self, value):
        return _not_negative(value, 'Cost')


class RoutingSerializer(serializers.ModelSerializer):
    steps = RoutingStepSerializer(many=True)
    orders = serializers.IntegerField(source='orders.count', read_only=True)
    planned_hours = serializers.SerializerMethodField()

    class Meta:
        model = Routing
        fields = ['id', 'name', 'description', 'is_active', 'created_at', 'steps', 'orders', 'planned_hours']

    def get_planned_hours(self, obj) -> str:
        return _fixed(sum((s.planned_hours for s in obj.steps.all()), Decimal('0')))

    def validate_steps(self, steps):
        if not steps:
            raise serializers.ValidationError('Add at least one stage.')
        return steps

    def _save_steps(self, routing, steps):
        routing.steps.all().delete()
        for position, step in enumerate(steps, start=1):
            RoutingStep.objects.create(routing=routing, sequence=position, **step)

    @transaction.atomic
    def create(self, validated):
        steps = validated.pop('steps')
        routing = Routing.objects.create(**validated)
        self._save_steps(routing, steps)
        return routing

    @transaction.atomic
    def update(self, instance, validated):
        steps = validated.pop('steps', None)
        for k, v in validated.items():
            setattr(instance, k, v)
        instance.save()
        if steps is not None:
            self._save_steps(instance, steps)   # orders keep the steps they were created with
        return instance


# ── Bills of materials ──────────────────────────────────────────────────────

class BomLineSerializer(serializers.ModelSerializer):
    chemical_name = serializers.CharField(source='chemical.chemical_name', read_only=True, default=None)

    class Meta:
        model = BomLine
        fields = ['id', 'material', 'chemical', 'chemical_name', 'quantity_per_100kg', 'unit', 'unit_cost']

    def validate_quantity_per_100kg(self, value):
        if value <= 0:
            raise serializers.ValidationError('Quantity must be greater than zero.')
        return value

    def validate_unit_cost(self, value):
        return _not_negative(value, 'Cost')


class BomSerializer(serializers.ModelSerializer):
    lines = BomLineSerializer(many=True)
    orders = serializers.IntegerField(source='orders.count', read_only=True)

    class Meta:
        model = BillOfMaterials
        fields = ['id', 'name', 'product_name', 'is_active', 'notes', 'created_at', 'lines', 'orders']

    def validate_lines(self, lines):
        if not lines:
            raise serializers.ValidationError('Add at least one material.')
        return lines

    def _save_lines(self, bom, lines):
        bom.lines.all().delete()
        for line in lines:
            BomLine.objects.create(bom=bom, **line)

    @transaction.atomic
    def create(self, validated):
        lines = validated.pop('lines')
        bom = BillOfMaterials.objects.create(**validated)
        self._save_lines(bom, lines)
        return bom

    @transaction.atomic
    def update(self, instance, validated):
        lines = validated.pop('lines', None)
        for k, v in validated.items():
            setattr(instance, k, v)
        instance.save()
        if lines is not None:
            self._save_lines(instance, lines)
        return instance


# ── Orders ──────────────────────────────────────────────────────────────────

class OrderStepSerializer(serializers.ModelSerializer):
    stage_name = serializers.CharField(source='stage.name', read_only=True)
    stage_module = serializers.CharField(source='stage.module', read_only=True)
    operator_name = serializers.CharField(source='operator.username', read_only=True, default=None)
    order_number = serializers.CharField(source='order.number', read_only=True)
    cost = serializers.SerializerMethodField()

    class Meta:
        model = OrderStep
        fields = ['id', 'order', 'order_number', 'stage', 'stage_name', 'stage_module', 'sequence', 'status',
                  'operator', 'operator_name', 'machine', 'planned_hours', 'hourly_cost', 'started_at', 'finished_at',
                  'actual_hours', 'input_kg', 'output_kg', 'waste_kg', 'notes', 'cost']
        # Results are recorded with the start/complete actions
        read_only_fields = ['order', 'stage', 'sequence', 'status', 'started_at', 'finished_at', 'actual_hours',
                            'input_kg', 'output_kg', 'waste_kg']

    def get_cost(self, obj) -> str:
        return _fixed((obj.actual_hours or Decimal('0')) * obj.hourly_cost)

    def validate(self, data):
        if self.instance.order.status in ('Completed', 'Cancelled'):
            raise serializers.ValidationError({'status': [f'A {self.instance.order.status.lower()} order can no longer be changed.']})
        _not_negative(data.get('planned_hours'), 'Hours')
        _not_negative(data.get('hourly_cost'), 'Cost')
        return data


class MaterialUseSerializer(serializers.ModelSerializer):
    chemical_name = serializers.CharField(source='chemical.chemical_name', read_only=True, default=None)
    planned_cost = serializers.SerializerMethodField()
    actual_cost = serializers.SerializerMethodField()

    class Meta:
        model = MaterialUse
        fields = ['id', 'order', 'material', 'chemical', 'chemical_name', 'unit', 'planned_quantity',
                  'actual_quantity', 'unit_cost', 'planned_cost', 'actual_cost']

    def get_planned_cost(self, obj) -> str:
        return _fixed(obj.planned_quantity * obj.unit_cost)

    def get_actual_cost(self, obj) -> str | None:
        return None if obj.actual_quantity is None else _fixed(obj.actual_quantity * obj.unit_cost)

    def validate(self, data):
        user = self.context['request'].user
        order = data.get('order', getattr(self.instance, 'order', None))
        if order.status in ('Completed', 'Cancelled'):
            raise serializers.ValidationError({'order': [f'A {order.status.lower()} order can no longer be changed.']})
        if not is_admin(user):
            # Supervisors record what was actually used; the plan is the admin's
            services.check_floor_user(user)
            if self.instance is None or set(data) - {'actual_quantity'}:
                raise PermissionDenied('Only an admin can change the planned materials.')
        if self.instance and 'order' in data and data['order'] != self.instance.order:
            raise serializers.ValidationError({'order': ["A material line can't be moved to another order."]})
        for field, label in (('planned_quantity', 'Quantity'), ('actual_quantity', 'Quantity'), ('unit_cost', 'Cost')):
            _not_negative(data.get(field), label)
        return data


class ProductionOrderSerializer(serializers.ModelSerializer):
    steps = OrderStepSerializer(many=True, read_only=True)
    materials = MaterialUseSerializer(many=True, read_only=True)
    fabric_material = serializers.CharField(source='fabric.material_type', read_only=True)
    unit_name = serializers.CharField(source='unit.name', read_only=True, default=None)
    routing_name = serializers.CharField(source='routing.name', read_only=True)
    bom_name = serializers.CharField(source='bom.name', read_only=True, default=None)
    created_by_name = serializers.CharField(source='created_by.username', read_only=True)
    released_by_name = serializers.CharField(source='released_by.username', read_only=True, default=None)

    # After release only the schedule may still change
    SCHEDULE_FIELDS = {'planned_start', 'planned_end', 'priority', 'notes', 'unit'}

    class Meta:
        model = ProductionOrder
        fields = [
            'id', 'number', 'product_name', 'fabric', 'fabric_material', 'unit', 'unit_name', 'routing', 'routing_name',
            'bom', 'bom_name', 'planned_input_kg', 'planned_output_kg', 'planned_start', 'planned_end', 'priority',
            'status', 'actual_output_kg', 'notes', 'created_by', 'created_by_name', 'released_by', 'released_by_name',
            'released_at', 'started_at', 'completed_at', 'created_at', 'steps', 'materials',
        ]
        read_only_fields = ['number', 'status', 'actual_output_kg', 'created_by', 'released_by', 'released_at',
                            'started_at', 'completed_at']

    def to_representation(self, instance):
        data = super().to_representation(instance)
        for key, value in services.figures(instance).items():
            data[key] = _fixed(value) if isinstance(value, Decimal) else value
        return data

    def validate(self, data):
        order = self.instance

        def value(name):
            return data[name] if name in data else getattr(order, name, None)

        if order is not None:
            if order.status in ('Completed', 'Cancelled'):
                raise serializers.ValidationError({'status': [f'A {order.status.lower()} order can no longer be changed.']})
            if order.status != 'Draft':
                changed = {k for k, v in data.items() if getattr(order, k) != v} - self.SCHEDULE_FIELDS
                if changed:
                    raise serializers.ValidationError({sorted(changed)[0]: [
                        'The order is released: only its dates, priority and notes can still change.'
                    ]})
        if value('planned_input_kg') <= 0:
            raise serializers.ValidationError({'planned_input_kg': ['Must be greater than zero.']})
        if value('planned_output_kg') <= 0:
            raise serializers.ValidationError({'planned_output_kg': ['Must be greater than zero.']})
        if value('planned_output_kg') > value('planned_input_kg'):
            raise serializers.ValidationError({'planned_output_kg': ["Planned output can't be more than the input."]})
        if value('planned_end') < value('planned_start'):
            raise serializers.ValidationError({'planned_end': ["The end date can't be before the start date."]})
        if order is None or 'routing' in data and data['routing'] != order.routing:
            if not data['routing'].is_active:
                raise serializers.ValidationError({'routing': ['This routing is no longer in use.']})
        return data

    @transaction.atomic
    def create(self, validated):
        order = ProductionOrder.objects.create(**validated)
        services.build_steps(order)
        services.build_materials(order)
        return order

    @transaction.atomic
    def update(self, instance, validated):
        rebuild_steps = 'routing' in validated and validated['routing'] != instance.routing
        rebuild_materials = (('bom' in validated and validated['bom'] != instance.bom)
                             or ('planned_input_kg' in validated and validated['planned_input_kg'] != instance.planned_input_kg))
        for k, v in validated.items():
            setattr(instance, k, v)
        instance.save()
        if rebuild_steps:
            services.build_steps(instance)
        if rebuild_materials:
            services.build_materials(instance)
        return instance
