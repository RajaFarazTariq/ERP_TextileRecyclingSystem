# reports/urls.py
from django.urls import path
from . import views

urlpatterns = [
    # JSON data endpoints
    path('daily-production/',         views.daily_production_report,  name='report-daily-production'),
    path('monthly-sales/',            views.monthly_sales_report,     name='report-monthly-sales'),
    path('waste-analysis/',           views.waste_analysis_report,    name='report-waste-analysis'),

    # Excel export endpoints
    path('daily-production/export/',  views.daily_production_export,  name='export-daily-production'),
    path('monthly-sales/export/',     views.monthly_sales_export,     name='export-monthly-sales'),
    path('waste-analysis/export/',    views.waste_analysis_export,    name='export-waste-analysis'),
]
