from django.urls import path

from .views import AccessMatrixView, MyAccessView, UserAccessView

urlpatterns = [
    path('me/', MyAccessView.as_view(), name='access-me'),
    path('matrix/', AccessMatrixView.as_view(), name='access-matrix'),
    path('users/<int:pk>/', UserAccessView.as_view(), name='access-user'),
]
