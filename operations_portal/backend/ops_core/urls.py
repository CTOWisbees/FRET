from django.urls import path
from . import views

urlpatterns = [
    # Auth
    path('auth/login', views.api_login, name='api_login'),
    path('auth/me', views.api_me, name='api_me'),

    # Admin endpoints
    path('admin/dashboard', views.api_admin_dashboard, name='api_admin_dashboard'),
    path('admin/employees', views.api_admin_employees, name='api_admin_employees'),
    path('admin/employees/<int:pk>', views.api_admin_employee_detail, name='api_admin_employee_detail'),
    path('admin/roles', views.api_admin_roles, name='api_admin_roles'),
    path('admin/tasks', views.api_admin_tasks, name='api_admin_tasks'),
    path('admin/tasks/<int:pk>', views.api_admin_task_detail, name='api_admin_task_detail'),

    # Employee endpoints
    path('employee/dashboard', views.api_employee_dashboard, name='api_employee_dashboard'),
    path('employee/tasks', views.api_employee_tasks, name='api_employee_tasks'),
    path('employee/tasks/<int:pk>/status', views.api_employee_update_task_status, name='api_employee_update_task_status'),
    path('employee/work-logs', views.api_employee_work_logs, name='api_employee_work_logs'),
    path('employee/my-role', views.api_employee_my_role, name='api_employee_my_role'),

    # Attendance & Live Timer endpoints
    path('attendance/today', views.api_attendance_today, name='api_attendance_today'),
    path('attendance/check-in', views.api_attendance_check_in, name='api_attendance_check_in'),
    path('attendance/check-out', views.api_attendance_check_out, name='api_attendance_check_out'),
    path('attendance/history', views.api_attendance_history, name='api_attendance_history'),
]
