# drying/models.py
"""
Drying module — Step 4 in the textile recycling pipeline.
Pipeline: Warehouse → Sorting → Decolorization → Drying → Sales

After decolorization output, wet fabric goes into dryers.
This module tracks:
  - Dryer machines (capacity, status)
  - Drying sessions (input from decolorization, output kg after drying)
  - Temperature/duration settings per session
"""

from django.db import models
from django.utils import timezone
from sorting.models import FabricStock
from decolorization.models import DecolorizationSession
from users.models import CustomUser


class Dryer(models.Model):
    STATUS_CHOICES = [
        ('Available', 'Available'),
        ('Running',   'Running'),
        ('Cooling',   'Cooling'),
        ('Maintenance', 'Maintenance'),
    ]

    name       = models.CharField(max_length=100)          # e.g. "Dryer D-01"
    capacity   = models.DecimalField(max_digits=10, decimal_places=2)  # kg per batch
    dryer_type = models.CharField(
        max_length=50,
        choices=[
            ('Tumble',    'Tumble Dryer'),
            ('Conveyor',  'Conveyor Belt Dryer'),
            ('Chamber',   'Chamber Dryer'),
        ],
        default='Tumble',
    )
    status     = models.CharField(
        max_length=20, choices=STATUS_CHOICES, default='Available'
    )
    notes      = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.name} ({self.dryer_type}) — {self.status}"

    class Meta:
        ordering = ['name']


class DryingSession(models.Model):
    STATUS_CHOICES = [
        ('Pending',     'Pending'),
        ('In Progress', 'In Progress'),
        ('Completed',   'Completed'),
        ('Failed',      'Failed'),
        ('On Hold',     'On Hold'),
    ]

    # Relationships — link back to decolorization output
    dryer          = models.ForeignKey(
        Dryer, on_delete=models.CASCADE,
        related_name='drying_sessions'
    )
    fabric         = models.ForeignKey(
        FabricStock, on_delete=models.CASCADE,
        related_name='drying_sessions'
    )
    # Optionally link to the decolorization session this fabric came from
    decolor_session = models.ForeignKey(
        DecolorizationSession, on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='drying_sessions',
        help_text='Decolorization session this batch originated from'
    )
    supervisor     = models.ForeignKey(
        CustomUser, on_delete=models.CASCADE,
        related_name='drying_sessions'
    )

    # Quantities
    input_quantity  = models.DecimalField(max_digits=10, decimal_places=2,
                                          help_text='kg received wet from decolorization')
    output_quantity = models.DecimalField(max_digits=10, decimal_places=2, default=0,
                                          help_text='kg after drying (weight loss expected ~8-15%)')
    waste_quantity  = models.DecimalField(max_digits=10, decimal_places=2, default=0,
                                          help_text='kg discarded (damaged, contaminated during drying)')

    # Drying parameters
    temperature_celsius = models.DecimalField(
        max_digits=5, decimal_places=1, null=True, blank=True,
        help_text='Operating temperature in °C'
    )
    duration_minutes    = models.PositiveIntegerField(
        null=True, blank=True,
        help_text='Total drying duration in minutes'
    )

    # Status & timing
    status     = models.CharField(
        max_length=20, choices=STATUS_CHOICES, default='Pending'
    )
    start_date = models.DateTimeField(null=True, blank=True)
    end_date   = models.DateTimeField(null=True, blank=True)
    notes      = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return (
            f"{self.dryer.name} — "
            f"{self.fabric.material_type} — "
            f"{self.status}"
        )

    @property
    def moisture_loss_kg(self):
        """How many kg were lost to evaporation (not waste)."""
        if self.output_quantity and self.input_quantity:
            return max(0, float(self.input_quantity) - float(self.output_quantity) - float(self.waste_quantity))
        return 0

    @property
    def output_efficiency_pct(self):
        """Output as % of input."""
        if self.input_quantity and float(self.input_quantity) > 0:
            return round(float(self.output_quantity) / float(self.input_quantity) * 100, 1)
        return 0

    class Meta:
        ordering = ['-created_at']
