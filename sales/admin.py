from django.contrib import admin
from .models import SalesOrder, DispatchTracking, Payment


@admin.register(SalesOrder)
class SalesOrderAdmin(admin.ModelAdmin):
    list_display = [
        'id', 'buyer_name', 'fabric_quality',
        'weight_sold', 'total_price',
        'payment_status', 'status', 'created_at'
    ]
    list_filter = ['status', 'payment_status']
    search_fields = ['buyer_name', 'fabric_quality']


@admin.register(DispatchTracking)
class DispatchTrackingAdmin(admin.ModelAdmin):
    list_display = [
        'id', 'sales_order', 'vehicle_number',
        'dispatched_weight', 'dispatch_status', 'dispatch_date'
    ]
    list_filter = ['dispatch_status']
    search_fields = ['vehicle_number', 'driver_name']


@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = [
        'id', 'sales_order', 'amount',
        'payment_method', 'received_by', 'payment_date'
    ]
    list_filter = ['payment_method']