from django.db import models
from django.utils import timezone

from apps.users.models import CustomUser

STAGES = ['Warehouse', 'Sorting', 'Decolorization', 'Drying', 'Other']
STAGE_CHOICES = [(s, s) for s in STAGES]


class WasteCategory(models.Model):
    """A kind of waste the factory handles, e.g. fibre dust or chemical sludge."""
    CLASSIFICATION_CHOICES = [
        ('Recyclable', 'Recyclable'),
        ('Reusable', 'Reusable'),
        ('Hazardous', 'Hazardous'),
        ('General', 'General / landfill'),
    ]

    name = models.CharField(max_length=100, unique=True)
    classification = models.CharField(max_length=20, choices=CLASSIFICATION_CHOICES, default='General')
    description = models.TextField(blank=True, default='')
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['name']
        verbose_name_plural = 'waste categories'

    def __str__(self):
        return self.name


class WasteRecord(models.Model):
    """
    Waste or rejected material that was weighed and disposed of.

    Process loss (input minus output of a session) is not entered here; it is
    worked out from the sorting, decolorization and drying sessions.
    """
    METHOD_CHOICES = [
        ('Recycled internally', 'Recycled internally'),
        ('Sold as by-product', 'Sold as by-product'),
        ('Sent to recycler', 'Sent to recycler'),
        ('Reused', 'Reused'),
        ('Landfill', 'Landfill'),
        ('Incinerated', 'Incinerated'),
        ('Treated', 'Treated'),
    ]

    date = models.DateField(default=timezone.localdate)
    category = models.ForeignKey(WasteCategory, on_delete=models.PROTECT, related_name='records')
    stage = models.CharField(max_length=20, choices=STAGE_CHOICES, default='Other')
    quantity_kg = models.DecimalField(max_digits=12, decimal_places=2)
    fabric = models.ForeignKey('sorting.FabricStock', on_delete=models.SET_NULL, null=True, blank=True,
                               related_name='waste_records')
    disposal_method = models.CharField(max_length=30, choices=METHOD_CHOICES)
    disposed_to = models.CharField(max_length=255, blank=True, default='',
                                   help_text='Who took the waste, e.g. a recycler or a buyer')
    disposal_cost = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    revenue = models.DecimalField(max_digits=14, decimal_places=2, default=0,
                                  help_text='Money received when the waste was sold as a by-product')
    disposal_reference = models.CharField(max_length=100, blank=True, default='',
                                          help_text='Manifest or gate pass number')
    notes = models.TextField(blank=True, default='')
    recorded_by = models.ForeignKey(CustomUser, on_delete=models.PROTECT, related_name='waste_records')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-date', '-id']

    def __str__(self):
        return f'{self.category.name} {self.quantity_kg} kg on {self.date}'


class UtilityReading(models.Model):
    """Water, power or fuel used over a period, as read from a meter or a bill."""
    # Each utility is always kept in one unit, so readings can be added up
    UNITS = {'Water': 'm3', 'Electricity': 'kWh', 'Gas': 'm3', 'Steam': 'kg', 'Diesel': 'litres'}
    UTILITY_CHOICES = [(u, u) for u in UNITS]

    date = models.DateField(default=timezone.localdate)
    utility = models.CharField(max_length=20, choices=UTILITY_CHOICES)
    quantity = models.DecimalField(max_digits=12, decimal_places=2)
    unit = models.CharField(max_length=10, editable=False)
    cost = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    stage = models.CharField(max_length=20, choices=STAGE_CHOICES, blank=True, default='',
                             help_text='Leave empty for the whole factory')
    meter_reference = models.CharField(max_length=100, blank=True, default='')
    notes = models.TextField(blank=True, default='')
    recorded_by = models.ForeignKey(CustomUser, on_delete=models.PROTECT, related_name='utility_readings')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-date', '-id']

    def save(self, *args, **kwargs):
        self.unit = self.UNITS[self.utility]
        super().save(*args, **kwargs)

    def __str__(self):
        return f'{self.utility} {self.quantity} {self.unit} on {self.date}'


class SustainabilityTarget(models.Model):
    """A goal for one calculated figure; the dashboard shows whether it is met."""
    METRIC_CHOICES = [
        ('recovery_rate', 'Recovery rate %'),
        ('landfill_share', 'Waste to landfill %'),
        ('water_per_kg', 'Water per kg (litres)'),
        ('energy_per_kg', 'Energy per kg (kWh)'),
        ('chemical_per_kg', 'Chemical cost per kg (Rs.)'),
    ]
    DIRECTION_CHOICES = [('At least', 'At least'), ('At most', 'At most')]

    metric = models.CharField(max_length=20, choices=METRIC_CHOICES)
    target_value = models.DecimalField(max_digits=12, decimal_places=2)
    direction = models.CharField(max_length=10, choices=DIRECTION_CHOICES)
    period = models.CharField(max_length=50, blank=True, default='', help_text='e.g. 2026')
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['metric', '-id']

    def __str__(self):
        return f'{self.get_metric_display()}: {self.direction.lower()} {self.target_value}'
