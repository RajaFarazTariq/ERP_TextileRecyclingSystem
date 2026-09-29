from django.urls import path
from .views import LoginView, RegisterView, UserListView, UserDetailView, ToggleActiveView

urlpatterns = [
    path('login/', LoginView.as_view(), name='login'),
    path('register/', RegisterView.as_view(), name='register'),
    path('list/', UserListView.as_view(), name='user-list'),
    path('detail/<int:pk>/', UserDetailView.as_view(), name='user-detail'),
    path('toggle-active/<int:pk>/', ToggleActiveView.as_view(), name='toggle-active'),
]