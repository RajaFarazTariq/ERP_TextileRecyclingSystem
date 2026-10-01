from django.db import models


class Vendor(models.Model):
    """A supplier of waste fabric (also used by Procurement)."""
    CATEGORY_CHOICES = [
        ('Textile waste', 'Textile waste'),
        ('Post-consumer', 'Post-consumer'),
        ('Pre-consumer', 'Pre-consumer'),
        ('Chemicals', 'Chemicals'),
        ('Packaging', 'Packaging'),
        ('Other', 'Other'),
    ]

    name = models.CharField(max_length=255)
    contact = models.CharField(max_length=100, blank=True, null=True)
    address = models.TextField(blank=True, null=True)
    # Supplier profile (all optional; added in Phase 5)
    email = models.EmailField(blank=True, default='')
    category = models.CharField(max_length=50, choices=CATEGORY_CHOICES, blank=True, default='')
    specialties = models.CharField(max_length=255, blank=True, default='',
                                   help_text='Materials this supplier deals in, e.g. "cotton, denim"')
    payment_terms_days = models.PositiveIntegerField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name


class FactoryUnit(models.Model):
    name = models.CharField(max_length=50)  # Unit 1, Unit 2, Unit 3

    def __str__(self):
        return self.name


class Stock(models.Model):
    STATUS_CHOICES = [
        ('Received', 'Received'),
        ('Pending', 'Pending'),
        ('Approved', 'Approved'),
        ('Rejected', 'Rejected'),
    ]

    vendor = models.ForeignKey(Vendor, on_delete=models.PROTECT)
    fabric_type = models.CharField(max_length=100)
    vendor_weight_slip = models.CharField(max_length=100)
    vehicle_no = models.CharField(max_length=50)
    our_weight = models.DecimalField(max_digits=10, decimal_places=2)
    unloading_weight = models.DecimalField(max_digits=10, decimal_places=2)
    unit = models.ForeignKey(FactoryUnit, on_delete=models.PROTECT)
    status = models.CharField(
        max_length=50,
        choices=STATUS_CHOICES,
        default='Received'
    )
    # Goods receipt against a purchase order line (optional; Phase 5)
    po_line = models.ForeignKey(
        'procurement.PurchaseOrderLine', on_delete=models.PROTECT,
        null=True, blank=True, related_name='receipts',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.fabric_type} - {self.vendor} - {self.our_weight}kg"