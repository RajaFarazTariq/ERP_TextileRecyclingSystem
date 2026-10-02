from django.contrib import admin

from .models import Attendance, Department, Employee, JobRole, LeaveRequest, Shift, TaskAssignment


@admin.register(Department)
class DepartmentAdmin(admin.ModelAdmin):
    list_display = ['name', 'is_active']


@admin.register(JobRole)
class JobRoleAdmin(admin.ModelAdmin):
    list_display = ['title', 'department']


@admin.register(Shift)
class ShiftAdmin(admin.ModelAdmin):
    list_display = ['name', 'start_time', 'end_time', 'is_active']


@admin.register(Employee)
class EmployeeAdmin(admin.ModelAdmin):
    list_display = ['number', 'full_name', 'department', 'job_role', 'employment_type', 'status']
    list_filter = ['status', 'employment_type', 'department']
    search_fields = ['number', 'full_name']


@admin.register(Attendance)
class AttendanceAdmin(admin.ModelAdmin):
    list_display = ['employee', 'date', 'status', 'check_in', 'check_out', 'hours_worked', 'overtime_hours']
    list_filter = ['status', 'date']


@admin.register(LeaveRequest)
class LeaveRequestAdmin(admin.ModelAdmin):
    list_display = ['employee', 'leave_type', 'start_date', 'end_date', 'days', 'status']
    list_filter = ['status', 'leave_type']


@admin.register(TaskAssignment)
class TaskAssignmentAdmin(admin.ModelAdmin):
    list_display = ['title', 'employee', 'date', 'area', 'status', 'hours_spent', 'output_kg']
    list_filter = ['status', 'area']
