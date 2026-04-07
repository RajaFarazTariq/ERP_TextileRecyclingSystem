from django.db import models


class Vendor(models.Model):
    name = models.CharField(max_length=255)
    contact = models.CharField(max_length=100, blank=True, null=True)
    address = models.TextField(blank=True, null=True)
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

    vendor = models.ForeignKey(Vendor, on_delete=models.CASCADE)
    fabric_type = models.CharField(max_length=100)
    vendor_weight_slip = models.CharField(max_length=100)
    vehicle_no = models.CharField(max_length=50)
    our_weight = models.DecimalField(max_digits=10, decimal_places=2)
    unloading_weight = models.DecimalField(max_digits=10, decimal_places=2)
    unit = models.ForeignKey(FactoryUnit, on_delete=models.CASCADE)
    status = models.CharField(
        max_length=50,
        choices=STATUS_CHOICES,
        default='Received'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.fabric_type} - {self.vendor} - {self.our_weight}kg"