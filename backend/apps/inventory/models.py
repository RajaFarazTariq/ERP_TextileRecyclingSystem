from django.conf import settings
from django.db import models


class StockMovement(models.Model):
    """
    One change to the sellable (dried) stock of a fabric lot.

    Quantity is signed: positive adds stock, negative removes it. Each movement
    points to the record that caused it (source_type + source_id). The ledger
    is kept in sync with those records by apps.inventory.services, so on-hand
    stock is always the sum of movements, never an editable number.
    """
    DRYING_OUTPUT = 'DRYING_OUTPUT'
    DISPATCH      = 'DISPATCH'
    ADJUSTMENT    = 'ADJUSTMENT'
    TYPE_CHOICES = [
        (DRYING_OUTPUT, 'Drying output'),
        (DISPATCH,      'Dispatch'),
        (ADJUSTMENT,    'Adjustment'),
    ]

    fabric = models.ForeignKey(
        'sorting.FabricStock', on_delete=models.PROTECT, related_name='stock_movements'
    )
    movement_type = models.CharField(max_length=20, choices=TYPE_CHOICES)
    quantity      = models.DecimalField(max_digits=12, decimal_places=2)
    source_type   = models.CharField(max_length=50)            # e.g. "DryingSession"
    source_id     = models.PositiveBigIntegerField()
    note          = models.CharField(max_length=255, blank=True)
    created_by    = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name='stock_movements',
    )
    created_at    = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['-created_at', '-id']
        indexes = [
            models.Index(fields=['fabric', 'created_at']),
            models.Index(fields=['source_type', 'source_id']),
        ]

    def __str__(self):
        return f'{self.get_movement_type_display()} {self.quantity:+} kg — fabric #{self.fabric_id}'
