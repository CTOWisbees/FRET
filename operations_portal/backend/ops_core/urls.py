from django.urls import path
from . import views

urlpatterns = [
    # Auth (Unified Single Login)
    path('auth/login', views.api_login, name='api_login'),
    path('auth/me', views.api_me, name='api_me'),
    path('auth/profile', views.api_profile, name='api_profile'),
    path('user/profile', views.api_profile, name='api_user_profile'),
    path('auth/forgot-password/send-otp', views.api_forgot_password_send_otp, name='api_forgot_password_send_otp'),
    path('auth/forgot-password/verify-otp', views.api_forgot_password_verify_otp, name='api_forgot_password_verify_otp'),
    path('auth/forgot-password/reset', views.api_forgot_password_reset, name='api_forgot_password_reset'),

    # Superadmin Department Manager Appointments
    path('admin/managers', views.api_admin_managers, name='api_admin_managers'),
    path('admin/managers/assign', views.api_admin_assign_manager, name='api_admin_assign_manager'),
    path('admin/managers/remove', views.api_admin_remove_manager, name='api_admin_remove_manager'),

    # Admin endpoints
    path('admin/dashboard', views.api_admin_dashboard, name='api_admin_dashboard'),
    path('admin/departments', views.api_admin_departments, name='api_admin_departments'),
    path('admin/departments/<int:pk>', views.api_admin_department_detail, name='api_admin_department_detail'),
    path('admin/department-matrix', views.api_admin_department_matrix, name='api_admin_department_matrix'),
    path('admin/employees', views.api_admin_employees, name='api_admin_employees'),
    path('admin/employees/<int:pk>', views.api_admin_employee_detail, name='api_admin_employee_detail'),
    path('admin/roles', views.api_admin_roles, name='api_admin_roles'),
    path('admin/tasks', views.api_admin_tasks, name='api_admin_tasks'),
    path('admin/tasks/<int:pk>', views.api_admin_task_detail, name='api_admin_task_detail'),

    # Assigned Tasks (Superadmin, Manager, Employee)
    path('tracker/assigned-tasks', views.api_assigned_tasks, name='api_assigned_tasks'),
    path('tracker/assigned-tasks/create', views.api_create_assigned_task, name='api_create_assigned_task'),
    path('tracker/assigned-tasks/<int:pk>/status', views.api_update_assigned_task_status, name='api_update_assigned_task_status'),

    # Daily Work Tracker Endpoints (BRD Feature Set)
    path('tracker/daily', views.api_tracker_get, name='api_tracker_get'),
    path('tracker/daily/save', views.api_tracker_save, name='api_tracker_save'),
    path('tracker/daily/request-unlock', views.api_tracker_request_unlock, name='api_tracker_request_unlock'),
    path('tracker/admin/list', views.api_admin_tracker_list, name='api_admin_tracker_list'),
    path('tracker/admin/review', views.api_admin_tracker_review, name='api_admin_tracker_review'),
    path('tracker/admin/unlock-requests', views.api_admin_tracker_unlock_requests, name='api_admin_tracker_unlock_requests'),
    path('tracker/admin/unlock-decision', views.api_admin_tracker_unlock_decision, name='api_admin_tracker_unlock_decision'),
    path('tracker/export', views.api_tracker_export, name='api_tracker_export'),

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

    # Digital Marketing endpoints
    path('dm/ghost-posts', views.api_dm_ghost_posts, name='api_dm_ghost_posts'),
    path('dm/newsletter-blast', views.api_dm_newsletter_blast, name='api_dm_newsletter_blast'),

    # IA (Institutional Stock Research & Recommendations Performance) endpoints
    path('ia/search-stocks', views.api_ia_search_stocks, name='api_ia_search_stocks'),
    path('ia/fetch-stock-data', views.api_ia_fetch_stock_data, name='api_ia_fetch_stock_data'),
    path('ia/recommendations', views.api_stock_recommendations_list, name='api_stock_recommendations_list'),
    path('ia/recommendations/create', views.api_stock_recommendation_create, name='api_stock_recommendation_create'),
    path('ia/recommendations/<int:pk>/update', views.api_stock_recommendation_update, name='api_stock_recommendation_update'),
    path('ia/recommendations/<int:pk>/delete', views.api_stock_recommendation_delete, name='api_stock_recommendation_delete'),
    path('ia/recommendations/calculate', views.api_stock_recommendations_calculate, name='api_stock_recommendations_calculate'),
    path('ia/recommendations/refresh-prices', views.api_stock_recommendations_refresh_prices, name='api_stock_recommendations_refresh_prices'),
]

