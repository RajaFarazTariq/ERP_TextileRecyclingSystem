from django.db import models
from warehouse.models import Stock
from users.models import CustomUser


class FabricStock(models.Model):
    STATUS_CHOICES = [
        ('In Warehouse', 'In Warehouse'),
        ('In Sorting', 'In Sorting'),
        ('Sorted', 'Sorted'),
        ('Sent to Decolorization', 'Sent to Decolorization'),
    ]

    stock = models.ForeignKey(
        Stock, on_delete=models.CASCADE, related_name='fabric_stocks'
    )
    material_type = models.CharField(max_length=255)
    initial_quantity = models.DecimalField(max_digits=10, decimal_places=2)
    sorted_quantity = models.DecimalField(
        max_digits=10, decimal_places=2, default=0
    )
    remaining_quantity = models.DecimalField(max_digits=10, decimal_places=2)
    status = models.CharField(
        max_length=50, choices=STATUS_CHOICES, default='In Warehouse'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.material_type} - {self.remaining_quantity}kg - {self.status}"


class SortingSession(models.Model):
    STATUS_CHOICES = [
        ('In Progress', 'In Progress'),
        ('Completed', 'Completed'),
        ('On Hold', 'On Hold'),
    ]

    fabric = models.ForeignKey(
        FabricStock, on_delete=models.CASCADE, related_name='sorting_sessions'
    )
    supervisor = models.ForeignKey(
        CustomUser, on_delete=models.CASCADE, related_name='sorting_sessions'
    )
    unit = models.CharField(max_length=50)  # Unit 1, Unit 2, Unit 3
    quantity_taken = models.DecimalField(max_digits=10, decimal_places=2)
    quantity_sorted = models.DecimalField(
        max_digits=10, decimal_places=2, default=0
    )
    waste_quantity = models.DecimalField(
        max_digits=10, decimal_places=2, default=0
    )
    start_date = models.DateTimeField(auto_now_add=True)
    end_date = models.DateTimeField(null=True, blank=True)
    status = models.CharField(
        max_length=20, choices=STATUS_CHOICES, default='In Progress'
    )
    notes = models.TextField(blank=True, null=True)

    def __str__(self):
        return f"{self.fabric.material_type} - {self.unit} - {self.status}"