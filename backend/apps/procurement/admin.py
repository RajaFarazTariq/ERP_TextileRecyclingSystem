from django.contrib import admin

from .models import (
    PurchaseOrder, PurchaseOrderLine, PurchaseRequisition, PurchaseReturn, RequisitionLine,
    SupplierInvoice, SupplierPayment, SupplierQuotation,
)


class RequisitionLineInline(admin.TabularInline):
    model = RequisitionLine
    extra = 0


@admin.register(PurchaseRequisition)
class RequisitionAdmin(admin.ModelAdmin):
    list_display = ['number', 'requested_by', 'status', 'needed_by', 'created_at']
    list_filter = ['status']
    inlines = [RequisitionLineInline]


class OrderLineInline(admin.TabularInline):
    model = PurchaseOrderLine
    extra = 0


@admin.register(PurchaseOrder)
class PurchaseOrderAdmin(admin.ModelAdmin):
    list_display = ['number', 'vendor', 'status', 'revision', 'order_date', 'expected_date']
    list_filter = ['status', 'vendor']
    search_fields = ['number', 'vendor__name']
    inlines = [OrderLineInline]


@admin.register(SupplierInvoice)
class SupplierInvoiceAdmin(admin.ModelAdmin):
    list_display = ['invoice_number', 'vendor', 'invoice_date', 'due_date', 'amount', 'tax_amount', 'status']
    list_filter = ['status', 'vendor']


admin.site.register([PurchaseReturn, SupplierPayment, SupplierQuotation])
