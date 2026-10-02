"""
Equipment and maintenance: the machine register, preventive schedules, work
orders (preventive and corrective), spare parts and the parts used on a job.

A machine can point to a decolorization tank or a dryer, so its downtime can be
set next to the sessions run on that equipment. Maintenance never changes the
tank or dryer itself.
"""
from datetime import timedelta
from decimal import Decimal

from django.db import models
from django.utils import timezone

from apps.procurement.models import NumberedModel
from apps.users.models import CustomUser

MONEY = {'max_digits': 14, 'decimal_places': 2}
QTY = {'max_digits': 12, 'decimal_places': 2}


class Machine(models.Model):
    STATUS_CHOICES = [
        ('Running', 'Running'),
        ('Idle', 'Idle'),
        ('Under maintenance', 'Under maintenance'),
        ('Broken down', 'Broken down'),
        ('Retired', 'Retired'),
    ]

    code = models.CharField(max_length=30, unique=True)
    name = models.CharField(max_length=150)
    category = models.CharField(max_length=60, blank=True, default='',
                                help_text='e.g. Sorting line, Tank, Dryer, Baler, Shredder, Utility')
    location = models.CharField(max_length=120, blank=True, default='')
    manufacturer = models.CharField(max_length=120, blank=True, default='')
    model = models.CharField(max_length=120, blank=True, default='')
    serial_number = models.CharField(max_length=120, blank=True, default='')
    specifications = models.TextField(blank=True, default='')
    installed_on = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='Running')
    hourly_operating_cost = models.DecimalField(**MONEY, default=0)
    notes = models.TextField(blank=True, default='')
    # Optional link to the equipment used by production
    tank = models.ForeignKey('decolorization.Tank', on_delete=models.SET_NULL, null=True, blank=True,
                             related_name='machines')
    dryer = models.ForeignKey('drying.Dryer', on_delete=models.SET_NULL, null=True, blank=True,
                              related_name='machines')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['code']

    def __str__(self):
        return f'{self.code} {self.name}'


class MaintenanceSchedule(models.Model):
    """A preventive task repeated every N days on one machine."""
    machine = models.ForeignKey(Machine, on_delete=models.CASCADE, related_name='schedules')
    task = models.CharField(max_length=150)
    every_days = models.PositiveIntegerField()
    start_date = models.DateField(default=timezone.localdate, help_text='First due date, until the task is done once')
    last_done_on = models.DateField(null=True, blank=True)
    next_due_on = models.DateField(editable=False)
    instructions = models.TextField(blank=True, default='')
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['next_due_on', 'id']

    def __str__(self):
        return f'{self.task} ({self.machine.code})'

    def save(self, *args, **kwargs):
        self.next_due_on = (self.last_done_on + timedelta(days=self.every_days)
                            if self.last_done_on else self.start_date)
        if kwargs.get('update_fields') is not None:
            kwargs['update_fields'] = {*kwargs['update_fields'], 'next_due_on'}
        super().save(*args, **kwargs)


class WorkOrder(NumberedModel):
    PREFIX = 'WO'
    KIND_CHOICES = [('Preventive', 'Preventive'), ('Corrective', 'Corrective')]
    PRIORITY_CHOICES = [('Low', 'Low'), ('Normal', 'Normal'), ('High', 'High'), ('Urgent', 'Urgent')]
    STATUS_CHOICES = [('Open', 'Open'), ('In progress', 'In progress'), ('Done', 'Done'), ('Cancelled', 'Cancelled')]
    CLOSED = ('Done', 'Cancelled')

    machine = models.ForeignKey(Machine, on_delete=models.PROTECT, related_name='work_orders')
    kind = models.CharField(max_length=12, choices=KIND_CHOICES, default='Corrective')
    schedule = models.ForeignKey(MaintenanceSchedule, on_delete=models.SET_NULL, null=True, blank=True,
                                 related_name='work_orders')
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True, default='')
    priority = models.CharField(max_length=10, choices=PRIORITY_CHOICES, default='Normal')
    status = models.CharField(max_length=12, choices=STATUS_CHOICES, default='Open')
    is_breakdown = models.BooleanField(default=False, help_text='The machine stopped unexpectedly')
    reported_by = models.ForeignKey(CustomUser, on_delete=models.PROTECT, related_name='reported_work_orders')
    assigned_to = models.ForeignKey(CustomUser, on_delete=models.PROTECT, null=True, blank=True,
                                    related_name='assigned_work_orders')
    reported_at = models.DateTimeField(default=timezone.now)
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    downtime_minutes = models.PositiveIntegerField(default=0, help_text='How long the machine was stopped')
    labour_hours = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    labour_cost = models.DecimalField(**MONEY, default=0)
    other_cost = models.DecimalField(**MONEY, default=0)
    work_done = models.TextField(blank=True, default='')

    class Meta:
        ordering = ['-reported_at', '-id']
        indexes = [models.Index(fields=['status', 'reported_at'])]

    def __str__(self):
        return f'{self.number or "Work order"} ({self.status})'

    @property
    def closed(self):
        return self.status in self.CLOSED

    @property
    def parts_cost(self):
        return sum((use.cost for use in self.parts.all()), Decimal('0'))

    @property
    def total_cost(self):
        return self.labour_cost + self.other_cost + self.parts_cost


class SparePart(models.Model):
    code = models.CharField(max_length=30, unique=True)
    name = models.CharField(max_length=150)
    unit = models.CharField(max_length=20, default='pcs')
    stock_quantity = models.DecimalField(**QTY, default=0)
    reorder_level = models.DecimalField(**QTY, default=0)
    unit_cost = models.DecimalField(**MONEY, default=0)
    location = models.CharField(max_length=120, blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return f'{self.code} {self.name}'

    @property
    def low(self):
        return self.stock_quantity <= self.reorder_level


class PartUse(models.Model):
    """Spare parts taken from stock for a work order. The cost is kept as it was on that day."""
    work_order = models.ForeignKey(WorkOrder, on_delete=models.PROTECT, related_name='parts')
    part = models.ForeignKey(SparePart, on_delete=models.PROTECT, related_name='uses')
    quantity = models.DecimalField(**QTY)
    unit_cost = models.DecimalField(**MONEY, default=0)
    used_by = models.ForeignKey(CustomUser, on_delete=models.PROTECT, related_name='+')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['id']
        verbose_name = 'part used'
        verbose_name_plural = 'parts used'

    def __str__(self):
        return f'{self.quantity} x {self.part.name}'

    @property
    def cost(self):
        return (self.quantity * self.unit_cost).quantize(Decimal('0.01'))
