from django.contrib import admin

from .models import SustainabilityTarget, UtilityReading, WasteCategory, WasteRecord


@admin.register(WasteCategory)
class WasteCategoryAdmin(admin.ModelAdmin):
    list_display = ['name', 'classification', 'is_active']
    list_filter = ['classification', 'is_active']
    search_fields = ['name']


@admin.register(WasteRecord)
class WasteRecordAdmin(admin.ModelAdmin):
    list_display = ['date', 'category', 'stage', 'quantity_kg', 'disposal_method', 'recorded_by']
    list_filter = ['stage', 'disposal_method', 'category']
    search_fields = ['disposal_reference', 'disposed_to']


@admin.register(UtilityReading)
class UtilityReadingAdmin(admin.ModelAdmin):
    list_display = ['date', 'utility', 'quantity', 'unit', 'cost', 'stage', 'recorded_by']
    list_filter = ['utility', 'stage']


@admin.register(SustainabilityTarget)
class SustainabilityTargetAdmin(admin.ModelAdmin):
    list_display = ['metric', 'direction', 'target_value', 'period', 'is_active']
    list_filter = ['metric', 'is_active']
