"""
Procurement: purchase requisition -> approval -> purchase order -> goods
receipt -> supplier invoice -> payment.

Suppliers are the existing warehouse `Vendor`s, and a goods receipt is the
existing warehouse `Stock` entry, linked to a PO line through `Stock.po_line`.
Recording a delivery without a PO keeps working exactly as before.
"""
from decimal import Decimal

from django.db import models
from django.db.models import Sum

from apps.users.models import CustomUser
from apps.warehouse.models import FactoryUnit, Vendor

ZERO = Decimal('0')
MONEY = {'max_digits': 14, 'decimal_places': 2}
KG = {'max_digits': 12, 'decimal_places': 2}


class NumberedModel(models.Model):
    """Gives each record a readable number such as PO-00042, set on first save."""
    PREFIX = ''
    number = models.CharField(max_length=20, blank=True, default='', editable=False, db_index=True)

    class Meta:
        abstract = True

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        if not self.number:
            self.number = f'{self.PREFIX}-{self.pk:05d}'
            super().save(update_fields=['number'])


class PurchaseRequisition(NumberedModel):
    """A request to buy material. Needs an admin's approval before a PO is raised."""
    PREFIX = 'PR'
    STATUS_CHOICES = [
        ('Draft', 'Draft'),
        ('Submitted', 'Submitted'),
        ('Approved', 'Approved'),
        ('Rejected', 'Rejected'),
        ('Ordered', 'Ordered'),
        ('Cancelled', 'Cancelled'),
    ]

    requested_by = models.ForeignKey(CustomUser, on_delete=models.PROTECT, related_name='requisitions')
    unit = models.ForeignKey(FactoryUnit, on_delete=models.PROTECT, null=True, blank=True)
    needed_by = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='Draft')
    notes = models.TextField(blank=True, default='')
    decided_by = models.ForeignKey(CustomUser, on_delete=models.PROTECT, null=True, blank=True, related_name='+')
    decided_at = models.DateTimeField(null=True, blank=True)
    rejection_reason = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return self.number or 'New requisition'


class RequisitionLine(models.Model):
    requisition = models.ForeignKey(PurchaseRequisition, on_delete=models.CASCADE, related_name='lines')
    material = models.CharField(max_length=255)
    quantity_kg = models.DecimalField(**KG)
    notes = models.CharField(max_length=255, blank=True, default='')

    def __str__(self):
        return f'{self.material} {self.quantity_kg} kg'


class PurchaseOrder(NumberedModel):
    """
    An order to a supplier. Approved by an admin; changing an approved order
    makes it an amendment (revision + 1) that needs approval again.
    """
    PREFIX = 'PO'
    STATUS_CHOICES = [
        ('Draft', 'Draft'),
        ('Submitted', 'Submitted'),
        ('Approved', 'Approved'),
        ('Partially Received', 'Partially Received'),
        ('Received', 'Received'),
        ('Closed', 'Closed'),
        ('Cancelled', 'Cancelled'),
    ]
    # Goods can be received against these
    OPEN_STATUSES = ('Approved', 'Partially Received')

    vendor = models.ForeignKey(Vendor, on_delete=models.PROTECT, related_name='purchase_orders')
    requisition = models.ForeignKey(PurchaseRequisition, on_delete=models.PROTECT, null=True, blank=True,
                                    related_name='purchase_orders')
    order_date = models.DateField()
    expected_date = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='Draft')
    revision = models.PositiveIntegerField(default=0)
    notes = models.TextField(blank=True, default='')
    created_by = models.ForeignKey(CustomUser, on_delete=models.PROTECT, related_name='purchase_orders')
    approved_by = models.ForeignKey(CustomUser, on_delete=models.PROTECT, null=True, blank=True, related_name='+')
    approved_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return self.number or 'New purchase order'

    @property
    def total_amount(self):
        return sum((line.amount for line in self.lines.all()), ZERO)


class PurchaseOrderLine(models.Model):
    order = models.ForeignKey(PurchaseOrder, on_delete=models.CASCADE, related_name='lines')
    material = models.CharField(max_length=255)
    quantity_kg = models.DecimalField(**KG)
    unit_price = models.DecimalField(max_digits=12, decimal_places=2, help_text='Rs. per kg')

    def __str__(self):
        return f'{self.order} · {self.material}'

    @property
    def amount(self):
        return (self.quantity_kg or ZERO) * (self.unit_price or ZERO)

    def received_kg(self):
        """Weight of accepted deliveries (rejected deliveries don't count)."""
        total = self.receipts.exclude(status='Rejected').aggregate(t=Sum('our_weight'))['t']
        return total or ZERO

    def rejected_kg(self):
        total = self.receipts.filter(status='Rejected').aggregate(t=Sum('our_weight'))['t']
        return total or ZERO

    def returned_kg(self):
        total = PurchaseReturn.objects.filter(receipt__po_line=self).aggregate(t=Sum('quantity_kg'))['t']
        return total or ZERO


class PurchaseReturn(NumberedModel):
    """Material sent back to the supplier from a delivery. A record only: it doesn't change the delivery."""
    PREFIX = 'RET'
    receipt = models.ForeignKey('warehouse.Stock', on_delete=models.PROTECT, related_name='purchase_returns')
    quantity_kg = models.DecimalField(**KG)
    reason = models.TextField()
    return_date = models.DateField()
    created_by = models.ForeignKey(CustomUser, on_delete=models.PROTECT, related_name='+')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return self.number or 'New return'


class SupplierQuotation(models.Model):
    """A price a supplier offered for a material, for comparison."""
    vendor = models.ForeignKey(Vendor, on_delete=models.PROTECT, related_name='quotations')
    requisition = models.ForeignKey(PurchaseRequisition, on_delete=models.SET_NULL, null=True, blank=True,
                                    related_name='quotations')
    material = models.CharField(max_length=255)
    price_per_kg = models.DecimalField(max_digits=12, decimal_places=2)
    min_quantity_kg = models.DecimalField(**KG, null=True, blank=True)
    quoted_on = models.DateField()
    valid_until = models.DateField(null=True, blank=True)
    notes = models.CharField(max_length=255, blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-quoted_on', '-created_at']

    def __str__(self):
        return f'{self.vendor} · {self.material} @ {self.price_per_kg}'


class SupplierInvoice(models.Model):
    STATUS_CHOICES = [('Unpaid', 'Unpaid'), ('Partial', 'Partial'), ('Paid', 'Paid')]

    vendor = models.ForeignKey(Vendor, on_delete=models.PROTECT, related_name='invoices')
    purchase_order = models.ForeignKey(PurchaseOrder, on_delete=models.PROTECT, null=True, blank=True,
                                       related_name='invoices')
    invoice_number = models.CharField(max_length=100, help_text="The supplier's invoice number")
    invoice_date = models.DateField()
    due_date = models.DateField(null=True, blank=True)
    amount = models.DecimalField(**MONEY, help_text='Before tax')
    tax_amount = models.DecimalField(**MONEY, default=ZERO)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='Unpaid', editable=False)
    notes = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-invoice_date', '-created_at']
        constraints = [
            models.UniqueConstraint(fields=['vendor', 'invoice_number'], name='unique_invoice_per_supplier'),
        ]

    def __str__(self):
        return f'{self.vendor} · {self.invoice_number}'

    @property
    def total(self):
        return (self.amount or ZERO) + (self.tax_amount or ZERO)

    def paid_amount(self):
        return self.payments.aggregate(t=Sum('amount'))['t'] or ZERO

    def refresh_status(self):
        paid = self.paid_amount()
        status = 'Paid' if paid >= self.total and self.total > 0 else 'Partial' if paid > 0 else 'Unpaid'
        if status != self.status:
            self.status = status
            self.save(update_fields=['status'])


class SupplierPayment(models.Model):
    METHOD_CHOICES = [
        ('Cash', 'Cash'),
        ('Bank Transfer', 'Bank Transfer'),
        ('Cheque', 'Cheque'),
        ('Online Transfer', 'Online Transfer'),
    ]

    invoice = models.ForeignKey(SupplierInvoice, on_delete=models.PROTECT, related_name='payments')
    amount = models.DecimalField(**MONEY)
    method = models.CharField(max_length=20, choices=METHOD_CHOICES)
    payment_date = models.DateField()
    reference = models.CharField(max_length=100, blank=True, default='')
    paid_by = models.ForeignKey(CustomUser, on_delete=models.PROTECT, related_name='+')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-payment_date', '-created_at']

    def __str__(self):
        return f'{self.invoice} · {self.amount}'
