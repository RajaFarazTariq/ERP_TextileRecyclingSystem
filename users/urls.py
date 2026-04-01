from django.urls import path
from .views import LoginView, RegisterView, UserListView, UserDetailView

urlpatterns = [
    path('login/', LoginView.as_view(), name='login'),
    path('register/', RegisterView.as_view(), name='register'),
    path('list/', UserListView.as_view(), name='user-list'),
    path('detail/<int:pk>/', UserDetailView.as_view(), name='user-detail'),
]