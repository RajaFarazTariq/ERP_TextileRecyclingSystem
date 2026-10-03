from django.urls import path

from .views import (
    AccessMatrixView, DutyMatrixView, MyAccessView, RoleDetailView, RoleListView, RoleNamesView, UserAccessView,
)

urlpatterns = [
    path('me/', MyAccessView.as_view(), name='access-me'),
    path('matrix/', AccessMatrixView.as_view(), name='access-matrix'),
    path('duties/', DutyMatrixView.as_view(), name='access-duties'),
    path('roles/', RoleListView.as_view(), name='access-roles'),
    path('role-names/', RoleNamesView.as_view(), name='access-role-names'),
    path('roles/<int:pk>/', RoleDetailView.as_view(), name='access-role'),
    path('users/<int:pk>/', UserAccessView.as_view(), name='access-user'),
]
