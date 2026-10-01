"""
Quality control: standards (checklists with limits), inspections of deliveries
and fabric lots, quarantine of failed material, and corrective actions.

An inspection of incoming material points to the warehouse delivery (`Stock`);
in-process and finished inspections point to the fabric lot (`FabricStock`).
A failed inspection keeps its delivery or lot in quarantine until an admin
releases it. Material that was never inspected is not affected.
"""
from django.db import models

from apps.procurement.models import NumberedModel
from apps.users.models import CustomUser

VALUE = {'max_digits': 10, 'decimal_places': 2}

STAGE_CHOICES = [
    ('Incoming', 'Incoming material'),
    ('In-process', 'In-process'),
    ('Finished', 'Finished product'),
]
KIND_CHOICES = [('Measure', 'Measurement'), ('Pass/Fail', 'Pass / fail')]


class QualityStandard(models.Model):
    """A reusable checklist with acceptance limits, for one stage and (optionally) one material."""
    name = models.CharField(max_length=150, unique=True)
    stage = models.CharField(max_length=20, choices=STAGE_CHOICES)
    material_type = models.CharField(max_length=255, blank=True, default='',
                                     help_text='Leave empty to use for any material')
    is_active = models.BooleanField(default=True)
    notes = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['stage', 'name']

    def __str__(self):
        return self.name


class StandardCheck(models.Model):
    standard = models.ForeignKey(QualityStandard, on_delete=models.CASCADE, related_name='checks')
    name = models.CharField(max_length=150)
    kind = models.CharField(max_length=10, choices=KIND_CHOICES, default='Measure')
    unit = models.CharField(max_length=20, blank=True, default='')
    min_value = models.DecimalField(**VALUE, null=True, blank=True)
    max_value = models.DecimalField(**VALUE, null=True, blank=True)

    class Meta:
        ordering = ['id']

    def __str__(self):
        return f'{self.standard.name}: {self.name}'


class Inspection(NumberedModel):
    PREFIX = 'QC'
    RESULT_CHOICES = [('Pass', 'Pass'), ('Conditional', 'Conditional'), ('Fail', 'Fail')]

    stage = models.CharField(max_length=20, choices=STAGE_CHOICES)
    stock = models.ForeignKey('warehouse.Stock', on_delete=models.PROTECT, null=True, blank=True,
                              related_name='inspections', help_text='The delivery (incoming inspections)')
    fabric = models.ForeignKey('sorting.FabricStock', on_delete=models.PROTECT, null=True, blank=True,
                               related_name='inspections', help_text='The fabric lot (in-process and finished)')
    standard = models.ForeignKey(QualityStandard, on_delete=models.PROTECT, null=True, blank=True,
                                 related_name='inspections')
    inspector = models.ForeignKey(CustomUser, on_delete=models.PROTECT, related_name='inspections')
    inspected_on = models.DateField()
    sample_kg = models.DecimalField(**VALUE, null=True, blank=True)
    composition = models.CharField(max_length=255, blank=True, default='',
                                   help_text='Fabric composition found, e.g. 80% cotton / 20% polyester')
    result = models.CharField(max_length=15, choices=RESULT_CHOICES)
    rejection_reason = models.TextField(blank=True, default='')
    notes = models.TextField(blank=True, default='')
    # Quarantine ends when an admin releases the material
    released_by = models.ForeignKey(CustomUser, on_delete=models.PROTECT, null=True, blank=True, related_name='+')
    released_at = models.DateTimeField(null=True, blank=True)
    release_note = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-inspected_on', '-id']
        indexes = [models.Index(fields=['result', 'released_at'])]

    def __str__(self):
        return f'{self.number or "Inspection"} ({self.result})'

    @property
    def quarantined(self):
        return self.result == 'Fail' and self.released_at is None


class InspectionResult(models.Model):
    """One checklist line as measured. Limits are copied in, so later changes to a standard don't rewrite history."""
    inspection = models.ForeignKey(Inspection, on_delete=models.CASCADE, related_name='results')
    name = models.CharField(max_length=150)
    kind = models.CharField(max_length=10, choices=KIND_CHOICES, default='Measure')
    unit = models.CharField(max_length=20, blank=True, default='')
    min_value = models.DecimalField(**VALUE, null=True, blank=True)
    max_value = models.DecimalField(**VALUE, null=True, blank=True)
    value = models.DecimalField(**VALUE, null=True, blank=True)
    passed = models.BooleanField()
    note = models.CharField(max_length=255, blank=True, default='')

    class Meta:
        ordering = ['id']

    def __str__(self):
        return f'{self.name}: {"pass" if self.passed else "fail"}'


class CorrectiveAction(models.Model):
    """Corrective or preventive action (CAPA) raised from an inspection."""
    KIND_CHOICES = [('Corrective', 'Corrective'), ('Preventive', 'Preventive')]
    STATUS_CHOICES = [('Open', 'Open'), ('Done', 'Done')]

    inspection = models.ForeignKey(Inspection, on_delete=models.CASCADE, related_name='actions')
    kind = models.CharField(max_length=12, choices=KIND_CHOICES, default='Corrective')
    description = models.TextField()
    owner = models.ForeignKey(CustomUser, on_delete=models.PROTECT, null=True, blank=True,
                              related_name='quality_actions')
    due_date = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='Open', editable=False)
    completed_at = models.DateTimeField(null=True, blank=True, editable=False)
    completion_note = models.TextField(blank=True, default='')
    created_by = models.ForeignKey(CustomUser, on_delete=models.PROTECT, related_name='+')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-status', 'due_date', '-id']   # open actions first

    def __str__(self):
        return f'{self.kind} action for {self.inspection.number}'
