from django.utils import timezone
from rest_framework import serializers
from rest_framework.exceptions import PermissionDenied

from apps.core.permissions import has_duty
from . import services
from .models import Machine, MaintenanceSchedule, PartUse, SparePart, WorkOrder


def _not_negative(value):
    if value is not None and value < 0:
        raise serializers.ValidationError("Can't be negative.")
    return value


class MachineSerializer(serializers.ModelSerializer):
    tank_name = serializers.CharField(source='tank.name', read_only=True, default=None)
    dryer_name = serializers.CharField(source='dryer.name', read_only=True, default=None)
    open_work_orders = serializers.SerializerMethodField()

    class Meta:
        model = Machine
        fields = [
            'id', 'code', 'name', 'category', 'location', 'manufacturer', 'model', 'serial_number', 'specifications',
            'installed_on', 'status', 'hourly_operating_cost', 'notes', 'tank', 'tank_name', 'dryer', 'dryer_name',
            'open_work_orders', 'created_at',
        ]

    def get_open_work_orders(self, obj) -> int:
        return sum(1 for o in obj.work_orders.all() if not o.closed)

    validate_hourly_operating_cost = staticmethod(_not_negative)

    def validate(self, data):
        tank = data.get('tank', getattr(self.instance, 'tank', None))
        dryer = data.get('dryer', getattr(self.instance, 'dryer', None))
        if tank and dryer:
            raise serializers.ValidationError({'dryer': ['Link a machine to a tank or a dryer, not both.']})
        return data


class ScheduleSerializer(serializers.ModelSerializer):
    machine_code = serializers.CharField(source='machine.code', read_only=True)
    machine_name = serializers.CharField(source='machine.name', read_only=True)
    overdue = serializers.SerializerMethodField()
    days_until_due = serializers.SerializerMethodField()
    open_work_order = serializers.SerializerMethodField()

    class Meta:
        model = MaintenanceSchedule
        fields = [
            'id', 'machine', 'machine_code', 'machine_name', 'task', 'every_days', 'start_date', 'last_done_on',
            'next_due_on', 'instructions', 'is_active', 'overdue', 'days_until_due', 'open_work_order', 'created_at',
        ]
        read_only_fields = ['next_due_on']

    def get_days_until_due(self, obj) -> int:
        return (obj.next_due_on - timezone.localdate()).days

    def get_overdue(self, obj) -> bool:
        return obj.is_active and obj.next_due_on < timezone.localdate()

    def get_open_work_order(self, obj) -> str | None:
        """Number of the work order still open for this schedule, if any."""
        return next((o.number for o in obj.work_orders.all() if not o.closed), None)

    def validate_every_days(self, value):
        if value < 1:
            raise serializers.ValidationError('Must be at least 1 day.')
        return value


class PartUseSerializer(serializers.ModelSerializer):
    part_code = serializers.CharField(source='part.code', read_only=True)
    part_name = serializers.CharField(source='part.name', read_only=True)
    unit = serializers.CharField(source='part.unit', read_only=True)
    used_by_name = serializers.CharField(source='used_by.username', read_only=True)
    work_order_number = serializers.CharField(source='work_order.number', read_only=True)
    cost = serializers.SerializerMethodField()

    class Meta:
        model = PartUse
        fields = ['id', 'work_order', 'work_order_number', 'part', 'part_code', 'part_name', 'unit', 'quantity',
                  'unit_cost', 'cost', 'used_by', 'used_by_name', 'created_at']
        read_only_fields = ['unit_cost', 'used_by']

    def get_cost(self, obj) -> str:
        return services.fixed(obj.cost)

    def create(self, validated):
        return services.use_part(validated['work_order'], validated['part'], validated['quantity'],
                                 self.context['request'].user)


class WorkOrderSerializer(serializers.ModelSerializer):
    machine_code = serializers.CharField(source='machine.code', read_only=True)
    machine_name = serializers.CharField(source='machine.name', read_only=True)
    schedule_task = serializers.CharField(source='schedule.task', read_only=True, default=None)
    reported_by_name = serializers.CharField(source='reported_by.username', read_only=True)
    assigned_to_name = serializers.CharField(source='assigned_to.username', read_only=True, default=None)
    parts = PartUseSerializer(many=True, read_only=True)
    parts_cost = serializers.SerializerMethodField()
    total_cost = serializers.SerializerMethodField()

    class Meta:
        model = WorkOrder
        fields = [
            'id', 'number', 'machine', 'machine_code', 'machine_name', 'kind', 'schedule', 'schedule_task', 'title',
            'description', 'priority', 'status', 'is_breakdown', 'reported_by', 'reported_by_name', 'assigned_to',
            'assigned_to_name', 'reported_at', 'started_at', 'completed_at', 'downtime_minutes', 'labour_hours',
            'labour_cost', 'other_cost', 'work_done', 'parts', 'parts_cost', 'total_cost',
        ]
        # Work figures are recorded with the complete action
        read_only_fields = ['number', 'status', 'schedule', 'reported_by', 'reported_at', 'started_at',
                            'completed_at', 'downtime_minutes', 'labour_hours', 'labour_cost', 'other_cost',
                            'work_done']

    def get_parts_cost(self, obj) -> str:
        return services.fixed(obj.parts_cost)

    def get_total_cost(self, obj) -> str:
        return services.fixed(obj.total_cost)

    def validate(self, data):
        user = self.context['request'].user
        order = self.instance
        if order is not None:
            services.check_open(order)
            if not has_duty(user, 'manage_maintenance'):
                if order.reported_by_id != user.pk or order.status != 'Open':
                    raise PermissionDenied('Only an admin can change this work order.')
                if 'machine' in data and data['machine'] != order.machine:
                    raise PermissionDenied('Only an admin can move a work order to another machine.')
        if not has_duty(user, 'manage_maintenance'):
            # Other roles report problems; an admin plans preventive work and assigns people
            if data.get('kind', 'Corrective') != 'Corrective':
                raise PermissionDenied('Only an admin can create preventive work orders.')
            if 'assigned_to' in data and data['assigned_to'] != getattr(order, 'assigned_to', None):
                raise PermissionDenied('Only an admin can assign a work order.')
        machine = data.get('machine')
        if machine is not None and machine.status == 'Retired' and (order is None or order.machine_id != machine.pk):
            raise serializers.ValidationError({'machine': ['This machine is retired.']})
        return data


class SparePartSerializer(serializers.ModelSerializer):
    low = serializers.BooleanField(read_only=True)
    stock_value = serializers.SerializerMethodField()

    class Meta:
        model = SparePart
        fields = ['id', 'code', 'name', 'unit', 'stock_quantity', 'reorder_level', 'unit_cost', 'location', 'low',
                  'stock_value', 'created_at']

    def get_stock_value(self, obj) -> str:
        return services.fixed(obj.stock_quantity * obj.unit_cost)

    validate_stock_quantity = staticmethod(_not_negative)
    validate_reorder_level = staticmethod(_not_negative)
    validate_unit_cost = staticmethod(_not_negative)

    def validate(self, data):
        # After a part exists its stock moves only through receiving and use on work orders
        if self.instance is not None and 'stock_quantity' in data and data['stock_quantity'] != self.instance.stock_quantity:
            raise serializers.ValidationError({'stock_quantity': ['Use “Receive” to add stock.']})
        return data
