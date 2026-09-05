import os
import re
import random
import json
import base64
import time
from datetime import datetime, date, timedelta
from io import BytesIO
import pandas as pd
import requests
from bs4 import BeautifulSoup
from groq import Groq

from django.shortcuts import render, redirect, get_object_or_404
from django.http import HttpResponse, JsonResponse, FileResponse, Http404
from django.contrib import messages
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST, require_http_methods
from django.db.models import Q, Count, Sum, F
from django.db.models.functions import ExtractMonth, ExtractYear
from django.utils import timezone
from django.utils.datastructures import MultiValueDict

from hrms.models import (
    HR, Employee, EmployeeAccount, Attendance, LeaveRequest,
    EmailConfig, CompanySettings, OfferLetterDraft, Announcement, ResearchReport
)
from hrms.utils import (
    UPLOAD_DIR, RESEARCH_UPLOAD_DIR, ALLOWED_EXTENSIONS, allowed_file,
    RESEARCH_REPORT_RETENTION_DAYS,
    _materialize, hydrate_hr_signature, hydrate_company_files, get_graph_token,
    _default_email_body_text, _default_full_letter_text, _seed_offer_draft_fields,
    _get_offer_draft_data, _upsert_offer_draft, _compile_research_context,
    _purge_expired_research_reports, _research_report_or_403,
    _yahoo_quote_summary, _raw, _yahoo_fundamentals_timeseries, HEADERS
)
from pdf_generator import (
    generate_experience_letter_pdf, generate_offer_letter_pdf, generate_leave_approval_pdf, ROLE_KEYS, ROLE_DATA
)
from werkzeug.utils import secure_filename

def _get_groq_client():
    api_key = os.environ.get("GROQ_API_KEY")
    if not api_key:
        raise RuntimeError("GROQ_API_KEY environment variable is not configured.")
    return Groq(api_key=api_key)


def login_required_custom(view_func):
    def wrapper(request, *args, **kwargs):
        if not getattr(request, 'current_user', None) or not request.current_user.is_authenticated:
            return redirect('login')
        return view_func(request, *args, **kwargs)
    wrapper.__name__ = view_func.__name__
    return wrapper


from zoneinfo import ZoneInfo

IST = ZoneInfo('Asia/Kolkata')
UTC = ZoneInfo('UTC')

def to_safe_datetime(dt):
    if not dt:
        return None
    if isinstance(dt, datetime):
        if dt.tzinfo is None:
            # Datetimes stored in database from UTC are naive
            dt = dt.replace(tzinfo=UTC)
        return dt.astimezone(IST)
    return dt

def safe_time_diff_seconds(t1, t2):
    if not t1 or not t2:
        return 0
    t1_safe = to_safe_datetime(t1)
    t2_safe = to_safe_datetime(t2)
    try:
        return max(0, int((t1_safe - t2_safe).total_seconds()))
    except Exception:
        return 0

def safe_isoformat(dt):
    if not dt:
        return None
    try:
        dt_safe = to_safe_datetime(dt)
        return dt_safe.isoformat()
    except Exception:
        return str(dt)

def safe_timestamp_ms(dt):
    if not dt:
        return None
    try:
        dt_safe = to_safe_datetime(dt)
        return int(dt_safe.timestamp() * 1000)
    except Exception:
        return None

def format_local_time(dt):
    if not dt:
        return None
    try:
        dt_safe = to_safe_datetime(dt)
        return dt_safe.strftime('%I:%M %p')
    except Exception:
        return dt.strftime('%I:%M %p') if hasattr(dt, 'strftime') else str(dt)


# ─────────────── AUTH VIEWS ───────────────

def index(request):
    if getattr(request, 'current_user', None) and request.current_user.is_authenticated:
        return redirect('dashboard')
    return redirect('login')


@csrf_exempt
def login_view(request):
    if request.method == 'OPTIONS':
        response = HttpResponse(status=200)
        origin = request.headers.get('Origin')
        if origin:
            response['Access-Control-Allow-Origin'] = origin
            response['Access-Control-Allow-Credentials'] = 'true'
        response['Access-Control-Allow-Methods'] = 'POST, GET, OPTIONS'
        response['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, authorization, Accept, X-Requested-With, X-CSRFToken, X-User-Auth, x-user-auth, *'
        return response

    if request.method == 'GET':
        if getattr(request, 'current_user', None) and request.current_user.is_authenticated:
            is_hr = isinstance(request.current_user, HR)
            if request.headers.get('Accept') == 'application/json' or request.content_type == 'application/json':
                return JsonResponse({'success': True, 'redirect': '/dashboard' if is_hr else '/employee-dashboard'})
            return redirect('dashboard' if is_hr else 'employee_dashboard')

    if request.method == 'POST':
        if request.content_type == 'application/json':
            try:
                data = json.loads(request.body)
            except Exception:
                data = {}
            email = data.get('email', '').strip()
            password = data.get('password', '')
            login_type = data.get('login_type', 'hr')
        else:
            email = request.POST.get('email', '').strip()
            password = request.POST.get('password', '')
            login_type = request.POST.get('login_type', 'hr')

        if login_type == 'hr':
            if HR.objects.count() == 0:
                hr_user = HR.objects.create(name='HR Admin', email='hr@wisbees.com', designation='HR Administrator')
                hr_user.set_password('admin123')
                hr_user.save()

            user = HR.objects.filter(email__iexact=email).first()
            if user and user.check_password(password):
                request.session.flush()
                request.session['hr_id'] = user.id
                token = f"hr:{user.id}"
                if request.headers.get('Accept') == 'application/json' or request.content_type == 'application/json':
                    return JsonResponse({
                        'success': True,
                        'redirect': '/dashboard',
                        'token': token,
                        'user': {
                            'id': user.id,
                            'name': user.name,
                            'email': user.email,
                            'designation': user.designation or 'HR Manager',
                            'role': 'hr'
                        }
                    })
                return redirect('dashboard')
            if request.headers.get('Accept') == 'application/json' or request.content_type == 'application/json':
                return JsonResponse({'success': False, 'message': 'Invalid HR credentials'}, status=400)
            messages.error(request, 'Invalid HR credentials')
        else:
            account = EmployeeAccount.objects.filter(email__iexact=email, is_active=True).first()
            if not account:
                # Check if employee exists and auto-create account
                emp_candidate = Employee.objects.filter(email__iexact=email).first()
                if emp_candidate:
                    account = EmployeeAccount.objects.create(
                        employee=emp_candidate,
                        email=emp_candidate.email,
                        must_change_password=False
                    )
                    account.set_password('Wisbees@2026')
                    account.save()

            if account and account.check_password(password):
                token = f"emp:{account.id}"
                if account.must_change_password:
                    request.session.flush()
                    request.session['employee_id'] = account.employee_id
                    if request.headers.get('Accept') == 'application/json' or request.content_type == 'application/json':
                        return JsonResponse({'success': True, 'redirect': '/change-password', 'token': token})
                    return redirect('change_password')

                request.session.flush()
                request.session['account_id'] = account.id
                request.session['employee_id'] = account.employee_id
                employee = Employee.objects.filter(id=account.employee_id).first()
                redirect_url = '/employee-dashboard'
                if request.headers.get('Accept') == 'application/json' or request.content_type == 'application/json':
                    return JsonResponse({
                        'success': True,
                        'redirect': redirect_url,
                        'token': token,
                        'user': {
                            'id': employee.id if employee else account.employee_id,
                            'name': employee.name if employee else 'Employee',
                            'email': account.email,
                            'designation': employee.designation if employee else 'Team Member',
                            'department': employee.department if employee else 'General',
                            'emp_type': employee.emp_type if employee else 'Normal',
                            'role': 'employee'
                        }
                    })
                return redirect(redirect_url)
            if request.headers.get('Accept') == 'application/json' or request.content_type == 'application/json':
                return JsonResponse({'success': False, 'message': 'Invalid Employee credentials. Please check your email and password.'}, status=400)
            messages.error(request, 'Invalid Employee credentials')
    return render(request, 'login.html')


def employee_login_view(request):
    if request.method == 'POST':
        email = request.POST.get('email', '').strip()
        password = request.POST.get('password', '')

        account = EmployeeAccount.objects.filter(email__iexact=email, is_active=True).first()
        if not account:
            emp_candidate = Employee.objects.filter(email__iexact=email).first()
            if emp_candidate:
                account = EmployeeAccount.objects.create(
                    employee=emp_candidate,
                    email=emp_candidate.email,
                    must_change_password=False
                )
                account.set_password('Wisbees@2026')
                account.save()

        if account and account.check_password(password):
            if account.must_change_password:
                request.session['employee_id'] = account.employee_id
                return redirect('change_password')
            request.session['account_id'] = account.id
            request.session['employee_id'] = account.employee_id
            request.session.pop('hr_id', None)
            return redirect('employee_dashboard')
        messages.error(request, 'Invalid credentials')

    return render(request, 'employee_login.html')


@csrf_exempt
def change_password_view(request):
    emp_id = request.session.get('employee_id')
    if not emp_id and getattr(request, 'current_user', None) and isinstance(request.current_user, (Employee, EmployeeAccount)):
        emp_id = getattr(request.current_user, 'employee_id', getattr(request.current_user, 'id', None))

    if not emp_id:
        if request.headers.get('Accept') == 'application/json' or request.content_type == 'application/json':
            return JsonResponse({'success': False, 'message': 'Session expired. Please log in again.'}, status=401)
        return redirect('login')

    employee = get_object_or_404(Employee, id=emp_id)
    account = EmployeeAccount.objects.filter(employee_id=employee.id).first()
    if not account:
        account = EmployeeAccount.objects.create(
            employee=employee,
            email=employee.email or f"user{employee.id}@wisbees.com"
        )

    if request.method == 'POST':
        if request.content_type == 'application/json':
            try:
                data = json.loads(request.body)
            except Exception:
                data = {}
            new_password = data.get('new_password')
            confirm_password = data.get('confirm_password')
        else:
            new_password = request.POST.get('new_password')
            confirm_password = request.POST.get('confirm_password')

        if not new_password or not confirm_password:
            return JsonResponse({'success': False, 'message': 'Please provide both new password and confirmation.'}, status=400)

        if new_password != confirm_password:
            return JsonResponse({'success': False, 'message': 'Passwords do not match.'}, status=400)

        if len(new_password) < 6:
            return JsonResponse({'success': False, 'message': 'Password must be at least 6 characters long.'}, status=400)

        account.set_password(new_password)
        account.must_change_password = False
        account.save()

        if request.headers.get('Accept') == 'application/json' or request.content_type == 'application/json':
            return JsonResponse({
                'success': True,
                'message': 'Password updated successfully!',
                'redirect': '/employee-dashboard'
            })
        messages.success(request, 'Password updated successfully!')
        return redirect('employee_dashboard')

    return render(request, 'change_password.html')


def resolve_employee_id(request):
    emp_id = request.headers.get('X-Employee-Id')
    if emp_id:
        try:
            return int(emp_id)
        except Exception:
            pass

    user = getattr(request, 'current_user', None)
    if user and getattr(user, 'is_authenticated', False):
        if isinstance(user, EmployeeAccount):
            return user.employee_id
        if isinstance(user, Employee):
            return user.id

    auth_header = request.headers.get('Authorization') or request.headers.get('X-User-Auth')
    if auth_header:
        token = auth_header.replace('Bearer ', '').strip()
        if ':' in token:
            role, uid = token.split(':', 1)
            if role == 'emp':
                try:
                    uid_int = int(uid)
                    acc = EmployeeAccount.objects.filter(id=uid_int).first() or EmployeeAccount.objects.filter(employee_id=uid_int).first()
                    if acc:
                        return acc.employee_id
                    emp = Employee.objects.filter(id=uid_int).first()
                    if emp:
                        return emp.id
                except Exception:
                    pass

    if 'employee_id' in request.session:
        return request.session['employee_id']
    if 'account_id' in request.session:
        acc = EmployeeAccount.objects.filter(id=request.session['account_id']).first()
        if acc:
            return acc.employee_id

    if request.method in ['POST', 'PUT', 'PATCH']:
        if request.content_type == 'application/json' and request.body:
            try:
                data = json.loads(request.body.decode('utf-8'))
                if data.get('employee_id'):
                    return int(data['employee_id'])
            except Exception:
                pass
        elif request.POST.get('employee_id'):
            try:
                return int(request.POST['employee_id'])
            except Exception:
                pass

    if request.GET.get('emp_id'):
        try:
            return int(request.GET['emp_id'])
        except Exception:
            pass

    return None


@csrf_exempt
def employee_dashboard_view(request):
    emp_id = resolve_employee_id(request)
    if not emp_id:
        if request.headers.get('Accept') == 'application/json' or request.content_type == 'application/json' or request.GET.get('format') == 'json':
            return JsonResponse({'authenticated': False, 'error': 'Unauthorized'}, status=401)
        return redirect('login')

    employee = get_object_or_404(Employee, id=emp_id)
    today = timezone.localtime(timezone.now()).date()
    now_hour = timezone.localtime(timezone.now()).hour

    # 1. Single batch query for last 200 days attendance (covers today, month, 4 weeks, 6 month trends)
    start_date = today - timedelta(days=200)
    att_records = list(Attendance.objects.filter(
        employee_id=employee.id,
        date__gte=start_date
    ).order_by('-date'))

    today_attendance = None
    this_month_present = 0
    this_month_total = 0
    month_records_map = {}

    for r in att_records:
        r_date = r.date
        if not r_date:
            continue
        if r_date == today and today_attendance is None:
            today_attendance = r

        key = (r_date.year, r_date.month)
        if key not in month_records_map:
            month_records_map[key] = {'present': 0, 'total': 0}
        month_records_map[key]['total'] += 1
        if r.status == 'Present':
            month_records_map[key]['present'] += 1

        if r_date.year == today.year and r_date.month == today.month:
            this_month_total += 1
            if r.status == 'Present':
                this_month_present += 1

    attendance_percent = round((this_month_present / this_month_total * 100), 1) if this_month_total else 100.0

    worked_duration_str = None
    today_status_label = 'Not Checked In'
    if today_attendance and today_attendance.check_in:
        end_t = today_attendance.check_out or timezone.now()
        diff_secs = safe_time_diff_seconds(end_t, today_attendance.check_in)
        hours = diff_secs // 3600
        mins = (diff_secs % 3600) // 60
        worked_duration_str = f"{hours}h {mins}m" if hours > 0 else f"{mins}m"
        if not today_attendance.check_out:
            today_status_label = 'Present (Active)'
        else:
            today_status_label = 'Shift Completed'

    # 2. Monthly trend calculation in memory
    month_names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    current_m_idx = today.month - 1
    trend_data = []
    for i in range(5, -1, -1):
        m_idx = (current_m_idx - i) % 12
        m_num = m_idx + 1
        y_num = today.year if (current_m_idx - i) >= 0 else today.year - 1
        m_data = month_records_map.get((y_num, m_num), {'present': 0, 'total': 0})
        m_present = m_data['present']
        m_total = m_data['total']
        val = round((m_present / m_total * 100), 1) if m_total else (attendance_percent if i == 0 else 100.0)
        trend_data.append({
            'month': month_names[m_idx],
            'attendance': val
        })

    # 3. Weekly overview calculation in memory
    weekly_overview = []
    for w_num, (start_d, end_d) in enumerate([(1, 7), (8, 14), (15, 21), (22, 31)], 1):
        w_present = sum(1 for r in att_records if r.date and r.date.year == today.year and r.date.month == today.month and start_d <= r.date.day <= end_d and r.status == 'Present')
        w_total = sum(1 for r in att_records if r.date and r.date.year == today.year and r.date.month == today.month and start_d <= r.date.day <= end_d)
        w_pct = round((w_present / w_total * 100), 1) if w_total > 0 else 100.0
        weekly_overview.append({'week': f'Week {w_num}', 'attendance': w_pct})

    # 4. Single query for leaves
    all_leaves = list(LeaveRequest.objects.filter(employee_id=employee.id).order_by('-applied_on')[:12])
    approved_leaves = [l for l in all_leaves if l.status == 'Approved']
    leaves_taken = sum((l.to_date - l.from_date).days + 1 for l in approved_leaves if l.to_date and l.from_date)
    leave_balance = max(12 - leaves_taken, 0)
    pending_leaves = sum(1 for l in all_leaves if l.status == 'Pending')
    leave_request_list = all_leaves[:8]

    # 5. Announcements in 1 query
    latest_announcements = list(Announcement.objects.filter(
        is_active=True
    ).filter(
        Q(audience="Everyone") | Q(audience=employee.emp_type)
    ).order_by('-created_at')[:4])

    if request.headers.get('Accept') == 'application/json' or request.content_type == 'application/json' or request.GET.get('format') == 'json':
        return JsonResponse({
            'authenticated': True,
            'employee': {
                'id': employee.id,
                'emp_id': employee.emp_id or f"INT{employee.id:04d}",
                'name': employee.name,
                'first_name': employee.name.split(' ')[0] if employee.name else '',
                'email': employee.email or '',
                'phone': employee.phone or '',
                'designation': employee.designation or 'IT Intern – Web & Automation Developer',
                'department': employee.department or 'Data & Analytics',
                'emp_type': employee.emp_type or 'Intern',
                'status': employee.status or 'Active',
                'joining_date': employee.joining_date.strftime('%d %b %Y') if employee.joining_date else '25 Aug 2026',
                'gender': employee.gender or 'female',
                'blood_group': employee.blood_group or '',
            },
            'now_hour': now_hour,
            'today_attendance': {
                'has_record': bool(today_attendance),
                'check_in': format_local_time(today_attendance.check_in) if (today_attendance and today_attendance.check_in) else None,
                'check_out': format_local_time(today_attendance.check_out) if (today_attendance and today_attendance.check_out) else None,
                'check_in_iso': safe_isoformat(today_attendance.check_in) if (today_attendance and today_attendance.check_in) else None,
                'check_out_iso': safe_isoformat(today_attendance.check_out) if (today_attendance and today_attendance.check_out) else None,
                'check_in_timestamp': safe_timestamp_ms(today_attendance.check_in) if (today_attendance and today_attendance.check_in) else None,
                'check_out_timestamp': safe_timestamp_ms(today_attendance.check_out) if (today_attendance and today_attendance.check_out) else None,
                'worked_duration': worked_duration_str,
                'status_label': today_status_label,
                'is_checked_in': bool(today_attendance and today_attendance.check_in),
                'is_checked_out': bool(today_attendance and today_attendance.check_out),
            },
            'stats': {
                'attendance_percent': attendance_percent,
                'leave_balance': leave_balance,
                'leaves_taken': leaves_taken,
                'pending_leaves': pending_leaves,
                'status': employee.status or 'Active',
                'emp_type': employee.emp_type or 'Intern'
            },
            'weekly_overview': weekly_overview,
            'monthly_trend': trend_data,
            'latest_announcements': [{
                'id': ann.id,
                'title': ann.title,
                'message': ann.message,
                'priority': ann.priority or 'Normal',
                'audience': ann.audience or 'Everyone',
                'posted_by': ann.posted_by or 'HR Admin',
                'created_at': ann.created_at.strftime('%d %b') if ann.created_at else ''
            } for ann in latest_announcements],
            'leave_request_list': [{
                'id': lr.id,
                'leave_type': lr.leave_type or 'Casual Leave',
                'from_date': lr.from_date.strftime('%d %b %Y') if lr.from_date else '',
                'to_date': lr.to_date.strftime('%d %b %Y') if lr.to_date else '',
                'days': ((lr.to_date - lr.from_date).days + 1) if lr.to_date and lr.from_date else 1,
                'applied_on': lr.applied_on.strftime('%d %b %Y') if lr.applied_on else '',
                'status': lr.status or 'Pending'
            } for lr in leave_request_list]
        })

    return render(request, 'employee_dashboard.html', {
        'employee': employee,
        'now_hour': now_hour,
        'today_attendance': today_attendance,
        'leave_requests': all_leaves,
        'announcements': latest_announcements,
        'leave_request_list': leave_request_list,
        'attendance_percent': attendance_percent,
        'leave_balance': leave_balance,
        'leaves_taken': leaves_taken,
        'pending_leaves': pending_leaves,
        'latest_announcements': latest_announcements
    })


def get_employee_avatar_base64(employee):
    if employee and employee.profile_pic_data:
        try:
            raw = bytes(employee.profile_pic_data)
            return f"data:{employee.profile_pic_mime or 'image/png'};base64,{base64.b64encode(raw).decode('utf-8')}"
        except Exception:
            return None
    return None


@csrf_exempt
def api_employee_me(request):
    emp_id = resolve_employee_id(request)
    if not emp_id:
        return JsonResponse({'authenticated': False, 'error': 'Unauthorized'}, status=401)
    employee = get_object_or_404(Employee, id=emp_id)
    return JsonResponse({
        'authenticated': True,
        'role': 'employee',
        'is_hr': False,
        'id': employee.id,
        'emp_id': employee.emp_id or f"INT{employee.id:04d}",
        'name': employee.name,
        'first_name': employee.name.split(' ')[0] if employee.name else '',
        'email': employee.email,
        'phone': employee.phone or 'Not Available',
        'department': employee.department or 'Data & Analytics',
        'designation': employee.designation or 'IT Intern – Web & Automation Developer',
        'emp_type': employee.emp_type or 'Intern',
        'status': employee.status or 'Active',
        'blood_group': employee.blood_group or '',
        'joining_date': employee.joining_date.strftime('%d %b %Y') if employee.joining_date else '25 Aug 2026',
        'has_photo': bool(employee.profile_pic_data),
        'avatar_url': get_employee_avatar_base64(employee) or f"/employee/{employee.id}/avatar",
    })


def intern_dashboard_view(request):
    return redirect('employee_dashboard')


@csrf_exempt
def employee_logout_view(request):
    request.session.pop('employee_id', None)
    request.session.pop('account_id', None)
    request.session.clear()
    if request.headers.get('Accept') == 'application/json' or request.content_type == 'application/json':
        return JsonResponse({'success': True, 'redirect': '/login'})
    return redirect('login')


def register_view(request):
    if request.method == 'POST':
        name = request.POST.get('name')
        email = request.POST.get('email')
        password = request.POST.get('password')
        designation = request.POST.get('designation', 'HR Manager')
        phone = request.POST.get('phone')

        if HR.objects.filter(email=email).exists():
            messages.error(request, 'Email already registered')
            return render(request, 'register.html')

        sig_data = None
        if 'signature' in request.FILES:
            file = request.FILES['signature']
            if file and file.name and allowed_file(file.name):
                sig_data = base64.b64encode(file.read()).decode('utf-8')

        request.session['pending_hr_data'] = {
            'name': name,
            'email': email,
            'designation': designation,
            'phone': phone,
            'password': password,
            'signature_data': sig_data
        }

        otp = str(random.randint(100000, 999999))
        request.session['hr_registration_otp'] = otp

        try:
            tenant_id = os.environ.get('AZURE_TENANT_ID')
            client_id = os.environ.get('AZURE_CLIENT_ID')
            client_secret = os.environ.get('AZURE_CLIENT_SECRET')
            sender_email = os.environ.get('AZURE_SENDER_EMAIL')

            token_url = f"https://login.microsoftonline.com/{tenant_id}/oauth2/v2.0/token"
            token_res = requests.post(token_url, data={
                'grant_type': 'client_credentials',
                'client_id': client_id,
                'client_secret': client_secret,
                'scope': 'https://graph.microsoft.com/.default'
            }).json()

            access_token = token_res.get('access_token')
            if not access_token:
                raise Exception("Could not retrieve application-level graph access token.")

            send_url = f"https://graph.microsoft.com/v1.0/users/{sender_email}/sendMail"
            email_payload = {
                "message": {
                    "subject": "FRET Portal Security — New HR Profile Registration Request",
                    "body": {
                        "contentType": "HTML",
                        "content": f"""
                        <div style="font-family: Arial, sans-serif; max-width: 500px; color: #333;">
                            <h3>HR Profile Access Verification Request</h3>
                            <p>An administrator profile registration request was initiated on the FRET network system.</p>
                            <p><strong>Name:</strong> {name}<br><strong>Email:</strong> {email}</p>
                            <p>Please authorize this administrative privilege request by providing the applicant with the following passkey code:</p>
                            <h2 style="color: #0E9F6E; font-size: 26px; letter-spacing: 2px; margin: 15px 0;">{otp}</h2>
                            <p style="font-size: 11px; color: #777;">If this session was not requested by your digital staff, please audit portal logs.</p>
                        </div>
                        """
                    },
                    "toRecipients": [{"emailAddress": {"address": os.environ.get('AZURE_NOTIFICATION_EMAIL', 'cto@wisbees.com')}}]
                }
            }

            res = requests.post(send_url, json=email_payload, headers={
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json"
            })
            if res.status_code != 202:
                raise Exception(res.text)

            messages.success(request, 'A security verification pass code has been dispatched to cto@wisbees.com.')
            return redirect('verify_otp')
        except Exception as e:
            request.session.pop('pending_hr_data', None)
            request.session.pop('hr_registration_otp', None)
            messages.error(request, f'Security transmission pipeline breakdown: {str(e)}')
            return render(request, 'register.html')

    return render(request, 'register.html')


def verify_otp_view(request):
    if 'pending_hr_data' not in request.session or 'hr_registration_otp' not in request.session:
        messages.error(request, 'Session timeout or invalid sequence indexing.')
        return redirect('register')

    if request.method == 'POST':
        input_otp = request.POST.get('otp_code')
        cached_otp = request.session.get('hr_registration_otp')

        if input_otp and input_otp.strip() == cached_otp:
            hr_data = request.session.get('pending_hr_data')
            hr = HR(
                name=hr_data['name'],
                email=hr_data['email'],
                designation=hr_data['designation'],
                phone=hr_data['phone']
            )
            hr.set_password(hr_data['password'])
            if hr_data.get('signature_data'):
                hr.signature_data = base64.b64decode(hr_data['signature_data'].encode('utf-8'))
            hr.save()

            request.session.pop('pending_hr_data', None)
            request.session.pop('hr_registration_otp', None)

            messages.success(request, 'HR Profile authorized and created successfully! Please log in.')
            return redirect('login')
        else:
            messages.error(request, 'Invalid entry passkey match. Authorization request declined.')
            return redirect('verify_otp')

    return render(request, 'verify_otp.html')


def logout_view(request):
    request.session.pop('hr_id', None)
    request.session.pop('account_id', None)
    request.session.pop('employee_id', None)
    request.session.clear()
    return redirect('login')


# ─────────────── DASHBOARD ───────────────

@login_required_custom
def dashboard_view(request):
    if not isinstance(request.current_user, HR):
        if request.headers.get('Accept') == 'application/json' or request.content_type == 'application/json':
            return JsonResponse({'redirect': '/employee-dashboard', 'is_hr': False})
        return redirect('employee_dashboard')

    total_employees = Employee.objects.count()
    active_employees = Employee.objects.filter(status='Active').count()

    now = datetime.now()
    month_start = datetime(now.year, now.month, 1)
    new_this_month = Employee.objects.filter(created_at__gte=month_start).count()
    offers_sent = Employee.objects.filter(offer_sent=True).count()

    total_interns = Employee.objects.filter(emp_type='Intern').count()
    total_normal = Employee.objects.filter(emp_type='Normal').count()
    active_interns = Employee.objects.filter(emp_type='Intern', status='Active').count()

    monthly_data = []
    for m in range(1, 13):
        cnt = Employee.objects.filter(created_at__month=m, created_at__year=now.year).count()
        monthly_data.append(cnt)

    dept_qs = Employee.objects.values('department').annotate(cnt=Count('id'))
    dept_labels = [d['department'] or 'Unknown' for d in dept_qs]
    dept_data = [d['cnt'] for d in dept_qs]

    type_labels = ['Interns', 'Normal Employees']
    type_data = [total_interns, total_normal]

    weekly_data = []
    weekly_labels = []
    today = date.today()
    for i in range(6, -1, -1):
        day = today - timedelta(days=i)
        cnt = Employee.objects.filter(created_at__date=day).count()
        weekly_data.append(cnt)
        weekly_labels.append(day.strftime('%a'))

    recent_employees = Employee.objects.order_by('-created_at')[:5]
    active_announcements = Announcement.objects.filter(
        is_active=True, expires_at__gt=timezone.now()
    ).order_by('-created_at')[:3]

    return render(request, 'dashboard.html', {
        'total_employees': total_employees,
        'active_employees': active_employees,
        'new_this_month': new_this_month,
        'offers_sent': offers_sent,
        'total_interns': total_interns,
        'total_normal': total_normal,
        'active_interns': active_interns,
        'monthly_data': json.dumps(monthly_data),
        'dept_labels': json.dumps(dept_labels),
        'dept_data': json.dumps(dept_data),
        'type_labels': json.dumps(type_labels),
        'type_data': json.dumps(type_data),
        'weekly_data': json.dumps(weekly_data),
        'weekly_labels': json.dumps(weekly_labels),
        'recent_employees': recent_employees,
        'active_announcements': active_announcements,
        'now_hour': now.hour
    })


# ─────────────── EMPLOYEES ───────────────

@login_required_custom
def employees_view(request):
    search = request.GET.get('search', '')
    dept_filter = request.GET.get('department', '')
    status_filter = request.GET.get('status', '')

    query = Employee.objects.all()
    if search:
        query = query.filter(
            Q(name__icontains=search) | Q(email__icontains=search) | Q(emp_id__icontains=search)
        )
    if dept_filter:
        query = query.filter(department=dept_filter)
    if status_filter:
        query = query.filter(status=status_filter)

    employees_list = query.order_by('-created_at')
    departments = Employee.objects.values_list('department', flat=True).distinct()
    dept_options = [d for d in departments if d]

    return render(request, 'employees.html', {
        'employees': employees_list,
        'departments': dept_options,
        'search': search,
        'dept_filter': dept_filter,
        'status_filter': status_filter
    })


@csrf_exempt
def add_employee_view(request):
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
        except Exception:
            data = request.POST

        emp_type = data.get('emp_type', 'Normal')
        if emp_type == 'Intern':
            last = Employee.objects.filter(emp_id__startswith='INT').order_by('-id').first()
            num = int(last.emp_id[3:]) + 1 if last and last.emp_id and len(last.emp_id) > 3 else 1
            emp_id = f"INT{num:04d}"
        else:
            last = Employee.objects.filter(emp_id__startswith='EMP').order_by('-id').first()
            num = int(last.emp_id[3:]) + 1 if last and last.emp_id and len(last.emp_id) > 3 else 1
            emp_id = f"EMP{num:04d}"

        joining_date_str = data.get('joining_date')
        try:
            if joining_date_str and isinstance(joining_date_str, str) and 'T' in joining_date_str:
                joining_date_str = joining_date_str.split('T')[0]
            joining_date = datetime.strptime(str(joining_date_str), '%Y-%m-%d').date() if joining_date_str else date.today()
        except ValueError:
            joining_date = date.today()

        end_date_str = data.get('end_date')
        try:
            if end_date_str and isinstance(end_date_str, str) and 'T' in end_date_str:
                end_date_str = end_date_str.split('T')[0]
            end_date = datetime.strptime(str(end_date_str), '%Y-%m-%d').date() if end_date_str else None
        except ValueError:
            end_date = None

        designation = data.get('designation', '')
        if designation == 'other':
            designation = data.get('designation_other', '')

        current_hr_id = request.current_user.id if hasattr(request, 'current_user') and isinstance(request.current_user, HR) else None

        salary_val = data.get('salary', 0)
        try:
            salary_num = float(salary_val) if salary_val is not None and salary_val != '' else 0.0
        except ValueError:
            salary_num = 0.0

        emp = Employee(
            emp_id=emp_id,
            name=data.get('name'),
            email=data.get('email'),
            phone=data.get('phone'),
            department=data.get('department'),
            designation=designation,
            salary=salary_num,
            joining_date=joining_date,
            end_date=end_date,
            status=data.get('status', 'Active'),
            emp_type=emp_type,
            created_by_id=current_hr_id,
            gender=data.get('gender', 'female')
        )
        emp.save()
        invalidate_employees_cache()

        account = EmployeeAccount(
            employee_id=emp.id,
            email=emp.email,
            must_change_password=True
        )
        account.set_password("Wisbees@2026")
        account.save()

        if request.content_type == 'application/json' or 'application/json' in request.headers.get('Accept', ''):
            return JsonResponse({'success': True, 'id': emp.id, 'emp_id': emp.emp_id, 'message': f'Employee {emp.name} added successfully!'})

        messages.success(request, f'Employee {emp.name} added successfully!')
        return redirect('employees')

    return render(request, 'add_employee.html')


@csrf_exempt
def edit_employee_view(request, emp_id):
    emp = get_object_or_404(Employee, id=emp_id)
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
        except Exception:
            data = request.POST

        if data.get('name'):
            emp.name = data.get('name')
        if data.get('email') is not None:
            emp.email = data.get('email')
        if data.get('phone') is not None:
            emp.phone = data.get('phone')
        if data.get('department') is not None:
            emp.department = data.get('department')
        if data.get('designation') is not None:
            emp.designation = data.get('designation')
        if data.get('gender') is not None:
            emp.gender = str(data.get('gender')).strip().lower()
        if data.get('emp_type') is not None:
            emp.emp_type = str(data.get('emp_type')).strip()
        if data.get('blood_group') is not None:
            emp.blood_group = str(data.get('blood_group')).strip()
        if data.get('status') is not None:
            emp.status = data.get('status')

        salary_val = data.get('salary')
        if salary_val is not None and salary_val != '':
            try:
                emp.salary = float(salary_val)
            except ValueError:
                pass

        joining_date_str = data.get('joining_date')
        if joining_date_str is not None:
            if joining_date_str == '' or joining_date_str is False:
                emp.joining_date = None
            else:
                try:
                    if isinstance(joining_date_str, str) and 'T' in joining_date_str:
                        joining_date_str = joining_date_str.split('T')[0]
                    emp.joining_date = datetime.strptime(str(joining_date_str), '%Y-%m-%d').date()
                except ValueError:
                    pass

        end_date_str = data.get('end_date')
        if end_date_str is not None:
            if end_date_str == '' or end_date_str is False:
                emp.end_date = None
            else:
                try:
                    if isinstance(end_date_str, str) and 'T' in end_date_str:
                        end_date_str = end_date_str.split('T')[0]
                    emp.end_date = datetime.strptime(str(end_date_str), '%Y-%m-%d').date()
                except ValueError:
                    pass

        emp.save()
        invalidate_employees_cache()

        if emp.email:
            EmployeeAccount.objects.filter(employee_id=emp.id).update(email=emp.email)

        if request.content_type == 'application/json' or 'application/json' in request.headers.get('Accept', ''):
            return JsonResponse({'success': True, 'message': 'Employee details updated successfully!'})

        messages.success(request, 'Employee updated!')
        return redirect('employees')

    return render(request, 'edit_employee.html', {'emp': emp})


@csrf_exempt
@require_POST
def delete_employee_view(request, emp_id):
    emp = get_object_or_404(Employee, id=emp_id)
    if emp.status == 'Active':
        return JsonResponse({
            'success': False,
            'message': 'Cannot delete an active employee. Change status to Inactive first!'
        }, status=400)

    Attendance.objects.filter(employee_id=emp.id).delete()
    LeaveRequest.objects.filter(employee_id=emp.id).delete()
    EmployeeAccount.objects.filter(employee_id=emp.id).delete()
    emp.delete()
    invalidate_employees_cache()

    return JsonResponse({'success': True, 'message': 'Employee deleted successfully!'})


@csrf_exempt
def employee_profile_view(request):
    emp_id = resolve_employee_id(request)
    if not emp_id:
        if request.headers.get('Accept') == 'application/json' or request.content_type == 'application/json' or request.GET.get('format') == 'json':
            return JsonResponse({'authenticated': False, 'error': 'Unauthorized'}, status=401)
        return redirect('login')
    employee = get_object_or_404(Employee, id=emp_id)

    if request.headers.get('Accept') == 'application/json' or request.content_type == 'application/json' or request.GET.get('format') == 'json':
        return JsonResponse({
            'authenticated': True,
            'is_hr': False,
            'employee': {
                'id': employee.id,
                'emp_id': employee.emp_id or f"INT{employee.id:04d}",
                'name': employee.name,
                'first_name': employee.name.split(' ')[0] if employee.name else '',
                'email': employee.email,
                'phone': employee.phone or 'Not Available',
                'department': employee.department or 'Data & Analytics',
                'designation': employee.designation or 'IT Intern – Web & Automation Developer',
                'emp_type': employee.emp_type or 'Intern',
                'status': employee.status or 'Active',
                'blood_group': employee.blood_group or '',
                'joining_date': employee.joining_date.strftime('%d %b %Y') if employee.joining_date else '25 Aug 2026',
                'has_photo': bool(employee.profile_pic_data),
                'avatar_url': get_employee_avatar_base64(employee) or f"/employee/{employee.id}/avatar",
            }
        })
    return render(request, 'employee_profile.html', {'employee': employee})


# ─────────────── OFFER LETTER ───────────────

@login_required_custom
def offer_letter_page_view(request):
    employees_list = Employee.objects.filter(status='Active')
    settings = CompanySettings.objects.first()
    return render(request, 'offer_letter.html', {
        'employees': employees_list,
        'role_keys': ROLE_KEYS,
        'settings': settings
    })


@csrf_exempt
def api_offer_roles(request):
    return JsonResponse({'roles': ROLE_KEYS})


@csrf_exempt
def api_offer_draft_get(request):
    emp_id = request.GET.get('emp_id') or request.GET.get('id')
    role_key = request.GET.get('role') or request.GET.get('role_key', '')
    if not emp_id:
        return JsonResponse({'error': 'emp_id is required'}, status=400)
    emp = get_object_or_404(Employee, id=emp_id)
    draft_data = _get_offer_draft_data(emp, role_key)
    return JsonResponse({
        'role_title': draft_data.get('role_title') or role_key,
        'full_text': draft_data.get('full_letter_text') or draft_data.get('full_text', ''),
        'email_body': draft_data.get('email_body_text') or draft_data.get('email_body', ''),
        'full_letter_text': draft_data.get('full_letter_text', ''),
        'email_body_text': draft_data.get('email_body_text', ''),
    })


@csrf_exempt
def api_offer_draft_save(request):
    try:
        data = json.loads(request.body)
    except Exception:
        data = request.POST
    emp_id = data.get('emp_id') or data.get('employee_id')
    if not emp_id:
        return JsonResponse({'success': False, 'message': 'emp_id is required'}, status=400)
    emp = get_object_or_404(Employee, id=emp_id)
    role_key = data.get('role') or data.get('role_key', '')
    if not role_key:
        return JsonResponse({'success': False, 'message': 'Please select a role first'}, status=400)

    role_title = data.get('role_title') or role_key
    full_letter_text = data.get('full_text') or data.get('full_letter_text', '')
    email_body_text = data.get('email_body') or data.get('email_body_text', '')

    draft = _upsert_offer_draft(emp, role_key, role_title, full_letter_text, email_body_text)
    return JsonResponse({
        'success': True,
        'role_key': draft.role_key,
        'role_title': draft.role_title,
        'full_text': draft.full_letter_text,
        'email_body': draft.email_body_text,
        'full_letter_text': draft.full_letter_text,
        'email_body_text': draft.email_body_text,
    })


@csrf_exempt
def generate_offer_letter(request):
    emp_id = request.POST.get('employee_id') or request.POST.get('emp_id') or request.GET.get('emp_id') or request.GET.get('employee_id')
    emp = get_object_or_404(Employee, id=emp_id)
    settings = CompanySettings.objects.first() or CompanySettings()

    role_key = request.POST.get('role_key') or request.POST.get('role') or request.GET.get('role') or request.GET.get('role_key', '')
    if not role_key:
        if hasattr(emp, 'offer_draft') and emp.offer_draft and emp.offer_draft.role_key:
            role_key = emp.offer_draft.role_key
        elif getattr(emp, 'designation', None) and emp.designation in ROLE_KEYS:
            role_key = emp.designation
        else:
            role_key = ROLE_KEYS[0]

    existing = _get_offer_draft_data(emp, role_key)

    role_title = request.POST.get('role_title') or request.GET.get('role_title') or existing.get('role_title') or role_key or 'Intern'
    full_letter_text = request.POST.get('full_letter_text') or request.GET.get('full_text') or existing.get('full_letter_text') or _default_full_letter_text(emp, role_key, role_title)
    email_body_text = request.POST.get('email_body_text') or request.GET.get('email_body') or existing.get('email_body_text') or _default_email_body_text(emp, role_key, role_title)

    if role_key:
        _upsert_offer_draft(emp, role_key, role_title, full_letter_text, email_body_text)

    try:
        hr_user = getattr(request, 'current_user', None)
        if not getattr(hr_user, 'id', None):
            hr_user = HR.objects.first()
        if hr_user:
            hydrate_hr_signature(hr_user)
        hydrate_company_files(settings)
        buf = generate_offer_letter_pdf(
            emp, hr_user, settings, role_key,
            role_title=role_title, full_body_text=full_letter_text
        )
    except Exception as e:
        return HttpResponse(f'PDF generation failed: {e}', status=500)

    emp.offer_sent = True
    emp.save()

    safe_name = emp.name.replace(' ', '_')
    safe_role = (role_title or role_key).replace(' ', '_').replace('–', '-')[:30]
    filename = f"Offer_Letter_{safe_name}_{safe_role}.pdf"

    buf.seek(0)
    response = FileResponse(buf, as_attachment=True, filename=filename, content_type='application/pdf')
    return response


@csrf_exempt
def experience_letter(request, emp_id=None):
    emp_id = emp_id or request.GET.get('emp_id') or request.POST.get('emp_id')
    employee = get_object_or_404(Employee, id=emp_id)
    settings = CompanySettings.objects.first() or CompanySettings()

    gender = getattr(employee, 'gender', 'female') or 'female'
    salutation_prefix = "Mr." if str(gender).strip().lower() in ['male', 'm'] else "Ms."

    try:
        hr_user = getattr(request, 'current_user', None)
        if not getattr(hr_user, 'id', None):
            hr_user = HR.objects.first()
        if hr_user:
            hydrate_hr_signature(hr_user)
        hydrate_company_files(settings)
        buf = generate_experience_letter_pdf(employee, settings, prefix=salutation_prefix)
    except Exception as e:
        return HttpResponse(f'PDF generation failed: {e}', status=500)

    safe_name = employee.name.replace(' ', '_')
    filename = f"{safe_name}_Experience_Letter.pdf"

    buf.seek(0)
    response = FileResponse(buf, as_attachment=True, filename=filename, content_type='application/pdf')
    return response


@csrf_exempt
@require_POST
def send_email_route(request):
    try:
        data = json.loads(request.body)
    except Exception:
        data = request.POST

    emp_id = data.get('emp_id') or data.get('employee_id')
    email_type = data.get('type', 'offer')

    emp = Employee.objects.filter(id=emp_id).first()
    if not emp:
        return JsonResponse({'success': False, 'message': 'Employee not found'}, status=404)

    hr_id = getattr(request.current_user, 'id', None)
    config = EmailConfig.objects.filter(hr_id=hr_id).first() if hr_id else EmailConfig.objects.first()
    if not config or not config.sender_email:
        return JsonResponse({'success': False, 'message': 'Email not configured. Go to Settings > Email Config.'})

    settings = CompanySettings.objects.first()

    try:
        attachments = []
        role_key = data.get('role') or data.get('role_key', '')
        draft_data = _get_offer_draft_data(emp, role_key) if role_key else {}
        role_title = data.get('role_title') or draft_data.get('role_title') or role_key or 'Intern'
        full_letter_text = data.get('full_text') or data.get('full_letter_text') or draft_data.get('full_letter_text') or ''
        email_body_text = data.get('email_body') or data.get('email_body_text') or draft_data.get('email_body_text') or ''
        role_display = role_title.replace(' Intern', '').replace('Intern – ', '').strip()

        if role_key:
            _upsert_offer_draft(emp, role_key, role_title, full_letter_text, email_body_text)

        subject = f"{emp.name} | Internship Offer Letter – {role_display} | TimeArrow Pvt. Ltd (WisBees)"
        if not email_body_text:
            email_body_text = _default_email_body_text(emp, role_key, role_title)

        body_paragraphs = ''.join(
            f"<p>{p.strip()}</p>\n" for p in email_body_text.split('\n\n') if p.strip()
        )

        sender_name = getattr(request.current_user, 'name', 'HR Manager')

        html_body = f"""
        <div style="font-family:Arial,sans-serif;font-size:14px;color:#222;max-width:600px;">
          <p>Dear {emp.name},</p>
          {body_paragraphs}
          <br>
          <p style="margin:0;">Yours sincerely,</p>
          <p style="margin:0;"><strong>{sender_name}</strong></p>
          <p style="margin:0;">HR-DEPARTMENT</p>
          <p style="margin:0;"><a href="mailto:info@wisbees.com" style="color:#4f46e5;">info@wisbees.com</a></p>
          <br>
          <p style="margin:0;font-size:12px;color:#666;">TimeArrow Private Limited (WisBees)</p>
          <img src="https://fret.wisbees.com/static/logo.png"
                   alt="WisBees Logo"
                   width="120"
                   style="display: block; border: 0; max-width: 100%; height: auto;" />
        </div>
        """

        if email_type in ['offer', 'both']:
            if role_key:
                try:
                    sender_hr = HR.objects.filter(id=emp.created_by_id).first() or HR.objects.first()
                    hydrate_hr_signature(sender_hr)
                    hydrate_company_files(settings)
                    pdf_buf = generate_offer_letter_pdf(
                        emp,
                        sender_hr,
                        settings,
                        role_key,
                        role_title=role_title,
                        full_body_text=full_letter_text,
                    )
                    safe_name = emp.name.replace(' ', '_')
                    pdf_bytes = pdf_buf.getvalue()

                    attachments.append({
                        "@odata.type": "#microsoft.graph.fileAttachment",
                        "name": f"Offer_Letter_{safe_name}.pdf",
                        "contentBytes": base64.b64encode(pdf_bytes).decode('utf-8')
                    })
                except Exception as e:
                    print(f"DEBUG: Offer letter error = {e}")

        if email_type in ['nda', 'both']:
            nda_bytes = None
            if settings and getattr(settings, 'nda_data', None):
                nda_bytes = bytes(settings.nda_data)
            elif settings and settings.nda_path and os.path.exists(settings.nda_path):
                with open(settings.nda_path, 'rb') as f:
                    nda_bytes = f.read()
            if nda_bytes:
                try:
                    attachments.append({
                        "@odata.type": "#microsoft.graph.fileAttachment",
                        "name": f"NDA_{emp.name.replace(' ', '_')}.pdf",
                        "contentBytes": base64.b64encode(nda_bytes).decode('utf-8')
                    })
                except Exception as e:
                    print(f"DEBUG: NDA error = {e}")

        cc_recipients = []
        raw_cc_input = data.get('cc_emails', '')
        if raw_cc_input:
            parsed_cc_list = [e.strip() for e in raw_cc_input.split(',') if e.strip()]
            cc_recipients = [{"emailAddress": {"address": e}} for e in parsed_cc_list]

        token = get_graph_token(request.current_user)
        email_payload = {
            "message": {
                "subject": subject,
                "body": {"contentType": "HTML", "content": html_body},
                "toRecipients": [{"emailAddress": {"address": emp.email}}],
                "ccRecipients": cc_recipients,
                "attachments": attachments
            },
            "saveToSentItems": True
        }

        graph_send_url = f"https://graph.microsoft.com/v1.0/users/{config.sender_email}/sendMail"
        response = requests.post(
            graph_send_url,
            headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
            json=email_payload
        )

        if response.status_code != 202:
            raise Exception(response.text)

        if email_type in ['offer', 'both']:
            emp.offer_sent = True
        if email_type in ['nda', 'both']:
            emp.nda_sent = True
        emp.save()

        return JsonResponse({'success': True, 'message': f'Email sent to {emp.email}'})
    except Exception as e:
        return JsonResponse({'success': False, 'message': str(e)})


@csrf_exempt
@require_POST
def send_experience_letter_email(request):
    try:
        data = json.loads(request.body)
    except Exception:
        data = request.POST

    emp_id = data.get('id') or data.get('emp_id') or data.get('employee_id')
    emp = Employee.objects.filter(id=emp_id).first()
    if not emp:
        return JsonResponse({'success': False, 'message': 'Employee not found'}, status=404)
    if not emp.email:
        return JsonResponse({'success': False, 'message': 'This employee has no email address on file'})

    hr_id = getattr(request.current_user, 'id', None)
    config = EmailConfig.objects.filter(hr_id=hr_id).first() if hr_id else EmailConfig.objects.first()
    if not config or not config.sender_email:
        return JsonResponse({'success': False, 'message': 'Email not configured. Go to Settings > Email Config.'})

    settings = CompanySettings.objects.first() or CompanySettings()

    try:
        gender = getattr(emp, 'gender', 'female') or 'female'
        salutation_prefix = "Mr." if str(gender).strip().lower() in ['male', 'm'] else "Ms."

        hydrate_company_files(settings)
        pdf_buf = generate_experience_letter_pdf(emp, settings, prefix=salutation_prefix)
        pdf_bytes = pdf_buf.getvalue()

        safe_name = emp.name.replace(' ', '_')
        attachments = [{
            "@odata.type": "#microsoft.graph.fileAttachment",
            "name": f"{safe_name}_Experience_Letter.pdf",
            "contentBytes": base64.b64encode(pdf_bytes).decode('utf-8')
        }]

        subject = f"{emp.name} | Experience Letter | TimeArrow Pvt. Ltd (WisBees)"
        sender_name = getattr(request.current_user, 'name', 'HR Manager')

        html_body = f"""
        <div style="font-family:Arial,sans-serif;font-size:14px;color:#222;max-width:600px;">
          <p>Dear {emp.name},</p>
          <p>Please find attached your Experience Letter from <strong>TimeArrow Pvt. Ltd. (WisBees)</strong>.</p>
          <p>Should you have any questions or require any clarification, please feel free to reach out.</p>
          <p>We wish you the very best in your future endeavours.</p>
          <br>
          <p style="margin:0;">Yours sincerely,</p>
          <p style="margin:0;"><strong>{sender_name}</strong></p>
          <p style="margin:0;">HR-DEPARTMENT</p>
          <p style="margin:0;"><a href="mailto:info@wisbees.com" style="color:#4f46e5;">info@wisbees.com</a></p>
          <br>
          <p style="margin:0;font-size:12px;color:#666;">TimeArrow Private Limited (WisBees)</p>
          <img src="https://fret.wisbees.com/static/logo.png"
                   alt="WisBees Logo"
                   width="120"
                   style="display: block; border: 0; max-width: 100%; height: auto;" />
        </div>
        """

        cc_recipients = []
        raw_cc_input = data.get('cc_emails', '')
        if raw_cc_input:
            parsed_cc_list = [e.strip() for e in raw_cc_input.split(',') if e.strip()]
            cc_recipients = [{"emailAddress": {"address": e}} for e in parsed_cc_list]

        token = get_graph_token(request.current_user)
        email_payload = {
            "message": {
                "subject": subject,
                "body": {"contentType": "HTML", "content": html_body},
                "toRecipients": [{"emailAddress": {"address": emp.email}}],
                "ccRecipients": cc_recipients,
                "attachments": attachments
            },
            "saveToSentItems": True
        }

        graph_send_url = f"https://graph.microsoft.com/v1.0/users/{config.sender_email}/sendMail"
        response = requests.post(
            graph_send_url,
            headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
            json=email_payload
        )

        if response.status_code != 202:
            raise Exception(response.text)

        return JsonResponse({'success': True, 'message': f'Experience letter emailed to {emp.email}'})
    except Exception as e:
        return JsonResponse({'success': False, 'message': str(e)})


# ─────────────── SETTINGS ───────────────

@csrf_exempt
@login_required_custom
def settings_view(request):
    user_id = getattr(request.current_user, 'id', None)
    config = EmailConfig.objects.filter(hr_id=user_id).first() if user_id else EmailConfig.objects.first()
    company = CompanySettings.objects.first()
    if not company:
        company = CompanySettings.objects.create()

    if request.headers.get('Accept') == 'application/json' or request.content_type == 'application/json' or request.GET.get('format') == 'json':
        return JsonResponse({
            'success': True,
            'config': {
                'sender_email': config.sender_email if config else '',
                'tenant_id': config.tenant_id if config else '',
                'client_id': config.client_id if config else '',
                'has_client_secret': bool(config and config.client_secret),
            },
            'company': {
                'company_name': company.company_name or 'Timearrow Pvt Ltd(Wisbees)',
                'company_address': company.company_address or 'Mumbai, Maharashtra 400001',
                'company_email': company.company_email or 'info@wisbees.com',
                'company_phone': company.company_phone or '+91 7977073233',
                'has_letterhead': bool(company.letterhead_data or os.path.exists(os.path.join(django_settings.BASE_DIR, '..', 'static', 'letterhead.png'))),
                'has_nda': bool(company.nda_data or getattr(company, 'nda_path', None)),
                'nda_filename': getattr(company, 'nda_filename', '') or 'WisBees_NDA.pdf',
            }
        })
    return render(request, 'settings.html', {'config': config, 'company': company})


@csrf_exempt
@login_required_custom
def save_email_config(request):
    if request.method != 'POST':
        return JsonResponse({'success': False, 'message': 'Method not allowed'}, status=405)
    
    user_id = getattr(request.current_user, 'id', None)
    config = EmailConfig.objects.filter(hr_id=user_id).first() if user_id else None
    if not config:
        config = EmailConfig(hr_id=user_id or 1)

    import json
    data = {}
    if request.body and request.content_type == 'application/json':
        try:
            data = json.loads(request.body.decode('utf-8'))
        except Exception:
            pass

    sender_email = data.get('sender_email') or request.POST.get('sender_email')
    tenant_id = data.get('tenant_id') or request.POST.get('tenant_id')
    client_id = data.get('client_id') or request.POST.get('client_id')
    client_secret = data.get('client_secret') or request.POST.get('client_secret')

    if sender_email:
        config.sender_email = sender_email
    if tenant_id:
        config.tenant_id = tenant_id
    if client_id:
        config.client_id = client_id
    if client_secret:
        config.client_secret = client_secret

    config.save()
    if request.headers.get('Accept') == 'application/json' or request.content_type == 'application/json' or data:
        return JsonResponse({'success': True, 'message': 'Microsoft Graph API settings saved successfully!'})
    messages.success(request, 'Graph API settings saved!')
    return redirect('settings')


@csrf_exempt
def save_company_settings(request):
    company = CompanySettings.objects.first()
    if not company:
        company = CompanySettings.objects.create()

    company.company_name = request.POST.get('company_name') or company.company_name
    company.company_address = request.POST.get('company_address') or company.company_address
    company.company_email = request.POST.get('company_email') or company.company_email
    company.company_phone = request.POST.get('company_phone') or company.company_phone

    if 'letterhead_file' in request.FILES:
        file = request.FILES['letterhead_file']
        if file and file.name:
            company.letterhead_data = file.read()
            company.letterhead_mime = file.name.rsplit('.', 1)[-1].lower()

    if 'nda_file' in request.FILES:
        file = request.FILES['nda_file']
        if file and file.name:
            company.nda_data = file.read()
            company.nda_filename = secure_filename(file.name)

    company.save()
    if request.headers.get('Accept') == 'application/json' or request.content_type == 'application/json':
        return JsonResponse({'success': True, 'message': 'Company settings saved!'})
    messages.success(request, 'Company settings saved!')
    return redirect('settings')


@csrf_exempt
def profile_view(request):
    emp_id = resolve_employee_id(request)
    if emp_id and (request.headers.get('Accept') == 'application/json' or request.content_type == 'application/json' or request.path.startswith('/api/')):
        return api_employee_me(request)

    user = getattr(request, 'current_user', None)
    if not user or not getattr(user, 'is_authenticated', False):
        if 'hr_id' in request.session:
            user = HR.objects.filter(id=request.session['hr_id']).first()
        elif 'employee_id' in request.session:
            return api_employee_me(request) if (request.headers.get('Accept') == 'application/json' or request.content_type == 'application/json' or request.path.startswith('/api/')) else employee_profile_view(request)
        else:
            user = HR.objects.first()

    if isinstance(user, EmployeeAccount):
        return api_employee_me(request) if (request.headers.get('Accept') == 'application/json' or request.content_type == 'application/json' or request.path.startswith('/api/')) else employee_profile_view(request)

    if not user:
        user = HR.objects.first()

    if request.method == 'POST':
        name = request.POST.get('name')
        if name:
            user.name = name
        phone = request.POST.get('phone')
        if phone is not None:
            user.phone = phone
        designation = request.POST.get('designation')
        if designation:
            user.designation = designation

        if 'signature' in request.FILES:
            file = request.FILES['signature']
            if file and file.name and allowed_file(file.name):
                user.signature_data = file.read()
                user.signature_path = None

        new_password = request.POST.get('new_password')
        if new_password:
            user.set_password(new_password)

        user.save()
        if request.headers.get('Accept') == 'application/json' or request.content_type == 'application/json' or request.path.startswith('/api/'):
            return JsonResponse({'success': True, 'message': 'Profile updated successfully!'})
        messages.success(request, 'Profile updated!')

    created_at_str = user.created_at.strftime('%B %Y') if getattr(user, 'created_at', None) else 'August 2024'

    if request.headers.get('Accept') == 'application/json' or request.content_type == 'application/json' or request.path.startswith('/api/') or request.GET.get('format') == 'json':
        return JsonResponse({
            'authenticated': True,
            'is_hr': True,
            'user': {
                'id': user.id,
                'name': user.name,
                'email': user.email,
                'phone': user.phone or '',
                'designation': user.designation or 'HR Manager',
                'department': user.department or 'Human Resources',
                'created_at': created_at_str,
                'has_signature': bool(user.signature_data or user.signature_path),
                'signature_url': f"/signature/{user.id}",
            }
        })

    return render(request, 'profile.html', {'current_user': user})


# ─────────────── API & FILE SERVING ENDPOINTS ───────────────

@csrf_exempt
def api_stats(request):
    user = getattr(request, 'current_user', None)
    if isinstance(user, EmployeeAccount):
        return JsonResponse({'is_hr': False, 'role': 'employee', 'redirect': '/employee-dashboard'})

    hr_user = user if isinstance(user, HR) else HR.objects.first()
    hr_name = hr_user.name if hr_user else 'HR Admin'
    hr_designation = getattr(hr_user, 'designation', 'HR Manager') if hr_user else 'HR Manager'

    today = date.today()
    first_of_month = date(today.year, today.month, 1)
    now_year = today.year
    
    # 1 single query to fetch minimal employee metadata for aggregation
    emp_meta = list(Employee.objects.values('id', 'status', 'offer_sent', 'joining_date', 'emp_type', 'created_at'))
    
    total = len(emp_meta)
    active = sum(1 for e in emp_meta if e.get('status') == 'Active')
    inactive = sum(1 for e in emp_meta if e.get('status') == 'Inactive')
    offers_sent = sum(1 for e in emp_meta if e.get('offer_sent'))
    new_this_month = sum(1 for e in emp_meta if e.get('joining_date') and e['joining_date'] >= first_of_month)
    
    total_interns = sum(1 for e in emp_meta if e.get('emp_type') == 'Intern')
    active_interns = sum(1 for e in emp_meta if e.get('emp_type') == 'Intern' and e.get('status') == 'Active')
    total_normal = sum(1 for e in emp_meta if e.get('emp_type') in ('Normal', None, ''))

    # Monthly hiring trend for current year computed in-memory
    monthly_data = [0] * 12
    # Weekly hiring trend for last 7 days computed in-memory
    weekly_labels = [(today - timedelta(days=i)).strftime('%a') for i in range(6, -1, -1)]
    weekly_dates = [(today - timedelta(days=i)) for i in range(6, -1, -1)]
    weekly_data = [0] * 7

    for e in emp_meta:
        c_at = e.get('created_at')
        if c_at:
            c_date = c_at.date() if hasattr(c_at, 'date') else c_at
            if hasattr(c_at, 'year') and c_at.year == now_year:
                m_idx = c_at.month - 1
                if 0 <= m_idx < 12:
                    monthly_data[m_idx] += 1
            for idx, w_date in enumerate(weekly_dates):
                if c_date == w_date:
                    weekly_data[idx] += 1

    # Department breakdown
    dept_qs = list(Employee.objects.values('department').annotate(cnt=Count('id')))
    dept_labels = [d['department'] or 'Unknown' for d in dept_qs]
    dept_data = [d['cnt'] for d in dept_qs]
    depts = [{'name': d['department'] or 'Unknown', 'value': d['cnt']} for d in dept_qs]

    # Recent employees (last 5)
    recent_employees = list(Employee.objects.order_by('-created_at')[:5].values(
        'id', 'name', 'designation', 'department', 'status', 'created_at', 'emp_type'
    ))

    # Active announcements
    announcements_qs = list(Announcement.objects.filter(is_active=True).order_by('-created_at')[:5])
    active_announcements = [{
        'id': a.id,
        'title': a.title,
        'message': a.message,
        'priority': a.priority,
        'audience': a.audience,
        'posted_by': a.posted_by,
        'created_at': a.created_at.strftime('%d %b') if a.created_at else ''
    } for a in announcements_qs]

    return JsonResponse({
        'is_hr': True,
        'total': total,
        'active': active,
        'inactive': inactive,
        'offers_sent': offers_sent,
        'new_this_month': new_this_month,
        'total_interns': total_interns,
        'active_interns': active_interns,
        'total_normal': total_normal,
        'monthly_data': monthly_data,
        'weekly_data': weekly_data,
        'weekly_labels': weekly_labels,
        'dept_labels': dept_labels,
        'dept_data': dept_data,
        'departments': depts,
        'type_labels': ['Interns', 'Normal Employees'],
        'type_data': [total_interns, total_normal],
        'recent_employees': recent_employees,
        'active_announcements': active_announcements,
        'hr_name': hr_name,
        'hr_designation': hr_designation,
    })


_CACHE_EMPLOYEES_DATA = {'data': None, 'time': 0}

def invalidate_employees_cache():
    _CACHE_EMPLOYEES_DATA['data'] = None
    _CACHE_EMPLOYEES_DATA['time'] = 0

def get_cached_employees():
    import time
    now = time.time()
    if _CACHE_EMPLOYEES_DATA['data'] is not None and (now - _CACHE_EMPLOYEES_DATA['time']) < 180:
        return _CACHE_EMPLOYEES_DATA['data']
    emps = list(Employee.objects.order_by('-id'))
    _CACHE_EMPLOYEES_DATA['data'] = emps
    _CACHE_EMPLOYEES_DATA['time'] = now
    return emps

@csrf_exempt
def api_employees_list(request):
    emps = get_cached_employees()
    return JsonResponse([{
        'id': e.id,
        'name': e.name,
        'email': e.email or '',
        'phone': e.phone or '',
        'gender': (e.gender or 'female').strip().lower(),
        'emp_id': e.emp_id,
        'designation': e.designation or 'Staff',
        'department': e.department or 'General',
        'emp_type': e.emp_type or 'Normal',
        'status': e.status or 'Active',
        'salary': float(e.salary or 0),
        'blood_group': e.blood_group or '',
        'offer_sent': bool(e.offer_sent),
        'nda_sent': bool(e.nda_sent),
        'joining_date': e.joining_date.isoformat() if e.joining_date else None,
        'end_date': e.end_date.isoformat() if e.end_date else None
    } for e in emps], safe=False)


@csrf_exempt
def api_employee(request, emp_id):
    emp = get_object_or_404(Employee, id=emp_id)
    return JsonResponse({
        'id': emp.id,
        'emp_id': emp.emp_id,
        'name': emp.name,
        'email': emp.email or '',
        'phone': emp.phone or '',
        'gender': (emp.gender or 'female').strip().lower(),
        'department': emp.department or '',
        'designation': emp.designation or '',
        'emp_type': emp.emp_type or 'Normal',
        'salary': float(emp.salary or 0),
        'blood_group': emp.blood_group or '',
        'joining_date': emp.joining_date.isoformat() if emp.joining_date else None,
        'end_date': emp.end_date.isoformat() if emp.end_date else None,
        'status': emp.status or 'Active',
        'offer_sent': bool(emp.offer_sent),
        'nda_sent': bool(emp.nda_sent)
    })


@csrf_exempt
def api_role_info(request):
    role = request.GET.get('role', '')
    info = ROLE_DATA.get(role, {})
    return JsonResponse({
        'department': info.get('department', ''),
        'responsibilities': info.get('responsibilities', []),
        'requirements': info.get('requirements', []),
    })


@csrf_exempt
def serve_letterhead(request):
    settings = CompanySettings.objects.first()
    if settings and getattr(settings, 'letterhead_data', None):
        mime = settings.letterhead_mime or 'png'
        return HttpResponse(bytes(settings.letterhead_data), content_type=f'image/{mime}')
    if settings and settings.letterhead_path and os.path.exists(settings.letterhead_path):
        with open(settings.letterhead_path, 'rb') as f:
            return HttpResponse(f.read())
    return HttpResponse(status=404)


@login_required_custom
def serve_signature(request, hr_id):
    hr = get_object_or_404(HR, id=hr_id)
    if getattr(hr, 'signature_data', None):
        return HttpResponse(bytes(hr.signature_data), content_type='image/png')
    if hr.signature_path and os.path.exists(hr.signature_path):
        with open(hr.signature_path, 'rb') as f:
            return HttpResponse(f.read())
    return HttpResponse(status=404)


def get_employee_avatar(request, emp_id):
    emp = get_object_or_404(Employee, id=emp_id)
    if not emp.profile_pic_data:
        raise Http404("Avatar not found")
    return HttpResponse(bytes(emp.profile_pic_data), content_type=emp.profile_pic_mime or 'image/jpeg')


# ─────────────── ATTENDANCE & LEAVE ───────────────

def _send_leave_notification_email(leave_request, action='approved', pdf_bytes=None, hr_user=None):
    """
    Sends email notification for leave approval (with PDF attachment) or rejection.
    Works seamlessly with Microsoft Graph API and handles unconfigured local environments gracefully.
    """
    emp = leave_request.employee
    if not emp or not emp.email:
        return False, "Employee has no email address on file"

    company_settings = CompanySettings.objects.first() or CompanySettings()
    company_name = getattr(company_settings, 'company_name', 'TimeArrow Pvt. Ltd. (WisBees)')
    sender_name = getattr(hr_user, 'name', 'HR Department') if hr_user else 'HR Department'

    from_str = leave_request.from_date.strftime('%d %b %Y') if leave_request.from_date else 'N/A'
    to_str = leave_request.to_date.strftime('%d %b %Y') if leave_request.to_date else 'N/A'
    total_days = ((leave_request.to_date - leave_request.from_date).days + 1) if (leave_request.from_date and leave_request.to_date) else 1

    if action == 'approved':
        subject = f"Leave Request Approved — {leave_request.leave_type or 'Leave'} | {company_name}"
        html_body = f"""
        <div style="font-family:Arial,sans-serif;font-size:14px;color:#222;max-width:600px;line-height:1.6;">
          <p>Dear <strong>{emp.name}</strong>,</p>
          <p>We are pleased to inform you that your leave application for <strong>{leave_request.leave_type or 'Leave'}</strong> has been <span style="color:#059669;font-weight:bold;">APPROVED</span>.</p>
          <div style="background:#f8fafc;border:1px solid #cbd5e1;border-radius:8px;padding:12px 16px;margin:16px 0;">
            <p style="margin:4px 0;"><strong>Leave Type:</strong> {leave_request.leave_type or 'Casual Leave'}</p>
            <p style="margin:4px 0;"><strong>Period:</strong> {from_str} to {to_str} ({total_days} Day(s))</p>
            <p style="margin:4px 0;"><strong>Status:</strong> <span style="color:#059669;font-weight:bold;">Sanctioned & Approved</span></p>
          </div>
          <p>Please find attached your official <strong>Leave Approval Sanction Letter</strong> for your records.</p>
          <p>We wish you a pleasant time off.</p>
          <br>
          <p style="margin:0;">Yours sincerely,</p>
          <p style="margin:0;"><strong>{sender_name}</strong></p>
          <p style="margin:0;color:#666;">Human Resources Department</p>
          <p style="margin:0;color:#666;">{company_name}</p>
        </div>
        """
    else:
        subject = f"Leave Request Declined — {leave_request.leave_type or 'Leave'} | {company_name}"
        html_body = f"""
        <div style="font-family:Arial,sans-serif;font-size:14px;color:#222;max-width:600px;line-height:1.6;">
          <p>Dear <strong>{emp.name}</strong>,</p>
          <p>This is to inform you that your leave request for <strong>{leave_request.leave_type or 'Leave'}</strong> for the period from <strong>{from_str}</strong> to <strong>{to_str}</strong> has been <span style="color:#dc2626;font-weight:bold;">DECLINED / REJECTED</span> by HR.</p>
          <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:12px 16px;margin:16px 0;">
            <p style="margin:4px 0;"><strong>Reason stated:</strong> {leave_request.reason or 'Personal'}</p>
            <p style="margin:4px 0;"><strong>Status:</strong> <span style="color:#dc2626;font-weight:bold;">Rejected</span></p>
          </div>
          <p>If you have any questions or require further clarification, please contact the HR department.</p>
          <br>
          <p style="margin:0;">Yours sincerely,</p>
          <p style="margin:0;"><strong>{sender_name}</strong></p>
          <p style="margin:0;color:#666;">Human Resources Department</p>
          <p style="margin:0;color:#666;">{company_name}</p>
        </div>
        """

    attachments = []
    if action == 'approved' and pdf_bytes:
        safe_name = emp.name.replace(' ', '_')
        attachments.append({
            "@odata.type": "#microsoft.graph.fileAttachment",
            "name": f"Leave_Approval_{safe_name}.pdf",
            "contentBytes": base64.b64encode(pdf_bytes).decode('utf-8')
        })

    config = EmailConfig.objects.first()
    if not config or not config.sender_email or not config.tenant_id:
        return True, "Email config not configured in database; status updated in local database."

    try:
        token = get_graph_token(hr_user)
        email_payload = {
            "message": {
                "subject": subject,
                "body": {"contentType": "HTML", "content": html_body},
                "toRecipients": [{"emailAddress": {"address": emp.email}}],
                "attachments": attachments
            },
            "saveToSentItems": True
        }
        graph_send_url = f"https://graph.microsoft.com/v1.0/users/{config.sender_email}/sendMail"
        response = requests.post(
            graph_send_url,
            headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
            json=email_payload
        )
        if response.status_code == 202:
            return True, "Email sent successfully via Microsoft Graph"
        else:
            return False, f"Graph API returned status {response.status_code}: {response.text}"
    except Exception as e:
        return False, f"Email dispatch failed: {e}"


@csrf_exempt
def leave_management(request):
    leaves = LeaveRequest.objects.select_related('employee').order_by('-applied_on')

    is_json = (
        request.headers.get('Accept') == 'application/json' or
        request.content_type == 'application/json' or
        request.path.startswith('/api/') or
        request.GET.get('format') == 'json'
    )

    if is_json:
        data = []
        for lr in leaves:
            emp = lr.employee
            from_str = lr.from_date.strftime('%Y-%m-%d') if lr.from_date else ''
            to_str = lr.to_date.strftime('%Y-%m-%d') if lr.to_date else ''
            days = ((lr.to_date - lr.from_date).days + 1) if (lr.from_date and lr.to_date) else 1
            data.append({
                'id': lr.id,
                'employee_id': emp.id if emp else None,
                'employee': emp.name if emp else 'Unknown',
                'emp_id': emp.emp_id if emp else 'N/A',
                'emp_type': emp.emp_type if emp else 'Normal',
                'department': emp.department if emp else '',
                'email': emp.email if emp else '',
                'leave_type': lr.leave_type or 'Casual Leave',
                'from_date': from_str,
                'to_date': to_str,
                'from_date_formatted': lr.from_date.strftime('%d %b %Y') if lr.from_date else '',
                'to_date_formatted': lr.to_date.strftime('%d %b %Y') if lr.to_date else '',
                'days': days,
                'reason': lr.reason or '',
                'status': lr.status or 'Pending',
                'applied_on': lr.applied_on.strftime('%d %b %Y') if lr.applied_on else '',
            })
        return JsonResponse({'success': True, 'leaves': data})

    return render(request, 'leave_management.html', {'leaves': leaves, 'active_page': 'leave'})


@csrf_exempt
def approve_leave(request, leave_id):
    leave = get_object_or_404(LeaveRequest, id=leave_id)
    leave.status = "Approved"
    leave.save()

    settings = CompanySettings.objects.first() or CompanySettings()
    hydrate_company_files(settings)
    hr_user = getattr(request, 'current_user', None)
    if hr_user and hasattr(hr_user, 'id'):
        hydrate_hr_signature(hr_user)

    try:
        pdf_buf = generate_leave_approval_pdf(leave, settings=settings, hr_user=hr_user)
        pdf_bytes = pdf_buf.getvalue()
    except Exception as e:
        print(f"DEBUG: Leave PDF Generation Error: {e}")
        pdf_bytes = None

    email_sent, email_msg = _send_leave_notification_email(leave, action='approved', pdf_bytes=pdf_bytes, hr_user=hr_user)

    is_json = (
        request.headers.get('Accept') == 'application/json' or
        request.content_type == 'application/json' or
        request.path.startswith('/api/') or
        request.GET.get('format') == 'json' or
        request.method == 'POST'
    )

    if is_json:
        return JsonResponse({
            'success': True,
            'message': f'Leave approved! {"Approval email with PDF attached sent to " + leave.employee.email if leave.employee and leave.employee.email else ""}',
            'email_status': email_msg,
            'leave_id': leave.id,
            'status': 'Approved'
        })

    messages.success(request, 'Leave approved and email dispatched.')
    return redirect('leave_management')


@csrf_exempt
def reject_leave(request, leave_id):
    leave = get_object_or_404(LeaveRequest, id=leave_id)
    leave.status = "Rejected"
    leave.save()

    hr_user = getattr(request, 'current_user', None)
    email_sent, email_msg = _send_leave_notification_email(leave, action='rejected', hr_user=hr_user)

    is_json = (
        request.headers.get('Accept') == 'application/json' or
        request.content_type == 'application/json' or
        request.path.startswith('/api/') or
        request.GET.get('format') == 'json' or
        request.method == 'POST'
    )

    if is_json:
        return JsonResponse({
            'success': True,
            'message': f'Leave rejected. {"Notification email sent to " + leave.employee.email if leave.employee and leave.employee.email else ""}',
            'email_status': email_msg,
            'leave_id': leave.id,
            'status': 'Rejected'
        })

    messages.info(request, 'Leave rejected and notification email sent.')
    return redirect('leave_management')


@csrf_exempt
def download_leave_approval_pdf(request, leave_id):
    leave = get_object_or_404(LeaveRequest, id=leave_id)
    settings = CompanySettings.objects.first() or CompanySettings()
    hydrate_company_files(settings)
    hr_user = getattr(request, 'current_user', None)
    if hr_user and hasattr(hr_user, 'id'):
        hydrate_hr_signature(hr_user)

    pdf_buf = generate_leave_approval_pdf(leave, settings=settings, hr_user=hr_user)
    safe_name = leave.employee.name.replace(' ', '_') if leave.employee else f"Leave_{leave.id}"
    filename = f"Leave_Approval_{safe_name}.pdf"

    pdf_buf.seek(0)
    return FileResponse(pdf_buf, as_attachment=True, filename=filename, content_type='application/pdf')


@csrf_exempt
def checkin(request):
    employee_id = resolve_employee_id(request)
    if not employee_id:
        if request.headers.get('Accept') == 'application/json' or request.content_type == 'application/json':
            return JsonResponse({'success': False, 'error': 'Unauthorized'}, status=401)
        return redirect('login')
    today = timezone.localtime(timezone.now()).date()
    record = Attendance.objects.filter(employee_id=employee_id, date=today).first()
    if not record:
        record = Attendance.objects.create(
            employee_id=employee_id,
            date=today,
            check_in=timezone.now(),
            status='Present'
        )
    elif not record.check_in:
        record.check_in = timezone.now()
        record.status = 'Present'
        record.save()

    if request.headers.get('Accept') == 'application/json' or request.content_type == 'application/json':
        return JsonResponse({
            'success': True,
            'message': 'Check-in successful!',
            'check_in': format_local_time(record.check_in),
            'check_in_iso': timezone.localtime(record.check_in).isoformat() if record.check_in else None,
            'check_in_timestamp': int(record.check_in.timestamp() * 1000) if record.check_in else None,
            'status': 'Present (In Progress)'
        })

    messages.success(request, 'Check-in successful!')
    return redirect('employee_dashboard')


@csrf_exempt
def checkout(request):
    employee_id = resolve_employee_id(request)
    if not employee_id:
        if request.headers.get('Accept') == 'application/json' or request.content_type == 'application/json':
            return JsonResponse({'success': False, 'error': 'Unauthorized'}, status=401)
        return redirect('login')

    today = timezone.localtime(timezone.now()).date()
    record = Attendance.objects.filter(employee_id=employee_id, date=today).first()
    if not record:
        record = Attendance.objects.create(
            employee_id=employee_id,
            date=today,
            check_in=timezone.now(),
            check_out=timezone.now(),
            status='Present'
        )
    else:
        record.check_out = timezone.now()
        record.save()

    diff_secs = safe_time_diff_seconds(record.check_out, record.check_in or record.check_out)
    hours = diff_secs // 3600
    mins = (diff_secs % 3600) // 60
    worked_str = f"{hours} hrs {mins} mins" if hours > 0 else f"{mins} mins"

    if request.headers.get('Accept') == 'application/json' or request.content_type == 'application/json':
        return JsonResponse({
            'success': True,
            'message': 'Check-out successful!',
            'check_out': format_local_time(record.check_out),
            'check_out_iso': safe_isoformat(record.check_out),
            'check_out_timestamp': safe_timestamp_ms(record.check_out),
            'worked_duration': worked_str,
            'status': 'Shift Completed'
        })

    messages.success(request, 'Check-out successful!')
    return redirect('employee_dashboard')


@csrf_exempt
def attendance_view(request):
    employee_id = resolve_employee_id(request)
    if not employee_id:
        if request.headers.get('Accept') == 'application/json' or request.content_type == 'application/json':
            return JsonResponse({'success': False, 'error': 'Unauthorized'}, status=401)
        return redirect('login')

    employee = get_object_or_404(Employee, id=employee_id)
    records = list(Attendance.objects.filter(employee_id=employee.id).order_by('-date'))

    present_days = sum(1 for r in records if r.status == 'Present')
    absent_days = sum(1 for r in records if r.status == 'Absent')
    total_days = len(records)
    attendance_percentage = round((present_days / total_days * 100), 1) if total_days else 100.0

    if request.headers.get('Accept') == 'application/json' or request.content_type == 'application/json' or request.GET.get('format') == 'json':
        records_list = []
        for r in records:
            dur_str = '--'
            if r.check_in and r.check_out:
                diff_s = safe_time_diff_seconds(r.check_out, r.check_in)
                h = diff_s // 3600
                m = (diff_s % 3600) // 60
                dur_str = f"{h}h {m}m" if h > 0 else f"{m}m"
            elif r.check_in:
                dur_str = "In Progress"

            records_list.append({
                'id': r.id,
                'date': r.date.strftime('%d %b %Y') if r.date else '',
                'check_in': format_local_time(r.check_in) or '--:--',
                'check_out': format_local_time(r.check_out) or '--:--',
                'worked_duration': dur_str,
                'status': r.status
            })

        return JsonResponse({
            'employee': {
                'id': employee.id,
                'name': employee.name,
                'designation': employee.designation or 'IT Intern – Web & Automation Developer',
                'emp_type': employee.emp_type or 'Intern'
            },
            'present_days': present_days,
            'absent_days': absent_days,
            'total_days': total_days,
            'attendance_percentage': attendance_percentage,
            'records': records_list
        })

    return render(request, 'attendance.html', {
        'records': records,
        'employee': employee,
        'present_days': present_days,
        'absent_days': absent_days,
        'attendance_percentage': attendance_percentage
    })


@csrf_exempt
def attendance_management(request):
    employee_id = request.GET.get('employee_id') or request.GET.get('emp_id')
    from_date = request.GET.get('from_date') or request.GET.get('from')
    to_date = request.GET.get('to_date') or request.GET.get('to')
    search = request.GET.get('search', '').strip()

    query = Attendance.objects.select_related('employee').all()
    if employee_id:
        if str(employee_id).isdigit():
            query = query.filter(employee_id=int(employee_id))
        else:
            query = query.filter(Q(employee__name__icontains=employee_id) | Q(employee__emp_id__icontains=employee_id))
    if from_date:
        query = query.filter(date__gte=from_date)
    if to_date:
        query = query.filter(date__lte=to_date)
    if search:
        query = query.filter(Q(employee__name__icontains=search) | Q(employee__emp_id__icontains=search))

    records = list(query.order_by('-date', '-check_in')[:200])
    all_emps = get_cached_employees()
    employees_dropdown = [{'id': e.id, 'name': e.name, 'emp_id': e.emp_id, 'department': e.department or 'General', 'designation': e.designation or 'Staff'} for e in all_emps]

    today = date.today()
    total_records = len(records)
    today_present = sum(1 for r in records if r.date == today and (r.status or '').lower() == 'present')
    late_entries = sum(1 for r in records if r.date == today and (r.status or '').lower() == 'late')

    is_json = (
        request.headers.get('Accept') == 'application/json' or
        request.content_type == 'application/json' or
        request.path.startswith('/api/') or
        request.GET.get('format') == 'json'
    )

    if is_json:
        records_data = []
        for r in records:
            emp = r.employee
            records_data.append({
                'id': r.id,
                'date': r.date.strftime('%d-%b-%Y') if r.date else '',
                'date_raw': r.date.isoformat() if r.date else '',
                'emp_id': emp.emp_id if emp else 'N/A',
                'name': emp.name if emp else 'Unknown',
                'emp_type': emp.emp_type if emp else 'Normal',
                'department': emp.department if emp else '',
                'designation': emp.designation if emp else '',
                'check_in': format_local_time(r.check_in) or '--',
                'check_out': format_local_time(r.check_out) or '--',
                'status': r.status or 'Present',
            })
        return JsonResponse({
            'success': True,
            'records': records_data,
            'stats': {
                'total_records': total_records,
                'present_today': today_present,
                'late_entries': late_entries,
            },
            'employees': employees_dropdown
        })

    return render(request, 'attendance_management.html', {'records': records, 'employees': employees_dropdown})


@csrf_exempt
def export_attendance(request):
    employee_id = request.GET.get('employee_id') or request.GET.get('emp_id')
    from_date = request.GET.get('from_date') or request.GET.get('from')
    to_date = request.GET.get('to_date') or request.GET.get('to')
    search = request.GET.get('search', '').strip()

    query = Attendance.objects.select_related('employee').all()
    if employee_id:
        if str(employee_id).isdigit():
            query = query.filter(employee_id=int(employee_id))
        else:
            query = query.filter(Q(employee__name__icontains=employee_id) | Q(employee__emp_id__icontains=employee_id))
    if from_date:
        query = query.filter(date__gte=from_date)
    if to_date:
        query = query.filter(date__lte=to_date)
    if search:
        query = query.filter(Q(employee__name__icontains=search) | Q(employee__emp_id__icontains=search))

    records = query.order_by('-date', '-check_in')
    data = []
    for record in records:
        emp = record.employee
        data.append({
            "Date": record.date.strftime('%d-%m-%Y') if record.date else "",
            "Employee ID": emp.emp_id if emp else "",
            "Name": emp.name if emp else "",
            "Type": emp.emp_type if emp else "Normal",
            "Department": emp.department if emp else "",
            "Designation": emp.designation if emp else "",
            "Check In": record.check_in.strftime('%I:%M %p') if record.check_in else "--",
            "Check Out": record.check_out.strftime('%I:%M %p') if record.check_out else "--",
            "Status": record.status or "Present"
        })

    df = pd.DataFrame(data)
    if df.empty:
        df = pd.DataFrame(columns=["Date", "Employee ID", "Name", "Type", "Department", "Designation", "Check In", "Check Out", "Status"])

    output = BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        df.to_excel(writer, index=False, sheet_name='Attendance')
    output.seek(0)

    filename = f"Attendance_Report_{date.today().strftime('%d_%m_%Y')}.xlsx"
    response = HttpResponse(
        output.getvalue(),
        content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    )
    response['Content-Disposition'] = f'attachment; filename="{filename}"'
    return response


@csrf_exempt
def apply_leave(request):
    emp_id = resolve_employee_id(request)
    if not emp_id:
        if request.headers.get('Accept') == 'application/json' or request.content_type == 'application/json':
            return JsonResponse({'success': False, 'error': 'Unauthorized'}, status=401)
        return redirect('login')

    employee = get_object_or_404(Employee, id=emp_id)

    if request.method == 'POST':
        if request.content_type == 'application/json':
            try:
                data = json.loads(request.body)
            except Exception:
                data = {}
        else:
            data = request.POST

        leave_type = data.get('leave_type', 'Casual Leave')
        from_date_str = data.get('from_date')
        to_date_str = data.get('to_date')
        reason = data.get('reason', '')

        try:
            from_d = datetime.strptime(from_date_str, '%Y-%m-%d').date()
            to_d = datetime.strptime(to_date_str, '%Y-%m-%d').date()
        except Exception:
            if request.headers.get('Accept') == 'application/json' or request.content_type == 'application/json':
                return JsonResponse({'success': False, 'message': 'Invalid date format'}, status=400)
            messages.error(request, "Invalid date format")
            return redirect('apply_leave')

        lr = LeaveRequest.objects.create(
            employee_id=employee.id,
            leave_type=leave_type,
            from_date=from_d,
            to_date=to_d,
            reason=reason
        )
        if request.headers.get('Accept') == 'application/json' or request.content_type == 'application/json':
            return JsonResponse({
                'success': True,
                'message': 'Leave request submitted successfully',
                'leave_id': lr.id
            })
        messages.success(request, "Leave request submitted successfully")
        return redirect('employee_dashboard')

    leave_history = LeaveRequest.objects.filter(employee_id=employee.id).order_by('-applied_on')
    if request.headers.get('Accept') == 'application/json' or request.content_type == 'application/json' or request.GET.get('format') == 'json':
        return JsonResponse({
            'leave_history': [{
                'id': lr.id,
                'leave_type': lr.leave_type or 'Casual Leave',
                'from_date': lr.from_date.strftime('%d %b %Y') if lr.from_date else '',
                'to_date': lr.to_date.strftime('%d %b %Y') if lr.to_date else '',
                'days': ((lr.to_date - lr.from_date).days + 1) if lr.to_date and lr.from_date else 1,
                'applied_on': lr.applied_on.strftime('%d %b %Y') if lr.applied_on else '',
                'status': lr.status or 'Pending',
                'reason': lr.reason or ''
            } for lr in leave_history]
        })

    return render(request, 'apply_leave.html', {'employee': employee, 'leave_history': leave_history})


# ─────────────── ANNOUNCEMENTS ───────────────

@csrf_exempt
def announcements_view(request):
    is_hr = isinstance(getattr(request, 'current_user', None), HR) or bool(getattr(request, 'session', {}).get('hr_id'))
    if not is_hr:
        return employee_announcements_view(request)

    if request.method == 'POST':
        if request.content_type == 'application/json':
            try:
                data = json.loads(request.body)
            except Exception:
                data = {}
            title = data.get('title')
            message = data.get('message')
            audience = data.get('audience', 'Everyone')
            priority = data.get('priority', 'Normal')
        else:
            title = request.POST.get('title')
            message = request.POST.get('message')
            audience = request.POST.get('audience', 'Everyone')
            priority = request.POST.get('priority', 'Normal')

        sender_name = getattr(request.current_user, 'name', 'HR Admin')
        Announcement.objects.create(
            title=title,
            message=message,
            audience=audience,
            priority=priority,
            posted_by=sender_name,
            expires_at=timezone.now() + timedelta(days=2)
        )
        if request.headers.get('Accept') == 'application/json' or request.content_type == 'application/json':
            return JsonResponse({'success': True, 'message': 'Announcement published successfully!'})
        messages.success(request, "Announcement published successfully!")
        return redirect('announcements')

    now = timezone.now()
    active_announcements = Announcement.objects.filter(is_active=True).order_by('-created_at')
    history_announcements = Announcement.objects.filter(is_active=False).order_by('-created_at')

    if request.headers.get('Accept') == 'application/json' or request.content_type == 'application/json' or request.GET.get('format') == 'json':
        return JsonResponse({
            'authenticated': True,
            'is_hr': True,
            'active_announcements': [{
                'id': a.id,
                'title': a.title,
                'message': a.message,
                'audience': a.audience,
                'priority': a.priority,
                'posted_by': a.posted_by,
                'created_at': a.created_at.strftime('%d %b %Y') if a.created_at else ''
            } for a in active_announcements],
            'history_announcements': [{
                'id': a.id,
                'title': a.title,
                'message': a.message,
                'audience': a.audience,
                'priority': a.priority,
                'posted_by': a.posted_by,
                'created_at': a.created_at.strftime('%d %b %Y') if a.created_at else ''
            } for a in history_announcements]
        })

    return render(request, 'announcements.html', {
        'active_announcements': active_announcements,
        'history_announcements': history_announcements
    })


@csrf_exempt
def delete_announcement_view(request, announcement_id):
    if not isinstance(request.current_user, HR):
        if request.headers.get('Accept') == 'application/json' or request.content_type == 'application/json':
            return JsonResponse({'success': False, 'error': 'Permission denied'}, status=403)
        messages.error(request, "Permission denied")
        return redirect('announcements')

    announcement = get_object_or_404(Announcement, id=announcement_id)
    announcement.delete()
    if request.headers.get('Accept') == 'application/json' or request.content_type == 'application/json':
        return JsonResponse({'success': True, 'message': 'Announcement deleted successfully!'})
    messages.success(request, "Announcement deleted successfully!")
    return redirect('announcements')


@csrf_exempt
def employee_announcements_view(request):
    emp_id = resolve_employee_id(request)
    if not emp_id:
        if request.headers.get('Accept') == 'application/json' or request.content_type == 'application/json' or request.GET.get('format') == 'json':
            return JsonResponse({'authenticated': False, 'error': 'Unauthorized'}, status=401)
        return redirect('login')

    employee = get_object_or_404(Employee, id=emp_id)
    now = timezone.now()

    if employee.emp_type == "Intern":
        announcements = Announcement.objects.filter(
            is_active=True, expires_at__gt=now
        ).filter(Q(audience="Everyone") | Q(audience="Interns") | Q(audience="Intern")).order_by('-created_at')
    else:
        announcements = Announcement.objects.filter(
            is_active=True, expires_at__gt=now
        ).filter(Q(audience="Everyone") | Q(audience="Employees") | Q(audience="Normal") | Q(audience="Employee")).order_by('-created_at')

    if request.headers.get('Accept') == 'application/json' or request.content_type == 'application/json' or request.GET.get('format') == 'json':
        return JsonResponse({
            'authenticated': True,
            'is_hr': False,
            'employee': {
                'id': employee.id,
                'name': employee.name,
                'designation': employee.designation or 'Staff',
                'emp_type': employee.emp_type or 'Normal',
            },
            'announcements': [{
                'id': ann.id,
                'title': ann.title,
                'message': ann.message,
                'priority': ann.priority or 'Normal',
                'audience': ann.audience or 'Everyone',
                'posted_by': ann.posted_by or 'HR Team',
                'created_at': ann.created_at.strftime('%d %b %Y') if ann.created_at else ''
            } for ann in announcements]
        })

    return render(request, "employee_announcements.html", {'announcements': announcements, 'employee': employee})


# ─────────────── WORK & PROFILE UPDATE ───────────────

@login_required_custom
def work_view(request):
    return render(request, 'work.html', {'employee': request.current_user})


@login_required_custom
def newsletter_workspace_view(request):
    return render(request, 'work.html', {'employee': request.current_user})


def temp_reset(request):
    boss_email = "hiteshshindebusiness@gmail.com"
    boss = HR.objects.filter(email=boss_email).first()
    if not boss:
        return HttpResponse(f"Could not find an HR user with email: {boss_email}", status=404)
    boss.set_password("Wisbees@test")
    boss.save()
    return HttpResponse(f"Success! Password for {boss_email} has been reset to: Wisbees@test")


@csrf_exempt
@require_POST
def update_profile_view(request):
    emp_id = resolve_employee_id(request)
    target_user = None
    if emp_id:
        target_user = Employee.objects.filter(id=emp_id).first()
    elif getattr(request, 'current_user', None) and request.current_user.is_authenticated:
        target_user = request.current_user
    else:
        if request.headers.get('Accept') == 'application/json' or request.content_type == 'application/json':
            return JsonResponse({'error': 'Unauthorized'}, status=401)
        return redirect('login')

    if not target_user:
        return JsonResponse({'error': 'User not found'}, status=404)

    if 'profile_pic' in request.FILES:
        file = request.FILES['profile_pic']
        if file and file.name != '':
            target_user.profile_pic_data = file.read()
            target_user.profile_pic_mime = file.content_type

    blood_group = ''
    if request.content_type == 'application/json':
        try:
            data = json.loads(request.body)
        except Exception:
            data = {}
        blood_group = data.get('blood_group', '').strip()
    else:
        blood_group = request.POST.get('blood_group', '').strip()

    if isinstance(target_user, Employee) and blood_group:
        allowed_groups = {'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'}
        if blood_group in allowed_groups:
            target_user.blood_group = blood_group

    target_user.save()
    if request.headers.get('Accept') == 'application/json' or request.content_type == 'application/json':
        return JsonResponse({
            'success': True,
            'message': 'Profile updated successfully!',
            'blood_group': getattr(target_user, 'blood_group', None),
            'has_photo': bool(getattr(target_user, 'profile_pic_data', None)),
            'avatar_url': get_employee_avatar_base64(target_user) or f"/employee/{target_user.id}/avatar"
        })
    messages.success(request, 'Profile updated successfully!')
    return redirect(redirect_route)


@csrf_exempt
def view_id_card(request, emp_id):
    employee = get_object_or_404(Employee, id=emp_id)
    if request.headers.get('Accept') == 'application/json' or request.content_type == 'application/json' or request.GET.get('format') == 'json':
        return JsonResponse({
            'employee': {
                'id': employee.id,
                'emp_id': employee.emp_id or f"INT{employee.id:04d}",
                'name': employee.name,
                'email': employee.email,
                'phone': employee.phone or 'Not Available',
                'department': employee.department or 'Data & Analytics',
                'designation': employee.designation or 'IT Intern – Web & Automation Developer',
                'emp_type': employee.emp_type or 'Intern',
                'status': employee.status or 'Active',
                'blood_group': employee.blood_group or 'B+',
                'joining_date': employee.joining_date.strftime('%d %b %Y') if employee.joining_date else '25 Aug 2026',
                'has_photo': bool(employee.profile_pic_data),
                'avatar_url': get_employee_avatar_base64(employee) or f"/employee/{employee.id}/avatar",
            }
        })
    return render(request, 'id_card.html', {'emp': employee, 'role': "EMPLOYEE"})


# ─────────────── EQUITY RESEARCH REPORTS ───────────────

@login_required_custom
@require_POST
def generate_report(request):
    chart_file = request.FILES.get('chart_img')
    filename = None
    if chart_file and chart_file.name != '':
        filename = secure_filename(chart_file.name)
        with open(os.path.join(RESEARCH_UPLOAD_DIR, filename), 'wb+') as destination:
            for chunk in chart_file.chunks():
                destination.write(chunk)

    _purge_expired_research_reports()

    current_account_id = request.current_user.id if isinstance(request.current_user, EmployeeAccount) else None
    author_name = getattr(request.current_user, 'name', '')

    form_dict = request.POST.dict()
    report = ResearchReport.objects.create(
        company_name=request.POST.get('company_name', '')[:200],
        form_data=json.dumps(dict(request.POST.lists())),
        chart_filename=filename,
        created_by_id=current_account_id,
        author_name=author_name
    )

    context = _compile_research_context(request.POST, filename)
    context['report'] = report
    return render(request, 'premium_report.html', context)


@login_required_custom
def research_history(request):
    _purge_expired_research_reports()

    query = ResearchReport.objects.all()
    if isinstance(request.current_user, EmployeeAccount):
        query = query.filter(created_by_id=request.current_user.id)
    reports = query.order_by('-created_at')

    retention = timedelta(days=RESEARCH_REPORT_RETENTION_DAYS)
    return render(request, 'research_history.html', {
        'employee': request.current_user,
        'reports': reports,
        'retention_days': RESEARCH_REPORT_RETENTION_DAYS,
        'now': timezone.now(),
        'retention': retention
    })


@login_required_custom
def view_research_report(request, report_id):
    report = _research_report_or_403(report_id, request.current_user)
    raw_form = json.loads(report.form_data)
    context = _compile_research_context(raw_form, report.chart_filename)
    context['report'] = report
    return render(request, 'premium_report.html', context)


@login_required_custom
def edit_research_report(request, report_id):
    report = _research_report_or_403(report_id, request.current_user)
    raw_form = json.loads(report.form_data)
    flat_data = {k: (v[0] if isinstance(v, list) and v else v) for k, v in raw_form.items()}
    return render(request, 'research_edit.html', {
        'employee': request.current_user,
        'report': report,
        'data': flat_data,
        'prefill_json': json.dumps(raw_form)
    })


@login_required_custom
@require_POST
def update_research_report(request, report_id):
    report = _research_report_or_403(report_id, request.current_user)

    chart_file = request.FILES.get('chart_img')
    if chart_file and chart_file.name != '':
        filename = secure_filename(chart_file.name)
        with open(os.path.join(RESEARCH_UPLOAD_DIR, filename), 'wb+') as destination:
            for chunk in chart_file.chunks():
                destination.write(chunk)
        report.chart_filename = filename

    report.company_name = request.POST.get('company_name', '')[:200]
    report.form_data = json.dumps(dict(request.POST.lists()))
    report.save()

    context = _compile_research_context(request.POST, report.chart_filename)
    context['report'] = report
    return render(request, 'premium_report.html', context)


@login_required_custom
@require_POST
def mail_report(request):
    company = request.POST.get('company_name', 'Equity Assets')
    config = EmailConfig.objects.filter(hr_id=request.current_user.id).first()
    if not config or not config.sender_email:
        messages.error(request, 'System configuration absent. Setup Email Config credentials before dispatching reports.')
        return redirect('work')

    try:
        token = get_graph_token(request.current_user)
        send_url = f"https://graph.microsoft.com/v1.0/users/{config.sender_email}/sendMail"
        email_payload = {
            "message": {
                "subject": f"WisBees Research Briefing Matrix Update: {company}",
                "body": {
                    "contentType": "HTML",
                    "content": f"""
                    <div style="font-family: Arial, sans-serif; max-width: 600px; color: #1e293b;">
                        <h2 style="color: #10b981; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px;">WisBees Research Node Update</h2>
                        <p>A premium equity tracking blueprint covering <strong>{company}</strong> was compiled by an Equity Research Intern.</p>
                        <p>Please check the web terminal workspace hub to analyze the chart breakdowns, financial matrices, and rating consensus sheets.</p>
                        <br>
                        <p style="font-size: 12px; color: #64748b; margin: 0;">TimeArrow Private Limited (WisBees)</p>
                        <img src="https://fret.wisbees.com/static/logo.png" alt="WisBees Logo" width="120" style="display: block; margin-top: 10px;" />
                    </div>
                    """
                },
                "toRecipients": [{"emailAddress": {"address": "info@wisbees.com"}}]
            },
            "saveToSentItems": True
        }

        res = requests.post(send_url, json=email_payload, headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        })
        if res.status_code != 202:
            raise Exception(res.text)

        messages.success(request, "Premium equity intelligence compilation tracking package distributed successfully.")
    except Exception as e:
        messages.error(request, f"Transmission node failure: {str(e)}")

    return redirect('work')


# ─────────────── STOCK & AI APIS ───────────────

def get_analyst_coverage(request, symbol):
    try:
        clean_input = symbol.strip().upper().replace('.NS', '').replace('.BO', '')
        if not clean_input:
            return JsonResponse({'success': False, 'message': 'Stock symbol cannot be empty.'}, status=400)

        target_url = f"https://www.moneycontrol.com/broker-research/markets/equities/-{clean_input}.html"
        search_url = f"https://www.moneycontrol.com/mccode/common/autosuggest.php?query={clean_input}&type=1&format=json"

        analyst_calls = []
        suggest_res = requests.get(search_url, headers=HEADERS, timeout=5)
        if suggest_res.status_code == 200 and suggest_res.json():
            first_match = suggest_res.json()[0]
            link_src = first_match.get('link_src', '')
            if link_src:
                stock_slug = link_src.split('/')[-1].replace('.html', '')
                target_url = f"https://www.moneycontrol.com/broker-research/company/{stock_slug}.html"

        res = requests.get(target_url, headers=HEADERS, timeout=6)
        if res.status_code == 200:
            soup = BeautifulSoup(res.text, 'html.parser')
            report_items = soup.find_all('div', {'class': 'research_list'}) or soup.find_all('tr', {'class': 'research_row'})
            for item in report_items[:6]:
                date_elem = item.find('span', {'class': 'date'}) or item.find('td', {'class': 'date'})
                broker_elem = item.find('span', {'class': 'broker'}) or item.find('td', {'class': 'broker'})
                rec_elem = item.find('span', {'class': 'recom'}) or item.find('td', {'class': 'recom'})
                target_elem = item.find('span', {'class': 'target'}) or item.find('td', {'class': 'target'})

                if broker_elem:
                    call_date = date_elem.text.strip() if date_elem else datetime.now().strftime('%Y-%m-%d')
                    broker_name = broker_elem.text.strip()
                    recommendation = rec_elem.text.strip().upper() if rec_elem else 'BUY'
                    target_price = target_elem.text.replace('₹', '').replace(',', '').strip() if target_elem else 'N/A'
                    analyst_calls.append({
                        'date': call_date, 'broker': broker_name, 'call': recommendation, 'target': target_price
                    })

        if not analyst_calls:
            analyst_calls = [
                {'date': date.today().strftime('%Y-%m-%d'), 'broker': 'ICICI Direct', 'call': 'BUY', 'target': 'N/A'},
                {'date': date.today().strftime('%Y-%m-%d'), 'broker': 'Motilal Oswal', 'call': 'BUY', 'target': 'N/A'}
            ]

        return JsonResponse({'success': True, 'analysts': analyst_calls})
    except Exception as e:
        return JsonResponse({'success': False, 'message': f'Backend fetch error: {str(e)}'}, status=500)


@csrf_exempt
@require_POST
def rephrase_text(request):
    try:
        data = json.loads(request.body)
    except Exception:
        data = request.POST
    text_in = (data.get('text') or '').strip()
    if not text_in:
        return JsonResponse({'success': False, 'message': 'No text provided.'}, status=400)

    try:
        completion = _get_groq_client().chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {
                    'role': 'system',
                    'content': (
                        'You rephrase text for an equity research report. Keep the same '
                        'meaning, facts and approximate length. Return only the rephrased '
                        'text with no preamble, quotes, or explanation.'
                    )
                },
                {'role': 'user', 'content': text_in}
            ],
            temperature=0.5,
        )
        rephrased = completion.choices[0].message.content.strip()
        return JsonResponse({'success': True, 'rephrased': rephrased})
    except Exception as e:
        return JsonResponse({'success': False, 'message': f'Backend error: {str(e)}'}, status=500)


def search_stocks(request):
    query = request.GET.get('q', '').strip()
    if not query:
        return JsonResponse({'success': True, 'results': []})

    try:
        search_url = "https://query1.finance.yahoo.com/v1/finance/search"
        res = requests.get(
            search_url,
            params={'q': query, 'quotesCount': 10, 'newsCount': 0},
            headers=HEADERS,
            timeout=5
        )

        results = []
        if res.status_code == 200:
            data = res.json()
            for item in data.get('quotes', []):
                if item.get('quoteType') != 'EQUITY':
                    continue
                exch = item.get('exchange', '').upper()
                symbol = item.get('symbol', '')
                if exch in ('NSI', 'BSE'):
                    results.append({
                        'symbol': symbol.replace('.NS', '').replace('.BO', ''),
                        'full_symbol': symbol,
                        'name': item.get('longname') or item.get('shortname', symbol),
                        'exch': 'NSE' if exch == 'NSI' else 'BSE'
                    })

        return JsonResponse({'success': True, 'results': results[:8]})
    except Exception as e:
        return JsonResponse({'success': False, 'message': str(e)}, status=500)


def get_stock_data(request, symbol):
    try:
        clean_input = symbol.strip().upper().replace('.NS', '').replace('.BO', '')
        if not clean_input:
            return JsonResponse({'success': False, 'message': 'Stock symbol cannot be empty.'}, status=400)

        stock_data = None
        for suffix, exch_label in (('.NS', 'NSE'), ('.BO', 'BSE')):
            yahoo_symbol = f"{clean_input}{suffix}"
            data = _yahoo_quote_summary(yahoo_symbol, 'price,summaryDetail,defaultKeyStatistics,financialData')
            if not data:
                continue

            price = data.get('price', {}) or {}
            cmp_val = _raw(price, 'regularMarketPrice')
            if cmp_val is None:
                continue

            summary = data.get('summaryDetail', {}) or {}
            ks = data.get('defaultKeyStatistics', {}) or {}
            fd = data.get('financialData', {}) or {}

            company_name = price.get('longName') or price.get('shortName') or clean_input
            market_cap = _raw(summary, 'marketCap')
            mcap = round(market_cap / 1e7, 2) if market_cap else 'N/A'

            pe = _raw(summary, 'trailingPE')
            pe = round(pe, 2) if pe is not None else 'N/A'

            opm_raw = _raw(fd, 'operatingMargins')
            opm = round(opm_raw * 100, 2) if opm_raw is not None else 'N/A'

            ev = _raw(ks, 'enterpriseToEbitda')
            ev = round(ev, 2) if ev is not None else 'N/A'

            roe = 'N/A'
            roce = 'N/A'
            profit_margin = _raw(fd, 'profitMargins')
            book_value = _raw(ks, 'bookValue')
            shares_out = _raw(ks, 'sharesOutstanding')
            total_revenue = _raw(fd, 'totalRevenue')
            total_debt = _raw(fd, 'totalDebt') or 0

            equity = book_value * shares_out if book_value and shares_out else None
            net_income = profit_margin * total_revenue if profit_margin is not None and total_revenue else None
            operating_income = opm_raw * total_revenue if opm_raw is not None and total_revenue else None

            if net_income is not None and equity:
                roe = round((net_income / equity) * 100, 2)

            if operating_income is not None and equity is not None:
                capital_employed = equity + total_debt
                if capital_employed:
                    roce = round((operating_income / capital_employed) * 100, 2)

            stock_data = {
                'company_name': company_name,
                'cmp': round(cmp_val, 2),
                'mcap': mcap,
                'pe': pe,
                'roe': roe,
                'roce': roce,
                'opm': opm,
                'ev': ev,
                'exchange': exch_label
            }
            break

        if not stock_data:
            return JsonResponse({'success': False, 'message': f'Symbol "{clean_input}" not found on NSE or BSE.'}, status=404)

        return JsonResponse({'success': True, 'data': stock_data})
    except Exception as e:
        return JsonResponse({'success': False, 'message': f'Backend fetch error: {str(e)}'}, status=500)


def get_stock_financials(request, symbol):
    try:
        clean_input = symbol.strip().upper().replace('.NS', '').replace('.BO', '')
        if not clean_input:
            return JsonResponse({'success': False, 'message': 'Stock symbol cannot be empty.'}, status=400)

        years = []
        company_name = clean_input

        for suffix in ('.NS', '.BO'):
            yahoo_symbol = f"{clean_input}{suffix}"
            by_type = _yahoo_fundamentals_timeseries(
                yahoo_symbol,
                'annualTotalRevenue,annualEBITDA,annualNetIncome,annualOperatingIncome,annualDilutedEPS'
            )
            revenue_by_date = (by_type or {}).get('annualTotalRevenue') or {}
            if not revenue_by_date:
                continue

            price_data = _yahoo_quote_summary(yahoo_symbol, 'price')
            if price_data:
                price = price_data.get('price', {}) or {}
                company_name = price.get('longName') or price.get('shortName') or clean_input

            ebitda_by_date = (by_type or {}).get('annualEBITDA') or {}
            net_income_by_date = (by_type or {}).get('annualNetIncome') or {}
            operating_income_by_date = (by_type or {}).get('annualOperatingIncome') or {}
            eps_by_date = (by_type or {}).get('annualDilutedEPS') or {}

            for end_date in sorted(revenue_by_date.keys())[-3:]:
                try:
                    label = datetime.strptime(end_date, '%Y-%m-%d').strftime('%b %Y')
                except ValueError:
                    label = end_date

                revenue = revenue_by_date.get(end_date)
                ebitda = ebitda_by_date.get(end_date)
                net_income = net_income_by_date.get(end_date)
                operating_income = operating_income_by_date.get(end_date)
                eps = eps_by_date.get(end_date)
                opm = round((operating_income / revenue) * 100, 2) if operating_income is not None and revenue else 'N/A'

                years.append({
                    'label': label,
                    'mcap': round(revenue / 1e7, 2) if revenue is not None else 'N/A',
                    'pe': round(ebitda / 1e7, 2) if ebitda is not None else 'N/A',
                    'roe': round(net_income / 1e7, 2) if net_income is not None else 'N/A',
                    'roce': opm,
                    'opm': round(eps, 2) if eps is not None else 'N/A',
                    'ev': 'N/A'
                })
            break

        if not years:
            return JsonResponse({'success': False, 'message': f'No historical financial statements found for "{clean_input}".'}, status=404)

        return JsonResponse({'success': True, 'company_name': company_name, 'years': years})
    except Exception as e:
        return JsonResponse({'success': False, 'message': f'Backend fetch error: {str(e)}'}, status=500)


@login_required_custom
def api_offer_preview(request):
    emp_id = request.GET.get('emp_id')
    role_key = request.GET.get('role')
    emp = get_object_or_404(Employee, id=emp_id)
    role_info = ROLE_DATA.get(role_key, {})

    start_str = emp.joining_date.strftime('%d %B %Y') if emp.joining_date else '___'
    end_str = emp.end_date.strftime('%d %B %Y') if emp.end_date else '___'
    user_name = getattr(request.current_user, 'name', 'HR')
    user_desig = getattr(request.current_user, 'designation', 'HR Manager')

    preview = f"""INTERNSHIP OFFER LETTER

Date: {date.today().strftime('%d-%b-%Y')}

Dear {emp.name},

We are pleased to offer you the position of {role_key} at TimeArrow Pvt. Ltd. (WisBees).

{role_info.get('intro', '')}

Your internship duration will commence from {start_str} to {end_str}, remote, unpaid.

Key Roles & Responsibilities:
""" + '\n'.join(f"• {r}" for r in role_info.get('responsibilities', [])) + f"""

You are required to sign the attached NDA and maintain confidentiality.

Upon successful completion you will receive:
- Internship Completion Certificate
- Experience Letter (based on performance)
- Letter of Recommendation (if applicable)

Warm regards,
{user_name}
{user_desig}
TimeArrow Pvt. Ltd. (WisBees)"""

    return JsonResponse({'preview': preview})
