from decimal import Decimal

from django.db import models
from apps.procurement.models import NumberedModel
from apps.sorting.models import FabricStock
from apps.users.models import CustomUser

MONEY = {'max_digits': 14, 'decimal_places': 2}
KG = {'max_digits': 12, 'decimal_places': 2}
PERCENT = {'max_digits': 5, 'decimal_places': 2, 'default': 0}
CUSTOMER_CATEGORIES = [(c, c) for c in ('Wholesaler', 'Manufacturer', 'Exporter', 'Retailer', 'Other')]


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
    # Profile (all optional; added in Phase 5)
    email           = models.EmailField(blank=True, default='')
    category        = models.CharField(max_length=20, choices=CUSTOMER_CATEGORIES, blank=True, default='')
    credit_limit    = models.DecimalField(**MONEY, default=0, help_text='0 = no limit. Going over it warns; it never blocks.')
    payment_terms_days = models.PositiveIntegerField(default=0, help_text='Days an invoice may stay unpaid')
    is_active       = models.BooleanField(default=True)

    class Meta:
        ordering = ['name']

    def save(self, *args, **kwargs):
        self.name = ' '.join(self.name.split())
        self.normalized_name = normalize_name(self.name)
        super().save(*args, **kwargs)

    def __str__(self):
        return self.name


class Product(models.Model):
    """A sellable product: what the price list and quotations refer to."""
    name = models.CharField(max_length=150, unique=True)
    material_type = models.CharField(max_length=255, blank=True, default='')
    grade = models.CharField(max_length=100, blank=True, default='')
    specification = models.TextField(blank=True, default='')
    price_per_kg = models.DecimalField(**MONEY, help_text='List price; a customer category can have its own')
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return self.name


class ProductPrice(models.Model):
    """The price of a product for one customer category (the price list)."""
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='prices')
    customer_category = models.CharField(max_length=20, choices=CUSTOMER_CATEGORIES)
    price_per_kg = models.DecimalField(**MONEY)

    class Meta:
        ordering = ['customer_category']
        constraints = [models.UniqueConstraint(fields=['product', 'customer_category'], name='unique_product_category_price')]

    def __str__(self):
        return f'{self.product.name} for {self.customer_category}'


def order_total(weight, price_per_kg, discount_pct, tax_pct):
    """Weight x price, less the discount, plus tax on the rest."""
    gross = weight * price_per_kg
    if not discount_pct and not tax_pct:
        return gross
    net = gross * (Decimal('100') - Decimal(discount_pct or 0)) / Decimal('100')
    return (net * (Decimal('100') + Decimal(tax_pct or 0)) / Decimal('100')).quantize(Decimal('0.01'))


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
    # Optional; added in Phase 5. With no discount or tax the total is weight x price, as before.
    product = models.ForeignKey(Product, on_delete=models.PROTECT, null=True, blank=True, related_name='orders')
    discount_pct = models.DecimalField(**PERCENT)
    tax_pct = models.DecimalField(**PERCENT)

    def __str__(self):
        return f"Order #{self.id} - {self.buyer_name} - {self.weight_sold}kg"

    def save(self, *args, **kwargs):
        # Auto calculate total price
        self.total_price = order_total(self.weight_sold, self.price_per_kg, self.discount_pct, self.tax_pct)
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
        ('Online Transfer', 'Online Transfer'),
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


# ─────────────────────────────────────────────────────────────────────────────
# Phase 5: quotations, invoices and returns
# ─────────────────────────────────────────────────────────────────────────────
class SalesQuotation(NumberedModel):
    """An offer to a customer. Once accepted it is converted into a sales order."""
    PREFIX = 'QT'
    STATUS_CHOICES = [(s, s) for s in ('Draft', 'Sent', 'Accepted', 'Rejected', 'Converted')]

    customer = models.ForeignKey(Customer, on_delete=models.PROTECT, related_name='quotations')
    product = models.ForeignKey(Product, on_delete=models.PROTECT, null=True, blank=True, related_name='quotations')
    fabric = models.ForeignKey(FabricStock, on_delete=models.PROTECT, null=True, blank=True, related_name='quotations',
                               help_text='The lot to sell from; can be chosen when the order is made')
    fabric_quality = models.CharField(max_length=100)
    weight = models.DecimalField(**KG)
    price_per_kg = models.DecimalField(**MONEY)
    discount_pct = models.DecimalField(**PERCENT)
    tax_pct = models.DecimalField(**PERCENT)
    total = models.DecimalField(**MONEY, editable=False, default=0)
    valid_until = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='Draft')
    notes = models.TextField(blank=True, default='')
    rejection_reason = models.TextField(blank=True, default='')
    decided_at = models.DateTimeField(null=True, blank=True)
    order = models.OneToOneField(SalesOrder, on_delete=models.SET_NULL, null=True, blank=True, related_name='quotation')
    created_by = models.ForeignKey(CustomUser, on_delete=models.PROTECT, related_name='+')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def save(self, *args, **kwargs):
        self.total = order_total(self.weight, self.price_per_kg, self.discount_pct, self.tax_pct)
        super().save(*args, **kwargs)

    def __str__(self):
        return self.number or f'Quotation #{self.pk}'


class SalesInvoice(NumberedModel):
    """The bill for dispatched goods. Amounts are fixed when it is raised."""
    PREFIX = 'INV'

    order = models.ForeignKey(SalesOrder, on_delete=models.PROTECT, related_name='invoices')
    invoice_date = models.DateField()
    due_date = models.DateField()
    weight = models.DecimalField(**KG)
    price_per_kg = models.DecimalField(**MONEY)
    subtotal = models.DecimalField(**MONEY)
    discount_amount = models.DecimalField(**MONEY, default=0)
    tax_amount = models.DecimalField(**MONEY, default=0)
    total = models.DecimalField(**MONEY)
    notes = models.TextField(blank=True, default='')
    created_by = models.ForeignKey(CustomUser, on_delete=models.PROTECT, related_name='+')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-invoice_date', '-id']

    def __str__(self):
        return self.number or f'Invoice #{self.pk}'


class SalesReturn(NumberedModel):
    """Goods a customer sends back. Approved by an admin: credits the customer and may restock."""
    PREFIX = 'SR'
    STATUS_CHOICES = [(s, s) for s in ('Requested', 'Approved', 'Rejected')]

    order = models.ForeignKey(SalesOrder, on_delete=models.PROTECT, related_name='returns')
    return_date = models.DateField()
    weight = models.DecimalField(**KG)
    reason = models.TextField()
    restock = models.BooleanField(default=False, help_text='Put the returned weight back into sellable stock')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='Requested')
    credit_amount = models.DecimalField(**MONEY, default=0, editable=False)
    rejection_reason = models.TextField(blank=True, default='')
    decided_by = models.ForeignKey(CustomUser, on_delete=models.PROTECT, null=True, blank=True, related_name='+')
    decided_at = models.DateTimeField(null=True, blank=True)
    created_by = models.ForeignKey(CustomUser, on_delete=models.PROTECT, related_name='+')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return self.number or f'Return #{self.pk}'
