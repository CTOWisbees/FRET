from django.contrib import admin
from .models import OperationUser, OperationalRole, WorkTask, WorkLog, ActivityLog

@admin.register(OperationUser)
class OperationUserAdmin(admin.ModelAdmin):
    list_display = ('name', 'email', 'role', 'designation', 'status', 'assigned_role')
    search_fields = ('name', 'email', 'designation')
    list_filter = ('role', 'status', 'department')

@admin.register(OperationalRole)
class OperationalRoleAdmin(admin.ModelAdmin):
    list_display = ('title', 'department', 'level', 'created_at')
    search_fields = ('title', 'department')

@admin.register(WorkTask)
class WorkTaskAdmin(admin.ModelAdmin):
    list_display = ('title', 'assigned_to', 'priority', 'status', 'deadline', 'created_at')
    list_filter = ('priority', 'status')
    search_fields = ('title', 'assigned_to__name')

@admin.register(WorkLog)
class WorkLogAdmin(admin.ModelAdmin):
    list_display = ('task', 'user', 'hours_spent', 'created_at')

@admin.register(ActivityLog)
class ActivityLogAdmin(admin.ModelAdmin):
    list_display = ('user', 'action', 'created_at')
