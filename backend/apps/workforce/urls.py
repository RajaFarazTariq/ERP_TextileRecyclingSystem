from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    AttendanceViewSet, DepartmentViewSet, EmployeeViewSet, JobRoleViewSet, LeaveRequestViewSet, ProductivityView,
    ShiftViewSet, TaskViewSet, WorkforceSummaryView,
)

router = DefaultRouter()
router.register(r'departments', DepartmentViewSet, basename='workforce-department')
router.register(r'job-roles', JobRoleViewSet, basename='workforce-job-role')
router.register(r'shifts', ShiftViewSet, basename='workforce-shift')
router.register(r'employees', EmployeeViewSet, basename='workforce-employee')
router.register(r'attendance', AttendanceViewSet, basename='workforce-attendance')
router.register(r'leave', LeaveRequestViewSet, basename='workforce-leave')
router.register(r'tasks', TaskViewSet, basename='workforce-task')

urlpatterns = [
    path('summary/', WorkforceSummaryView.as_view(), name='workforce-summary'),
    path('productivity/', ProductivityView.as_view(), name='workforce-productivity'),
    path('', include(router.urls)),
]
