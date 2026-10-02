from django.urls import path

from .views import SearchView, TraceView

urlpatterns = [
    path('', SearchView.as_view(), name='search'),
    path('trace/', TraceView.as_view(), name='search-trace'),
]
