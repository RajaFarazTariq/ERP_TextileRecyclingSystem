from django.db import models
from sorting.models import FabricStock
from users.models import CustomUser


class ChemicalStock(models.Model):
    chemical_name = models.CharField(max_length=255)
    total_stock = models.DecimalField(max_digits=10, decimal_places=2)
    issued_quantity = models.DecimalField(
        max_digits=10, decimal_places=2, default=0
    )
    remaining_stock = models.DecimalField(max_digits=10, decimal_places=2)
    unit_of_measure = models.CharField(
        max_length=50, default='Liters'
    )
    last_updated = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.chemical_name} - {self.remaining_stock} {self.unit_of_measure}"


class Tank(models.Model):
    STATUS_CHOICES = [
        ('Empty', 'Empty'),
        ('Filled', 'Filled'),
        ('Processing', 'Processing'),
        ('Completed', 'Completed'),
        ('Cleaning', 'Cleaning'),
    ]

    name = models.CharField(max_length=100)
    capacity = models.DecimalField(max_digits=10, decimal_places=2)
    fabric = models.ForeignKey(
        FabricStock, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='tanks'
    )
    batch_id = models.CharField(max_length=100, unique=True)
    tank_status = models.CharField(
        max_length=50, choices=STATUS_CHOICES, default='Empty'
    )
    fabric_quantity = models.DecimalField(
        max_digits=10, decimal_places=2, default=0
    )
    start_date = models.DateTimeField(null=True, blank=True)
    expected_completion = models.DateTimeField(null=True, blank=True)
    actual_completion = models.DateTimeField(null=True, blank=True)
    supervisor = models.ForeignKey(
        CustomUser, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='tanks'
    )
    notes = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.name} - Batch {self.batch_id} - {self.tank_status}"


class ChemicalIssuance(models.Model):
    chemical = models.ForeignKey(
        ChemicalStock, on_delete=models.CASCADE,
        related_name='issuances'
    )
    tank = models.ForeignKey(
        Tank, on_delete=models.CASCADE,
        related_name='chemical_issuances'
    )
    issued_by = models.ForeignKey(
        CustomUser, on_delete=models.CASCADE,
        related_name='chemical_issuances'
    )
    quantity = models.DecimalField(max_digits=10, decimal_places=2)
    issued_at = models.DateTimeField(auto_now_add=True)
    notes = models.TextField(blank=True, null=True)

    def __str__(self):
        return f"{self.chemical.chemical_name} - {self.quantity} issued to {self.tank.name}"


class DecolorizationSession(models.Model):
    STATUS_CHOICES = [
        ('In Progress', 'In Progress'),
        ('Completed', 'Completed'),
        ('Failed', 'Failed'),
        ('On Hold', 'On Hold'),
    ]

    tank = models.ForeignKey(
        Tank, on_delete=models.CASCADE,
        related_name='sessions'
    )
    fabric = models.ForeignKey(
        FabricStock, on_delete=models.CASCADE,
        related_name='decolorization_sessions'
    )
    supervisor = models.ForeignKey(
        CustomUser, on_delete=models.CASCADE,
        related_name='decolorization_sessions'
    )
    input_quantity = models.DecimalField(max_digits=10, decimal_places=2)
    output_quantity = models.DecimalField(
        max_digits=10, decimal_places=2, default=0
    )
    waste_quantity = models.DecimalField(
        max_digits=10, decimal_places=2, default=0
    )
    status = models.CharField(
        max_length=20, choices=STATUS_CHOICES, default='In Progress'
    )
    start_date = models.DateTimeField(auto_now_add=True)
    end_date = models.DateTimeField(null=True, blank=True)
    notes = models.TextField(blank=True, null=True)

    def __str__(self):
        return f"Tank {self.tank.name} - {self.fabric.material_type} - {self.status}"