from django.contrib import admin
from django.urls import path
from hrms import views, newsletter_views

def api_offer_draft_dispatch(request):
    if request.method == 'POST':
        return views.api_offer_draft_save(request)
    return views.api_offer_draft_get(request)

urlpatterns = [
    path('admin/', admin.site.urls),

    # Auth
    path('', views.index, name='index'),
    path('login', views.login_view, name='login'),
    path('employee-login', views.employee_login_view, name='employee_login'),
    path('change-password', views.change_password_view, name='change_password'),
    path('employee-dashboard', views.employee_dashboard_view, name='employee_dashboard'),
    path('api/employee-dashboard', views.employee_dashboard_view, name='api_employee_dashboard'),
    path('api/employee/me', views.api_employee_me, name='api_employee_me'),
    path('intern-dashboard', views.intern_dashboard_view, name='intern_dashboard'),
    path('employee-logout', views.employee_logout_view, name='employee_logout'),
    path('register', views.register_view, name='register'),
    path('verify-otp', views.verify_otp_view, name='verify_otp'),
    path('logout', views.logout_view, name='logout'),

    # HR & Dashboard
    path('dashboard', views.dashboard_view, name='dashboard'),
    path('employees', views.employees_view, name='employees'),
    path('employees/add', views.add_employee_view, name='add_employee'),
    path('employees/<int:emp_id>/edit', views.edit_employee_view, name='edit_employee'),
    path('employees/<int:emp_id>/delete', views.delete_employee_view, name='delete_employee'),
    path('employee-profile', views.employee_profile_view, name='employee_profile'),

    # Offer & Experience Letters
    path('offer-letter', views.offer_letter_page_view, name='offer_letter_page'),
    path('offer-letter/roles', views.api_offer_roles, name='api_offer_roles'),
    path('api/offer-letter/roles', views.api_offer_roles),
    path('offer-letter/draft', views.api_offer_draft_get, name='api_offer_draft_get'),
    path('api/offer-letter/draft', views.api_offer_draft_get),
    path('api/offer-draft', api_offer_draft_dispatch, name='api_offer_draft'),
    path('offer-letter/draft/save', views.api_offer_draft_save, name='api_offer_draft_save'),
    path('api/offer-letter/draft/save', views.api_offer_draft_save),
    path('offer-letter/send', views.send_email_route, name='api_offer_letter_send'),
    path('api/offer-letter/send', views.send_email_route),
    path('generate-offer-letter', views.generate_offer_letter, name='generate_offer_letter'),
    path('generate-experience-letter', views.experience_letter, name='generate_experience_letter'),
    path('experience-letter/<int:emp_id>', views.experience_letter, name='experience_letter'),
    path('experience_letter/send', views.send_experience_letter_email, name='api_experience_letter_send'),
    path('api/experience_letter/send', views.send_experience_letter_email),
    path('send-email', views.send_email_route, name='send_email_route'),
    path('send-experience-letter-email', views.send_experience_letter_email, name='send_experience_letter_email'),

    # Settings & Profile
    path('settings', views.settings_view, name='settings'),
    path('settings/email', views.save_email_config, name='save_email_config'),
    path('settings/company', views.save_company_settings, name='save_company_settings'),
    path('profile', views.profile_view, name='profile'),
    path('profile/update', views.update_profile_view, name='update_profile'),

    # Stats & Files
    path('api/stats', views.api_stats, name='api_stats'),
    path('api/employee/<int:emp_id>', views.api_employee, name='api_employee'),
    path('api/role-info', views.api_role_info, name='api_role_info'),
    path('api/employees-list', views.api_employees_list, name='api_employees_list'),
    path('letterhead', views.serve_letterhead, name='serve_letterhead'),
    path('signature/<int:hr_id>', views.serve_signature, name='serve_signature'),
    path('employee/<int:emp_id>/avatar', views.get_employee_avatar, name='get_employee_avatar'),
    path('employee/<int:emp_id>/id-card', views.view_id_card, name='view_id_card'),

    # Attendance & Leave
    path('leave-management', views.leave_management, name='leave_management'),
    path('leave/<int:leave_id>/approve', views.approve_leave, name='approve_leave'),
    path('leave/<int:leave_id>/reject', views.reject_leave, name='reject_leave'),
    path('api/offer-preview', views.api_offer_preview, name='api_offer_preview'),
    path('attendance/checkin', views.checkin, name='checkin'),
    path('attendance/checkout', views.checkout, name='checkout'),
    path('attendance', views.attendance_view, name='attendance'),
    path('attendance-management', views.attendance_management, name='attendance_management'),
    path('attendance/export', views.export_attendance, name='export_attendance'),
    path('apply-leave', views.apply_leave, name='apply_leave'),

    # Announcements
    path('announcements', views.announcements_view, name='announcements'),
    path('announcements/delete/<int:announcement_id>', views.delete_announcement_view, name='delete_announcement'),
    path('employee-announcements', views.employee_announcements_view, name='employee_announcements'),

    # Work Hub
    path('work', views.work_view, name='work'),
    path('newsletter-workspace', views.newsletter_workspace_view, name='newsletter_workspace'),
    path('temp-reset-password-xyz', views.temp_reset, name='temp_reset'),

    # Research Reports
    path('research/generate', views.generate_report, name='generate_report'),
    path('research/history', views.research_history, name='research_history'),
    path('research/view/<int:report_id>', views.view_research_report, name='view_research_report'),
    path('research/edit/<int:report_id>', views.edit_research_report, name='edit_research_report'),
    path('research/update/<int:report_id>', views.update_research_report, name='update_research_report'),
    path('research/mail', views.mail_report, name='mail_report'),

    # Stock & AI APIs
    path('api/get-analyst-coverage/<str:symbol>', views.get_analyst_coverage, name='get_analyst_coverage'),
    path('api/rephrase-text', views.rephrase_text, name='rephrase_text'),
    path('api/search-stocks', views.search_stocks, name='search_stocks'),
    path('api/get-stock-data/<str:symbol>', views.get_stock_data, name='get_stock_data'),
    path('api/get-stock-financials/<str:symbol>', views.get_stock_financials, name='get_stock_financials'),

    # Newsletter APIs
    path('api/newsletter/posts', newsletter_views.list_posts, name='list_posts'),
    path('api/newsletter/wealth-help-posts', newsletter_views.list_wealth_help_posts, name='list_wealth_help_posts'),
    path('api/newsletter/sendable-posts', newsletter_views.list_sendable_posts, name='list_sendable_posts'),
    path('send-bulk-newsletter', newsletter_views.send_bulk_newsletter, name='send_bulk_newsletter'),
    path('api/newsletter/job/<int:job_id>', newsletter_views.job_status, name='job_status'),
    path('newsletter/unsubscribe', newsletter_views.unsubscribe, name='unsubscribe'),
]
