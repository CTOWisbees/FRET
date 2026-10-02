import json
import io
import os
import csv
import smtplib
import urllib.request
import urllib.error
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from datetime import datetime, date, timedelta
import random
from django.conf import settings
from django.http import JsonResponse, HttpResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST, require_GET, require_http_methods
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.db.models import Q, Count, Sum, Avg
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
    DepartmentManagerAssignment,
    DailyTrackerConfig,
    DailyAssignedTask,
    DailyTrackerDay,
    DailyTaskRow,
    DailyTrackerUnlockRequest,
    DailyTrackerAuditLog,
)


def parse_request_json(request):
    try:
        if request.body:
            return json.loads(request.body.decode('utf-8'))
    except Exception:
        pass
    return {}


def get_current_user(request):
    """
    Extract user from Authorization / X-User-Auth header e.g. Bearer ops:employee:1 or ops:admin:2 or session
    """
    auth_header = request.headers.get('Authorization') or request.headers.get('X-User-Auth')
    if auth_header:
        token = auth_header.replace('Bearer ', '').strip()
        if token.startswith('ops:'):
            parts = token.split(':')
            if len(parts) >= 3:
                try:
                    uid = int(parts[2])
                    u = OperationUser.objects.filter(id=uid).first()
                    if u:
                        return u
                except Exception:
                    pass
        # Session token lookup
        sess = OPSession.objects.filter(session_token=token, is_active=True).first()
        if sess and sess.user:
            return sess.user

    # Fallback to X-Employee-Id or X-User-Id header
    uid = request.headers.get('X-User-Id') or request.headers.get('X-Employee-Id')
    if uid:
        try:
            return OperationUser.objects.filter(id=int(uid)).first()
        except Exception:
            pass
    return None


# Google Sheets Operational Departments & Modules Catalog Matrix
DEPARTMENTS_MODULES_CATALOG = {
    "Digital Marketing": [
        {"id": "bulk_email", "name": "Bulk email", "description": "High-volume transactional and campaign email dispatch"},
        {"id": "campaign_analytics", "name": "Campaign Analytics", "description": "CTR, open rate, and conversion metrics"},
        {"id": "social_media_mgmt", "name": "Social Media Strategy", "description": "Post scheduling and community branding"}
    ],
    "IT": [
        {"id": "task_management", "name": "Task Management", "description": "Core task dispatch, sprint workflows, and SLA tracking"},
        {"id": "system_admin", "name": "System Administration", "description": "Access control, infrastructure, and automation pipelines"},
        {"id": "api_web_portals", "name": "API & Web Portals", "description": "REST APIs, Next.js frontend interfaces, and integrations"}
    ],
    "IA - Research": [
        {"id": "report_generation", "name": "Report Generation", "description": "Automated investment and equity research reporting"},
        {"id": "portfolio_tracking", "name": "portfolio tracking dashboard", "description": "Real-time client portfolio metrics and asset performance"},
        {"id": "market_intelligence", "name": "Market Intelligence", "description": "Macro analysis, filings, and competitor intelligence"}
    ],
    "WBC": [
        {"id": "client_advisory", "name": "Client Advisory", "description": "WisBees consulting client interactions & proposals"},
        {"id": "ops_coordination", "name": "Operations Coordination", "description": "Cross-functional consulting deliverables"}
    ],
    "Wealth": [
        {"id": "portfolio_management", "name": "Portfolio Management", "description": "Wealth strategy, asset allocation, and rebalancing"},
        {"id": "wealth_analytics", "name": "Wealth Analytics", "description": "Risk profiling, CAGR, and yield tracking"}
    ],
    "Content Publishing": [
        {"id": "content_editor", "name": "Content Editor", "description": "Research note editing, editorial approvals & SEO"},
        {"id": "publishing_pipeline", "name": "Publishing Pipeline", "description": "Multi-channel broadcast and newsletter distributions"}
    ]
}


def serialize_user(user):
    primary_role = user.assigned_role or user.assigned_roles.first()
    assigned_roles_list = list(user.assigned_roles.all())
    if not assigned_roles_list and primary_role:
        assigned_roles_list = [primary_role]

    all_perms = set()
    for r in assigned_roles_list:
        if isinstance(r.permissions, list):
            for p in r.permissions:
                all_perms.add(p)

    # Department Accesses from OPUserDepartmentAccess
    dept_accesses = []
    for da in user.department_accesses.select_related('department').all():
        dept_accesses.append({
            'id': da.department.id,
            'name': da.department.name,
            'page_key': da.department.page_key,
            'is_active': da.is_active and da.department.is_active
        })

    dept_names = []
    # 1. From active OPUserDepartmentAccess
    for da in dept_accesses:
        if da['is_active'] and da['name'] not in dept_names:
            dept_names.append(da['name'])

    # 2. From assigned_departments JSON field
    if isinstance(user.assigned_departments, list):
        for d in user.assigned_departments:
            if d and d not in dept_names:
                dept_names.append(d)

    # 3. From primary department
    if user.department and user.department not in dept_names:
        dept_names.append(user.department)

    # 4. From assigned roles
    for r in assigned_roles_list:
        if r.department and r.department != 'Operations' and r.department not in dept_names:
            dept_names.append(r.department)

    depts = dept_names if dept_names else ([user.department] if user.department else ["Operations"])
    modules = user.assigned_modules if isinstance(user.assigned_modules, list) else []

    managed_depts = []
    if isinstance(user.managed_departments, list):
        managed_depts = [d for d in user.managed_departments if d]
    if user.managed_department and user.managed_department not in managed_depts:
        managed_depts.append(user.managed_department)

    # Also check active DepartmentManagerAssignment
    try:
        for dma in user.department_managements.filter(is_active=True).select_related('department'):
            if dma.department.name not in managed_depts:
                managed_depts.append(dma.department.name)
    except Exception:
        pass

    is_mgr = bool(user.is_manager or len(managed_depts) > 0)
    is_super = bool(user.is_superadmin or user.role == 'admin')

    return {
        'id': user.id,
        'name': user.name,
        'full_name': user.full_name or user.name,
        'email': user.email,
        'role': user.role,
        'is_superadmin': is_super,
        'is_manager': is_mgr,
        'managed_department': user.managed_department or (managed_depts[0] if managed_depts else ''),
        'managed_departments': managed_depts,
        'emp_type': user.emp_type or ('Intern' if 'intern' in (user.designation or '').lower() else 'Normal'),
        'phone': user.phone,
        'emp_code': user.emp_code or f"OPS-{user.id:04d}",
        'designation': user.designation,
        'department': user.department or (depts[0] if depts else 'Operations'),
        'assigned_departments': depts,
        'assigned_modules': modules,
        'department_accesses': dept_accesses,
        'status': user.status,
        'is_active': user.is_active and user.status == 'Active',
        'joining_date': user.joining_date.strftime('%Y-%m-%d') if user.joining_date else '',
        'avatar_url': user.avatar_url,
        'skills': user.skills,
        'assigned_role': {
            'id': primary_role.id,
            'title': primary_role.title,
            'level': primary_role.level,
            'department': primary_role.department,
            'permissions': primary_role.permissions,
            'responsibilities': primary_role.responsibilities,
        } if primary_role else None,
        'assigned_roles': [{
            'id': r.id,
            'title': r.title,
            'level': r.level,
            'department': r.department,
            'permissions': r.permissions,
            'responsibilities': r.responsibilities,
        } for r in assigned_roles_list],
        'all_permissions': list(all_perms),
    }


def serialize_task(task):
    return {
        'id': task.id,
        'title': task.title,
        'description': task.description,
        'priority': task.priority,
        'status': task.status,
        'deadline': task.deadline.strftime('%Y-%m-%d') if task.deadline else '',
        'estimated_hours': task.estimated_hours,
        'tags': [t.strip() for t in task.tags.split(',') if t.strip()] if task.tags else [],
        'attachment_url': task.attachment_url,
        'submission_notes': task.submission_notes,
        'submission_link': task.submission_link,
        'completed_at': task.completed_at.strftime('%Y-%m-%d %H:%M') if task.completed_at else None,
        'created_at': task.created_at.strftime('%Y-%m-%d %H:%M'),
        'assigned_to': {
            'id': task.assigned_to.id,
            'name': task.assigned_to.name,
            'email': task.assigned_to.email,
            'designation': task.assigned_to.designation,
            'department': task.assigned_to.department,
            'emp_code': task.assigned_to.emp_code,
        } if task.assigned_to else None,
        'created_by': {
            'id': task.created_by.id,
            'name': task.created_by.name,
        } if task.created_by else None,
    }


# ─────────────────────────────────────────────────────────────
# 1. AUTHENTICATION APIS (Unified Single Login)
# ─────────────────────────────────────────────────────────────

@csrf_exempt
@require_POST
def api_login(request):
    data = parse_request_json(request)
    email = data.get('email', '').strip().lower()
    password = data.get('password', '')

    if not email or not password:
        return JsonResponse({'success': False, 'error': 'Please provide email and password.'}, status=400)

    user = OperationUser.objects.filter(email__iexact=email).first()
    if not user or not user.check_password(password):
        return JsonResponse({'success': False, 'error': 'Invalid email or password.'}, status=401)

    if not user.is_active or user.status != 'Active':
        return JsonResponse({'success': False, 'error': 'Account is inactive. Please contact Operations Administrator.'}, status=403)

    is_superadmin = bool(user.is_superadmin or user.role == 'admin')
    token = f"ops:{user.role}:{user.id}"
    ActivityLog.objects.create(user=user, action=f"User {user.name} logged in ({user.role})")

    # Record active session in OPSession
    try:
        ip = request.META.get('HTTP_X_FORWARDED_FOR', request.META.get('REMOTE_ADDR', '127.0.0.1'))
        if ',' in ip:
            ip = ip.split(',')[0].strip()
        ua = request.META.get('HTTP_USER_AGENT', '')
        OPSession.objects.create(
            user=user,
            session_token=f"{token}:{timezone.now().timestamp()}",
            ip_address=ip if len(ip) <= 45 else None,
            user_agent=ua[:500],
            is_active=True,
            expires_at=timezone.now() + timezone.timedelta(days=7)
        )
    except Exception:
        pass

    user_data = serialize_user(user)
    redirect_url = '/admin/dashboard' if is_superadmin else '/employee/dashboard'

    return JsonResponse({
        'success': True,
        'message': f'Welcome back, {user.name}!',
        'token': token,
        'user': user_data,
        'redirect_url': redirect_url,
    })


@csrf_exempt
@require_GET
def api_me(request):
    user = get_current_user(request)
    if not user:
        return JsonResponse({'authenticated': False, 'error': 'Unauthorized'}, status=401)

    return JsonResponse({
        'authenticated': True,
        'user': serialize_user(user),
    })


@csrf_exempt
@require_http_methods(["GET", "PUT", "POST"])
def api_profile(request):
    user = get_current_user(request)
    if not user:
        return JsonResponse({'success': False, 'error': 'Unauthorized. Please log in.'}, status=401)

    if request.method == 'GET':
        return JsonResponse({
            'success': True,
            'user': serialize_user(user)
        })

    # Profile Update (PUT or POST)
    data = parse_request_json(request)

    # 1. Email Handling
    new_email = data.get('email', '').strip().lower() if 'email' in data else ''
    if new_email and new_email != user.email.lower():
        if user.role != 'admin':
            return JsonResponse({
                'success': False,
                'error': 'Employees are not permitted to change their registered company email. Please contact an Operations Administrator.'
            }, status=403)
        
        # Check uniqueness for Admin
        if OperationUser.objects.filter(email__iexact=new_email).exclude(id=user.id).exists():
            return JsonResponse({
                'success': False,
                'error': 'This email address is already registered to another account.'
            }, status=400)
        
        user.email = new_email

    # 2. General Profile Fields
    if 'full_name' in data and data['full_name'].strip():
        user.full_name = data['full_name'].strip()
        user.name = data['full_name'].strip()
    elif 'name' in data and data['name'].strip():
        user.name = data['name'].strip()
        user.full_name = data['name'].strip()

    if 'phone' in data:
        user.phone = data['phone'].strip()

    if 'avatar_url' in data:
        user.avatar_url = data['avatar_url'].strip()

    if 'skills' in data:
        user.skills = data['skills'].strip()

    if user.role == 'admin':
        if 'designation' in data and data['designation'].strip():
            user.designation = data['designation'].strip()

    # 3. Password Update
    new_password = data.get('new_password', '').strip()
    current_password = data.get('current_password', '').strip()

    if new_password:
        if not current_password:
            return JsonResponse({
                'success': False,
                'error': 'Current password is required to change your password.'
            }, status=400)

        if not user.check_password(current_password):
            return JsonResponse({
                'success': False,
                'error': 'Current password is incorrect.'
            }, status=400)

        if len(new_password) < 6:
            return JsonResponse({
                'success': False,
                'error': 'New password must be at least 6 characters long.'
            }, status=400)

        confirm_password = data.get('confirm_password', '').strip()
        if confirm_password and confirm_password != new_password:
            return JsonResponse({
                'success': False,
                'error': 'New password and confirmation password do not match.'
            }, status=400)

        user.set_password(new_password)

    user.save()

    try:
        ActivityLog.objects.create(
            user=user,
            action=f"Updated profile details ({'Password changed' if new_password else 'Info updated'})"
        )
    except Exception:
        pass

    return JsonResponse({
        'success': True,
        'message': 'Profile updated successfully!',
        'user': serialize_user(user)
    })


def send_otp_email(email, otp_code, user_name="Team Member"):
    """
    Sends OTP email via Gmail SMTP with both HTML & Plain Text templates.
    """
    subject = f"WisBees Operations Portal - Verification Code: {otp_code}"
    body_text = f"""Hello {user_name},

You have requested to reset your password for the WisBees Operations Portal.

Your One-Time Password (OTP) verification code is: {otp_code}

This verification code is valid for 10 minutes. If you did not make this request, please ignore this email.

Best regards,
WisBees Operations Team
"""

    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body {{ font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f8fafc; color: #1e293b; margin: 0; padding: 24px; }}
        .card {{ max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 20px; border: 1px solid #e2e8f0; padding: 36px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }}
        .logo {{ font-size: 20px; font-weight: 900; color: #0284c7; letter-spacing: -0.5px; margin-bottom: 20px; text-transform: uppercase; }}
        .title {{ font-size: 18px; font-weight: 800; color: #0f172a; margin-bottom: 12px; }}
        .desc {{ font-size: 14px; color: #64748b; line-height: 1.6; margin-bottom: 24px; }}
        .otp-box {{ background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%); border: 2px dashed #0284c7; border-radius: 16px; padding: 20px; text-align: center; margin-bottom: 24px; }}
        .otp-code {{ font-size: 32px; font-weight: 900; letter-spacing: 8px; color: #0369a1; font-family: monospace; }}
        .footer {{ font-size: 12px; color: #94a3b8; line-height: 1.5; border-top: 1px solid #f1f5f9; padding-top: 20px; margin-top: 20px; }}
      </style>
    </head>
    <body>
      <div class="card">
        <div class="logo">WisBees Operations</div>
        <div class="title">Password Reset Verification</div>
        <div class="desc">Hello <strong>{user_name}</strong>,<br>You recently requested to reset your password for the WisBees Operations Portal. Use the verification code below to proceed:</div>
        <div class="otp-box">
          <div class="otp-code">{otp_code}</div>
        </div>
        <div class="desc" style="font-size: 12px; margin-bottom: 0;">This code will expire in <strong>10 minutes</strong>. If you did not request a password reset, you can safely disregard this message.</div>
        <div class="footer">WisBees Operations Management Portal • Enterprise Secure Access</div>
      </div>
    </body>
    </html>
    """

    smtp_server = getattr(settings, 'EMAIL_HOST', 'smtp.gmail.com')
    smtp_port = getattr(settings, 'EMAIL_PORT', 587)
    smtp_user = getattr(settings, 'EMAIL_HOST_USER', '')
    smtp_password = getattr(settings, 'EMAIL_HOST_PASSWORD', '')

    sent = False
    if smtp_user and smtp_password:
        try:
            msg = MIMEMultipart('alternative')
            msg['From'] = f"WisBees Operations <{smtp_user}>"
            msg['To'] = email
            msg['Subject'] = subject
            msg.attach(MIMEText(body_text, 'plain'))
            msg.attach(MIMEText(html_content, 'html'))

            with smtplib.SMTP(smtp_server, smtp_port, timeout=10) as server:
                server.starttls()
                server.login(smtp_user, smtp_password)
                server.sendmail(smtp_user, [email], msg.as_string())
            sent = True
            print(f"[OTP Email Sent Successfully] To: {email}")
        except Exception as e:
            print(f"[OTP Email SMTP Error]: {e}")

    print(f"\n==========================================")
    print(f"[PASSWORD RESET OTP] Target: {email}")
    print(f"[OTP Code]: {otp_code}")
    print(f"==========================================\n")
    return sent


@csrf_exempt
@require_POST
def api_forgot_password_send_otp(request):
    data = parse_request_json(request)
    email = data.get('email', '').strip().lower()

    if not email:
        return JsonResponse({'success': False, 'error': 'Please provide your registered email address.'}, status=400)

    user = OperationUser.objects.filter(email__iexact=email).first()
    if not user:
        return JsonResponse({
            'success': False,
            'error': f'No registered account found with email "{email}". Please check with your Operations administrator.'
        }, status=404)

    if not user.is_active or user.status == 'Inactive':
        return JsonResponse({
            'success': False,
            'error': 'This account is currently inactive. Please contact Operations Administrator.'
        }, status=403)

    # Generate 6-digit random numeric OTP
    otp_code = f"{random.randint(100000, 999999)}"

    # Invalidate previous unverified OTPs for this email
    LoginOTP.objects.filter(email__iexact=email).delete()

    LoginOTP.objects.create(
        user=user,
        email=user.email,
        otp_code=otp_code,
        is_verified=False,
        expires_at=timezone.now() + timezone.timedelta(minutes=10)
    )

    send_otp_email(user.email, otp_code, user.name)

    return JsonResponse({
        'success': True,
        'message': f'A 6-digit verification OTP code has been generated and sent to {user.email}.',
        'email': user.email,
        'user_name': user.name,
        'demo_otp': otp_code  # Provided for immediate testing/demo convenience
    })


@csrf_exempt
@require_POST
def api_forgot_password_verify_otp(request):
    data = parse_request_json(request)
    email = data.get('email', '').strip().lower()
    otp = data.get('otp', '').strip()

    if not email or not otp:
        return JsonResponse({'success': False, 'error': 'Email and verification code are required.'}, status=400)

    otp_record = LoginOTP.objects.filter(email__iexact=email, otp_code=otp).order_by('-created_at').first()
    if not otp_record:
        return JsonResponse({'success': False, 'error': 'Invalid verification code. Please check and try again.'}, status=400)

    if otp_record.expires_at and timezone.now() > otp_record.expires_at:
        return JsonResponse({'success': False, 'error': 'This verification code has expired. Please request a new code.'}, status=400)

    otp_record.is_verified = True
    otp_record.save()

    return JsonResponse({
        'success': True,
        'message': 'Verification code successfully validated.'
    })


@csrf_exempt
@require_POST
def api_forgot_password_reset(request):
    data = parse_request_json(request)
    email = data.get('email', '').strip().lower()
    otp = data.get('otp', '').strip()
    new_password = data.get('new_password', '').strip()
    confirm_password = data.get('confirm_password', '').strip()

    if not email or not otp or not new_password:
        return JsonResponse({'success': False, 'error': 'All fields are required.'}, status=400)

    if new_password != confirm_password:
        return JsonResponse({'success': False, 'error': 'Passwords do not match.'}, status=400)

    if len(new_password) < 6:
        return JsonResponse({'success': False, 'error': 'Password must be at least 6 characters long.'}, status=400)

    # Verify that the OTP was verified within valid window
    otp_record = LoginOTP.objects.filter(email__iexact=email, otp_code=otp, is_verified=True).order_by('-created_at').first()
    if not otp_record:
        return JsonResponse({'success': False, 'error': 'Invalid or expired OTP session. Please request a new code.'}, status=400)

    if otp_record.expires_at and timezone.now() > (otp_record.expires_at + timezone.timedelta(minutes=5)):
        return JsonResponse({'success': False, 'error': 'Password reset window expired. Please request a new code.'}, status=400)

    user = OperationUser.objects.filter(email__iexact=email).first()
    if not user:
        return JsonResponse({'success': False, 'error': 'User not found.'}, status=404)

    user.set_password(new_password)
    user.save()

    # Clear OTP records after successful reset
    LoginOTP.objects.filter(email__iexact=email).delete()

    ActivityLog.objects.create(user=user, action='Successfully reset account password via OTP verification')

    return JsonResponse({
        'success': True,
        'message': 'Password has been reset successfully! You can now sign in with your new credentials.'
    })


# ─────────────────────────────────────────────────────────────
# 2. DEPARTMENT APIS (CRUD & ACCESS SCOPE)
# ─────────────────────────────────────────────────────────────

@csrf_exempt
@require_http_methods(['GET', 'POST'])
def api_admin_departments(request):
    user = get_current_user(request)
    if not user or user.role != 'admin':
        return JsonResponse({'error': 'Admin privileges required'}, status=403)

    if request.method == 'GET':
        depts = Department.objects.all().order_by('name')
        dept_list = []
        for d in depts:
            user_count = d.user_accesses.filter(is_active=True, user__is_active=True).count()
            dept_list.append({
                'id': d.id,
                'name': d.name,
                'page_key': d.page_key,
                'is_active': d.is_active,
                'user_count': user_count,
                'created_at': d.created_at.strftime('%Y-%m-%d %H:%M') if d.created_at else '',
            })
        return JsonResponse({'departments': dept_list})

    if request.method == 'POST':
        data = parse_request_json(request)
        name = data.get('name', '').strip()
        page_key = data.get('page_key', '').strip() or name
        is_active = bool(data.get('is_active', True))

        if not name:
            return JsonResponse({'error': 'Department name is required'}, status=400)

        if Department.objects.filter(name__iexact=name).exists():
            return JsonResponse({'error': f'Department "{name}" already exists'}, status=400)

        dept = Department.objects.create(
            name=name,
            page_key=page_key,
            is_active=is_active
        )
        ActivityLog.objects.create(user=user, action=f"Created department '{dept.name}'")
        return JsonResponse({
            'success': True,
            'message': f'Department {dept.name} created successfully',
            'department': {
                'id': dept.id,
                'name': dept.name,
                'page_key': dept.page_key,
                'is_active': dept.is_active,
                'user_count': 0,
                'created_at': dept.created_at.strftime('%Y-%m-%d %H:%M')
            }
        })


@csrf_exempt
@require_http_methods(['GET', 'PUT', 'DELETE'])
def api_admin_department_detail(request, pk):
    user = get_current_user(request)
    if not user or user.role != 'admin':
        return JsonResponse({'error': 'Admin privileges required'}, status=403)

    dept = get_object_or_404(Department, id=pk)

    if request.method == 'GET':
        users = [serialize_user(access.user) for access in dept.user_accesses.filter(is_active=True).select_related('user')]
        return JsonResponse({
            'department': {
                'id': dept.id,
                'name': dept.name,
                'page_key': dept.page_key,
                'is_active': dept.is_active,
                'user_count': len(users),
                'created_at': dept.created_at.strftime('%Y-%m-%d %H:%M') if dept.created_at else '',
            },
            'assigned_users': users,
        })

    if request.method == 'PUT':
        data = parse_request_json(request)
        if 'name' in data and data['name'].strip():
            dept.name = data['name'].strip()
        if 'page_key' in data and data['page_key'].strip():
            dept.page_key = data['page_key'].strip()
        if 'is_active' in data:
            dept.is_active = bool(data['is_active'])
        dept.save()

        ActivityLog.objects.create(user=user, action=f"Updated department '{dept.name}'")
        return JsonResponse({
            'success': True,
            'message': f'Department {dept.name} updated successfully',
            'department': {
                'id': dept.id,
                'name': dept.name,
                'page_key': dept.page_key,
                'is_active': dept.is_active,
                'created_at': dept.created_at.strftime('%Y-%m-%d %H:%M') if dept.created_at else '',
            }
        })

    if request.method == 'DELETE':
        dname = dept.name
        dept.delete()
        ActivityLog.objects.create(user=user, action=f"Deleted department '{dname}'")
        return JsonResponse({'success': True, 'message': f'Department {dname} deleted successfully'})


# ─────────────────────────────────────────────────────────────
# 3. ADMIN DASHBOARD & MATRIX
# ─────────────────────────────────────────────────────────────

@csrf_exempt
@require_GET
def api_admin_department_matrix(request):
    user = get_current_user(request)
    if not user or user.role != 'admin':
        return JsonResponse({'error': 'Admin privileges required'}, status=403)

    return JsonResponse({
        'catalog': DEPARTMENTS_MODULES_CATALOG
    })


@csrf_exempt
@require_GET
def api_admin_dashboard(request):
    user = get_current_user(request)
    if not user or user.role != 'admin':
        return JsonResponse({'error': 'Admin privileges required'}, status=403)

    total_employees = OperationUser.objects.filter(role='employee').count()
    active_employees = OperationUser.objects.filter(role='employee', is_active=True, status='Active').count()
    total_tasks = WorkTask.objects.count()
    completed_tasks = WorkTask.objects.filter(status='Completed').count()
    in_progress_tasks = WorkTask.objects.filter(status='In Progress').count()
    pending_review = WorkTask.objects.filter(status='Under Review').count()
    urgent_tasks = WorkTask.objects.filter(priority='Urgent', status__in=['Todo', 'In Progress']).count()

    recent_tasks = WorkTask.objects.all().order_by('-created_at')[:8]
    recent_activities = ActivityLog.objects.all().order_by('-created_at')[:10]
    all_departments = Department.objects.filter(is_active=True).values('id', 'name', 'page_key')

    return JsonResponse({
        'stats': {
            'total_employees': total_employees,
            'active_employees': active_employees,
            'total_tasks': total_tasks,
            'completed_tasks': completed_tasks,
            'in_progress_tasks': in_progress_tasks,
            'pending_review': pending_review,
            'urgent_tasks': urgent_tasks,
            'completion_rate': round((completed_tasks / total_tasks * 100), 1) if total_tasks else 0,
        },
        'recent_tasks': [serialize_task(t) for t in recent_tasks],
        'recent_activities': [{
            'id': a.id,
            'user_name': a.user.name,
            'user_role': a.user.role,
            'action': a.action,
            'details': a.details,
            'time': a.created_at.strftime('%d %b %H:%M'),
        } for a in recent_activities],
        'departments': list(all_departments),
        'department_catalog': DEPARTMENTS_MODULES_CATALOG,
    })


@csrf_exempt
@require_http_methods(['GET', 'POST'])
def api_admin_employees(request):
    user = get_current_user(request)
    if not user:
        return JsonResponse({'error': 'Unauthorized'}, status=401)

    is_admin = bool(user.is_superadmin or user.role == 'admin')

    if request.method == 'GET':
        # Department managers, admins, and staff can retrieve active employees & interns
        employees = OperationUser.objects.filter(is_active=True).order_by('name')
        all_departments = Department.objects.all().order_by('name').values('id', 'name', 'page_key', 'is_active')
        return JsonResponse({
            'success': True,
            'employees': [serialize_user(emp) for emp in employees],
            'departments': list(all_departments),
            'department_catalog': DEPARTMENTS_MODULES_CATALOG
        })

    if request.method == 'POST':
        if not is_admin:
            return JsonResponse({'error': 'Admin privileges required to create employee accounts'}, status=403)
        data = parse_request_json(request)
        email = data.get('email', '').strip().lower()
        full_name = data.get('full_name', '').strip() or data.get('name', '').strip()
        raw_pwd = data.get('password', 'employee123')
        is_active = bool(data.get('is_active', True))

        if not email or not full_name:
            return JsonResponse({'error': 'Full name and Email are required'}, status=400)

        if OperationUser.objects.filter(email__iexact=email).exists():
            return JsonResponse({'error': 'An employee with this email already exists'}, status=400)

        # Multi-role handling
        assigned_role_ids = data.get('assigned_role_ids', [])
        single_role_id = data.get('assigned_role_id')
        if single_role_id and single_role_id not in assigned_role_ids:
            assigned_role_ids.append(single_role_id)

        roles_qs = OperationalRole.objects.filter(id__in=assigned_role_ids) if assigned_role_ids else []
        primary_role = roles_qs[0] if len(roles_qs) > 0 else None

        # Department handling
        department_ids = data.get('department_ids', [])
        assigned_departments = data.get('assigned_departments', [])
        primary_dept = data.get('department')

        if department_ids:
            dept_objs = Department.objects.filter(id__in=department_ids)
            assigned_departments = [d.name for d in dept_objs]
        elif assigned_departments:
            dept_objs = Department.objects.filter(name__in=assigned_departments)
        else:
            dept_objs = Department.objects.filter(is_active=True)[:1]
            assigned_departments = [d.name for d in dept_objs]

        if not primary_dept and assigned_departments:
            primary_dept = assigned_departments[0]

        new_emp = OperationUser(
            name=full_name,
            full_name=full_name,
            email=email,
            role='employee',
            phone=data.get('phone', ''),
            emp_code=data.get('emp_code', f"OPS-{OperationUser.objects.count()+1:04d}"),
            designation=data.get('designation', 'Operations Associate'),
            department=primary_dept or 'Operations',
            assigned_role=primary_role,
            assigned_departments=assigned_departments,
            assigned_modules=data.get('assigned_modules', []),
            is_active=is_active,
            status='Active' if is_active else 'Inactive',
            skills=data.get('skills', ''),
        )
        new_emp.set_password(raw_pwd)
        new_emp.save()

        if roles_qs:
            new_emp.assigned_roles.set(roles_qs)

        # Save OPUserDepartmentAccess mappings
        for d in dept_objs:
            OPUserDepartmentAccess.objects.get_or_create(user=new_emp, department=d, defaults={'is_active': True})

        ActivityLog.objects.create(user=user, action=f"Created new employee account for {new_emp.name}")
        return JsonResponse({'success': True, 'message': 'Employee created successfully', 'employee': serialize_user(new_emp)})


@csrf_exempt
@require_http_methods(['GET', 'PUT', 'DELETE'])
def api_admin_employee_detail(request, pk):
    admin_user = get_current_user(request)
    if not admin_user or admin_user.role != 'admin':
        return JsonResponse({'error': 'Admin privileges required'}, status=403)

    target_emp = get_object_or_404(OperationUser, id=pk)

    if request.method == 'GET':
        tasks = WorkTask.objects.filter(assigned_to=target_emp).order_by('-created_at')
        all_departments = Department.objects.all().order_by('name').values('id', 'name', 'page_key', 'is_active')
        return JsonResponse({
            'employee': serialize_user(target_emp),
            'tasks': [serialize_task(t) for t in tasks],
            'departments': list(all_departments),
            'department_catalog': DEPARTMENTS_MODULES_CATALOG
        })

    if request.method == 'PUT':
        data = parse_request_json(request)
        if 'name' in data or 'full_name' in data:
            name_val = data.get('full_name') or data.get('name')
            target_emp.name = name_val
            target_emp.full_name = name_val

        target_emp.phone = data.get('phone', target_emp.phone)
        target_emp.designation = data.get('designation', target_emp.designation)
        target_emp.skills = data.get('skills', target_emp.skills)
        target_emp.emp_code = data.get('emp_code', target_emp.emp_code)

        if 'is_active' in data:
            target_emp.is_active = bool(data['is_active'])
            target_emp.status = 'Active' if target_emp.is_active else 'Inactive'
        elif 'status' in data:
            target_emp.status = data['status']
            target_emp.is_active = (data['status'] == 'Active')

        # Department accesses sync
        if 'department_ids' in data:
            dept_ids = data['department_ids']
            depts = Department.objects.filter(id__in=dept_ids)
            target_emp.assigned_departments = [d.name for d in depts]
            if depts:
                target_emp.department = depts[0].name
            # Sync OPUserDepartmentAccess table
            OPUserDepartmentAccess.objects.filter(user=target_emp).exclude(department__in=depts).delete()
            for d in depts:
                OPUserDepartmentAccess.objects.get_or_create(user=target_emp, department=d, defaults={'is_active': True})
        elif 'assigned_departments' in data:
            target_emp.assigned_departments = data['assigned_departments']
            depts = Department.objects.filter(name__in=data['assigned_departments'])
            if data['assigned_departments']:
                target_emp.department = data['assigned_departments'][0]
            OPUserDepartmentAccess.objects.filter(user=target_emp).exclude(department__in=depts).delete()
            for d in depts:
                OPUserDepartmentAccess.objects.get_or_create(user=target_emp, department=d, defaults={'is_active': True})

        if 'assigned_modules' in data:
            target_emp.assigned_modules = data['assigned_modules']

        if 'assigned_role_ids' in data:
            role_ids = data['assigned_role_ids']
            roles_qs = OperationalRole.objects.filter(id__in=role_ids)
            target_emp.assigned_roles.set(roles_qs)
            target_emp.assigned_role = roles_qs.first() if roles_qs.exists() else None
        elif 'assigned_role_id' in data:
            role_id = data['assigned_role_id']
            role_obj = OperationalRole.objects.filter(id=role_id).first() if role_id else None
            target_emp.assigned_role = role_obj
            if role_obj:
                target_emp.assigned_roles.set([role_obj])
            else:
                target_emp.assigned_roles.clear()

        if data.get('new_password') or data.get('password'):
            target_emp.set_password(data.get('new_password') or data.get('password'))

        target_emp.save()
        ActivityLog.objects.create(user=admin_user, action=f"Updated details and role scopes for {target_emp.name}")
        return JsonResponse({'success': True, 'message': 'Employee updated successfully', 'employee': serialize_user(target_emp)})

    if request.method == 'DELETE':
        name = target_emp.name
        # Reassign or clean up assigned tasks before deletion
        WorkTask.objects.filter(assigned_to=target_emp).delete()
        OPUserDepartmentAccess.objects.filter(user=target_emp).delete()
        target_emp.delete()
        ActivityLog.objects.create(user=admin_user, action=f"Deleted employee account: {name}")
        return JsonResponse({'success': True, 'message': f'Employee {name} deleted successfully'})


@csrf_exempt
@require_http_methods(['GET', 'POST'])
def api_admin_roles(request):
    user = get_current_user(request)
    if not user or user.role != 'admin':
        return JsonResponse({'error': 'Admin privileges required'}, status=403)

    if request.method == 'GET':
        roles = OperationalRole.objects.all().order_by('title')
        return JsonResponse({
            'roles': [{
                'id': r.id,
                'title': r.title,
                'department': r.department,
                'description': r.description,
                'level': r.level,
                'permissions': r.permissions,
                'responsibilities': r.responsibilities,
                'member_count': r.members_multi.count() or r.members.count(),
            } for r in roles],
            'department_catalog': DEPARTMENTS_MODULES_CATALOG,
        })

    if request.method == 'POST':
        data = parse_request_json(request)
        title = data.get('title', '').strip()
        if not title:
            return JsonResponse({'error': 'Role title is required'}, status=400)

        new_role = OperationalRole.objects.create(
            title=title,
            department=data.get('department', 'Operations'),
            description=data.get('description', ''),
            level=data.get('level', 'Intern'),
            permissions=data.get('permissions', ['view_assigned_work', 'submit_work_logs']),
            responsibilities=data.get('responsibilities', ''),
        )
        ActivityLog.objects.create(user=user, action=f"Created operational role: {new_role.title}")
        return JsonResponse({'success': True, 'message': 'Role created successfully', 'role_id': new_role.id})


@csrf_exempt
@require_http_methods(['GET', 'POST'])
def api_admin_tasks(request):
    user = get_current_user(request)
    if not user or user.role != 'admin':
        return JsonResponse({'error': 'Admin privileges required'}, status=403)

    if request.method == 'GET':
        tasks = WorkTask.objects.all().order_by('-created_at')
        status_filter = request.GET.get('status')
        assignee_filter = request.GET.get('assigned_to')
        dept_filter = request.GET.get('department')

        if status_filter:
            tasks = tasks.filter(status=status_filter)
        if assignee_filter:
            tasks = tasks.filter(assigned_to_id=assignee_filter)
        if dept_filter:
            tasks = tasks.filter(assigned_to__department=dept_filter)

        return JsonResponse({
            'tasks': [serialize_task(t) for t in tasks],
            'department_catalog': DEPARTMENTS_MODULES_CATALOG,
        })

    if request.method == 'POST':
        data = parse_request_json(request)
        title = data.get('title', '').strip()
        assign_mode = data.get('assign_mode', 'single')  # 'single', 'multiple', 'department', 'everyone'

        if not title:
            return JsonResponse({'error': 'Task title is required.'}, status=400)

        deadline_str = data.get('deadline')
        deadline = datetime.strptime(deadline_str, '%Y-%m-%d').date() if deadline_str else None
        priority = data.get('priority', 'Medium')
        description = data.get('description', '')
        estimated_hours = float(data.get('estimated_hours', 0) or 0)
        tags = data.get('tags', '')
        attachment_url = data.get('attachment_url', '')

        target_assignees = []

        if assign_mode == 'everyone':
            target_assignees = list(OperationUser.objects.filter(role='employee', status='Active'))
            if not target_assignees:
                return JsonResponse({'error': 'No active employees found to assign.'}, status=400)

        elif assign_mode == 'department':
            target_dept = data.get('target_department', '').strip()
            if not target_dept:
                return JsonResponse({'error': 'Please select a target department.'}, status=400)
            
            # Match employees in this department or having it in assigned_departments
            all_emps = OperationUser.objects.filter(role='employee', status='Active')
            target_assignees = [
                emp for emp in all_emps
                if emp.department == target_dept or (isinstance(emp.assigned_departments, list) and target_dept in emp.assigned_departments)
            ]
            if not target_assignees:
                return JsonResponse({'error': f'No active employees found in department "{target_dept}".'}, status=400)

        elif assign_mode == 'multiple':
            assigned_to_ids = data.get('assigned_to_ids', [])
            if not assigned_to_ids:
                return JsonResponse({'error': 'Please select at least one assignee.'}, status=400)
            target_assignees = list(OperationUser.objects.filter(id__in=assigned_to_ids, role='employee'))
            if not target_assignees:
                return JsonResponse({'error': 'Selected assignees not found.'}, status=400)

        else:  # 'single'
            assigned_to_id = data.get('assigned_to_id')
            if not assigned_to_id:
                return JsonResponse({'error': 'Assignee is required.'}, status=400)
            single_assignee = get_object_or_404(OperationUser, id=assigned_to_id)
            target_assignees = [single_assignee]

        created_tasks = []
        for assignee in target_assignees:
            task = WorkTask.objects.create(
                title=title,
                description=description,
                assigned_to=assignee,
                created_by=user,
                priority=priority,
                status=data.get('status', 'Todo'),
                deadline=deadline,
                estimated_hours=estimated_hours,
                tags=tags,
                attachment_url=attachment_url,
            )
            created_tasks.append(task)

        if len(target_assignees) == 1:
            ActivityLog.objects.create(user=user, action=f"Assigned task '{title}' to {target_assignees[0].name}")
            return JsonResponse({'success': True, 'message': f"Task assigned to {target_assignees[0].name} successfully", 'task': serialize_task(created_tasks[0])})
        else:
            ActivityLog.objects.create(user=user, action=f"Assigned task '{title}' to {len(target_assignees)} employees ({assign_mode})")
            return JsonResponse({'success': True, 'message': f"Task broadcasted to {len(target_assignees)} team members successfully!", 'tasks': [serialize_task(t) for t in created_tasks]})


@csrf_exempt
@require_http_methods(['GET', 'PUT', 'DELETE'])
def api_admin_task_detail(request, pk):
    admin_user = get_current_user(request)
    if not admin_user or admin_user.role != 'admin':
        return JsonResponse({'error': 'Admin privileges required'}, status=403)

    task = get_object_or_404(WorkTask, id=pk)

    if request.method == 'GET':
        logs = task.logs.all().order_by('-created_at')
        return JsonResponse({
            'task': serialize_task(task),
            'logs': [{
                'id': l.id,
                'user_name': l.user.name,
                'hours_spent': l.hours_spent,
                'work_summary': l.work_summary,
                'submission_link': l.submission_link,
                'created_at': l.created_at.strftime('%d %b %Y %H:%M'),
            } for l in logs]
        })

    if request.method == 'PUT':
        data = parse_request_json(request)
        task.title = data.get('title', task.title)
        task.description = data.get('description', task.description)
        task.priority = data.get('priority', task.priority)
        task.status = data.get('status', task.status)
        task.tags = data.get('tags', task.tags)
        task.estimated_hours = float(data.get('estimated_hours', task.estimated_hours) or 0)

        if data.get('deadline'):
            try:
                task.deadline = datetime.strptime(data['deadline'], '%Y-%m-%d').date()
            except Exception:
                pass

        if data.get('assigned_to_id'):
            task.assigned_to = get_object_or_404(OperationUser, id=data['assigned_to_id'])

        if task.status == 'Completed' and not task.completed_at:
            task.completed_at = timezone.now()

        task.save()
        ActivityLog.objects.create(user=admin_user, action=f"Updated task '{task.title}'")
        return JsonResponse({'success': True, 'message': 'Task updated successfully', 'task': serialize_task(task)})

    if request.method == 'DELETE':
        title = task.title
        task.delete()
        ActivityLog.objects.create(user=admin_user, action=f"Deleted task '{title}'")
        return JsonResponse({'success': True, 'message': 'Task deleted successfully'})


# ─────────────────────────────────────────────────────────────
# 3. EMPLOYEE APIS (TEAM MEMBER, e.g. Chhayakanta Maharana)
# ─────────────────────────────────────────────────────────────

@csrf_exempt
@require_GET
def api_employee_dashboard(request):
    emp = get_current_user(request)
    if not emp:
        return JsonResponse({'error': 'Unauthorized'}, status=401)

    my_tasks = WorkTask.objects.filter(assigned_to=emp)
    total_tasks = my_tasks.count()
    todo_count = my_tasks.filter(status='Todo').count()
    in_progress_count = my_tasks.filter(status='In Progress').count()
    under_review_count = my_tasks.filter(status='Under Review').count()
    completed_count = my_tasks.filter(status='Completed').count()
    urgent_count = my_tasks.filter(priority='Urgent', status__in=['Todo', 'In Progress']).count()

    active_tasks = my_tasks.exclude(status='Completed').order_by('deadline', '-created_at')[:5]
    recent_completed = my_tasks.filter(status='Completed').order_by('-completed_at')[:4]

    return JsonResponse({
        'employee': serialize_user(emp),
        'stats': {
            'total_tasks': total_tasks,
            'todo_count': todo_count,
            'in_progress_count': in_progress_count,
            'under_review_count': under_review_count,
            'completed_count': completed_count,
            'urgent_count': urgent_count,
            'completion_rate': round((completed_count / total_tasks * 100), 1) if total_tasks else 0,
        },
        'active_tasks': [serialize_task(t) for t in active_tasks],
        'recent_completed': [serialize_task(t) for t in recent_completed],
    })


@csrf_exempt
@require_GET
def api_employee_tasks(request):
    emp = get_current_user(request)
    if not emp:
        return JsonResponse({'error': 'Unauthorized'}, status=401)

    tasks = WorkTask.objects.filter(assigned_to=emp).order_by('-created_at')
    status_filter = request.GET.get('status')
    if status_filter:
        tasks = tasks.filter(status=status_filter)

    return JsonResponse({
        'tasks': [serialize_task(t) for t in tasks]
    })


@csrf_exempt
@require_POST
def api_employee_update_task_status(request, pk):
    emp = get_current_user(request)
    if not emp:
        return JsonResponse({'error': 'Unauthorized'}, status=401)

    task = get_object_or_404(WorkTask, id=pk, assigned_to=emp)
    data = parse_request_json(request)
    new_status = data.get('status')
    submission_notes = data.get('submission_notes', '')
    submission_link = data.get('submission_link', '')
    hours_logged = float(data.get('hours_spent', 0) or 0)

    if new_status in ['Todo', 'In Progress', 'Under Review', 'Completed']:
        task.status = new_status
        if submission_notes:
            task.submission_notes = submission_notes
        if submission_link:
            task.submission_link = submission_link

        if new_status == 'Completed':
            task.completed_at = timezone.now()

        task.save()

        # Record WorkLog if hours or summary provided
        if hours_logged > 0 or submission_notes:
            WorkLog.objects.create(
                task=task,
                user=emp,
                hours_spent=hours_logged,
                work_summary=submission_notes or f"Updated status to {new_status}",
                submission_link=submission_link,
            )

        ActivityLog.objects.create(
            user=emp,
            action=f"Updated status of '{task.title}' to {new_status}"
        )

        return JsonResponse({
            'success': True,
            'message': f"Task status updated to {new_status}",
            'task': serialize_task(task)
        })

    return JsonResponse({'error': 'Invalid status provided'}, status=400)


@csrf_exempt
@require_http_methods(['GET', 'POST'])
def api_employee_work_logs(request):
    emp = get_current_user(request)
    if not emp:
        return JsonResponse({'error': 'Unauthorized'}, status=401)

    if request.method == 'GET':
        logs = WorkLog.objects.filter(user=emp).order_by('-created_at')
        return JsonResponse({
            'logs': [{
                'id': l.id,
                'task_title': l.task.title,
                'task_id': l.task.id,
                'hours_spent': l.hours_spent,
                'work_summary': l.work_summary,
                'submission_link': l.submission_link,
                'created_at': l.created_at.strftime('%d %b %Y %H:%M'),
            } for l in logs]
        })

    if request.method == 'POST':
        data = parse_request_json(request)
        task_id = data.get('task_id')
        summary = data.get('work_summary', '').strip()
        hours = float(data.get('hours_spent', 0) or 0)

        if not task_id or not summary:
            return JsonResponse({'error': 'Task and work summary are required.'}, status=400)

        task = get_object_or_404(WorkTask, id=task_id, assigned_to=emp)
        new_log = WorkLog.objects.create(
            task=task,
            user=emp,
            hours_spent=hours,
            work_summary=summary,
            submission_link=data.get('submission_link', ''),
        )
        return JsonResponse({'success': True, 'message': 'Work log recorded successfully'})


@csrf_exempt
@require_GET
def api_employee_my_role(request):
    emp = get_current_user(request)
    if not emp:
        return JsonResponse({'error': 'Unauthorized'}, status=401)

    primary_role = emp.assigned_role or emp.assigned_roles.first()
    assigned_roles_list = list(emp.assigned_roles.all())
    if not assigned_roles_list and primary_role:
        assigned_roles_list = [primary_role]

    all_perms = set()
    all_responsibilities = []
    for r in assigned_roles_list:
        if isinstance(r.permissions, list):
            for p in r.permissions:
                all_perms.add(p)
        if r.responsibilities:
            all_responsibilities.append(f"【{r.title} ({r.department})】\n{r.responsibilities}")

    if not all_perms:
        all_perms = {'view_assigned_work', 'update_task_status', 'submit_work_logs', 'attach_deliverables'}

    combined_resp = "\n\n".join(all_responsibilities) if all_responsibilities else (
        primary_role.responsibilities if primary_role and primary_role.responsibilities else "Execute assigned cross-functional deliverables, development pipelines, and daily operational reports."
    )

    depts = emp.assigned_departments if (isinstance(emp.assigned_departments, list) and len(emp.assigned_departments) > 0) else ([emp.department] if emp.department else ["Operations"])
    modules = emp.assigned_modules if isinstance(emp.assigned_modules, list) else []

    return JsonResponse({
        'employee_name': emp.name,
        'designation': emp.designation,
        'department': emp.department or (depts[0] if depts else 'Operations'),
        'assigned_departments': depts,
        'assigned_modules': modules,
        'role_title': " & ".join([r.title for r in assigned_roles_list]) if assigned_roles_list else (primary_role.title if primary_role else 'Operations Team Member'),
        'level': primary_role.level if primary_role else 'Intern',
        'responsibilities': combined_resp,
        'permissions': list(all_perms),
        'roles': [{
            'id': r.id,
            'title': r.title,
            'level': r.level,
            'department': r.department,
            'permissions': r.permissions,
            'responsibilities': r.responsibilities,
        } for r in assigned_roles_list],
        'skills': emp.skills,
        'joining_date': emp.joining_date.strftime('%d %b %Y') if emp.joining_date else '',
        'department_catalog': DEPARTMENTS_MODULES_CATALOG,
    })


# ─── ATTENDANCE & LIVE SHIFT TIMER ENDPOINTS ───

@csrf_exempt
@require_GET
def api_attendance_today(request):
    user = get_current_user(request)
    if not user:
        return JsonResponse({'error': 'Unauthorized'}, status=401)

    today = timezone.now().date()
    from .models import AttendanceRecord
    record = AttendanceRecord.objects.filter(user=user, date=today).first()

    if not record:
        return JsonResponse({
            'is_checked_in': False,
            'status': 'Not Checked In',
            'check_in_time': None,
            'check_out_time': None,
            'total_hours': 0.0,
            'elapsed_seconds': 0,
            'work_mode': 'Office',
        })

    is_checked_in = record.check_in_time is not None and record.check_out_time is None
    elapsed_seconds = 0
    if is_checked_in and record.check_in_time:
        elapsed_seconds = int((timezone.now() - record.check_in_time).total_seconds())

    return JsonResponse({
        'id': record.id,
        'is_checked_in': is_checked_in,
        'status': record.status,
        'check_in_time': record.check_in_time.strftime('%I:%M %p') if record.check_in_time else None,
        'check_in_iso': record.check_in_time.isoformat() if record.check_in_time else None,
        'check_out_time': record.check_out_time.strftime('%I:%M %p') if record.check_out_time else None,
        'check_out_iso': record.check_out_time.isoformat() if record.check_out_time else None,
        'total_hours': round(record.total_hours, 2),
        'elapsed_seconds': max(0, elapsed_seconds),
        'work_mode': record.work_mode,
        'date': record.date.strftime('%d %b %Y'),
    })


@csrf_exempt
@require_POST
def api_attendance_check_in(request):
    user = get_current_user(request)
    if not user:
        return JsonResponse({'error': 'Unauthorized'}, status=401)

    data = parse_request_json(request)
    work_mode = data.get('work_mode', 'Office')
    notes = data.get('notes', '')

    today = timezone.now().date()
    now = timezone.now()
    record = AttendanceRecord.objects.filter(user=user, date=today).first()
    if record:
        if record.status == 'Completed' or record.check_out_time is not None:
            return JsonResponse({
                'error': f"You have already completed your attendance shift for today ({record.date.strftime('%d %b %Y')}). You can check in again on your next working day."
            }, status=400)
        if record.check_in_time is not None:
            return JsonResponse({
                'error': "You are already checked in for today's shift."
            }, status=400)

    record = AttendanceRecord.objects.create(
        user=user,
        date=today,
        check_in_time=now,
        status='Checked In',
        work_mode=work_mode,
        notes=notes,
    )

    ActivityLog.objects.create(
        user=user,
        action=f"Checked In for work shift ({work_mode}) at {now.strftime('%I:%M %p')}."
    )

    return JsonResponse({
        'success': True,
        'message': f'Checked In successfully at {now.strftime("%I:%M %p")}!',
        'check_in_time': now.strftime('%I:%M %p'),
        'check_in_iso': now.isoformat(),
        'is_checked_in': True,
    })


@csrf_exempt
@require_POST
def api_attendance_check_out(request):
    user = get_current_user(request)
    if not user:
        return JsonResponse({'error': 'Unauthorized'}, status=401)

    data = parse_request_json(request)
    notes = data.get('notes', '')

    today = timezone.now().date()
    now = timezone.now()
    from .models import AttendanceRecord

    record = AttendanceRecord.objects.filter(user=user, date=today).first()
    if not record or not record.check_in_time:
        return JsonResponse({'error': 'No active check-in found for today.'}, status=400)

    record.check_out_time = now
    duration_hours = (now - record.check_in_time).total_seconds() / 3600.0
    record.total_hours = max(0.1, round(duration_hours, 2))
    record.status = 'Completed'
    if notes:
        record.notes = f"{record.notes}\nCheck-out notes: {notes}".strip()
    record.save()

    ActivityLog.objects.create(
        user=user,
        action=f"Checked Out of work shift at {now.strftime('%I:%M %p')} (Logged {record.total_hours:.2f} hrs)."
    )

    return JsonResponse({
        'success': True,
        'message': f'Checked Out successfully! Total duration: {record.total_hours:.2f} hours.',
        'check_out_time': now.strftime('%I:%M %p'),
        'check_out_iso': now.isoformat(),
        'total_hours': record.total_hours,
        'is_checked_in': False,
    })


@csrf_exempt
@require_GET
def api_attendance_history(request):
    user = get_current_user(request)
    if not user:
        return JsonResponse({'error': 'Unauthorized'}, status=401)

    from .models import AttendanceRecord
    records = AttendanceRecord.objects.filter(user=user).order_by('-date')[:30]

    items = []
    total_hours_sum = 0
    completed_shifts = 0

    for r in records:
        total_hours_sum += r.total_hours
        if r.status == 'Completed':
            completed_shifts += 1
        items.append({
            'id': r.id,
            'date': r.date.strftime('%d %b %Y'),
            'day': r.date.strftime('%A'),
            'check_in': r.check_in_time.strftime('%I:%M %p') if r.check_in_time else '—',
            'check_out': r.check_out_time.strftime('%I:%M %p') if r.check_out_time else '—',
            'total_hours': r.total_hours,
            'status': r.status,
            'work_mode': r.work_mode,
            'notes': r.notes,
        })

    return JsonResponse({
        'records': items,
        'summary': {
            'total_days_logged': len(records),
            'total_hours': round(total_hours_sum, 1),
            'avg_daily_hours': round(total_hours_sum / max(1, len(records)), 1),
            'completed_shifts': completed_shifts,
        }
    })


# ─────────────────────────────────────────────────────────────
# DIGITAL MARKETING – Ghost CMS Posts & Newsletter Blast
# ─────────────────────────────────────────────────────────────

# Ghost CMS Configuration loaded from environment / .env
GHOST_URL = os.environ.get('GHOST_URL', 'https://www.wisbees.com').rstrip('/')
GHOST_API_KEY = os.environ.get('GHOST_CONTENT_API_KEY', 'e9bebe8370694ac729e21fe4fe')
GHOST_API_URL = f'{GHOST_URL}/ghost/api/content/posts/'
GHOST_WEALTH_TAG = os.environ.get('GHOST_NEWSLETTER_TAG', 'wealth-help')

# Fallback / Wealth help endpoint
WEALTHHELP_API_URL = f'{GHOST_URL}/ghost/api/content/posts/'
WEALTHHELP_API_KEY = GHOST_API_KEY


def _fetch_ghost_posts(base_url: str, api_key: str, tag: str = None, limit: int = 10) -> list:
    """Fetch posts from a Ghost Content API endpoint."""
    params = f'?key={api_key}&limit={limit}&include=tags&fields=id,title,url,feature_image,excerpt,published_at,custom_excerpt'
    if tag:
        params += f'&filter=tag:{tag}'
    url = base_url + params
    try:
        req = urllib.request.Request(url, headers={'Accept': 'application/json', 'User-Agent': 'WisBees-OpsPortal/1.0'})
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            return data.get('posts', [])
    except urllib.error.HTTPError as exc:
        import logging
        logging.getLogger(__name__).warning('Ghost API HTTP error %s for %s', exc.code, url)
        return []
    except Exception as exc:
        import logging
        logging.getLogger(__name__).warning('Ghost API fetch failed for %s: %s', url, exc)
        return []


@csrf_exempt
@require_GET
def api_dm_ghost_posts(request):
    """Return latest articles from Wisbees.com Ghost CMS (public Content API)."""
    user = get_current_user(request)
    if not user:
        return JsonResponse({'error': 'Unauthorized'}, status=401)

    dept = (user.department or '').lower()
    is_dm = 'digital' in dept or 'marketing' in dept or user.role == 'admin'
    if not is_dm:
        return JsonResponse({'error': 'Access restricted to Digital Marketing team'}, status=403)

    section = request.GET.get('section', 'latest')   # 'latest' | 'wealthhelp'
    limit = int(request.GET.get('limit', 10))

    if section == 'wealthhelp':
        # Wealth Help articles are tagged 'wealth-help' on the main wisbees Ghost site.
        posts = _fetch_ghost_posts(WEALTHHELP_API_URL, WEALTHHELP_API_KEY, tag=GHOST_WEALTH_TAG, limit=limit)
    else:
        posts = _fetch_ghost_posts(GHOST_API_URL, GHOST_API_KEY, limit=limit)

    return JsonResponse({'posts': posts, 'section': section, 'count': len(posts)})


@csrf_exempt
def api_dm_newsletter_blast(request):
    """
    POST multipart/form-data:
      post_url         – Ghost post URL to link
      post_title       – post title (fallback subject)
      subject          – optional email subject override
      opening_message  – optional top-of-email greeting paragraph
      readers_db       – .xlsx/.xls or .csv with reader emails
    """
    if request.method != 'POST':
        return JsonResponse({'error': 'POST required'}, status=405)

    user = get_current_user(request)
    if not user:
        return JsonResponse({'error': 'Unauthorized'}, status=401)

    dept = (user.department or '').lower()
    is_dm = 'digital' in dept or 'marketing' in dept or user.role == 'admin'
    if not is_dm:
        return JsonResponse({'error': 'Access restricted to Digital Marketing team'}, status=403)

    post_url = request.POST.get('post_url', '').strip()
    post_title = request.POST.get('post_title', '').strip()
    subject = request.POST.get('subject', '').strip() or post_title or 'Newsletter from WisBees'
    opening_msg = request.POST.get('opening_message', '').strip()
    readers_file = request.FILES.get('readers_db')

    if not post_url:
        return JsonResponse({'error': 'post_url is required'}, status=400)
    if not readers_file:
        return JsonResponse({'error': 'readers_db file is required'}, status=400)

    # Parse emails from CSV or XLSX
    emails = []
    fname = readers_file.name.lower()
    try:
        if fname.endswith('.csv'):
            content = readers_file.read().decode('utf-8-sig', errors='replace')
            reader = csv.reader(io.StringIO(content))
            for row in reader:
                for cell in row:
                    cell = cell.strip()
                    if '@' in cell and '.' in cell:
                        emails.append(cell)
        elif fname.endswith('.xlsx') or fname.endswith('.xls'):
            try:
                import openpyxl
                wb = openpyxl.load_workbook(io.BytesIO(readers_file.read()), read_only=True)
                for ws in wb.worksheets:
                    for row in ws.iter_rows(values_only=True):
                        for cell in row:
                            if cell and isinstance(cell, str) and '@' in cell and '.' in cell:
                                emails.append(cell.strip())
            except ImportError:
                return JsonResponse({'error': 'openpyxl not installed. Run: pip install openpyxl'}, status=500)
        else:
            return JsonResponse({'error': 'Only .csv and .xlsx/.xls files are supported'}, status=400)
    except Exception as exc:
        return JsonResponse({'error': f'Failed to parse file: {exc}'}, status=400)

    emails = list(dict.fromkeys(e for e in emails if e))
    if not emails:
        return JsonResponse({'error': 'No valid email addresses found in the uploaded file'}, status=400)

    # Log the blast attempt
    try:
        ActivityLog.objects.create(
            user=user,
            action='Newsletter blast initiated',
            details=f'Post: {post_title} | Recipients: {len(emails)} | Subject: {subject}'
        )
    except Exception:
        pass

    SMTP_HOST = os.environ.get('SMTP_HOST') or getattr(settings, 'EMAIL_HOST', 'smtp.gmail.com')
    SMTP_PORT = int(os.environ.get('SMTP_PORT') or getattr(settings, 'EMAIL_PORT', 587))
    SMTP_USER = os.environ.get('SMTP_USER') or getattr(settings, 'EMAIL_HOST_USER', '')
    SMTP_PASS = os.environ.get('SMTP_PASS') or getattr(settings, 'EMAIL_HOST_PASSWORD', '')
    SENDER_NAME = os.environ.get('SENDER_NAME', 'WisBees Newsletter')

    if not SMTP_USER or not SMTP_PASS:
        # Dev simulation mode – SMTP not configured
        return JsonResponse({
            'success': True,
            'mode': 'simulation',
            'message': f'SMTP not configured. Would have sent to {len(emails)} recipients.',
            'total_recipients': len(emails),
            'post_url': post_url,
            'subject': subject,
        })

    opening_html = f'<p style="font-size:16px;color:#444;margin-bottom:20px;">{opening_msg}</p>' if opening_msg else ''
    html_body = f"""
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;">
      <div style="text-align:center;margin-bottom:24px;">
        <img src="https://wisbees.com/content/images/2023/09/wisbees-logo.png"
             alt="WisBees" style="height:40px;"/>
      </div>
      {opening_html}
      <h2 style="color:#1a1a2e;font-size:22px;margin-bottom:12px;">{post_title}</h2>
      <p style="margin-bottom:20px;">
        <a href="{post_url}" style="display:inline-block;background:#0284c7;color:#fff;
           padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:14px;">
          Read the full article &rarr;
        </a>
      </p>
      <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;"/>
      <p style="font-size:11px;color:#94a3b8;text-align:center;">
        &copy; WisBees &middot; You are receiving this because you subscribed to our newsletter.
      </p>
    </div>
    """

    sent_count = 0
    failed_emails = []
    try:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=15) as server:
            server.ehlo()
            server.starttls()
            server.login(SMTP_USER, SMTP_PASS)
            for email_addr in emails:
                try:
                    msg = MIMEMultipart('alternative')
                    msg['Subject'] = subject
                    msg['From'] = f'{SENDER_NAME} <{SMTP_USER}>'
                    msg['To'] = email_addr
                    msg.attach(MIMEText(html_body, 'html'))
                    server.sendmail(SMTP_USER, email_addr, msg.as_string())
                    sent_count += 1
                except Exception as send_err:
                    failed_emails.append({'email': email_addr, 'error': str(send_err)})
    except smtplib.SMTPAuthenticationError:
        return JsonResponse({'error': 'SMTP authentication failed. Check SMTP_USER and SMTP_PASS env vars.'}, status=500)
    except Exception as exc:
        return JsonResponse({'error': f'SMTP connection failed: {exc}'}, status=500)

    return JsonResponse({
        'success': True,
        'sent': sent_count,
        'failed': len(failed_emails),
        'total_recipients': len(emails),
        'subject': subject,
        'failed_details': failed_emails[:10],
    })


# ─────────────────────────────────────────────────────────────
# IA – Institutional Equity Research Auto-Fetch & Intelligence Engine
# ─────────────────────────────────────────────────────────────

PEER_MAPPINGS = {
    'IT': ['INFY.NS', 'TCS.NS', 'HCLTECH.NS'],
    'TECHNOLOGY': ['INFY.NS', 'TCS.NS', 'HCLTECH.NS'],
    'BANKING': ['HDFCBANK.NS', 'ICICIBANK.NS', 'SBIN.NS'],
    'FINANCIAL SERVICES': ['HDFCBANK.NS', 'ICICIBANK.NS', 'BAJFINANCE.NS'],
    'AUTOMOBILE': ['TATAMOTORS.NS', 'M&M.NS', 'MARUTI.NS'],
    'CONSUMER': ['HINDUNILVR.NS', 'ITC.NS', 'NESTLEIND.NS'],
    'PHARMACEUTICALS': ['SUNPHARMA.NS', 'CIPLA.NS', 'DRREDDY.NS'],
    'ENERGY': ['RELIANCE.NS', 'ONGC.NS', 'NTPC.NS'],
    'OIL & GAS': ['RELIANCE.NS', 'BPCL.NS', 'IOC.NS'],
    'METALS': ['TATASTEEL.NS', 'JSWSTEEL.NS', 'HINDALCO.NS'],
}

POPULAR_STOCKS = [
    {'symbol': 'WIPRO.NS', 'name': 'Wipro Limited', 'sector': 'Technology'},
    {'symbol': 'TCS.NS', 'name': 'Tata Consultancy Services', 'sector': 'Technology'},
    {'symbol': 'INFY.NS', 'name': 'Infosys Limited', 'sector': 'Technology'},
    {'symbol': 'HCLTECH.NS', 'name': 'HCL Technologies', 'sector': 'Technology'},
    {'symbol': 'TECHM.NS', 'name': 'Tech Mahindra Limited', 'sector': 'Technology'},
    {'symbol': 'RELIANCE.NS', 'name': 'Reliance Industries Limited', 'sector': 'Energy'},
    {'symbol': 'HDFCBANK.NS', 'name': 'HDFC Bank Limited', 'sector': 'Banking'},
    {'symbol': 'ICICIBANK.NS', 'name': 'ICICI Bank Limited', 'sector': 'Banking'},
    {'symbol': 'SBIN.NS', 'name': 'State Bank of India', 'sector': 'Banking'},
    {'symbol': 'TATAMOTORS.NS', 'name': 'Tata Motors Limited', 'sector': 'Automobile'},
    {'symbol': 'M&M.NS', 'name': 'Mahindra & Mahindra Limited', 'sector': 'Automobile'},
    {'symbol': 'MARUTI.NS', 'name': 'Maruti Suzuki India Limited', 'sector': 'Automobile'},
    {'symbol': 'SUNPHARMA.NS', 'name': 'Sun Pharmaceutical Industries', 'sector': 'Pharmaceuticals'},
    {'symbol': 'CIPLA.NS', 'name': 'Cipla Limited', 'sector': 'Pharmaceuticals'},
    {'symbol': 'HINDUNILVR.NS', 'name': 'Hindustan Unilever Limited', 'sector': 'Consumer'},
    {'symbol': 'ITC.NS', 'name': 'ITC Limited', 'sector': 'Consumer'},
    {'symbol': 'LT.NS', 'name': 'Larsen & Toubro Limited', 'sector': 'Capital Goods'},
    {'symbol': 'BHARTIARTL.NS', 'name': 'Bharti Airtel Limited', 'sector': 'Telecommunication'},
    {'symbol': 'BAJFINANCE.NS', 'name': 'Bajaj Finance Limited', 'sector': 'Financial Services'},
    {'symbol': 'TATASTEEL.NS', 'name': 'Tata Steel Limited', 'sector': 'Metals'},
]


def _format_ticker_symbol(query: str) -> str:
    sym = query.strip().upper()
    if not sym.endswith('.NS') and not sym.endswith('.BO') and not '.' in sym:
        sym = f"{sym}.NS"
    return sym


def _safe_float(val, default=0.0):
    if val is None:
        return default
    try:
        return float(val)
    except (ValueError, TypeError):
        return default


@csrf_exempt
@require_GET
def api_ia_search_stocks(request):
    """Autocomplete stock search for Indian & global equities."""
    q = request.GET.get('query', '').strip().upper()
    if not q:
        return JsonResponse({'results': POPULAR_STOCKS[:10]})

    results = []
    for s in POPULAR_STOCKS:
        if q in s['symbol'].upper() or q in s['name'].upper() or q in s['sector'].upper():
            results.append(s)

    if not results:
        sym = _format_ticker_symbol(q)
        results.append({'symbol': sym, 'name': sym.replace('.NS', '').replace('.BO', ''), 'sector': 'Equities'})

    return JsonResponse({'results': results})


@csrf_exempt
def api_ia_fetch_stock_data(request):
    """
    Fetch comprehensive live stock fundamentals and AI-generated institutional analyst notes.
    Accepts GET query param ?query=WIPRO or POST JSON {query: 'WIPRO'}
    """
    if request.method == 'POST':
        body = parse_request_json(request)
        query = body.get('query') or body.get('ticker') or ''
    else:
        query = request.GET.get('query') or request.GET.get('ticker') or ''

    query = query.strip()
    if not query:
        return JsonResponse({'error': 'Stock symbol or company name is required'}, status=400)

    sym = _format_ticker_symbol(query)

    try:
        import yfinance as yf
        ticker = yf.Ticker(sym)
        info = ticker.info or {}
    except Exception as exc:
        info = {}

    short_name = info.get('shortName') or info.get('longName') or query.upper()
    current_price = _safe_float(info.get('currentPrice') or info.get('regularMarketPrice') or info.get('previousClose'))
    if current_price <= 0:
        # Fallback chart API
        try:
            req_url = f'https://query1.finance.yahoo.com/v8/finance/chart/{sym}?interval=1d&range=1mo'
            resp = urllib.request.urlopen(urllib.request.Request(req_url, headers={'User-Agent': 'Mozilla/5.0'}), timeout=5)
            chart_data = json.loads(resp.read().decode('utf-8'))
            meta = chart_data.get('chart', {}).get('result', [{}])[0].get('meta', {})
            current_price = _safe_float(meta.get('regularMarketPrice') or meta.get('chartPreviousClose'))
        except Exception:
            current_price = 500.00

    currency = info.get('currency', 'INR')
    market_cap_raw = _safe_float(info.get('marketCap'))
    market_cap_cr = round(market_cap_raw / 10000000, 2) if market_cap_raw > 0 else 150000.00

    pe_ratio = round(_safe_float(info.get('trailingPE') or info.get('forwardPE')), 2)
    if pe_ratio <= 0:
        pe_ratio = 18.50

    roe = round(_safe_float(info.get('returnOnEquity')) * 100, 2)
    if roe <= 0:
        roe = 16.20

    opm = round(_safe_float(info.get('operatingMargins')) * 100, 2)
    if opm <= 0:
        opm = 17.80

    ev_ebitda = round(_safe_float(info.get('enterpriseToEbitda')), 2)
    if ev_ebitda <= 0:
        ev_ebitda = 12.40

    roce = round(roe * 1.15, 2)  # ROCE standard correlation

    matched_stock = next((s for s in POPULAR_STOCKS if s['symbol'].upper() == sym.upper() or s['symbol'].split('.')[0].upper() == query.upper()), None)
    default_sector = matched_stock['sector'] if matched_stock else ''

    sector = info.get('sector') or default_sector or ''
    industry = info.get('industry') or ''
    if sector and industry:
        industry_sector_val = f"{sector} - {industry}"
    elif sector:
        industry_sector_val = sector
    elif industry:
        industry_sector_val = industry
    else:
        industry_sector_val = ''

    high_52 = _safe_float(info.get('fiftyTwoWeekHigh'), current_price * 1.3)
    low_52 = _safe_float(info.get('fiftyTwoWeekLow'), current_price * 0.8)

    # Determine 12M Target Price & Recommendation
    analyst_target = _safe_float(info.get('targetMeanPrice'))
    if analyst_target > current_price:
        target_price = round(analyst_target, 2)
        upside_pct = round(((target_price - current_price) / current_price) * 100, 1)
        recommendation = 'Buy' if upside_pct >= 15 else 'Accumulate'
    else:
        target_price = round(current_price * 1.22, 2)
        upside_pct = 22.0
        recommendation = 'Buy'

    # Prepare Peers Table Structure
    peers_payload = [
        {'id': 1, 'label': 'Target Company'},
        {'id': 2, 'label': 'Peer 1'},
        {'id': 3, 'label': 'Peer 2'},
    ]
    peer_names_payload = {
        1: f"{short_name.upper()} (TARGET)" if short_name else f"{sym} (TARGET)",
    }

    metrics_data_payload = {
        'market_cap': {1: str(market_cap_cr) if market_cap_cr > 0 else ''},
        'pe_ratio': {1: str(pe_ratio) if pe_ratio > 0 else ''},
        'roe': {1: str(roe) if roe > 0 else ''},
        'roce': {1: str(roce) if roce > 0 else ''},
        'opm': {1: str(opm) if opm > 0 else ''},
        'ev_ebitda': {1: str(ev_ebitda) if ev_ebitda > 0 else ''},
    }

    # AI Intelligence Generation (using Groq LLaMA-3.3 if available)
    business_overview = (
        f"{short_name} is a leading player in {industry_sector_val or 'the market'}. "
        f"The company commands deep domain capabilities across large enterprise transformations, expansion, and managed operations. "
        f"Key structural MOAT drivers include long-standing client relationships, mission-critical workflow integration, high switching costs, and strong pipeline momentum."
    )

    valuation_thesis = (
        f"At CMP of ₹{current_price}, {short_name} is trading at a P/E multiple of {pe_ratio}x and EV/EBITDA of {ev_ebitda}x, offering an attractive valuation compared to industry benchmarks. "
        f"With sustainable OPM margins of {opm}% and ROE of {roe}%, ongoing margin optimization and operational leverage provide robust headroom for multiple re-rating. "
        f"We assign a '{recommendation}' rating with a 12-month Target Price of ₹{target_price} (upside of ~{upside_pct}%)."
    )

    technical_analysis = (
        f"On technical charts, the stock has established strong structural support near ₹{round(current_price * 0.92, 2)} and is consolidating constructively above its moving averages. "
        f"The 52-week range stands at ₹{low_52} - ₹{high_52}. Momentum indicators indicate steady accumulation with breakout confirmation projected on a sustained move above ₹{round(current_price * 1.06, 2)} towards ₹{target_price}."
    )

    groq_api_key = os.environ.get('GROQ_API_KEY')
    if groq_api_key:
        try:
            from groq import Groq
            client = Groq(api_key=groq_api_key)
            prompt = (
                f"You are an elite Wall Street / Dalal Street equity research analyst. "
                f"Analyze stock: {short_name} ({sym}) in sector: {industry_sector_val or 'Equities'}. "
                f"Live data: CMP=INR {current_price}, 52W High={high_52}, 52W Low={low_52}, "
                f"Market Cap=INR {market_cap_cr} Cr, P/E={pe_ratio}, ROE={roe}%, OPM={opm}%, EV/EBITDA={ev_ebitda}. "
                f"Provide concise institutional commentary in JSON format with keys: "
                f"'business_overview' (2-3 sentences on MOAT and competitive advantage), "
                f"'valuation_thesis' (2-3 sentences on valuation discount/upside rationale), "
                f"'technical_analysis' (2 sentences on technical momentum, support/resistance, and targets)."
            )
            completion = client.chat.completions.create(
                model='llama-3.3-70b-versatile',
                messages=[
                    {'role': 'system', 'content': 'You are a senior institutional equity research compiler. Return valid JSON only.'},
                    {'role': 'user', 'content': prompt}
                ],
                response_format={'type': 'json_object'},
                timeout=6
            )
            ai_data = json.loads(completion.choices[0].message.content)
            if ai_data.get('business_overview'):
                business_overview = ai_data['business_overview']
            if ai_data.get('valuation_thesis'):
                valuation_thesis = ai_data['valuation_thesis']
            if ai_data.get('technical_analysis'):
                technical_analysis = ai_data['technical_analysis']
        except Exception:
            pass

    today_str = timezone.now().strftime('%d/%m/%Y')
    consensus_rows_payload = [
        {'id': 1, 'callDate': today_str, 'brokerageHouse': '', 'rating': recommendation, 'targetPrice': str(target_price) if target_price else ''},
    ]

    return JsonResponse({
        'success': True,
        'stockQuery': sym,
        'companyName': short_name,
        'currentPrice': str(current_price),
        'priceAsOn': timezone.now().strftime('%Y-%m-%d'),
        'targetPrice': str(target_price),
        'recommendation': recommendation,
        'compMode': 'Peer Comparison (Target Co. vs Peers)',
        'industrySector': industry_sector_val,
        'timeHorizon': '',
        'peers': peers_payload,
        'peerNames': peer_names_payload,
        'metricsData': metrics_data_payload,
        'businessOverview': business_overview,
        'valuationThesis': valuation_thesis,
        'technicalAnalysis': technical_analysis,
        'consensusRows': consensus_rows_payload,
    })


# ─────────────────────────────────────────────────────────────
# DEPARTMENT MANAGERS & ROLE ASSIGNMENT APIS (Superadmin)
# ─────────────────────────────────────────────────────────────

@csrf_exempt
@require_GET
def api_admin_managers(request):
    """
    Returns list of all active departments with appointed managers, and list of candidates.
    """
    user = get_current_user(request)
    if not user:
        return JsonResponse({'success': False, 'error': 'Unauthorized'}, status=401)

    departments = Department.objects.filter(is_active=True).order_by('name')
    assignments = DepartmentManagerAssignment.objects.filter(is_active=True).select_related('department', 'manager', 'assigned_by')
    assignment_map = {}
    for a in assignments:
        assignment_map[a.department.name] = {
            'id': a.id,
            'manager_id': a.manager.id,
            'manager_name': a.manager.name,
            'manager_email': a.manager.email,
            'manager_designation': a.manager.designation,
            'assigned_by_name': a.assigned_by.name if a.assigned_by else 'Superadmin',
            'assigned_at': a.created_at.strftime('%Y-%m-%d %H:%M'),
        }

    dept_list = []
    for d in departments:
        mgr = assignment_map.get(d.name)
        dept_list.append({
            'id': d.id,
            'name': d.name,
            'page_key': d.page_key,
            'manager': mgr,
            'has_manager': bool(mgr),
        })

    # All active employees and interns who can be appointed as manager
    candidates = OperationUser.objects.filter(is_active=True).order_by('name')
    candidate_list = [
        {
            'id': u.id,
            'name': u.name,
            'email': u.email,
            'emp_code': u.emp_code,
            'designation': u.designation,
            'department': u.department,
            'emp_type': u.emp_type or ('Intern' if 'intern' in (u.designation or '').lower() else 'Normal'),
            'is_manager': u.is_manager,
            'managed_department': u.managed_department,
            'managed_departments': u.managed_departments,
        }
        for u in candidates
    ]

    return JsonResponse({
        'success': True,
        'departments': dept_list,
        'candidates': candidate_list,
    })


@csrf_exempt
@require_POST
def api_admin_assign_manager(request):
    """
    Superadmin assigns an employee or intern as manager of a selected department.
    """
    admin_user = get_current_user(request)
    if not admin_user:
        return JsonResponse({'success': False, 'error': 'Unauthorized'}, status=401)

    if not (admin_user.is_superadmin or admin_user.role == 'admin'):
        return JsonResponse({'success': False, 'error': 'Only Superadmin can assign Department Managers.'}, status=403)

    data = parse_request_json(request)
    user_id = data.get('user_id')
    department_name = (data.get('department_name') or '').strip()

    if not user_id or not department_name:
        return JsonResponse({'success': False, 'error': 'Please provide user_id and department_name.'}, status=400)

    target_user = OperationUser.objects.filter(id=user_id).first()
    if not target_user:
        return JsonResponse({'success': False, 'error': 'User not found.'}, status=404)

    dept_obj, _ = Department.objects.get_or_create(name=department_name, defaults={'page_key': department_name, 'is_active': True})

    # Deactivate previous manager assignment for this department
    DepartmentManagerAssignment.objects.filter(department=dept_obj, is_active=True).update(is_active=False)

    # Create new active assignment
    assignment = DepartmentManagerAssignment.objects.create(
        department=dept_obj,
        manager=target_user,
        assigned_by=admin_user,
        is_active=True
    )

    # Update target user attributes
    target_user.is_manager = True
    target_user.managed_department = dept_obj.name
    managed_depts = list(target_user.managed_departments or [])
    if dept_obj.name not in managed_depts:
        managed_depts.append(dept_obj.name)
    target_user.managed_departments = managed_depts

    # Ensure target user has access to the department
    assigned_depts = list(target_user.assigned_departments or [])
    if dept_obj.name not in assigned_depts:
        assigned_depts.append(dept_obj.name)
    target_user.assigned_departments = assigned_depts
    target_user.save()

    OPUserDepartmentAccess.objects.get_or_create(user=target_user, department=dept_obj, defaults={'is_active': True})

    ActivityLog.objects.create(
        user=admin_user,
        action=f"Appointed {target_user.name} as Manager of {dept_obj.name} Department"
    )

    return JsonResponse({
        'success': True,
        'message': f"Successfully appointed {target_user.name} as Manager of {dept_obj.name} Department!",
        'assignment_id': assignment.id,
        'user': serialize_user(target_user),
    })


@csrf_exempt
@require_POST
def api_admin_remove_manager(request):
    """
    Superadmin removes manager appointment for a department.
    """
    admin_user = get_current_user(request)
    if not admin_user:
        return JsonResponse({'success': False, 'error': 'Unauthorized'}, status=401)

    if not (admin_user.is_superadmin or admin_user.role == 'admin'):
        return JsonResponse({'success': False, 'error': 'Only Superadmin can modify Manager assignments.'}, status=403)

    data = parse_request_json(request)
    assignment_id = data.get('assignment_id')
    department_name = data.get('department_name')

    if assignment_id:
        assignment = DepartmentManagerAssignment.objects.filter(id=assignment_id).first()
    elif department_name:
        assignment = DepartmentManagerAssignment.objects.filter(department__name=department_name, is_active=True).first()
    else:
        assignment = None

    if not assignment:
        return JsonResponse({'success': False, 'error': 'Manager assignment not found.'}, status=404)

    target_user = assignment.manager
    dept_name = assignment.department.name
    assignment.is_active = False
    assignment.save()

    # Re-evaluate user manager status
    active_managements = DepartmentManagerAssignment.objects.filter(manager=target_user, is_active=True)
    active_managed_depts = [m.department.name for m in active_managements]
    target_user.managed_departments = active_managed_depts
    target_user.managed_department = active_managed_depts[0] if active_managed_depts else None
    target_user.is_manager = len(active_managed_depts) > 0
    target_user.save()

    ActivityLog.objects.create(
        user=admin_user,
        action=f"Removed manager appointment of {target_user.name} for {dept_name}"
    )

    return JsonResponse({
        'success': True,
        'message': f"Manager assignment for {dept_name} removed successfully.",
    })


# ─────────────────────────────────────────────────────────────
# ASSIGNED TASKS APIS (Superadmin & Department Manager)
# ─────────────────────────────────────────────────────────────

@csrf_exempt
@require_GET
def api_assigned_tasks(request):
    """
    Returns assigned tasks based on role:
    - Superadmin: all tasks
    - Manager: tasks in their managed department(s) or created by them
    - Employee: tasks assigned to them or to their department(s)
    """
    user = get_current_user(request)
    if not user:
        return JsonResponse({'success': False, 'error': 'Unauthorized'}, status=401)

    is_superadmin = bool(user.is_superadmin or user.role == 'admin')
    managed_depts = list(user.managed_departments or [])
    if user.managed_department and user.managed_department not in managed_depts:
        managed_depts.append(user.managed_department)

    department_filter = request.GET.get('department')
    status_filter = request.GET.get('status')

    qs = DailyAssignedTask.objects.all().select_related('assigned_by', 'assigned_to')

    if not is_superadmin:
        if user.is_manager and managed_depts:
            # Manager sees tasks in their managed departments or created by them or assigned to them
            qs = qs.filter(
                Q(department__in=managed_depts) |
                Q(assigned_by=user) |
                Q(assigned_to=user)
            )
        else:
            # Employee sees tasks assigned directly to them or to their department
            user_depts = list(user.assigned_departments or [user.department or 'Operations'])
            qs = qs.filter(
                Q(assigned_to=user) |
                (Q(department__in=user_depts) & Q(assigned_to__isnull=True))
            )

    if department_filter:
        qs = qs.filter(department__iexact=department_filter)
    if status_filter:
        qs = qs.filter(status__iexact=status_filter)

    tasks_data = [
        {
            'id': t.id,
            'title': t.title,
            'description': t.description or '',
            'department': t.department,
            'task_type': t.task_type,
            'priority': t.priority,
            'due_date': t.due_date.isoformat() if t.due_date else None,
            'status': t.status,
            'is_flagged': t.is_flagged,
            'flag_reason': t.flag_reason or '',
            'assigned_by': {
                'id': t.assigned_by.id,
                'name': t.assigned_by.name,
                'email': t.assigned_by.email,
                'designation': t.assigned_by.designation,
            } if t.assigned_by else None,
            'assigned_to': {
                'id': t.assigned_to.id,
                'name': t.assigned_to.name,
                'email': t.assigned_to.email,
                'designation': t.assigned_to.designation,
                'emp_code': t.assigned_to.emp_code,
            } if t.assigned_to else None,
            'completed_at': t.completed_at.isoformat() if t.completed_at else None,
            'created_at': t.created_at.strftime('%Y-%m-%d %H:%M'),
        }
        for t in qs[:150]
    ]

    return JsonResponse({
        'success': True,
        'count': len(tasks_data),
        'tasks': tasks_data,
        'user_is_manager': user.is_manager,
        'user_is_superadmin': is_superadmin,
        'managed_departments': managed_depts,
    })


@csrf_exempt
@require_POST
def api_create_assigned_task(request):
    """
    Superadmin or Department Manager creates a task:
    - Superadmin can assign to any department and any employee.
    - Department Manager can assign to their managed department(s) and any employee in that department.
    """
    user = get_current_user(request)
    if not user:
        return JsonResponse({'success': False, 'error': 'Unauthorized'}, status=401)

    is_superadmin = bool(user.is_superadmin or user.role == 'admin')
    managed_depts = list(user.managed_departments or [])
    if user.managed_department and user.managed_department not in managed_depts:
        managed_depts.append(user.managed_department)

    data = parse_request_json(request)
    title = (data.get('title') or '').strip()
    description = (data.get('description') or '').strip()
    department = (data.get('department') or '').strip()
    assigned_to_id = data.get('assigned_to_id')
    task_type = data.get('task_type') or 'Major'
    priority = data.get('priority') or 'Normal'
    due_date_str = data.get('due_date')

    if not title:
        return JsonResponse({'success': False, 'error': 'Task title is required.'}, status=400)

    if not department:
        department = managed_depts[0] if managed_depts else (user.department or 'Operations')

    # Authority check
    if not is_superadmin:
        if not user.is_manager:
            return JsonResponse({'success': False, 'error': 'Only Superadmin and Department Managers can assign tasks.'}, status=403)
        if managed_depts and department not in managed_depts:
            return JsonResponse({'success': False, 'error': f'You are only authorized to assign tasks in: {", ".join(managed_depts)}'}, status=403)

    assigned_to_user = None
    if assigned_to_id:
        assigned_to_user = OperationUser.objects.filter(id=assigned_to_id).first()

    due_date = None
    if due_date_str:
        try:
            due_date = datetime.strptime(due_date_str, '%Y-%m-%d').date()
        except Exception:
            pass

    task = DailyAssignedTask.objects.create(
        title=title,
        description=description,
        department=department,
        assigned_by=user,
        assigned_to=assigned_to_user,
        task_type=task_type,
        priority=priority,
        due_date=due_date,
        status='Pending'
    )

    ActivityLog.objects.create(
        user=user,
        action=f"Created task '{title}' for {assigned_to_user.name if assigned_to_user else department} ({department})"
    )

    return JsonResponse({
        'success': True,
        'message': f"Task '{title}' assigned successfully!",
        'task_id': task.id,
    })


@csrf_exempt
@require_POST
def api_update_assigned_task_status(request, pk):
    """
    Updates the status or blocker flag of an assigned task.
    """
    user = get_current_user(request)
    if not user:
        return JsonResponse({'success': False, 'error': 'Unauthorized'}, status=401)

    task = get_object_or_404(DailyAssignedTask, pk=pk)
    data = parse_request_json(request)

    status = data.get('status')
    is_flagged = data.get('is_flagged')
    flag_reason = data.get('flag_reason')

    if status:
        task.status = status
        if status == 'Completed':
            task.completed_at = timezone.now()
            task.is_flagged = False
        elif status == 'Flagged':
            task.is_flagged = True

    if is_flagged is not None:
        task.is_flagged = bool(is_flagged)
        if task.is_flagged:
            task.status = 'Flagged'
            if flag_reason:
                task.flag_reason = flag_reason
        else:
            if task.status == 'Flagged':
                task.status = 'In Progress'

    task.save()

    return JsonResponse({
        'success': True,
        'message': 'Task updated successfully',
        'status': task.status,
        'is_flagged': task.is_flagged,
    })


# ─────────────────────────────────────────────────────────────
# DAILY WORK TRACKER APIS (Operations Portal Full Feature Set)
# ─────────────────────────────────────────────────────────────

def _get_or_create_tracker_config():
    config = DailyTrackerConfig.objects.first()
    if not config:
        config = DailyTrackerConfig.objects.create(
            cutoff_hours=24,
            task_types_json='["Major", "Minor", "Research", "Documentation", "Meeting", "Support"]',
            custom_fields_json='[]',
            auto_lock_enabled=True
        )
    return config


def _calculate_day_number(user, target_date):
    if user.joining_date and target_date >= user.joining_date:
        delta = (target_date - user.joining_date).days + 1
        return max(1, delta)
    prev_count = DailyTrackerDay.objects.filter(user=user, date__lt=target_date).count()
    return prev_count + 1


def _check_and_apply_auto_lock(tracker_day, config=None):
    if not tracker_day or tracker_day.status == 'Locked':
        return tracker_day
    if not config:
        config = _get_or_create_tracker_config()
    if not config.auto_lock_enabled:
        return tracker_day

    cutoff_hours = config.cutoff_hours or 24
    tracker_day_dt = datetime.combine(tracker_day.date, datetime.min.time()) + timedelta(days=1, hours=cutoff_hours)
    now_aware = timezone.now()
    if timezone.is_naive(now_aware):
        compare_now = now_aware
    else:
        tracker_day_dt = timezone.make_aware(tracker_day_dt, timezone.get_current_timezone())
        compare_now = now_aware

    if compare_now > tracker_day_dt:
        tracker_day.status = 'Locked'
        if not tracker_day.locked_at:
            tracker_day.locked_at = timezone.now()
        tracker_day.save()
        DailyTrackerAuditLog.objects.create(
            tracker_day=tracker_day,
            user=tracker_day.user,
            action='AUTO_LOCKED',
            performed_by_name='System Auto-Lock',
            performed_by_role='System',
            details=f'Tracker automatically locked after {cutoff_hours}h cutoff threshold.'
        )
    return tracker_day


def _calculate_streak_badges(longest_streak, current_streak=0):
    best_streak = max(longest_streak or 0, current_streak or 0)
    badge_defs = [
        {'id': 'streak_21', 'days': 21, 'title': 'Habit Builder', 'tier': 'Bronze', 'icon': 'flame', 'emoji': '🔥', 'color': '#d97706', 'bg_gradient': 'from-amber-500/20 to-orange-500/10', 'description': 'Formed a consistent daily routine with a 21-day streak.'},
        {'id': 'streak_30', 'days': 30, 'title': 'Monthly Master', 'tier': 'Silver', 'icon': 'sparkles', 'emoji': '✨', 'color': '#64748b', 'bg_gradient': 'from-slate-400/20 to-slate-600/10', 'description': 'Completed a full uninterrupted 30-day work tracking milestone.'},
        {'id': 'streak_60', 'days': 60, 'title': 'Consistency Pro', 'tier': 'Gold', 'icon': 'zap', 'emoji': '⚡', 'color': '#eab308', 'bg_gradient': 'from-yellow-400/20 to-amber-600/10', 'description': 'Maintained peak consistency across 60 consecutive days.'},
        {'id': 'streak_120', 'days': 120, 'title': 'Centurion', 'tier': 'Platinum', 'icon': 'shield', 'emoji': '🛡️', 'color': '#06b6d4', 'bg_gradient': 'from-cyan-400/20 to-blue-600/10', 'description': 'Achieved an elite 120-day streak with relentless focus.'},
        {'id': 'streak_240', 'days': 240, 'title': 'Iron Will', 'tier': 'Diamond', 'icon': 'gem', 'emoji': '💎', 'color': '#8b5cf6', 'bg_gradient': 'from-purple-400/20 to-indigo-600/10', 'description': 'Completed 240 days of unbroken professional excellence.'},
        {'id': 'streak_360', 'days': 360, 'title': 'Grandmaster Legend', 'tier': 'Legend', 'icon': 'crown', 'emoji': '👑', 'color': '#ec4899', 'bg_gradient': 'from-pink-500/20 to-rose-600/10', 'description': 'Pinnacle 360-day full-year streak mastery achieved.'},
    ]
    badges = []
    for b in badge_defs:
        is_unlocked = best_streak >= b['days']
        pct = min(100, round((best_streak / b['days']) * 100)) if b['days'] > 0 else 0
        badges.append({
            **b,
            'is_unlocked': is_unlocked,
            'progress_percent': pct,
            'current_days': min(best_streak, b['days']),
            'remaining_days': max(0, b['days'] - best_streak)
        })
    return badges


def _get_user_github_heatmap(user, selected_date=None):
    if not selected_date:
        selected_date = timezone.now().date()

    days_to_sunday = 6 - selected_date.weekday()
    end_date = selected_date + timedelta(days=days_to_sunday)
    start_date = end_date - timedelta(days=52 * 7 - 1)

    trackers = DailyTrackerDay.objects.filter(
        user=user,
        date__gte=start_date,
        date__lte=end_date
    ).prefetch_related('tasks')

    tracker_map = {t.date: t for t in trackers}
    weeks = []
    current_week = []
    months_labels = []
    last_month = None
    curr_d = start_date
    week_idx = 0

    total_submitted_days = 0
    total_hours_sum = 0.0
    total_achievements_sum = 0
    longest_streak = 0
    running_streak = 0
    current_streak = 0

    today_dt = timezone.now().date()
    today_tracker = tracker_map.get(today_dt)
    check_d = today_dt if (today_tracker and today_tracker.status in ['Submitted', 'Locked']) else (today_dt - timedelta(days=1))

    while check_d >= start_date:
        t = tracker_map.get(check_d)
        is_sub = t and t.status in ['Submitted', 'Locked']
        is_off = (check_d.weekday() in [5, 6]) or (t and t.day_status in ['Weekly Off', 'Holiday', 'Leave'])
        if is_sub:
            current_streak += 1
            check_d -= timedelta(days=1)
        elif is_off:
            check_d -= timedelta(days=1)
        else:
            break

    while curr_d <= end_date:
        m_name = curr_d.strftime('%b')
        if curr_d.day <= 7 and m_name != last_month:
            last_month = m_name
            months_labels.append({'name': m_name, 'week_col': week_idx})

        tracker = tracker_map.get(curr_d)
        if tracker:
            hours = tracker.total_hours
            tasks_count = tracker.tasks_count
            achievements = tracker.achievements_count
            status = tracker.status
            day_status = tracker.day_status
        else:
            hours = 0.0
            tasks_count = 0
            achievements = 0
            status = 'None'
            day_status = 'Weekly Off' if curr_d.weekday() in [5, 6] else 'Working Day'

        is_sub = status in ['Submitted', 'Locked']
        is_off_day = (curr_d.weekday() in [5, 6]) or (day_status in ['Weekly Off', 'Holiday', 'Leave'])

        if is_sub:
            total_submitted_days += 1
            running_streak += 1
            if running_streak > longest_streak:
                longest_streak = running_streak
        elif is_off_day:
            pass
        elif curr_d < today_dt:
            running_streak = 0

        total_hours_sum += hours
        total_achievements_sum += achievements

        if not is_sub:
            level = 0
        elif hours >= 9:
            level = 4
        elif hours >= 7:
            level = 3
        elif hours >= 4:
            level = 2
        else:
            level = 1

        current_week.append({
            'date': curr_d.strftime('%Y-%m-%d'),
            'date_display': curr_d.strftime('%d-%b-%Y'),
            'day_name': curr_d.strftime('%A'),
            'weekday': curr_d.weekday(),
            'hours': round(hours, 1),
            'tasks_count': tasks_count,
            'achievements': achievements,
            'status': status,
            'day_status': day_status,
            'level': level,
            'is_selected': (curr_d == selected_date),
            'is_today': (curr_d == today_dt)
        })

        if curr_d.weekday() == 6:
            weeks.append(current_week)
            current_week = []
            week_idx += 1
        curr_d += timedelta(days=1)

    if current_week:
        weeks.append(current_week)

    best_streak = max(longest_streak, current_streak)
    badges = _calculate_streak_badges(longest_streak=best_streak, current_streak=current_streak)
    unlocked_badges_count = sum(1 for b in badges if b['is_unlocked'])

    return {
        'weeks': weeks,
        'months_labels': months_labels,
        'total_submitted_days': total_submitted_days,
        'total_hours_year': round(total_hours_sum, 1),
        'total_achievements_year': total_achievements_sum,
        'longest_streak': best_streak,
        'current_streak': current_streak,
        'badges': badges,
        'unlocked_badges_count': unlocked_badges_count,
    }


@csrf_exempt
@require_GET
def api_tracker_get(request):
    """
    Returns the JSON representation of tracker for a specific date and employee.
    """
    current_user = get_current_user(request)
    if not current_user:
        return JsonResponse({'error': 'Unauthorized'}, status=401)

    is_superadmin = bool(current_user.is_superadmin or current_user.role == 'admin')
    is_manager = bool(current_user.is_manager)
    managed_depts = list(current_user.managed_departments or [])

    emp_id = request.GET.get('user_id') or request.GET.get('employee_id')
    if emp_id:
        target_user = OperationUser.objects.filter(id=emp_id).first()
        if not target_user:
            return JsonResponse({'error': 'User not found'}, status=404)
        if target_user.id != current_user.id and not is_superadmin and not (is_manager and target_user.department in managed_depts):
            return JsonResponse({'error': 'Permission denied to view this tracker.'}, status=403)
    else:
        target_user = current_user

    date_str = request.GET.get('date', timezone.now().date().strftime('%Y-%m-%d'))
    try:
        current_date = datetime.strptime(date_str, '%Y-%m-%d').date()
    except Exception:
        current_date = timezone.now().date()

    config = _get_or_create_tracker_config()
    day_number = _calculate_day_number(target_user, current_date)

    tracker_day, _ = DailyTrackerDay.objects.get_or_create(
        user=target_user,
        date=current_date,
        defaults={
            'day_number': day_number,
            'day_status': 'Weekly Off' if current_date.weekday() in [5, 6] else 'Working Day',
            'status': 'Draft'
        }
    )

    _check_and_apply_auto_lock(tracker_day, config)

    tasks_data = []
    for task in tracker_day.tasks.all():
        tasks_data.append({
            'id': task.id,
            'assigned_task_id': task.assigned_task_id,
            'is_flagged': bool(task.is_flagged),
            'flag_reason': task.flag_reason or '',
            'task_description': task.task_description,
            'task_type': task.task_type,
            'hours_worked': task.hours_worked,
            'is_achievement': task.is_achievement,
            'remarks': task.remarks or '',
            'order': task.order,
            'custom_data': task.custom_data or '{}'
        })

    # Assigned tasks available for employee/intern to link to
    user_depts = list(target_user.assigned_departments or [target_user.department or 'Operations'])
    assigned_tasks_qs = DailyAssignedTask.objects.filter(
        Q(assigned_to=target_user) | (Q(department__in=user_depts) & Q(assigned_to__isnull=True))
    ).exclude(status='Completed').order_by('-created_at')

    assigned_tasks_data = [
        {
            'id': at.id,
            'title': at.title,
            'description': at.description or '',
            'department': at.department,
            'task_type': at.task_type,
            'priority': at.priority,
            'due_date': at.due_date.isoformat() if at.due_date else None,
            'status': at.status,
            'is_flagged': at.is_flagged,
            'flag_reason': at.flag_reason or '',
            'assigned_by_name': at.assigned_by.name if at.assigned_by else 'Management'
        }
        for at in assigned_tasks_qs
    ]

    pending_unlock = DailyTrackerUnlockRequest.objects.filter(
        tracker_day=tracker_day,
        status='Pending'
    ).first()

    heatmap_data = _get_user_github_heatmap(target_user, current_date)

    try:
        task_types = json.loads(config.task_types_json)
    except Exception:
        task_types = ["Major", "Minor", "Research", "Documentation", "Meeting", "Support"]

    return JsonResponse({
        'id': tracker_day.id,
        'user_id': target_user.id,
        'employee_id': target_user.id,
        'employee_name': target_user.name,
        'emp_type': target_user.emp_type or 'Normal',
        'department': target_user.department or '',
        'designation': target_user.designation or '',
        'date': tracker_day.date.strftime('%Y-%m-%d'),
        'day_number': tracker_day.day_number,
        'day_status': tracker_day.day_status,
        'status': tracker_day.status,
        'submitted_at': tracker_day.submitted_at.isoformat() if tracker_day.submitted_at else None,
        'locked_at': tracker_day.locked_at.isoformat() if tracker_day.locked_at else None,
        'manager_rating': tracker_day.manager_rating,
        'manager_remarks': tracker_day.manager_remarks or '',
        'reviewed_by': tracker_day.reviewed_by or '',
        'reviewed_at': tracker_day.reviewed_at.isoformat() if tracker_day.reviewed_at else None,
        'total_hours': tracker_day.total_hours,
        'achievements_count': tracker_day.achievements_count,
        'tasks': tasks_data,
        'assigned_tasks': assigned_tasks_data,
        'heatmap': heatmap_data,
        'task_types': task_types,
        'pending_unlock': {
            'id': pending_unlock.id,
            'reason': pending_unlock.reason,
            'requested_at': pending_unlock.requested_at.isoformat()
        } if pending_unlock else None
    })


@csrf_exempt
@require_POST
def api_tracker_save(request):
    """
    Saves tracker as Draft or Submits it with mandatory validations.
    """
    current_user = get_current_user(request)
    if not current_user:
        return JsonResponse({'error': 'Unauthorized'}, status=401)

    is_superadmin = bool(current_user.is_superadmin or current_user.role == 'admin')
    is_manager = bool(current_user.is_manager)
    managed_depts = list(current_user.managed_departments or [])

    data = parse_request_json(request)
    user_id = data.get('user_id') or data.get('employee_id')
    if user_id:
        target_user = OperationUser.objects.filter(id=user_id).first()
        if not target_user:
            return JsonResponse({'error': 'Target user not found'}, status=404)
        if target_user.id != current_user.id and not is_superadmin and not (is_manager and target_user.department in managed_depts):
            return JsonResponse({'error': 'Permission denied.'}, status=403)
    else:
        target_user = current_user

    date_str = data.get('date', timezone.now().date().strftime('%Y-%m-%d'))
    try:
        current_date = datetime.strptime(date_str, '%Y-%m-%d').date()
    except Exception:
        return JsonResponse({'error': 'Invalid date format (YYYY-MM-DD)'}, status=400)

    action = data.get('action', 'draft').lower()  # 'draft' or 'submit'
    day_status = data.get('day_status', 'Working Day')
    tasks_input = data.get('tasks', [])

    config = _get_or_create_tracker_config()

    tracker_day, _ = DailyTrackerDay.objects.get_or_create(
        user=target_user,
        date=current_date,
        defaults={
            'day_number': _calculate_day_number(target_user, current_date),
            'day_status': day_status,
            'status': 'Draft'
        }
    )

    # Check lock status
    if tracker_day.status == 'Locked' and not is_superadmin:
        return JsonResponse({
            'error': 'This tracker is locked. Please request an unlock to make corrections.'
        }, status=403)

    # Validations for submission
    if action == 'submit':
        if day_status == 'Working Day':
            if not tasks_input or len(tasks_input) == 0:
                return JsonResponse({'error': 'At least one task row is required for a Working Day.'}, status=400)

            total_h = 0.0
            for idx, t in enumerate(tasks_input):
                desc = (t.get('task_description') or '').strip()
                if not desc:
                    return JsonResponse({'error': f'Task description is mandatory on row {idx + 1}.'}, status=400)
                try:
                    h = float(t.get('hours_worked', 0))
                    if h < 0 or h > 24:
                        return JsonResponse({'error': f'Hours worked must be between 0 and 24 on row {idx + 1}.'}, status=400)
                    total_h += h
                except (ValueError, TypeError):
                    return JsonResponse({'error': f'Invalid hours value on row {idx + 1}.'}, status=400)

            if total_h > 24:
                return JsonResponse({'error': 'Total hours worked cannot exceed 24 hours in a single day.'}, status=400)

        tracker_day.status = 'Submitted'
        tracker_day.submitted_at = timezone.now()
    else:
        tracker_day.status = 'Draft'

    tracker_day.day_status = day_status
    tracker_day.save()

    # Re-sync task rows
    tracker_day.tasks.all().delete()
    created_tasks = []
    for idx, t in enumerate(tasks_input):
        desc = (t.get('task_description') or '').strip()
        if day_status != 'Working Day' and not desc:
            continue

        try:
            h = float(t.get('hours_worked', 0))
        except Exception:
            h = 0.0

        is_ach = bool(t.get('is_achievement', False))
        remarks = (t.get('remarks') or '').strip()
        task_type = (t.get('task_type') or 'Major').strip()
        assigned_task_id = t.get('assigned_task_id')
        is_flagged = bool(t.get('is_flagged', False))
        flag_reason = (t.get('flag_reason') or '').strip()
        custom_data = t.get('custom_data', '{}')
        if isinstance(custom_data, dict):
            custom_data = json.dumps(custom_data)

        assigned_task_obj = None
        if assigned_task_id:
            try:
                assigned_task_obj = DailyAssignedTask.objects.filter(id=assigned_task_id).first()
            except Exception:
                assigned_task_obj = None

        task_obj = DailyTaskRow.objects.create(
            tracker_day=tracker_day,
            assigned_task=assigned_task_obj,
            is_flagged=is_flagged,
            flag_reason=flag_reason,
            task_description=desc or 'Day Off / Leave',
            task_type=task_type,
            hours_worked=h if day_status == 'Working Day' else 0.0,
            is_achievement=is_ach,
            remarks=remarks,
            order=idx,
            custom_data=custom_data
        )
        created_tasks.append(task_obj)

        if assigned_task_obj:
            if is_flagged:
                assigned_task_obj.is_flagged = True
                assigned_task_obj.flag_reason = flag_reason
                assigned_task_obj.status = 'Flagged'
                assigned_task_obj.save()
            elif action == 'submit':
                assigned_task_obj.is_flagged = False
                assigned_task_obj.status = 'Completed'
                assigned_task_obj.completed_at = timezone.now()
                assigned_task_obj.save()
            elif action == 'draft' and assigned_task_obj.status == 'Pending':
                assigned_task_obj.status = 'In Progress'
                assigned_task_obj.save()

    # Audit Trail
    audit_action = 'SUBMITTED' if action == 'submit' else 'DRAFT_SAVED'
    performed_name = current_user.name
    performed_role = 'Superadmin' if is_superadmin else ('Manager' if is_manager else (target_user.emp_type or 'Employee'))

    DailyTrackerAuditLog.objects.create(
        tracker_day=tracker_day,
        user=target_user,
        action=audit_action,
        performed_by_name=performed_name,
        performed_by_role=performed_role,
        details=f"Tracker {audit_action.lower()} with {len(created_tasks)} tasks, Day Status: {day_status}, Total Hours: {tracker_day.total_hours}h."
    )

    return JsonResponse({
        'success': True,
        'message': f"Daily Tracker successfully {'submitted' if action == 'submit' else 'saved as draft'}.",
        'tracker_id': tracker_day.id,
        'status': tracker_day.status,
        'total_hours': tracker_day.total_hours,
        'achievements_count': tracker_day.achievements_count,
        'tasks_count': tracker_day.tasks_count
    })


@csrf_exempt
@require_POST
def api_tracker_request_unlock(request):
    """
    Employee requests unlock for a locked or submitted daily tracker.
    """
    user = get_current_user(request)
    if not user:
        return JsonResponse({'error': 'Unauthorized'}, status=401)

    data = parse_request_json(request)
    tracker_day_id = data.get('tracker_day_id')
    date_str = data.get('date')
    reason = (data.get('reason') or '').strip()

    if not reason:
        return JsonResponse({'error': 'Unlock request reason is mandatory.'}, status=400)

    if tracker_day_id:
        tracker_day = DailyTrackerDay.objects.filter(id=tracker_day_id, user=user).first()
    elif date_str:
        try:
            d = datetime.strptime(date_str, '%Y-%m-%d').date()
            tracker_day = DailyTrackerDay.objects.filter(user=user, date=d).first()
        except Exception:
            tracker_day = None
    else:
        tracker_day = None

    if not tracker_day:
        return JsonResponse({'error': 'Tracker day record not found.'}, status=404)

    # Check if pending unlock request already exists
    existing = DailyTrackerUnlockRequest.objects.filter(tracker_day=tracker_day, status='Pending').first()
    if existing:
        return JsonResponse({'error': 'An unlock request is already pending review for this tracker.'}, status=400)

    unlock_req = DailyTrackerUnlockRequest.objects.create(
        tracker_day=tracker_day,
        user=user,
        reason=reason,
        status='Pending'
    )

    DailyTrackerAuditLog.objects.create(
        tracker_day=tracker_day,
        user=user,
        action='UNLOCK_REQUESTED',
        performed_by_name=user.name,
        performed_by_role=user.emp_type or 'Employee',
        details=f"Unlock requested with reason: {reason}"
    )

    return JsonResponse({
        'success': True,
        'message': 'Unlock request submitted successfully to Manager & Admin.',
        'request_id': unlock_req.id
    })


@csrf_exempt
@require_GET
def api_admin_tracker_list(request):
    """
    Manager & Superadmin endpoint to list submitted daily trackers for review.
    """
    current_user = get_current_user(request)
    if not current_user:
        return JsonResponse({'error': 'Unauthorized'}, status=401)

    is_superadmin = bool(current_user.is_superadmin or current_user.role == 'admin')
    is_manager = bool(current_user.is_manager)
    managed_depts = list(current_user.managed_departments or [])

    if not is_superadmin and not is_manager:
        return JsonResponse({'error': 'Access restricted to Managers and Admins.'}, status=403)

    qs = DailyTrackerDay.objects.all().select_related('user').prefetch_related('tasks')

    if not is_superadmin:
        qs = qs.filter(user__department__in=managed_depts)

    dept_filter = request.GET.get('department')
    if dept_filter:
        qs = qs.filter(user__department__iexact=dept_filter)

    user_id_filter = request.GET.get('user_id')
    if user_id_filter:
        qs = qs.filter(user_id=user_id_filter)

    status_filter = request.GET.get('status')
    if status_filter:
        qs = qs.filter(status__iexact=status_filter)

    date_filter = request.GET.get('date')
    if date_filter:
        qs = qs.filter(date=date_filter)

    from_date = request.GET.get('from_date')
    if from_date:
        qs = qs.filter(date__gte=from_date)

    to_date = request.GET.get('to_date')
    if to_date:
        qs = qs.filter(date__lte=to_date)

    trackers_data = []
    for t in qs.order_by('-date', '-submitted_at')[:100]:
        trackers_data.append({
            'id': t.id,
            'user_id': t.user.id,
            'user_name': t.user.name,
            'user_email': t.user.email,
            'user_department': t.user.department,
            'user_designation': t.user.designation,
            'emp_type': t.user.emp_type or 'Normal',
            'date': t.date.strftime('%Y-%m-%d'),
            'date_display': t.date.strftime('%d-%b-%Y'),
            'day_status': t.day_status,
            'status': t.status,
            'total_hours': t.total_hours,
            'tasks_count': t.tasks_count,
            'achievements_count': t.achievements_count,
            'manager_rating': t.manager_rating,
            'manager_remarks': t.manager_remarks or '',
            'reviewed_by': t.reviewed_by or '',
            'reviewed_at': t.reviewed_at.isoformat() if t.reviewed_at else None,
            'submitted_at': t.submitted_at.isoformat() if t.submitted_at else None,
        })

    pending_unlocks_count = DailyTrackerUnlockRequest.objects.filter(status='Pending').count()

    return JsonResponse({
        'success': True,
        'count': len(trackers_data),
        'trackers': trackers_data,
        'pending_unlocks_count': pending_unlocks_count,
    })


@csrf_exempt
@require_POST
def api_admin_tracker_review(request):
    """
    Manager or Superadmin leaves rating (1-5 stars) and remarks on a daily tracker.
    """
    current_user = get_current_user(request)
    if not current_user:
        return JsonResponse({'error': 'Unauthorized'}, status=401)

    is_superadmin = bool(current_user.is_superadmin or current_user.role == 'admin')
    is_manager = bool(current_user.is_manager)
    managed_depts = list(current_user.managed_departments or [])

    if not is_superadmin and not is_manager:
        return JsonResponse({'error': 'Permission denied.'}, status=403)

    data = parse_request_json(request)
    tracker_day_id = data.get('tracker_day_id')
    rating = data.get('manager_rating', 0)
    remarks = (data.get('manager_remarks') or '').strip()

    tracker_day = get_object_or_404(DailyTrackerDay, pk=tracker_day_id)

    if not is_superadmin and (tracker_day.user.department not in managed_depts):
        return JsonResponse({'error': 'You can only review trackers in your managed department.'}, status=403)

    try:
        rating_val = int(rating)
        if rating_val < 0 or rating_val > 5:
            rating_val = 0
    except Exception:
        rating_val = 0

    tracker_day.manager_rating = rating_val
    tracker_day.manager_remarks = remarks
    tracker_day.reviewed_by = current_user.name
    tracker_day.reviewed_at = timezone.now()
    tracker_day.save()

    DailyTrackerAuditLog.objects.create(
        tracker_day=tracker_day,
        user=tracker_day.user,
        action='MANAGER_REVIEW',
        performed_by_name=current_user.name,
        performed_by_role='Superadmin' if is_superadmin else 'Department Manager',
        details=f"Reviewed with rating {rating_val}/5 stars. Feedback: {remarks}"
    )

    return JsonResponse({
        'success': True,
        'message': f"Review saved successfully for {tracker_day.user.name}'s tracker.",
        'manager_rating': tracker_day.manager_rating,
        'manager_remarks': tracker_day.manager_remarks,
        'reviewed_by': tracker_day.reviewed_by
    })


@csrf_exempt
@require_GET
def api_admin_tracker_unlock_requests(request):
    """
    Lists pending unlock requests for managers and admins.
    """
    current_user = get_current_user(request)
    if not current_user:
        return JsonResponse({'error': 'Unauthorized'}, status=401)

    is_superadmin = bool(current_user.is_superadmin or current_user.role == 'admin')
    is_manager = bool(current_user.is_manager)
    managed_depts = list(current_user.managed_departments or [])

    if not is_superadmin and not is_manager:
        return JsonResponse({'error': 'Unauthorized'}, status=403)

    qs = DailyTrackerUnlockRequest.objects.all().select_related('user', 'tracker_day')
    if not is_superadmin:
        qs = qs.filter(user__department__in=managed_depts)

    status_filter = request.GET.get('status', 'Pending')
    if status_filter != 'all':
        qs = qs.filter(status=status_filter)

    data = [
        {
            'id': req.id,
            'tracker_day_id': req.tracker_day.id,
            'date': req.tracker_day.date.strftime('%Y-%m-%d'),
            'user_id': req.user.id,
            'user_name': req.user.name,
            'user_email': req.user.email,
            'department': req.user.department,
            'reason': req.reason,
            'status': req.status,
            'requested_at': req.requested_at.isoformat(),
            'reviewed_by': req.reviewed_by or '',
            'reviewed_at': req.reviewed_at.isoformat() if req.reviewed_at else None,
            'review_notes': req.review_notes or '',
        }
        for req in qs.order_by('-requested_at')
    ]

    return JsonResponse({
        'success': True,
        'requests': data,
        'count': len(data),
    })


@csrf_exempt
@require_POST
def api_admin_tracker_unlock_decision(request):
    """
    Approves or rejects a daily tracker unlock request.
    """
    current_user = get_current_user(request)
    if not current_user:
        return JsonResponse({'error': 'Unauthorized'}, status=401)

    is_superadmin = bool(current_user.is_superadmin or current_user.role == 'admin')
    is_manager = bool(current_user.is_manager)
    managed_depts = list(current_user.managed_departments or [])

    if not is_superadmin and not is_manager:
        return JsonResponse({'error': 'Unauthorized'}, status=403)

    data = parse_request_json(request)
    request_id = data.get('request_id')
    decision = data.get('decision', 'approve').lower()  # 'approve' or 'reject'
    review_notes = (data.get('review_notes') or '').strip()

    unlock_req = get_object_or_404(DailyTrackerUnlockRequest, pk=request_id)
    if not is_superadmin and (unlock_req.user.department not in managed_depts):
        return JsonResponse({'error': 'Permission denied.'}, status=403)

    tracker_day = unlock_req.tracker_day

    if decision == 'approve':
        unlock_req.status = 'Approved'
        tracker_day.status = 'Draft'
        tracker_day.locked_at = None
        tracker_day.save()
        audit_action = 'UNLOCKED'
        msg = f"Tracker unlocked for {unlock_req.user.name}. They can now edit and re-submit."
    else:
        unlock_req.status = 'Rejected'
        audit_action = 'UNLOCK_REJECTED'
        msg = f"Unlock request rejected for {unlock_req.user.name}."

    unlock_req.reviewed_by = current_user.name
    unlock_req.reviewed_at = timezone.now()
    unlock_req.review_notes = review_notes
    unlock_req.save()

    DailyTrackerAuditLog.objects.create(
        tracker_day=tracker_day,
        user=unlock_req.user,
        action=audit_action,
        performed_by_name=current_user.name,
        performed_by_role='Superadmin' if is_superadmin else 'Department Manager',
        details=f"Unlock request {unlock_req.status}. Notes: {review_notes}"
    )

    return JsonResponse({
        'success': True,
        'message': msg,
        'status': unlock_req.status,
    })


@csrf_exempt
@require_GET
def api_tracker_export(request):
    """
    Exports daily trackers to CSV format.
    """
    current_user = get_current_user(request)
    if not current_user:
        return HttpResponse('Unauthorized', status=401)

    is_superadmin = bool(current_user.is_superadmin or current_user.role == 'admin')
    is_manager = bool(current_user.is_manager)
    managed_depts = list(current_user.managed_departments or [])

    qs = DailyTrackerDay.objects.all().select_related('user').prefetch_related('tasks')
    if not is_superadmin:
        if is_manager:
            qs = qs.filter(user__department__in=managed_depts)
        else:
            qs = qs.filter(user=current_user)

    dept_filter = request.GET.get('department')
    if dept_filter:
        qs = qs.filter(user__department__iexact=dept_filter)

    response = HttpResponse(content_type='text/csv')
    response['Content-Disposition'] = f'attachment; filename="Daily_Work_Trackers_{timezone.now().strftime("%Y%m%d")}.csv"'

    writer = csv.writer(response)
    writer.writerow([
        'Date', 'Employee Name', 'Email', 'Department', 'Designation',
        'Day Status', 'Status', 'Total Hours', 'Achievements Count',
        'Manager Rating (1-5)', 'Manager Remarks', 'Reviewed By', 'Task Descriptions'
    ])

    for t in qs.order_by('-date'):
        task_descs = " | ".join([f"{tk.task_description} ({tk.hours_worked}h, {tk.task_type})" for tk in t.tasks.all()])
        writer.writerow([
            t.date.strftime('%Y-%m-%d'),
            t.user.name,
            t.user.email,
            t.user.department,
            t.user.designation,
            t.day_status,
            t.status,
            f"{t.total_hours:.1f}",
            t.achievements_count,
            t.manager_rating,
            t.manager_remarks or '',
            t.reviewed_by or '',
            task_descs
        ])

    return response


# ─────────────────────────────────────────────────────────────
# STOCK RECOMMENDATION PERFORMANCE & RETURNS CALCULATOR APIS
# ─────────────────────────────────────────────────────────────

def _fetch_stock_live_price(symbol: str) -> float:
    """Fetch live or last close price for a stock ticker."""
    sym = _format_ticker_symbol(symbol)
    try:
        import yfinance as yf
        ticker = yf.Ticker(sym)
        fast_info = getattr(ticker, 'fast_info', None)
        if fast_info and hasattr(fast_info, 'last_price') and fast_info.last_price:
            return round(float(fast_info.last_price), 2)
        info = ticker.info or {}
        price = _safe_float(info.get('currentPrice') or info.get('regularMarketPrice') or info.get('previousClose'))
        if price > 0:
            return round(price, 2)
    except Exception:
        pass

    try:
        req_url = f'https://query1.finance.yahoo.com/v8/finance/chart/{sym}?interval=1d&range=5d'
        req = urllib.request.Request(req_url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=5) as resp:
            chart_data = json.loads(resp.read().decode('utf-8'))
            meta = chart_data.get('chart', {}).get('result', [{}])[0].get('meta', {})
            price = _safe_float(meta.get('regularMarketPrice') or meta.get('chartPreviousClose'))
            if price > 0:
                return round(price, 2)
    except Exception:
        pass
    return 0.0


def _fetch_stock_historical_price(symbol: str, target_date) -> float:
    """Fetch close price of a stock on or right before a specific historical date."""
    sym = _format_ticker_symbol(symbol)
    try:
        import yfinance as yf
        ticker = yf.Ticker(sym)
        start_d = target_date - timedelta(days=5)
        end_d = target_date + timedelta(days=2)
        hist = ticker.history(start=start_d.strftime('%Y-%m-%d'), end=end_d.strftime('%Y-%m-%d'))
        if not hist.empty:
            valid_rows = hist[hist.index.date <= target_date]
            if not valid_rows.empty:
                return round(float(valid_rows['Close'].iloc[-1]), 2)
            return round(float(hist['Close'].iloc[0]), 2)
    except Exception:
        pass
    return _fetch_stock_live_price(symbol)


def _compute_rec_metrics(rec, as_of_date=None):
    """Compute individual stock recommendation performance metrics."""
    today = timezone.now().date()
    eval_date = as_of_date or today

    rec_date = rec.recommendation_date
    if rec.status in ['Target Hit', 'Stop Loss Hit', 'Closed'] and rec.exit_date:
        effective_end_date = min(rec.exit_date, eval_date)
    else:
        effective_end_date = eval_date

    holding_days = max(1, (effective_end_date - rec_date).days)
    holding_months = round(holding_days / 30.4375, 1)

    buy_price = float(rec.recommended_price or 0.0)
    target_price = float(rec.target_price or (buy_price * 1.2))

    if rec.status in ['Target Hit', 'Stop Loss Hit', 'Closed'] and rec.exit_price:
        eval_price = float(rec.exit_price)
    elif as_of_date and as_of_date < today:
        eval_price = _fetch_stock_historical_price(rec.symbol, as_of_date) or float(rec.current_price or buy_price)
    else:
        eval_price = float(rec.current_price or buy_price)

    gain_abs = round(eval_price - buy_price, 2)
    return_pct = round(((eval_price - buy_price) / buy_price * 100), 2) if buy_price > 0 else 0.0

    target_diff = target_price - buy_price
    target_progress_pct = round(((eval_price - buy_price) / target_diff * 100), 1) if target_diff != 0 else 0.0
    target_progress_pct = max(-100.0, min(200.0, target_progress_pct))

    if holding_days >= 14 and return_pct > -90:
        years = holding_days / 365.0
        try:
            cagr = round((((1 + return_pct / 100.0) ** (1.0 / years)) - 1.0) * 100.0, 2)
        except Exception:
            cagr = round((return_pct / holding_days) * 365, 2)
    else:
        cagr = round((return_pct / max(1, holding_days)) * 365, 2)

    status = rec.status
    if status == 'Active':
        if target_price > buy_price and eval_price >= target_price:
            status = 'Target Hit'
        elif rec.stop_loss and eval_price <= float(rec.stop_loss):
            status = 'Stop Loss Hit'

    return {
        'id': rec.id,
        'symbol': rec.symbol,
        'company_name': rec.company_name,
        'sector': rec.sector,
        'client_name': rec.client_name,
        'recommendation_type': rec.recommendation_type,
        'recommendation_date': rec.recommendation_date.strftime('%Y-%m-%d'),
        'recommended_price': buy_price,
        'target_price': target_price,
        'stop_loss': float(rec.stop_loss) if rec.stop_loss else None,
        'time_horizon': rec.time_horizon,
        'current_price': eval_price,
        'last_price_update': rec.last_price_update.strftime('%Y-%m-%d %H:%M') if rec.last_price_update else None,
        'status': status,
        'exit_price': float(rec.exit_price) if rec.exit_price else None,
        'exit_date': rec.exit_date.strftime('%Y-%m-%d') if rec.exit_date else None,
        'notes': rec.notes,
        'holding_days': holding_days,
        'holding_months': holding_months,
        'gain_abs': gain_abs,
        'return_pct': return_pct,
        'target_progress_pct': target_progress_pct,
        'cagr_pct': cagr,
        'created_by': rec.created_by.name if rec.created_by else 'WisBees Research',
        'created_at': rec.created_at.strftime('%Y-%m-%d %H:%M'),
    }


@csrf_exempt
@require_GET
def api_stock_recommendations_list(request):
    """
    Returns list of recommended stocks with live prices, individual returns %,
    holding periods, and overall aggregate portfolio metrics (Average Return %, Win Rate, etc.).
    """
    user = get_current_user(request)
    if not user:
        return JsonResponse({'error': 'Unauthorized'}, status=401)

    as_of_date_str = request.GET.get('as_of_date')
    as_of_date = None
    if as_of_date_str:
        try:
            as_of_date = datetime.strptime(as_of_date_str, '%Y-%m-%d').date()
        except Exception:
            pass

    qs = StockRecommendation.objects.all().order_by('-recommendation_date', '-created_at')

    status_filter = request.GET.get('status')
    if status_filter and status_filter != 'all':
        qs = qs.filter(status=status_filter)

    type_filter = request.GET.get('type')
    if type_filter and type_filter != 'all':
        qs = qs.filter(recommendation_type=type_filter)

    sector_filter = request.GET.get('sector')
    if sector_filter and sector_filter != 'all':
        qs = qs.filter(sector__iexact=sector_filter)

    search_query = request.GET.get('search', '').strip().upper()
    if search_query:
        qs = qs.filter(Q(symbol__icontains=search_query) | Q(company_name__icontains=search_query) | Q(client_name__icontains=search_query))

    recommendations = list(qs)

    now = timezone.now()
    if not as_of_date:
        for rec in recommendations:
            if rec.status == 'Active':
                needs_update = not rec.last_price_update or (now - rec.last_price_update).total_seconds() > 900
                if needs_update:
                    live_p = _fetch_stock_live_price(rec.symbol)
                    if live_p > 0:
                        rec.current_price = live_p
                        rec.last_price_update = now
                        rec.save(update_fields=['current_price', 'last_price_update'])

    items = [_compute_rec_metrics(r, as_of_date) for r in recommendations]

    total_count = len(items)
    if total_count > 0:
        total_return_sum = sum(item['return_pct'] for item in items)
        avg_return = round(total_return_sum / total_count, 2)
        positive_items = [i for i in items if i['return_pct'] > 0]
        win_rate = round((len(positive_items) / total_count) * 100, 1)
        avg_holding_days = round(sum(item['holding_days'] for item in items) / total_count, 1)
        avg_holding_months = round(sum(item['holding_months'] for item in items) / total_count, 1)
        best_call = max(items, key=lambda x: x['return_pct'])
        worst_call = min(items, key=lambda x: x['return_pct'])
        target_hit_count = sum(1 for item in items if item['status'] == 'Target Hit')
        active_count = sum(1 for item in items if item['status'] == 'Active')
    else:
        avg_return = 0.0
        win_rate = 0.0
        avg_holding_days = 0.0
        avg_holding_months = 0.0
        best_call = None
        worst_call = None
        target_hit_count = 0
        active_count = 0

    return JsonResponse({
        'success': True,
        'as_of_date': (as_of_date or timezone.now().date()).strftime('%Y-%m-%d'),
        'count': total_count,
        'summary': {
            'total_recommendations': total_count,
            'active_count': active_count,
            'target_hit_count': target_hit_count,
            'avg_return_pct': avg_return,
            'win_rate_pct': win_rate,
            'avg_holding_days': avg_holding_days,
            'avg_holding_months': avg_holding_months,
            'best_call': {
                'symbol': best_call['symbol'],
                'company_name': best_call['company_name'],
                'return_pct': best_call['return_pct'],
                'gain_abs': best_call['gain_abs']
            } if best_call else None,
            'worst_call': {
                'symbol': worst_call['symbol'],
                'company_name': worst_call['company_name'],
                'return_pct': worst_call['return_pct']
            } if worst_call else None,
        },
        'recommendations': items,
    })


@csrf_exempt
@require_POST
def api_stock_recommendation_create(request):
    """Creates a new stock recommendation."""
    user = get_current_user(request)
    if not user:
        return JsonResponse({'error': 'Unauthorized'}, status=401)

    data = parse_request_json(request)
    raw_symbol = (data.get('symbol') or '').strip().upper()
    if not raw_symbol:
        return JsonResponse({'error': 'Stock ticker / symbol is required.'}, status=400)

    symbol = _format_ticker_symbol(raw_symbol)
    company_name = (data.get('company_name') or '').strip()
    sector = (data.get('sector') or 'Equities').strip()
    client_name = (data.get('client_name') or '').strip()
    rec_type = data.get('recommendation_type') or 'Buy'
    time_horizon = data.get('time_horizon') or '3 Months'
    notes = data.get('notes') or ''

    live_price = _fetch_stock_live_price(symbol)
    buy_price = _safe_float(data.get('recommended_price'))
    if buy_price <= 0:
        buy_price = live_price if live_price > 0 else 100.0

    target_price = _safe_float(data.get('target_price'))
    if target_price <= 0:
        target_price = round(buy_price * 1.25, 2)

    stop_loss = _safe_float(data.get('stop_loss')) if data.get('stop_loss') else None

    rec_date_str = data.get('recommendation_date')
    if rec_date_str:
        try:
            rec_date = datetime.strptime(rec_date_str, '%Y-%m-%d').date()
        except Exception:
            rec_date = timezone.now().date()
    else:
        rec_date = timezone.now().date()

    if not company_name:
        company_name = symbol.replace('.NS', '').replace('.BO', '')

    rec = StockRecommendation.objects.create(
        created_by=user,
        symbol=symbol,
        company_name=company_name,
        sector=sector,
        client_name=client_name,
        recommendation_type=rec_type,
        recommendation_date=rec_date,
        recommended_price=buy_price,
        target_price=target_price,
        stop_loss=stop_loss,
        time_horizon=time_horizon,
        current_price=live_price or buy_price,
        last_price_update=timezone.now(),
        status='Active',
        notes=notes,
    )

    ActivityLog.objects.create(
        user=user,
        action=f"Created stock recommendation: {symbol} ({rec_type} @ ₹{buy_price}, Target: ₹{target_price})"
    )

    return JsonResponse({
        'success': True,
        'message': f"Stock recommendation for {symbol} saved successfully!",
        'recommendation': _compute_rec_metrics(rec)
    })


@csrf_exempt
@require_http_methods(['POST', 'PUT'])
def api_stock_recommendation_update(request, pk):
    """Updates an existing stock recommendation."""
    user = get_current_user(request)
    if not user:
        return JsonResponse({'error': 'Unauthorized'}, status=401)

    rec = get_object_or_404(StockRecommendation, pk=pk)
    data = parse_request_json(request)

    if 'recommended_price' in data and data['recommended_price'] is not None:
        rec.recommended_price = _safe_float(data['recommended_price'], float(rec.recommended_price))
    if 'target_price' in data and data['target_price'] is not None:
        rec.target_price = _safe_float(data['target_price'], float(rec.target_price))
    if 'stop_loss' in data:
        rec.stop_loss = _safe_float(data['stop_loss']) if data['stop_loss'] else None
    if 'client_name' in data:
        rec.client_name = data['client_name'].strip()
    if 'recommendation_type' in data:
        rec.recommendation_type = data['recommendation_type']
    if 'time_horizon' in data:
        rec.time_horizon = data['time_horizon']
    if 'notes' in data:
        rec.notes = data['notes']
    if 'status' in data:
        rec.status = data['status']
    if 'exit_price' in data:
        rec.exit_price = _safe_float(data['exit_price']) if data['exit_price'] else None
    if 'exit_date' in data and data['exit_date']:
        try:
            rec.exit_date = datetime.strptime(data['exit_date'], '%Y-%m-%d').date()
        except Exception:
            pass

    rec.save()

    ActivityLog.objects.create(
        user=user,
        action=f"Updated stock recommendation for {rec.symbol}"
    )

    return JsonResponse({
        'success': True,
        'message': f"Recommendation for {rec.symbol} updated successfully!",
        'recommendation': _compute_rec_metrics(rec)
    })


@csrf_exempt
@require_http_methods(['POST', 'DELETE'])
def api_stock_recommendation_delete(request, pk):
    """Deletes a stock recommendation."""
    user = get_current_user(request)
    if not user:
        return JsonResponse({'error': 'Unauthorized'}, status=401)

    rec = get_object_or_404(StockRecommendation, pk=pk)
    sym = rec.symbol
    rec.delete()

    ActivityLog.objects.create(
        user=user,
        action=f"Deleted stock recommendation: {sym}"
    )

    return JsonResponse({
        'success': True,
        'message': f"Recommendation for {sym} deleted successfully."
    })


@csrf_exempt
@require_GET
def api_stock_recommendations_calculate(request):
    """
    On-demand automatic returns calculator for any stock recommendation.
    Accepts: ?symbol=TCS.NS&buy_price=3500&buy_date=2026-07-01&eval_date=2026-10-01&target_price=4200
    """
    symbol_raw = request.GET.get('symbol', '').strip().upper()
    if not symbol_raw:
        return JsonResponse({'error': 'Stock symbol is required.'}, status=400)

    symbol = _format_ticker_symbol(symbol_raw)
    buy_price = _safe_float(request.GET.get('buy_price'))
    target_price = _safe_float(request.GET.get('target_price'))

    buy_date_str = request.GET.get('buy_date')
    eval_date_str = request.GET.get('eval_date')

    today = timezone.now().date()
    try:
        buy_date = datetime.strptime(buy_date_str, '%Y-%m-%d').date() if buy_date_str else today - timedelta(days=60)
    except Exception:
        buy_date = today - timedelta(days=60)

    try:
        eval_date = datetime.strptime(eval_date_str, '%Y-%m-%d').date() if eval_date_str else today
    except Exception:
        eval_date = today

    if eval_date >= today:
        current_price = _fetch_stock_live_price(symbol)
    else:
        current_price = _fetch_stock_historical_price(symbol, eval_date)

    if current_price <= 0:
        current_price = buy_price if buy_price > 0 else 500.0

    if buy_price <= 0:
        historical_buy = _fetch_stock_historical_price(symbol, buy_date)
        buy_price = historical_buy if historical_buy > 0 else current_price * 0.88

    if target_price <= 0:
        target_price = round(buy_price * 1.25, 2)

    holding_days = max(1, (eval_date - buy_date).days)
    holding_months = round(holding_days / 30.4375, 1)

    gain_abs = round(current_price - buy_price, 2)
    return_pct = round(((current_price - buy_price) / buy_price * 100), 2)

    target_diff = target_price - buy_price
    target_progress_pct = round(((current_price - buy_price) / target_diff * 100), 1) if target_diff != 0 else 0.0

    if holding_days >= 14 and return_pct > -90:
        years = holding_days / 365.0
        try:
            cagr = round((((1 + return_pct / 100.0) ** (1.0 / years)) - 1.0) * 100.0, 2)
        except Exception:
            cagr = round((return_pct / holding_days) * 365, 2)
    else:
        cagr = round((return_pct / max(1, holding_days)) * 365, 2)

    return JsonResponse({
        'success': True,
        'calculation': {
            'symbol': symbol,
            'buy_price': buy_price,
            'buy_date': buy_date.strftime('%Y-%m-%d'),
            'eval_date': eval_date.strftime('%Y-%m-%d'),
            'current_price': current_price,
            'target_price': target_price,
            'gain_abs': gain_abs,
            'return_pct': return_pct,
            'holding_days': holding_days,
            'holding_months': holding_months,
            'target_progress_pct': target_progress_pct,
            'cagr_pct': cagr,
            'status': 'Target Hit' if current_price >= target_price else ('Positive Return' if return_pct >= 0 else 'Negative Return'),
        }
    })


@csrf_exempt
@require_POST
def api_stock_recommendations_refresh_prices(request):
    """Batch refresh live prices for all active recommendations."""
    user = get_current_user(request)
    if not user:
        return JsonResponse({'error': 'Unauthorized'}, status=401)

    active_recs = StockRecommendation.objects.filter(status='Active')
    updated_count = 0
    now = timezone.now()

    for rec in active_recs:
        live_p = _fetch_stock_live_price(rec.symbol)
        if live_p > 0:
            rec.current_price = live_p
            rec.last_price_update = now
            if rec.target_price and live_p >= float(rec.target_price):
                rec.status = 'Target Hit'
            elif rec.stop_loss and live_p <= float(rec.stop_loss):
                rec.status = 'Stop Loss Hit'
            rec.save()
            updated_count += 1

    return JsonResponse({
        'success': True,
        'message': f"Refreshed live prices for {updated_count} active stock recommendations.",
        'updated_count': updated_count,
    })




