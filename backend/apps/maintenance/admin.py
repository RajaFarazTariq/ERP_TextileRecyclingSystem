from django.contrib import admin

from .models import Machine, MaintenanceSchedule, PartUse, SparePart, WorkOrder


@admin.register(Machine)
class MachineAdmin(admin.ModelAdmin):
    list_display = ['code', 'name', 'category', 'location', 'status']
    list_filter = ['status', 'category']
    search_fields = ['code', 'name', 'serial_number']


@admin.register(MaintenanceSchedule)
class MaintenanceScheduleAdmin(admin.ModelAdmin):
    list_display = ['task', 'machine', 'every_days', 'last_done_on', 'next_due_on', 'is_active']
    list_filter = ['is_active']


class PartUseInline(admin.TabularInline):
    model = PartUse
    extra = 0


@admin.register(WorkOrder)
class WorkOrderAdmin(admin.ModelAdmin):
    list_display = ['number', 'machine', 'kind', 'title', 'priority', 'status', 'reported_at']
    list_filter = ['status', 'kind', 'priority', 'is_breakdown']
    search_fields = ['number', 'title']
    inlines = [PartUseInline]


@admin.register(SparePart)
class SparePartAdmin(admin.ModelAdmin):
    list_display = ['code', 'name', 'stock_quantity', 'reorder_level', 'unit_cost', 'location']
    search_fields = ['code', 'name']
