from decimal import Decimal

from django.db import transaction
from rest_framework import serializers
from rest_framework.exceptions import PermissionDenied

from apps.core.permissions import is_admin
from .models import (
    ChemicalIssuance, ChemicalLot, ChemicalStock, DecolorizationSession, Recipe, RecipeLine, RecipeVersion, Tank,
)

ZERO = Decimal('0')


class ChemicalStockSerializer(serializers.ModelSerializer):
    """
    Remaining stock is set from total stock on creation and then maintained by
    issuances. Raising or lowering total stock later (a restock or correction)
    moves remaining stock by the same amount.
    """
    supplier_name = serializers.CharField(source='supplier.name', read_only=True, default=None)

    class Meta:
        model = ChemicalStock
        fields = '__all__'
        read_only_fields = ['issued_quantity']
        extra_kwargs = {'remaining_stock': {'required': False}}

    def validate_unit_cost(self, value):
        if value < 0:
            raise serializers.ValidationError("Cost can't be negative.")
        return value

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
    unit_of_measure = serializers.CharField(source='chemical.unit_of_measure', read_only=True)
    cost = serializers.SerializerMethodField()

    class Meta:
        model = ChemicalIssuance
        fields = '__all__'
        # Defaults to the logged-in user when not given
        extra_kwargs = {'issued_by': {'required': False}}

    def get_cost(self, obj) -> str:
        return f'{obj.quantity * obj.unit_cost:.2f}'

    def validate(self, data):
        chemical = data.get('chemical', getattr(self.instance, 'chemical', None))
        quantity = data.get('quantity', getattr(self.instance, 'quantity', None))
        if chemical is None or quantity is None:
            return data
        request = self.context.get('request')
        if chemical.is_restricted and request is not None and not is_admin(request.user):
            raise PermissionDenied(f'{chemical.chemical_name} is restricted: only an admin can issue it.')
        session = data.get('session')
        tank = data.get('tank', getattr(self.instance, 'tank', None))
        if session is not None and tank is not None and session.tank_id != tank.pk:
            raise serializers.ValidationError({'session': ['This session runs in another tank.']})
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
    recipe_name = serializers.SerializerMethodField()
    approved_by_name = serializers.CharField(source='approved_by.username', read_only=True, default=None)
    chemical_cost = serializers.SerializerMethodField()

    class Meta:
        model = DecolorizationSession
        fields = '__all__'
        read_only_fields = ['approved_by', 'approved_at']

    def get_recipe_name(self, obj) -> str | None:
        version = obj.recipe_version
        return f'{version.recipe.name} v{version.version}' if version else None

    def get_chemical_cost(self, obj) -> str:
        return f'{sum((i.quantity * i.unit_cost for i in obj.issuances.all()), ZERO):.2f}'

    def validate(self, data):
        from apps.quality.services import check_lot_change
        check_lot_change(self, data, 'decolorized')
        for field in ('temperature_c', 'water_liters'):
            if data.get(field) is not None and data[field] < 0:
                raise serializers.ValidationError({field: ["Can't be negative."]})
        return data


# ── Chemical lots ───────────────────────────────────────────────────────────

class ChemicalLotSerializer(serializers.ModelSerializer):
    chemical_name = serializers.CharField(source='chemical.chemical_name', read_only=True)
    unit_of_measure = serializers.CharField(source='chemical.unit_of_measure', read_only=True)
    supplier_name = serializers.CharField(source='supplier.name', read_only=True, default=None)
    received_by_name = serializers.CharField(source='received_by.username', read_only=True)
    expired = serializers.SerializerMethodField()

    class Meta:
        model = ChemicalLot
        fields = '__all__'
        read_only_fields = ['received_by']

    def get_expired(self, obj) -> bool:
        from django.utils import timezone
        return obj.expiry_date is not None and obj.expiry_date < timezone.localdate()

    def validate(self, data):
        lot = self.instance
        if lot is not None:
            # The quantity is already in stock: correct a mistake by deleting the lot and entering it again
            for field in ('chemical', 'quantity'):
                if field in data and data[field] != getattr(lot, field):
                    raise serializers.ValidationError({field: [
                        "This can't be changed after the lot is received. Delete the lot and enter it again."
                    ]})
        if data.get('quantity') is not None and data['quantity'] <= 0:
            raise serializers.ValidationError({'quantity': ['Must be greater than zero.']})
        if data.get('unit_cost') is not None and data['unit_cost'] < 0:
            raise serializers.ValidationError({'unit_cost': ["Cost can't be negative."]})
        received = data.get('received_on', getattr(lot, 'received_on', None))
        expiry = data.get('expiry_date', getattr(lot, 'expiry_date', None))
        if expiry and received and expiry < received:
            raise serializers.ValidationError({'expiry_date': ["Can't be before the date it was received."]})
        return data


# ── Recipes ─────────────────────────────────────────────────────────────────

class RecipeLineSerializer(serializers.ModelSerializer):
    chemical_name = serializers.CharField(source='chemical.chemical_name', read_only=True)
    unit_of_measure = serializers.CharField(source='chemical.unit_of_measure', read_only=True)

    class Meta:
        model = RecipeLine
        fields = ['id', 'chemical', 'chemical_name', 'unit_of_measure', 'quantity_per_100kg']

    def validate_quantity_per_100kg(self, value):
        if value <= 0:
            raise serializers.ValidationError('Quantity must be greater than zero.')
        return value


class RecipeVersionSerializer(serializers.ModelSerializer):
    lines = RecipeLineSerializer(many=True)
    created_by_name = serializers.CharField(source='created_by.username', read_only=True)
    sessions = serializers.IntegerField(source='sessions.count', read_only=True)

    class Meta:
        model = RecipeVersion
        fields = ['id', 'version', 'temperature_c', 'duration_minutes', 'water_liters_per_100kg', 'notes',
                  'created_by', 'created_by_name', 'created_at', 'lines', 'sessions']
        read_only_fields = ['version', 'created_by']


class RecipeSerializer(serializers.ModelSerializer):
    """
    Reads return the recipe with every version, newest first. Writes take the
    process (`lines` and the settings) at the top level: creating a recipe makes
    version 1, and saving a changed process makes the next version.
    """
    versions = RecipeVersionSerializer(many=True, read_only=True)
    lines = RecipeLineSerializer(many=True, write_only=True, required=False)
    temperature_c = serializers.DecimalField(max_digits=5, decimal_places=1, write_only=True, required=False, allow_null=True)
    duration_minutes = serializers.IntegerField(min_value=0, write_only=True, required=False, allow_null=True)
    water_liters_per_100kg = serializers.DecimalField(max_digits=10, decimal_places=2, write_only=True, required=False, allow_null=True)
    change_note = serializers.CharField(write_only=True, required=False, allow_blank=True)

    PROCESS = ('temperature_c', 'duration_minutes', 'water_liters_per_100kg')

    class Meta:
        model = Recipe
        fields = ['id', 'name', 'material_type', 'is_active', 'created_at', 'versions',
                  'lines', 'temperature_c', 'duration_minutes', 'water_liters_per_100kg', 'change_note']

    def validate(self, data):
        if self.instance is None and not data.get('lines'):
            raise serializers.ValidationError({'lines': ['Add at least one chemical.']})
        if 'lines' in data:
            if not data['lines']:
                raise serializers.ValidationError({'lines': ['Add at least one chemical.']})
            chemicals = [line['chemical'].pk for line in data['lines']]
            if len(chemicals) != len(set(chemicals)):
                raise serializers.ValidationError({'lines': ['Each chemical can be listed once.']})
        return data

    def _process(self, validated):
        process = {k: validated.pop(k) for k in self.PROCESS if k in validated}
        return validated.pop('lines', None), process, validated.pop('change_note', '')

    def _add_version(self, recipe, number, lines, process, note):
        version = RecipeVersion.objects.create(recipe=recipe, version=number, notes=note,
                                               created_by=self.context['request'].user, **process)
        for line in lines:
            RecipeLine.objects.create(version=version, **line)

    @transaction.atomic
    def create(self, validated):
        lines, process, note = self._process(validated)
        recipe = Recipe.objects.create(**validated)
        self._add_version(recipe, 1, lines, process, note)
        return recipe

    @transaction.atomic
    def update(self, instance, validated):
        lines, process, note = self._process(validated)
        for k, v in validated.items():
            setattr(instance, k, v)
        instance.save()
        current = instance.versions.first()
        new_process = {k: process.get(k, getattr(current, k)) for k in self.PROCESS}
        old_lines = [(line.chemical_id, line.quantity_per_100kg) for line in current.lines.all()]
        new_lines = [(line['chemical'].pk, line['quantity_per_100kg']) for line in lines] if lines is not None else old_lines
        if new_lines != old_lines or any(new_process[k] != getattr(current, k) for k in self.PROCESS):
            if lines is None:
                lines = [{'chemical': line.chemical, 'quantity_per_100kg': line.quantity_per_100kg} for line in current.lines.all()]
            self._add_version(instance, current.version + 1, lines, new_process, note)
        return instance
