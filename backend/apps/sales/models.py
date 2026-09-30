from django.db import models
from apps.sorting.models import FabricStock
from apps.users.models import CustomUser


def normalize_name(name):
    """'  Ali   TRADERS ' -> 'ali traders' (used to match customers)."""
    return ' '.join((name or '').split()).casefold()


class Customer(models.Model):
    name            = models.CharField(max_length=255)
    normalized_name = models.CharField(max_length=255, unique=True, editable=False)
    contact         = models.CharField(max_length=100, blank=True, null=True)
    address         = models.TextField(blank=True, null=True)
    notes           = models.TextField(blank=True, null=True)
    created_at      = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['name']

    def save(self, *args, **kwargs):
        self.name = ' '.join(self.name.split())
        self.normalized_name = normalize_name(self.name)
        super().save(*args, **kwargs)

    def __str__(self):
        return self.name


class SalesOrder(models.Model):
    PAYMENT_STATUS_CHOICES = [
        ('Pending', 'Pending'),
        ('Partial', 'Partial'),
        ('Paid', 'Paid'),
    ]

    STATUS_CHOICES = [
        ('Draft', 'Draft'),
        ('Confirmed', 'Confirmed'),
        ('Dispatched', 'Dispatched'),
        ('Completed', 'Completed'),
        ('Cancelled', 'Cancelled'),
    ]

    buyer_name = models.CharField(max_length=255)   # as typed; kept alongside customer
    customer = models.ForeignKey(
        Customer, on_delete=models.PROTECT, null=True, blank=True,
        related_name='orders'
    )
    buyer_contact = models.CharField(max_length=100, blank=True, null=True)
    buyer_address = models.TextField(blank=True, null=True)
    fabric = models.ForeignKey(
        FabricStock, on_delete=models.PROTECT,
        related_name='sales_orders'
    )
    fabric_quality = models.CharField(max_length=100)
    weight_sold = models.DecimalField(max_digits=10, decimal_places=2)
    price_per_kg = models.DecimalField(max_digits=10, decimal_places=2)
    total_price = models.DecimalField(max_digits=14, decimal_places=2)
    payment_status = models.CharField(
        max_length=50,
        choices=PAYMENT_STATUS_CHOICES,
        default='Pending'
    )
    status = models.CharField(
        max_length=50,
        choices=STATUS_CHOICES,
        default='Draft'
    )
    created_by = models.ForeignKey(
        CustomUser, on_delete=models.PROTECT,
        related_name='sales_orders'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    notes = models.TextField(blank=True, null=True)

    def __str__(self):
        return f"Order #{self.id} - {self.buyer_name} - {self.weight_sold}kg"

    def save(self, *args, **kwargs):
        # Auto calculate total price
        self.total_price = self.weight_sold * self.price_per_kg
        # Orders always belong to a customer; a typed buyer name finds or creates one
        if self.customer_id is None and (self.buyer_name or '').strip():
            self.customer, _ = Customer.objects.get_or_create(
                normalized_name=normalize_name(self.buyer_name),
                defaults={'name': self.buyer_name},
            )
        super().save(*args, **kwargs)


class DispatchTracking(models.Model):
    STATUS_CHOICES = [
        ('Pending', 'Pending'),
        ('Loading', 'Loading'),
        ('Dispatched', 'Dispatched'),
        ('Delivered', 'Delivered'),
    ]

    sales_order = models.ForeignKey(
        SalesOrder, on_delete=models.PROTECT,
        related_name='dispatches'
    )
    vehicle_number = models.CharField(max_length=50)
    driver_name = models.CharField(max_length=100, blank=True, null=True)
    driver_contact = models.CharField(max_length=50, blank=True, null=True)
    dispatched_weight = models.DecimalField(max_digits=10, decimal_places=2)
    dispatch_status = models.CharField(
        max_length=50,
        choices=STATUS_CHOICES,
        default='Pending'
    )
    dispatched_by = models.ForeignKey(
        CustomUser, on_delete=models.PROTECT,
        related_name='dispatches'
    )
    dispatch_date = models.DateTimeField(auto_now_add=True)
    delivery_date = models.DateTimeField(null=True, blank=True)
    notes = models.TextField(blank=True, null=True)

    def __str__(self):
        return f"Dispatch #{self.id} - {self.vehicle_number} - {self.dispatch_status}"


class Payment(models.Model):
    PAYMENT_METHOD_CHOICES = [
        ('Cash', 'Cash'),
        ('Bank Transfer', 'Bank Transfer'),
        ('Cheque', 'Cheque'),
    ]

    sales_order = models.ForeignKey(
        SalesOrder, on_delete=models.PROTECT,
        related_name='payments'
    )
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    payment_method = models.CharField(
        max_length=50,
        choices=PAYMENT_METHOD_CHOICES,
        default='Cash'
    )
    received_by = models.ForeignKey(
        CustomUser, on_delete=models.PROTECT,
        related_name='payments'
    )
    payment_date = models.DateTimeField(auto_now_add=True)
    reference_number = models.CharField(max_length=100, blank=True, null=True)
    notes = models.TextField(blank=True, null=True)

    def __str__(self):
        return f"Payment #{self.id} - {self.amount} - {self.payment_method}"