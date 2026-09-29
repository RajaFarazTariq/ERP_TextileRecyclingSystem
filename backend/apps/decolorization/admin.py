from django.contrib import admin
from .models import ChemicalStock, Tank, ChemicalIssuance, DecolorizationSession


@admin.register(ChemicalStock)
class ChemicalStockAdmin(admin.ModelAdmin):
    list_display = [
        'chemical_name', 'total_stock',
        'remaining_stock', 'unit_of_measure', 'last_updated'
    ]
    search_fields = ['chemical_name']


@admin.register(Tank)
class TankAdmin(admin.ModelAdmin):
    list_display = [
        'name', 'batch_id', 'capacity',
        'tank_status', 'supervisor', 'created_at'
    ]
    list_filter = ['tank_status']
    search_fields = ['name', 'batch_id']


@admin.register(ChemicalIssuance)
class ChemicalIssuanceAdmin(admin.ModelAdmin):
    list_display = [
        'chemical', 'tank', 'issued_by',
        'quantity', 'issued_at'
    ]


@admin.register(DecolorizationSession)
class DecolorizationSessionAdmin(admin.ModelAdmin):
    list_display = [
        'tank', 'fabric', 'supervisor',
        'input_quantity', 'status', 'start_date'
    ]
    list_filter = ['status']