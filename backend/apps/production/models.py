"""
Production planning: configurable process stages, routings (the stages an
order goes through), bills of materials, and production orders that track
planned against actual consumption, output, time, cost and waste.

An order plans the processing of one fabric lot. It does not replace the
sorting, decolorization and drying sessions and moves no stock itself: those
sessions (and the drying output they post to the inventory ledger) keep
working exactly as before.
"""
from decimal import Decimal

from django.db import models

from apps.procurement.models import NumberedModel
from apps.users.models import CustomUser

ZERO = Decimal('0')
KG = {'max_digits': 12, 'decimal_places': 2}
HOURS = {'max_digits': 7, 'decimal_places': 2}
MONEY = {'max_digits': 12, 'decimal_places': 2}


class ProcessStage(models.Model):
    """One kind of processing step. Factories differ, so the list is configurable."""
    MODULE_CHOICES = [('', 'None'), ('sorting', 'Sorting'), ('decolorization', 'Decolorization'), ('drying', 'Drying')]

    name = models.CharField(max_length=100, unique=True)
    sequence = models.PositiveIntegerField(default=0, help_text='Usual position in the process')
    module = models.CharField(max_length=20, choices=MODULE_CHOICES, blank=True, default='',
                              help_text='The module whose sessions do this work, if any')
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ['sequence', 'name']

    def __str__(self):
        return self.name


class Routing(models.Model):
    """An ordered list of stages a production order goes through."""
    name = models.CharField(max_length=150, unique=True)
    description = models.TextField(blank=True, default='')
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return self.name


class RoutingStep(models.Model):
    routing = models.ForeignKey(Routing, on_delete=models.CASCADE, related_name='steps')
    stage = models.ForeignKey(ProcessStage, on_delete=models.PROTECT, related_name='routing_steps')
    sequence = models.PositiveIntegerField()
    planned_hours = models.DecimalField(**HOURS, default=ZERO)
    hourly_cost = models.DecimalField(**MONEY, default=ZERO, help_text='Labour and machine cost, Rs. per hour')

    class Meta:
        ordering = ['sequence', 'id']

    def __str__(self):
        return f'{self.routing.name}: {self.stage.name}'


class BillOfMaterials(models.Model):
    """What processing 100 kg of input needs (chemicals, packaging, ...)."""
    name = models.CharField(max_length=150, unique=True)
    product_name = models.CharField(max_length=255, blank=True, default='')
    is_active = models.BooleanField(default=True)
    notes = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['name']
        verbose_name_plural = 'bills of materials'

    def __str__(self):
        return self.name


class BomLine(models.Model):
    bom = models.ForeignKey(BillOfMaterials, on_delete=models.CASCADE, related_name='lines')
    material = models.CharField(max_length=255)
    chemical = models.ForeignKey('decolorization.ChemicalStock', on_delete=models.PROTECT, null=True, blank=True,
                                 related_name='bom_lines', help_text='Set for chemicals, to check stock')
    quantity_per_100kg = models.DecimalField(**KG)
    unit = models.CharField(max_length=20, default='kg')
    unit_cost = models.DecimalField(**MONEY, default=ZERO, help_text='Rs. per unit')

    class Meta:
        ordering = ['id']

    def __str__(self):
        return f'{self.bom.name}: {self.material}'


class ProductionOrder(NumberedModel):
    PREFIX = 'MO'
    STATUS_CHOICES = [
        ('Draft', 'Draft'),
        ('Released', 'Released'),
        ('In Progress', 'In Progress'),
        ('Completed', 'Completed'),
        ('Cancelled', 'Cancelled'),
    ]
    OPEN_STATUSES = ('Draft', 'Released', 'In Progress')
    PRIORITY_CHOICES = [('Low', 'Low'), ('Normal', 'Normal'), ('High', 'High')]

    product_name = models.CharField(max_length=255)
    fabric = models.ForeignKey('sorting.FabricStock', on_delete=models.PROTECT, related_name='production_orders')
    unit = models.ForeignKey('warehouse.FactoryUnit', on_delete=models.PROTECT, null=True, blank=True)
    routing = models.ForeignKey(Routing, on_delete=models.PROTECT, related_name='orders')
    bom = models.ForeignKey(BillOfMaterials, on_delete=models.PROTECT, null=True, blank=True, related_name='orders')
    planned_input_kg = models.DecimalField(**KG)
    planned_output_kg = models.DecimalField(**KG)
    planned_start = models.DateField()
    planned_end = models.DateField()
    priority = models.CharField(max_length=10, choices=PRIORITY_CHOICES, default='Normal')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='Draft')
    actual_output_kg = models.DecimalField(**KG, null=True, blank=True)
    notes = models.TextField(blank=True, default='')
    created_by = models.ForeignKey(CustomUser, on_delete=models.PROTECT, related_name='production_orders')
    released_by = models.ForeignKey(CustomUser, on_delete=models.PROTECT, null=True, blank=True, related_name='+')
    released_at = models.DateTimeField(null=True, blank=True)
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at', '-id']

    def __str__(self):
        return self.number or f'Production order #{self.pk}'


class OrderStep(models.Model):
    """One stage of one order: who runs it on which machine, and what went in and came out."""
    STATUS_CHOICES = [('Pending', 'Pending'), ('In Progress', 'In Progress'), ('Done', 'Done'), ('Skipped', 'Skipped')]
    CLOSED = ('Done', 'Skipped')

    order = models.ForeignKey(ProductionOrder, on_delete=models.CASCADE, related_name='steps')
    stage = models.ForeignKey(ProcessStage, on_delete=models.PROTECT, related_name='order_steps')
    sequence = models.PositiveIntegerField()
    status = models.CharField(max_length=15, choices=STATUS_CHOICES, default='Pending')
    operator = models.ForeignKey(CustomUser, on_delete=models.PROTECT, null=True, blank=True, related_name='production_steps')
    machine = models.CharField(max_length=100, blank=True, default='')
    planned_hours = models.DecimalField(**HOURS, default=ZERO)
    hourly_cost = models.DecimalField(**MONEY, default=ZERO)
    started_at = models.DateTimeField(null=True, blank=True)
    finished_at = models.DateTimeField(null=True, blank=True)
    actual_hours = models.DecimalField(**HOURS, null=True, blank=True)
    input_kg = models.DecimalField(**KG, null=True, blank=True)
    output_kg = models.DecimalField(**KG, null=True, blank=True)
    waste_kg = models.DecimalField(**KG, null=True, blank=True)
    notes = models.TextField(blank=True, default='')

    class Meta:
        ordering = ['sequence', 'id']

    def __str__(self):
        return f'{self.order}: {self.stage.name}'


class MaterialUse(models.Model):
    """Planned and actual use of one material on an order. A record only: chemical stock moves through issuances."""
    order = models.ForeignKey(ProductionOrder, on_delete=models.CASCADE, related_name='materials')
    material = models.CharField(max_length=255)
    chemical = models.ForeignKey('decolorization.ChemicalStock', on_delete=models.PROTECT, null=True, blank=True,
                                 related_name='production_uses')
    unit = models.CharField(max_length=20, default='kg')
    planned_quantity = models.DecimalField(**KG)
    actual_quantity = models.DecimalField(**KG, null=True, blank=True)
    unit_cost = models.DecimalField(**MONEY, default=ZERO)

    class Meta:
        ordering = ['id']

    def __str__(self):
        return f'{self.order}: {self.material}'
