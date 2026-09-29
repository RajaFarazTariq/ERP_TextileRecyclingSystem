from django.contrib import admin
from .models import Vendor, FactoryUnit, Stock


@admin.register(Vendor)
class VendorAdmin(admin.ModelAdmin):
    list_display = ['name', 'contact', 'created_at']
    search_fields = ['name']


@admin.register(FactoryUnit)
class FactoryUnitAdmin(admin.ModelAdmin):
    list_display = ['name']


@admin.register(Stock)
class StockAdmin(admin.ModelAdmin):
    list_display = [
        'fabric_type', 'vendor', 'unit',
        'our_weight', 'status', 'created_at'
    ]
    list_filter = ['status', 'unit', 'vendor']
    search_fields = ['fabric_type', 'vehicle_no']