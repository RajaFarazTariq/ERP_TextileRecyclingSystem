from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView

from .views import LoginView, LogoutView, RegisterView, UserListView, UserDetailView, ToggleActiveView

urlpatterns = [
    path('login/', LoginView.as_view(), name='login'),
    path('logout/', LogoutView.as_view(), name='logout'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token-refresh'),
    path('register/', RegisterView.as_view(), name='register'),
    path('list/', UserListView.as_view(), name='user-list'),
    path('detail/<int:pk>/', UserDetailView.as_view(), name='user-detail'),
    path('toggle-active/<int:pk>/', ToggleActiveView.as_view(), name='toggle-active'),
]