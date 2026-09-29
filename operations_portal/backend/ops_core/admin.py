from django.contrib import admin
from .models import (
    Department,
    OperationUser,
    OPUserDepartmentAccess,
    OPSession,
    LoginOTP,
    OperationalRole,
    WorkTask,
    WorkLog,
    ActivityLog,
    AttendanceRecord,
)

# Customize Admin Site Headers
admin.site.site_header = "Django administration"
admin.site.site_title = "OP Administration"
admin.site.index_title = "Site administration"


class OPUserDepartmentAccessInline(admin.TabularInline):
    model = OPUserDepartmentAccess
    extra = 1
    fields = ('department', 'is_active')
    verbose_name = "Department Access"
    verbose_name_plural = "DEPARTMENT ACCESS"


@admin.register(Department)
class DepartmentAdmin(admin.ModelAdmin):
    list_display = ('name', 'page_key', 'is_active')
    list_filter = ('is_active',)
    search_fields = ('name', 'page_key')
    ordering = ('name',)
    list_editable = ('is_active',)


@admin.register(OperationUser)
class OPUserAdmin(admin.ModelAdmin):
    list_display = ('email', 'full_name', 'is_active', 'role', 'created_at')
    list_filter = ('is_active', 'role', 'status')
    search_fields = ('email', 'full_name', 'name', 'emp_code')
    ordering = ('email',)
    inlines = [OPUserDepartmentAccessInline]
    
    fieldsets = (
        (None, {
            'fields': ('email', 'full_name', 'is_active')
        }),
        ('Extended Details (Optional)', {
            'classes': ('collapse',),
            'fields': ('role', 'password', 'phone', 'emp_code', 'designation', 'status', 'skills', 'assigned_role'),
        }),
    )

    def save_model(self, request, obj, form, change):
        # Set raw password into hashed password if modified or newly created
        if not change and not obj.password:
            obj.set_password('employee123')
        elif form.cleaned_data.get('password') and not form.cleaned_data['password'].startswith('pbkdf2_'):
            obj.set_password(form.cleaned_data['password'])
        super().save_model(request, obj, form, change)


@admin.register(OPUserDepartmentAccess)
class OPUserDepartmentAccessAdmin(admin.ModelAdmin):
    list_display = ('user', 'department', 'is_active', 'created_at')
    list_filter = ('is_active', 'department')
    search_fields = ('user__email', 'user__name', 'user__full_name', 'department__name')
    ordering = ('user', 'department')


@admin.register(OPSession)
class OPSessionAdmin(admin.ModelAdmin):
    list_display = ('user', 'session_token', 'ip_address', 'is_active', 'created_at', 'expires_at')
    list_filter = ('is_active',)
    search_fields = ('user__email', 'session_token', 'ip_address')
    ordering = ('-created_at',)


@admin.register(LoginOTP)
class LoginOTPAdmin(admin.ModelAdmin):
    list_display = ('email', 'otp_code', 'is_verified', 'created_at', 'expires_at')
    list_filter = ('is_verified',)
    search_fields = ('email', 'otp_code')
    ordering = ('-created_at',)


@admin.register(OperationalRole)
class OperationalRoleAdmin(admin.ModelAdmin):
    list_display = ('title', 'department', 'level', 'created_at')
    search_fields = ('title', 'department')


@admin.register(WorkTask)
class WorkTaskAdmin(admin.ModelAdmin):
    list_display = ('title', 'assigned_to', 'priority', 'status', 'deadline', 'created_at')
    list_filter = ('priority', 'status')
    search_fields = ('title', 'assigned_to__name', 'assigned_to__email')


@admin.register(WorkLog)
class WorkLogAdmin(admin.ModelAdmin):
    list_display = ('task', 'user', 'hours_spent', 'created_at')


@admin.register(ActivityLog)
class ActivityLogAdmin(admin.ModelAdmin):
    list_display = ('user', 'action', 'created_at')


@admin.register(AttendanceRecord)
class AttendanceRecordAdmin(admin.ModelAdmin):
    list_display = ('user', 'date', 'status', 'check_in_time', 'check_out_time', 'total_hours')
    list_filter = ('status', 'date')
    search_fields = ('user__name', 'user__email')
