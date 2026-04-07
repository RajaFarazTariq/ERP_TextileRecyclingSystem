from django.contrib import admin
from .models import FabricStock, SortingSession


@admin.register(FabricStock)
class FabricStockAdmin(admin.ModelAdmin):
    list_display = [
        'material_type', 'initial_quantity',
        'remaining_quantity', 'status', 'created_at'
    ]
    list_filter = ['status']
    search_fields = ['material_type']


@admin.register(SortingSession)
class SortingSessionAdmin(admin.ModelAdmin):
    list_display = [
        'fabric', 'supervisor', 'unit',
        'quantity_taken', 'status', 'start_date'
    ]
    list_filter = ['status', 'unit']