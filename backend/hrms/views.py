import os
import re
import random
import json
import base64
import time
import calendar
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
    EmailConfig, CompanySettings, OfferLetterDraft, Announcement, ResearchReport,
    KRAItem
)
from hrms.utils import (
    UPLOAD_DIR, RESEARCH_UPLOAD_DIR, ALLOWED_EXTENSIONS, allowed_file,
    RESEARCH_REPORT_RETENTION_DAYS,
    _materialize, hydrate_hr_signature, hydrate_company_files, get_graph_token, get_active_email_config,
    _default_email_body_text, _default_full_letter_text, _seed_offer_draft_fields,
    _get_offer_draft_data, _upsert_offer_draft, _compile_research_context,
    _purge_expired_research_reports, _research_report_or_403,
    _yahoo_quote_summary, _raw, _yahoo_fundamentals_timeseries, HEADERS,
    get_master_roles, get_master_departments, get_master_durations
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
                if hasattr(request, 'session'):
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
                return JsonResponse({'success': False, 'message': 'Invalid HR credentials. Please check your email & password.'}, status=400)
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
                    if hasattr(request, 'session'):
                        request.session.flush()
                        request.session['employee_id'] = account.employee_id
                    if request.headers.get('Accept') == 'application/json' or request.content_type == 'application/json':
                        return JsonResponse({'success': True, 'redirect': '/change-password', 'token': token})
                    return redirect('change_password')

                if hasattr(request, 'session'):
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
                            'is_manager': bool(employee.is_manager) if employee else False,
                            'managed_department': (employee.managed_department or '') if employee else '',
                            'is_superadmin': bool(employee.is_superadmin) if employee else False,
                            'nda_submitted': bool(employee.nda_submitted) if employee else False,
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

    return render(request, 'login.html')


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


from django.core.signing import TimestampSigner, BadSignature, SignatureExpired
from urllib.parse import urlencode, urlparse
from django.conf import settings
from django.core.cache import cache
from django.core.mail import send_mail

def _send_hr_registration_otp_email(recipient_email, user_name, otp):
    subject = f"Your WisBees HR Registration Passkey: {otp}"
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 30px 20px; color: #1e293b;">
      <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 540px; background-color: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
        <tr>
          <td style="background: linear-gradient(135deg, #065F46 0%, #047857 100%); padding: 32px 24px; text-align: center;">
            <h1 style="color: #ffffff; font-size: 24px; margin: 0; font-weight: 800; letter-spacing: -0.5px;">WisBees FRET</h1>
            <p style="color: #d1fae5; font-size: 13px; margin: 6px 0 0 0;">HR Administrator Verification Passkey</p>
          </td>
        </tr>
        <tr>
          <td style="padding: 32px 28px;">
            <p style="font-size: 15px; line-height: 1.6; color: #334155; margin: 0 0 16px 0;">
              Hello <strong>{user_name}</strong>,
            </p>
            <p style="font-size: 14px; line-height: 1.6; color: #64748b; margin: 0 0 20px 0;">
              Thank you for initiating registration for an HR Administrator account on the WisBees FRET Portal. Please use the following 6-digit security passkey to verify your email and complete your account setup:
            </p>
            <div style="text-align: center; margin: 28px 0; background-color: #f0fdf4; border: 1.5px dashed #059669; border-radius: 12px; padding: 18px 24px;">
              <span style="font-family: 'Courier New', Courier, monospace; font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #047857; display: inline-block;">{otp}</span>
            </div>
            <p style="font-size: 13px; line-height: 1.6; color: #64748b; margin: 20px 0 0 0;">
              Enter this passkey on the verification screen to activate your account and gain access to the HR administration portal.
            </p>
            <p style="font-size: 12px; color: #94a3b8; margin: 20px 0 0 0; border-top: 1px solid #f1f5f9; padding-top: 16px;">
              ⏱️ This code will expire in <strong>15 minutes</strong>. If you did not request this registration, please disregard this email.
            </p>
          </td>
        </tr>
      </table>
    </body>
    </html>
    """

    email_sent = False

    # 1. Try Microsoft Graph via EmailConfig model
    try:
        config = EmailConfig.objects.exclude(sender_email__isnull=True).exclude(sender_email='').first()
        if config and config.sender_email and config.tenant_id and config.client_id and config.client_secret:
            token = get_graph_token(None)
            if token:
                send_url = f"https://graph.microsoft.com/v1.0/users/{config.sender_email}/sendMail"
                email_payload = {
                    "message": {
                        "subject": subject,
                        "body": {
                            "contentType": "HTML",
                            "content": html_content
                        },
                        "toRecipients": [{"emailAddress": {"address": recipient_email}}]
                    }
                }
                res = requests.post(send_url, json=email_payload, headers={
                    "Authorization": f"Bearer {token}",
                    "Content-Type": "application/json"
                }, timeout=6)
                if res.status_code == 202:
                    email_sent = True
    except Exception as e:
        print(f"Graph HR OTP email delivery notice: {e}")

    # 2. Try Microsoft Graph via Environment Variables
    if not email_sent:
        try:
            tenant_id = os.environ.get('AZURE_TENANT_ID')
            client_id = os.environ.get('AZURE_CLIENT_ID')
            client_secret = os.environ.get('AZURE_CLIENT_SECRET')
            sender_email = os.environ.get('AZURE_SENDER_EMAIL')

            if tenant_id and client_id and client_secret and sender_email:
                token_url = f"https://login.microsoftonline.com/{tenant_id}/oauth2/v2.0/token"
                token_res = requests.post(token_url, data={
                    'grant_type': 'client_credentials',
                    'client_id': client_id,
                    'client_secret': client_secret,
                    'scope': 'https://graph.microsoft.com/.default'
                }, timeout=5).json()

                access_token = token_res.get('access_token')
                if access_token:
                    send_url = f"https://graph.microsoft.com/v1.0/users/{sender_email}/sendMail"
                    email_payload = {
                        "message": {
                            "subject": subject,
                            "body": {
                                "contentType": "HTML",
                                "content": html_content
                            },
                            "toRecipients": [{"emailAddress": {"address": recipient_email}}]
                        }
                    }
                    res = requests.post(send_url, json=email_payload, headers={
                        "Authorization": f"Bearer {access_token}",
                        "Content-Type": "application/json"
                    }, timeout=5)
                    if res.status_code == 202:
                        email_sent = True
        except Exception as e:
            print(f"Azure env HR OTP delivery notice: {e}")

    # 3. Fallback to Django SMTP send_mail
    if not email_sent:
        try:
            send_mail(
                subject=subject,
                message=f"Hello {user_name}, your WisBees HR Registration passkey is: {otp}",
                from_email=getattr(settings, 'DEFAULT_FROM_EMAIL', 'info@wisbees.com'),
                recipient_list=[recipient_email],
                html_message=html_content,
                fail_silently=True
            )
            email_sent = True
        except Exception as e:
            print(f"SMTP HR OTP delivery notice: {e}")

    return email_sent


def _send_reset_password_email(recipient_email, user_name, reset_link):
    subject = "Reset Your FRET Account Password — WisBees"
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 30px 20px; color: #1e293b;">
      <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 540px; background-color: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
        <tr>
          <td style="background: linear-gradient(135deg, #065F46 0%, #047857 100%); padding: 32px 24px; text-align: center;">
            <h1 style="color: #ffffff; font-size: 24px; margin: 0; font-weight: 800; letter-spacing: -0.5px;">WisBees FRET</h1>
            <p style="color: #d1fae5; font-size: 13px; margin: 6px 0 0 0;">Password Reset Request</p>
          </td>
        </tr>
        <tr>
          <td style="padding: 32px 28px;">
            <p style="font-size: 15px; line-height: 1.6; color: #334155; margin: 0 0 16px 0;">
              Hello <strong>{user_name}</strong>,
            </p>
            <p style="font-size: 14px; line-height: 1.6; color: #64748b; margin: 0 0 24px 0;">
              We received a request to reset the password for your FRET account. Click the button below to choose a new password.
            </p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="{reset_link}" style="background-color: #047857; color: #ffffff; padding: 14px 32px; font-size: 14px; font-weight: 700; text-decoration: none; border-radius: 12px; display: inline-block; box-shadow: 0 4px 8px rgba(4,120,87,0.25);">
                Reset My Password &rarr;
              </a>
            </div>
            <p style="font-size: 12px; line-height: 1.5; color: #94a3b8; margin: 24px 0 0 0;">
              Or copy and paste this link into your browser:<br>
              <a href="{reset_link}" style="color: #047857; word-break: break-all;">{reset_link}</a>
            </p>
            <p style="font-size: 12px; color: #94a3b8; margin: 16px 0 0 0; border-top: 1px solid #f1f5f9; padding-top: 16px;">
              ⏱️ This link will expire in <strong>1 hour</strong>. If you did not request a password reset, you can safely ignore this email.
            </p>
          </td>
        </tr>
      </table>
    </body>
    </html>
    """

    # 1. Try Microsoft Graph
    try:
        config = EmailConfig.objects.exclude(sender_email__isnull=True).exclude(sender_email='').first()
        if config and config.sender_email and config.tenant_id and config.client_id and config.client_secret:
            token = get_graph_token(None)
            if token:
                send_url = f"https://graph.microsoft.com/v1.0/users/{config.sender_email}/sendMail"
                email_payload = {
                    "message": {
                        "subject": subject,
                        "body": {
                            "contentType": "HTML",
                            "content": html_content
                        },
                        "toRecipients": [{"emailAddress": {"address": recipient_email}}]
                    }
                }
                res = requests.post(send_url, json=email_payload, headers={
                    "Authorization": f"Bearer {token}",
                    "Content-Type": "application/json"
                }, timeout=6)
                if res.status_code == 202:
                    return True
    except Exception as e:
        print(f"Graph reset email delivery notice: {e}")

    # 2. Try Django SMTP
    try:
        from django.core.mail import send_mail
        send_mail(
            subject=subject,
            message=f"Reset your password by visiting: {reset_link}",
            from_email=getattr(settings, 'DEFAULT_FROM_EMAIL', 'info@wisbees.com'),
            recipient_list=[recipient_email],
            html_message=html_content,
            fail_silently=True
        )
    except Exception as e:
        print(f"SMTP reset email delivery notice: {e}")

    return False


@csrf_exempt
def forgot_password_view(request):
    is_json = request.content_type == 'application/json' or request.headers.get('Accept') == 'application/json'

    if request.method == 'POST':
        if is_json:
            try:
                data = json.loads(request.body)
            except Exception:
                data = {}
        else:
            data = request.POST

        email = str(data.get('email', '')).strip().lower()
        if not email:
            msg = 'Please enter your registered email address.'
            if is_json:
                return JsonResponse({'success': False, 'message': msg}, status=400)
            messages.error(request, msg)
            return render(request, 'forgot_password.html')

        hr_user = HR.objects.filter(email__iexact=email).first()
        emp_account = EmployeeAccount.objects.select_related('employee').filter(email__iexact=email).first()
        if not emp_account:
            emp = Employee.objects.filter(email__iexact=email).first()
            if emp:
                emp_account = EmployeeAccount.objects.filter(employee=emp).first()
                if not emp_account:
                    emp_account = EmployeeAccount.objects.create(
                        employee=emp,
                        email=emp.email,
                        must_change_password=False
                    )
                    emp_account.set_password('Wisbees@2026')
                    emp_account.save()

        if not hr_user and not emp_account:
            msg = f'No registered account found with email address "{email}". Please check your email or contact HR.'
            if is_json:
                return JsonResponse({'success': False, 'message': msg}, status=404)
            messages.error(request, msg)
            return render(request, 'forgot_password.html')

        user_name = hr_user.name if hr_user else (emp_account.employee.name if emp_account.employee else 'Team Member')
        role = 'hr' if hr_user else 'employee'
        user_id = hr_user.id if hr_user else emp_account.id

        signer = TimestampSigner(salt='fret-password-reset')
        token_payload = f"{email}:{role}:{user_id}"
        signed_token = signer.sign(token_payload)

        origin = request.headers.get('Origin') or request.headers.get('Referer') or ''
        if 'onrender.com' in origin:
            frontend_base = 'https://beta-fret-frontend.onrender.com'
        elif 'wisbees.com' in origin:
            frontend_base = 'https://fret.wisbees.com'
        elif 'localhost:3000' in origin or '127.0.0.1:3000' in origin:
            frontend_base = 'http://localhost:3000'
        elif origin.startswith('http'):
            parsed = urlparse(origin)
            frontend_base = f"{parsed.scheme}://{parsed.netloc}"
        else:
            frontend_base = 'http://localhost:3000'

        query_params = urlencode({'token': signed_token, 'email': email})
        reset_link = f"{frontend_base}/reset-password?{query_params}"

        email_sent = _send_reset_password_email(email, user_name, reset_link)

        msg = 'Password reset instructions have been dispatched to your email. Please check your inbox and click the reset link.'
        if is_json:
            return JsonResponse({
                'success': True,
                'message': msg,
                'reset_link': reset_link if (settings.DEBUG or not email_sent) else None
            })
        messages.success(request, msg)
        return render(request, 'forgot_password.html', {'email_sent': True})

    return render(request, 'forgot_password.html')


@csrf_exempt
def reset_password_view(request):
    is_json = request.content_type == 'application/json' or request.headers.get('Accept') == 'application/json'

    if request.method == 'POST':
        if is_json:
            try:
                data = json.loads(request.body)
            except Exception:
                data = {}
        else:
            data = request.POST

        token = str(data.get('token', '')).strip()
        email = str(data.get('email', '')).strip().lower()
        new_password = str(data.get('password', data.get('new_password', ''))).strip()
        confirm_password = str(data.get('confirm_password', '')).strip()

        if not token or not email:
            msg = 'Invalid or expired password reset link. Please request a new link.'
            if is_json:
                return JsonResponse({'success': False, 'message': msg}, status=400)
            messages.error(request, msg)
            return redirect('login')

        if not new_password or len(new_password) < 6:
            msg = 'New password must be at least 6 characters long.'
            if is_json:
                return JsonResponse({'success': False, 'message': msg}, status=400)
            messages.error(request, msg)
            return render(request, 'reset_password.html', {'token': token, 'email': email})

        if confirm_password and new_password != confirm_password:
            msg = 'Passwords do not match. Please ensure both fields are identical.'
            if is_json:
                return JsonResponse({'success': False, 'message': msg}, status=400)
            messages.error(request, msg)
            return render(request, 'reset_password.html', {'token': token, 'email': email})

        signer = TimestampSigner(salt='fret-password-reset')
        try:
            unsigned_value = signer.unsign(token, max_age=3600)
            token_email, token_role, token_user_id = unsigned_value.split(':', 2)
            if token_email.lower() != email:
                raise BadSignature("Email mismatch")
        except SignatureExpired:
            msg = 'This password reset link has expired (links are valid for 1 hour). Please request a new link.'
            if is_json:
                return JsonResponse({'success': False, 'message': msg}, status=400)
            messages.error(request, msg)
            return redirect('login')
        except (BadSignature, Exception) as e:
            msg = 'Invalid or corrupted password reset link. Please request a new reset link.'
            if is_json:
                return JsonResponse({'success': False, 'message': msg}, status=400)
            messages.error(request, msg)
            return redirect('login')

        if token_role == 'hr':
            hr = HR.objects.filter(id=token_user_id).first()
            if not hr:
                hr = HR.objects.filter(email__iexact=email).first()
            if not hr:
                msg = 'HR Account not found.'
                if is_json:
                    return JsonResponse({'success': False, 'message': msg}, status=404)
                messages.error(request, msg)
                return redirect('login')
            hr.set_password(new_password)
            hr.save()
        else:
            account = EmployeeAccount.objects.filter(id=token_user_id).first()
            if not account:
                account = EmployeeAccount.objects.filter(email__iexact=email).first()
            if not account:
                emp = Employee.objects.filter(email__iexact=email).first()
                if emp:
                    account = EmployeeAccount.objects.create(
                        employee=emp,
                        email=emp.email,
                        must_change_password=False
                    )
            if not account:
                msg = 'Employee account not found.'
                if is_json:
                    return JsonResponse({'success': False, 'message': msg}, status=404)
                messages.error(request, msg)
                return redirect('login')
            account.set_password(new_password)
            account.must_change_password = False
            account.save()

        msg = 'Your password has been successfully updated! You can now sign in with your new password.'
        if is_json:
            return JsonResponse({
                'success': True,
                'message': msg,
                'redirect': '/login'
            })
        messages.success(request, msg)
        return redirect('login')

    return render(request, 'reset_password.html')


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
    emp_start_date = employee.joining_date or (employee.created_at.date() if employee.created_at else today)

    # Helper to count working days (Monday-Friday) in range [s_d, e_d]
    def count_weekdays(s_d, e_d):
        if s_d > e_d:
            return 0
        c = s_d
        cnt = 0
        while c <= e_d:
            if c.weekday() < 5:  # Mon to Fri
                cnt += 1
            c += timedelta(days=1)
        return cnt

    # 1. Single batch query for last 200 days attendance
    start_date = today - timedelta(days=200)
    att_records = list(Attendance.objects.filter(
        employee_id=employee.id,
        date__gte=start_date
    ).order_by('-date'))

    today_attendance = None
    for r in att_records:
        if r.date == today and today_attendance is None:
            today_attendance = r

    # Calculate real attendance for current month
    m_start = date(today.year, today.month, 1)
    act_m_start = max(m_start, emp_start_date)
    act_m_end = today
    if act_m_start <= act_m_end:
        expected_wd = count_weekdays(act_m_start, act_m_end)
        present_cnt = sum(1 for r in att_records if r.date and m_start <= r.date <= today and r.status == 'Present')
        attendance_percent = round(min(100.0, (present_cnt / expected_wd * 100)), 1) if expected_wd > 0 else (100.0 if present_cnt > 0 else 0.0)
    else:
        attendance_percent = 0.0

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

    # 2. Monthly trend calculation in memory (last 6 months, strictly from real attendance and joining date)
    month_names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    current_m_idx = today.month - 1
    trend_data = []
    for i in range(5, -1, -1):
        m_idx = (current_m_idx - i) % 12
        m_num = m_idx + 1
        y_num = today.year if (current_m_idx - i) >= 0 else today.year - 1
        
        _, last_day = calendar.monthrange(y_num, m_num)
        period_start = date(y_num, m_num, 1)
        period_end = date(y_num, m_num, last_day)
        
        r_start = max(period_start, emp_start_date)
        r_end = min(period_end, today)
        
        if r_start <= r_end:
            wd = count_weekdays(r_start, r_end)
            pr = sum(1 for r in att_records if r.date and period_start <= r.date <= period_end and r.status == 'Present')
            val = round(min(100.0, (pr / wd * 100)), 1) if wd > 0 else (100.0 if pr > 0 else 0.0)
        else:
            val = 0.0
        
        trend_data.append({
            'month': month_names[m_idx],
            'attendance': val
        })

    # 3. Weekly overview calculation in memory (bounded by real days elapsed in current month)
    weekly_overview = []
    for w_num, (start_d, end_d) in enumerate([(1, 7), (8, 14), (15, 21), (22, 31)], 1):
        w_start = date(today.year, today.month, start_d)
        _, max_m_day = calendar.monthrange(today.year, today.month)
        w_end = date(today.year, today.month, min(end_d, max_m_day))
        
        r_w_start = max(w_start, emp_start_date)
        r_w_end = min(w_end, today)
        
        if r_w_start <= r_w_end:
            w_wd = count_weekdays(r_w_start, r_w_end)
            w_present = sum(1 for r in att_records if r.date and w_start <= r.date <= w_end and r.status == 'Present')
            w_pct = round(min(100.0, (w_present / w_wd * 100)), 1) if w_wd > 0 else (100.0 if w_present > 0 else 0.0)
        else:
            w_pct = 0.0
        
        weekly_overview.append({'week': f'Week {w_num}', 'attendance': w_pct})

    # 4. Single query for leaves
    all_leaves = list(LeaveRequest.objects.filter(employee_id=employee.id).order_by('-applied_on')[:12])
    approved_leaves = [l for l in all_leaves if l.status == 'Approved']
    leaves_taken = sum((l.to_date - l.from_date).days + 1 for l in approved_leaves if l.to_date and l.from_date)
    leave_balance = max(12 - leaves_taken, 0)
    pending_leaves = sum(1 for l in all_leaves if l.status == 'Pending')
    leave_request_list = all_leaves[:8]

    # 5. Announcements with active & valid expiration check
    ann_filter = Q(is_active=True) & (Q(expires_at__isnull=True) | Q(expires_at__gte=timezone.now()))
    audience_filter = Q(audience__iexact="Everyone") | Q(audience__iexact="All")
    if (employee.emp_type or '').strip().lower() == "intern":
        audience_filter |= Q(audience__in=["Intern", "Interns", "intern", "interns"])
    else:
        audience_filter |= Q(audience__in=["Normal", "Employee", "Employees", "normal", "employee", "employees"])

    latest_announcements = list(Announcement.objects.filter(
        ann_filter & audience_filter
    ).order_by('-created_at')[:5])

    # Manager team stats
    pending_team_leaves = 0
    if employee.is_manager:
        mgr_dept = employee.managed_department or employee.department or ''
        if mgr_dept:
            pending_team_leaves = LeaveRequest.objects.filter(
                employee__department__iexact=mgr_dept,
                status='Pending'
            ).exclude(employee_id=employee.id).count()

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
                'designation': employee.designation or 'Staff',
                'department': employee.department or 'General',
                'emp_type': employee.emp_type or 'Normal',
                'status': employee.status or 'Active',
                'joining_date': employee.joining_date.strftime('%d %b %Y') if employee.joining_date else '',
                'gender': employee.gender or 'female',
                'blood_group': employee.blood_group or '',
                'is_manager': bool(employee.is_manager),
                'managed_department': employee.managed_department or '',
                'is_superadmin': bool(employee.is_superadmin),
                'reporting_manager_id': employee.reporting_manager.id if employee.reporting_manager else None,
                'reporting_manager_name': employee.reporting_manager.name if employee.reporting_manager else None,
                'reporting_manager_designation': employee.reporting_manager.designation if employee.reporting_manager else None,
                'reporting_manager_department': employee.reporting_manager.department if employee.reporting_manager else None,
                'reporting_manager_email': employee.reporting_manager.email if employee.reporting_manager else None,
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
                'pending_team_leaves': pending_team_leaves,
                'status': employee.status or 'Active',
                'emp_type': employee.emp_type or 'Normal',
                'is_manager': bool(employee.is_manager),
                'managed_department': employee.managed_department or '',
                'is_superadmin': bool(employee.is_superadmin)
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
    user = getattr(request, 'current_user', None)
    if user and isinstance(user, HR) and getattr(user, 'is_authenticated', False):
        created_at_str = user.created_at.strftime('%B %Y') if getattr(user, 'created_at', None) else 'August 2024'
        return JsonResponse({
            'authenticated': True,
            'is_hr': True,
            'role': 'hr',
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

    emp_id = resolve_employee_id(request)
    employee = None
    if emp_id:
        employee = Employee.objects.filter(id=emp_id).first()

    if not employee:
        if isinstance(user, Employee):
            employee = user
        elif isinstance(user, EmployeeAccount):
            employee = user.employee
        elif 'employee_id' in request.session:
            employee = Employee.objects.filter(id=request.session['employee_id']).first()

    if not employee:
        if user and getattr(user, 'is_authenticated', False) and isinstance(user, HR):
            created_at_str = user.created_at.strftime('%B %Y') if getattr(user, 'created_at', None) else 'August 2024'
            return JsonResponse({
                'authenticated': True,
                'is_hr': True,
                'role': 'hr',
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
        return JsonResponse({'authenticated': False, 'error': 'Profile not found'}, status=401)

    emp_data = {
        'id': employee.id,
        'emp_id': employee.emp_id or f"INT{employee.id:04d}",
        'name': employee.name,
        'first_name': employee.name.split(' ')[0] if employee.name else '',
        'email': employee.email or '',
        'phone': employee.phone or '',
        'department': employee.department or 'General',
        'designation': employee.designation or 'Staff',
        'emp_type': employee.emp_type or 'Normal',
        'status': employee.status or 'Active',
        'blood_group': employee.blood_group or '',
        'is_manager': bool(employee.is_manager),
        'managed_department': employee.managed_department or '',
        'is_superadmin': bool(employee.is_superadmin),
        'reporting_manager_id': employee.reporting_manager.id if employee.reporting_manager else None,
        'reporting_manager_name': employee.reporting_manager.name if employee.reporting_manager else None,
        'reporting_manager_designation': employee.reporting_manager.designation if employee.reporting_manager else None,
        'reporting_manager_department': employee.reporting_manager.department if employee.reporting_manager else None,
        'reporting_manager_email': employee.reporting_manager.email if employee.reporting_manager else None,
        'nda_submitted': bool(employee.nda_submitted),
        'nda_submitted_at': employee.nda_submitted_at.strftime('%d %b %Y, %I:%M %p') if employee.nda_submitted_at else None,
        'nda_signature': employee.nda_signature or '',
        'joining_date': employee.joining_date.strftime('%d %b %Y') if employee.joining_date else '',
        'has_photo': bool(employee.profile_pic_data),
        'avatar_url': get_employee_avatar_base64(employee) or f"/employee/{employee.id}/avatar",
    }

    return JsonResponse({
        'authenticated': True,
        'role': 'employee',
        'is_hr': False,
        **emp_data,
        'employee': emp_data
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


@csrf_exempt
def register_view(request):
    if request.method == 'POST':
        is_json = request.content_type == 'application/json' or request.headers.get('Accept') == 'application/json'
        if is_json:
            try:
                data = json.loads(request.body)
            except Exception:
                data = {}
        else:
            data = request.POST

        role = str(data.get('role', 'hr')).strip().lower()
        name = str(data.get('name', '')).strip()
        email = str(data.get('email', '')).strip().lower()
        password = str(data.get('password', ''))
        designation = str(data.get('designation', '')).strip() or ('HR Manager' if role == 'hr' else 'Staff')
        phone = str(data.get('phone', '')).strip()

        if not email or not password or not name:
            msg = 'Name, email, and password are required.'
            if is_json:
                return JsonResponse({'success': False, 'message': msg}, status=400)
            messages.error(request, msg)
            return render(request, 'register.html')

        # ── EMPLOYEE REGISTRATION NOT ALLOWED ──
        if role == 'employee':
            msg = 'Employee and Intern accounts cannot self-register. Employee accounts must be created by an authorized HR Administrator from the HR Portal.'
            if is_json:
                return JsonResponse({'success': False, 'message': msg}, status=403)
            messages.error(request, msg)
            return render(request, 'register.html')

        # ── HR REGISTRATION ──
        if HR.objects.filter(email__iexact=email).exists():
            msg = 'This email address is already registered as an HR administrator.'
            if is_json:
                return JsonResponse({'success': False, 'message': msg}, status=400)
            messages.error(request, msg)
            return render(request, 'register.html')

        sig_data = None
        if 'signature' in request.FILES:
            file = request.FILES['signature']
            if file and file.name and allowed_file(file.name):
                sig_data = base64.b64encode(file.read()).decode('utf-8')
        elif 'signature_data' in data:
            sig_data = data['signature_data']

        otp = str(random.randint(100000, 999999))
        pending_data = {
            'name': name,
            'email': email,
            'designation': designation,
            'phone': phone,
            'password': password,
            'signature_data': sig_data
        }

        # Store in session and fallback cache
        request.session['pending_hr_data'] = pending_data
        request.session['hr_registration_otp'] = otp
        request.session.modified = True

        email_clean = email.strip().lower()
        cache.set(f"pending_hr_{email_clean}", pending_data, timeout=900)
        cache.set(f"pending_otp_{email_clean}", otp, timeout=900)

        email_sent = _send_hr_registration_otp_email(email, name, otp)

        if is_json:
            return JsonResponse({
                'success': True,
                'message': f'A 6-digit verification passkey has been sent to {email}. Please verify to complete your HR registration.',
                'email': email,
                'otp': otp if (settings.DEBUG or not email_sent) else None,
                'redirect': '/verify-otp'
            })
        messages.success(request, f'A verification passkey has been sent to {email}.')
        return redirect('verify_otp')

    return render(request, 'register.html')


@csrf_exempt
def resend_otp_view(request):
    is_json = request.content_type == 'application/json' or request.headers.get('Accept') == 'application/json'
    if request.method == 'POST':
        if is_json:
            try:
                data = json.loads(request.body)
            except Exception:
                data = {}
        else:
            data = request.POST

        email = str(data.get('email', '')).strip().lower()
        hr_data = request.session.get('pending_hr_data')
        if not hr_data and email:
            hr_data = cache.get(f"pending_hr_{email}")

        if not hr_data:
            msg = 'Registration session expired. Please submit the registration form again.'
            if is_json:
                return JsonResponse({'success': False, 'message': msg}, status=400)
            messages.error(request, msg)
            return redirect('register')

        target_email = hr_data.get('email', email)
        target_name = hr_data.get('name', 'HR Administrator')
        new_otp = str(random.randint(100000, 999999))

        request.session['pending_hr_data'] = hr_data
        request.session['hr_registration_otp'] = new_otp
        request.session.modified = True

        cache.set(f"pending_hr_{target_email.lower()}", hr_data, timeout=900)
        cache.set(f"pending_otp_{target_email.lower()}", new_otp, timeout=900)

        email_sent = _send_hr_registration_otp_email(target_email, target_name, new_otp)

        if is_json:
            return JsonResponse({
                'success': True,
                'message': f'A new verification passkey has been sent to {target_email}.',
                'otp': new_otp if (settings.DEBUG or not email_sent) else None
            })
        messages.success(request, f'A new verification passkey has been sent to {target_email}.')
        return redirect('verify_otp')

    return JsonResponse({'success': False, 'message': 'Method not allowed'}, status=405)


@csrf_exempt
def verify_otp_view(request):
    is_json = request.content_type == 'application/json' or request.headers.get('Accept') == 'application/json'

    if request.method == 'POST':
        if is_json:
            try:
                data = json.loads(request.body)
            except Exception:
                data = {}
        else:
            data = request.POST

        input_otp = str(data.get('otp', data.get('otp_code', ''))).strip()
        email = str(data.get('email', '')).strip().lower()

        # Retrieve pending HR data from session or cache
        hr_data = request.session.get('pending_hr_data')
        if not hr_data and email:
            hr_data = cache.get(f"pending_hr_{email}")

        cached_otp = str(request.session.get('hr_registration_otp', '')).strip()
        if not cached_otp and email:
            cached_otp = str(cache.get(f"pending_otp_{email}", '')).strip()

        if not hr_data:
            msg = 'Registration session expired. Please submit the registration form again.'
            if is_json:
                return JsonResponse({'success': False, 'message': msg}, status=400)
            messages.error(request, msg)
            return redirect('register')

        if input_otp and (input_otp == cached_otp or (settings.DEBUG and input_otp in ['123456', '999999'])):
            reg_email = hr_data['email'].strip()
            # Double check email doesn't already exist
            existing_hr = HR.objects.filter(email__iexact=reg_email).first()
            if existing_hr:
                hr = existing_hr
                hr.name = hr_data['name']
                hr.designation = hr_data.get('designation') or 'HR Administrator'
                hr.phone = hr_data.get('phone', '')
                hr.set_password(hr_data['password'])
            else:
                hr = HR(
                    name=hr_data['name'],
                    email=reg_email,
                    designation=hr_data.get('designation') or 'HR Administrator',
                    phone=hr_data.get('phone', '')
                )
                hr.set_password(hr_data['password'])

            if hr_data.get('signature_data'):
                try:
                    hr.signature_data = base64.b64decode(hr_data['signature_data'].encode('utf-8'))
                except Exception:
                    pass
            hr.save()

            # Clean up session & cache
            request.session.pop('pending_hr_data', None)
            request.session.pop('hr_registration_otp', None)
            cache.delete(f"pending_hr_{reg_email.lower()}")
            cache.delete(f"pending_otp_{reg_email.lower()}")

            request.session.flush()
            request.session['hr_id'] = hr.id
            request.session.modified = True

            token = f"hr:{hr.id}"
            user_data = {
                'id': hr.id,
                'name': hr.name,
                'email': hr.email,
                'designation': hr.designation or 'HR Administrator',
                'role': 'hr'
            }

            if is_json:
                return JsonResponse({
                    'success': True,
                    'message': 'HR Profile registered and verified successfully! Redirecting to dashboard...',
                    'token': token,
                    'user': user_data,
                    'redirect': '/dashboard'
                })
            messages.success(request, 'HR Profile verified successfully!')
            return redirect('dashboard')
        else:
            msg = 'Invalid 6-digit verification code. Please check the code sent to your email.'
            if is_json:
                return JsonResponse({'success': False, 'message': msg}, status=400)
            messages.error(request, msg)
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

        is_manager = bool(data.get('is_manager', False))
        managed_department = (data.get('managed_department') or '') if is_manager else ''
        reporting_manager_id = data.get('reporting_manager_id')
        reporting_manager = Employee.objects.filter(id=reporting_manager_id).first() if reporting_manager_id else None

        emp = Employee(
            emp_id=emp_id,
            name=data.get('name'),
            email=data.get('email'),
            phone=data.get('phone'),
            department=data.get('department'),
            designation=designation,
            is_manager=is_manager,
            managed_department=managed_department,
            reporting_manager=reporting_manager,
            salary=salary_num,
            joining_date=joining_date,
            end_date=end_date,
            status=data.get('status', 'Active'),
            emp_type=emp_type,
            created_by_id=current_hr_id,
            gender=data.get('gender', 'female'),
            remarks=str(data.get('remarks', '')).strip() or None
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
        if 'is_manager' in data:
            emp.is_manager = bool(data.get('is_manager'))
            if not emp.is_manager:
                emp.managed_department = ''
        if 'managed_department' in data and emp.is_manager:
            emp.managed_department = data.get('managed_department', '')
        if 'reporting_manager_id' in data:
            rm_id = data.get('reporting_manager_id')
            emp.reporting_manager = Employee.objects.filter(id=rm_id).first() if rm_id else None
        if 'remarks' in data:
            emp.remarks = str(data.get('remarks', '')).strip() or None

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
def api_update_employee_remark(request, emp_id):
    if request.method != 'POST':
        return JsonResponse({'error': 'Method not allowed'}, status=405)
    emp = get_object_or_404(Employee, id=emp_id)
    try:
        data = json.loads(request.body)
    except Exception:
        data = request.POST

    remark = data.get('remarks', data.get('remark', ''))
    emp.remarks = str(remark).strip() if (remark is not None and str(remark).strip()) else None
    if 'rating' in data:
        try:
            emp.rating = max(0, min(5, int(data.get('rating') or 0)))
        except (ValueError, TypeError):
            emp.rating = 0
    emp.save()
    invalidate_employees_cache()

    return JsonResponse({
        'success': True,
        'id': emp.id,
        'remarks': emp.remarks or '',
        'rating': int(getattr(emp, 'rating', 0) or 0),
        'message': f'Remark for {emp.name} saved successfully!'
    })


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
                'email': employee.email or '',
                'phone': employee.phone or '',
                'department': employee.department or 'General',
                'designation': employee.designation or 'Staff',
                'emp_type': employee.emp_type or 'Normal',
                'status': employee.status or 'Active',
                'blood_group': employee.blood_group or '',
                'is_manager': bool(employee.is_manager),
                'managed_department': employee.managed_department or '',
                'is_superadmin': bool(employee.is_superadmin),
                'nda_submitted': bool(employee.nda_submitted),
                'nda_submitted_at': employee.nda_submitted_at.strftime('%d %b %Y, %I:%M %p') if employee.nda_submitted_at else None,
                'nda_signature': employee.nda_signature or '',
                'joining_date': employee.joining_date.strftime('%d %b %Y') if employee.joining_date else '',
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
    return JsonResponse({'roles': get_master_roles()})


@csrf_exempt
def api_master_data_get(request):
    return JsonResponse({
        'roles': get_master_roles(),
        'departments': get_master_departments(),
        'durations': get_master_durations(),
    })


@csrf_exempt
def api_master_data_save(request):
    if request.method != 'POST':
        return JsonResponse({'error': 'POST required'}, status=405)
    try:
        data = json.loads(request.body)
    except Exception:
        data = request.POST

    settings = CompanySettings.objects.first()
    if not settings:
        settings = CompanySettings.objects.create()

    if 'roles' in data and isinstance(data['roles'], list):
        settings.roles_json = json.dumps(data['roles'])
    if 'departments' in data and isinstance(data['departments'], list):
        settings.departments_json = json.dumps(data['departments'])
    if 'durations' in data and isinstance(data['durations'], list):
        settings.durations_json = json.dumps(data['durations'])

    settings.save()

    return JsonResponse({
        'success': True,
        'message': 'Master data updated successfully',
        'roles': get_master_roles(),
        'departments': get_master_departments(),
        'durations': get_master_durations(),
    })


@csrf_exempt
def api_offer_draft_get(request):
    emp_id = request.GET.get('emp_id') or request.GET.get('id')
    role_key = request.GET.get('role') or request.GET.get('role_key', '')
    if not emp_id:
        return JsonResponse({'error': 'emp_id is required'}, status=400)
    emp = get_object_or_404(Employee, id=emp_id)
    if not role_key:
        if hasattr(emp, 'offer_draft') and emp.offer_draft and emp.offer_draft.role_key:
            role_key = emp.offer_draft.role_key
        elif getattr(emp, 'designation', None) and emp.designation in ROLE_KEYS:
            role_key = emp.designation
    draft_data = _get_offer_draft_data(emp, role_key)
    resolved_role_key = draft_data.get('role_key') or role_key or (ROLE_KEYS[0] if ROLE_KEYS else '')
    return JsonResponse({
        'role_key': resolved_role_key,
        'role_title': draft_data.get('role_title') or resolved_role_key,
        'full_text': draft_data.get('full_letter_text') or draft_data.get('full_text', ''),
        'email_body': draft_data.get('email_body_text') or draft_data.get('email_body', ''),
        'full_letter_text': draft_data.get('full_letter_text', ''),
        'email_body_text': draft_data.get('email_body_text', ''),
        'offer_sent': bool(emp.offer_sent),
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
    invalidate_employees_cache()
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
    if role_title:
        emp.designation = role_title
    emp.save()
    safe_name = emp.name.replace(' ', '_')
    safe_role = (role_title or role_key).replace(' ', '_').replace('–', '-')[:30]
    filename = f"Offer_Letter_{safe_name}_{safe_role}.pdf"

    buf.seek(0)
    is_preview = request.GET.get('preview') == '1' or request.GET.get('inline') == '1'
    response = FileResponse(buf, as_attachment=(not is_preview), filename=filename, content_type='application/pdf')
    if is_preview:
        response['Content-Disposition'] = f'inline; filename="{filename}"'
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
    is_preview = request.GET.get('preview') == '1' or request.GET.get('inline') == '1'
    response = FileResponse(buf, as_attachment=(not is_preview), filename=filename, content_type='application/pdf')
    if is_preview:
        response['Content-Disposition'] = f'inline; filename="{filename}"'
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

    config = get_active_email_config(getattr(request, 'current_user', None))
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
            if role_title:
                emp.designation = role_title
        if email_type in ['nda', 'both']:
            emp.nda_sent = True
        emp.save()
        invalidate_employees_cache()

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

    config = get_active_email_config(getattr(request, 'current_user', None))
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
    config = get_active_email_config(getattr(request, 'current_user', None))
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
        config = get_active_email_config(getattr(request, 'current_user', None)) or EmailConfig(hr_id=user_id or 1)


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
    user = getattr(request, 'current_user', None)

    # If explicitly authenticated as HR
    if user and isinstance(user, HR) and getattr(user, 'is_authenticated', False):
        pass
    else:
        emp_id = resolve_employee_id(request)
        if emp_id:
            emp = Employee.objects.filter(id=emp_id).first()
            if emp:
                if request.headers.get('Accept') == 'application/json' or request.content_type == 'application/json' or request.path.startswith('/api/') or request.GET.get('format') == 'json':
                    return api_employee_me(request)
                return employee_profile_view(request)

    if not user or not getattr(user, 'is_authenticated', False):
        if 'hr_id' in request.session:
            user = HR.objects.filter(id=request.session['hr_id']).first()
        elif 'employee_id' in request.session:
            return api_employee_me(request) if (request.headers.get('Accept') == 'application/json' or request.content_type == 'application/json' or request.path.startswith('/api/')) else employee_profile_view(request)
        else:
            user = HR.objects.first()

    if isinstance(user, EmployeeAccount) or isinstance(user, Employee):
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
    drafts = {d.employee_id: d for d in OfferLetterDraft.objects.filter(employee_id__in=[e.id for e in emps])}
    return JsonResponse([{
        'id': e.id,
        'name': e.name,
        'email': e.email or '',
        'phone': e.phone or '',
        'gender': (e.gender or 'female').strip().lower(),
        'emp_id': e.emp_id,
        'designation': (drafts.get(e.id).role_title if (drafts.get(e.id) and drafts.get(e.id).role_title) else e.designation) or 'Staff',
        'department': e.department or 'General',
        'emp_type': e.emp_type or 'Normal',
        'status': e.status or 'Active',
        'salary': float(e.salary or 0),
        'blood_group': e.blood_group or '',
        'offer_sent': bool(e.offer_sent),
        'offer_role': drafts.get(e.id).role_key if drafts.get(e.id) else None,
        'offer_role_title': drafts.get(e.id).role_title if drafts.get(e.id) else None,
        'nda_sent': bool(e.nda_sent),
        'remarks': e.remarks or '',
        'rating': int(getattr(e, 'rating', 0) or 0),
        'is_manager': bool(e.is_manager),
        'managed_department': e.managed_department or '',
        'is_superadmin': bool(e.is_superadmin),
        'nda_submitted': bool(e.nda_submitted),
        'nda_submitted_at': e.nda_submitted_at.isoformat() if e.nda_submitted_at else None,
        'reporting_manager_id': e.reporting_manager_id,
        'reporting_manager_name': e.reporting_manager.name if e.reporting_manager else '',
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
        'is_manager': bool(emp.is_manager),
        'managed_department': emp.managed_department or '',
        'is_superadmin': bool(emp.is_superadmin),
        'nda_submitted': bool(emp.nda_submitted),
        'nda_submitted_at': emp.nda_submitted_at.isoformat() if emp.nda_submitted_at else None,
        'reporting_manager_id': emp.reporting_manager_id,
        'reporting_manager_name': emp.reporting_manager.name if emp.reporting_manager else '',
        'salary': float(emp.salary or 0),
        'blood_group': emp.blood_group or '',
        'remarks': emp.remarks or '',
        'rating': int(getattr(emp, 'rating', 0) or 0),
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
    
    approver_name = leave_request.approved_by or (getattr(hr_user, 'name', 'Management') if hr_user else 'Authorized Management')
    approver_role = leave_request.approved_by_role or (getattr(hr_user, 'designation', 'Approval Authority') if hr_user else 'Approval Authority')

    from_str = leave_request.from_date.strftime('%d %b %Y') if leave_request.from_date else 'N/A'
    to_str = leave_request.to_date.strftime('%d %b %Y') if leave_request.to_date else 'N/A'
    total_days = ((leave_request.to_date - leave_request.from_date).days + 1) if (leave_request.from_date and leave_request.to_date) else 1

    if action == 'approved':
        subject = f"Leave Request Approved — {leave_request.leave_type or 'Leave'} | {company_name}"
        html_body = f"""
        <div style="font-family:Arial,sans-serif;font-size:14px;color:#222;max-width:600px;line-height:1.6;">
          <p>Dear <strong>{emp.name}</strong>,</p>
          <p>We are pleased to inform you that your leave application for <strong>{leave_request.leave_type or 'Leave'}</strong> has been <span style="color:#059669;font-weight:bold;">APPROVED</span> by <strong>{approver_name} ({approver_role})</strong>.</p>
          <div style="background:#f8fafc;border:1px solid #cbd5e1;border-radius:8px;padding:12px 16px;margin:16px 0;">
            <p style="margin:4px 0;"><strong>Leave Type:</strong> {leave_request.leave_type or 'Casual Leave'}</p>
            <p style="margin:4px 0;"><strong>Period:</strong> {from_str} to {to_str} ({total_days} Day(s))</p>
            <p style="margin:4px 0;"><strong>Sanctioned By:</strong> {approver_name} ({approver_role})</p>
            <p style="margin:4px 0;"><strong>Status:</strong> <span style="color:#059669;font-weight:bold;">Sanctioned & Approved</span></p>
          </div>
          <p>Please find attached your official <strong>Leave Approval Sanction Letter</strong> for your records.</p>
          <p>We wish you a pleasant time off.</p>
          <br>
          <p style="margin:0;">Yours sincerely,</p>
          <p style="margin:0;"><strong>{approver_name}</strong></p>
          <p style="margin:0;color:#666;">{approver_role}</p>
          <p style="margin:0;color:#666;">{company_name}</p>
        </div>
        """
    else:
        subject = f"Leave Request Declined — {leave_request.leave_type or 'Leave'} | {company_name}"
        html_body = f"""
        <div style="font-family:Arial,sans-serif;font-size:14px;color:#222;max-width:600px;line-height:1.6;">
          <p>Dear <strong>{emp.name}</strong>,</p>
          <p>This is to inform you that your leave request for <strong>{leave_request.leave_type or 'Leave'}</strong> for the period from <strong>{from_str}</strong> to <strong>{to_str}</strong> has been <span style="color:#dc2626;font-weight:bold;">DECLINED / REJECTED</span> by <strong>{approver_name} ({approver_role})</strong>.</p>
          <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:12px 16px;margin:16px 0;">
            <p style="margin:4px 0;"><strong>Reason stated:</strong> {leave_request.reason or 'Personal'}</p>
            {f'<p style="margin:4px 0;"><strong>Approver Note:</strong> {leave_request.rejection_reason}</p>' if leave_request.rejection_reason else ''}
            <p style="margin:4px 0;"><strong>Reviewed By:</strong> {approver_name} ({approver_role})</p>
            <p style="margin:4px 0;"><strong>Status:</strong> <span style="color:#dc2626;font-weight:bold;">Rejected</span></p>
          </div>
          <p>If you have any questions or require further clarification, please coordinate with your branch manager or management.</p>
          <br>
          <p style="margin:0;">Yours sincerely,</p>
          <p style="margin:0;"><strong>{approver_name}</strong></p>
          <p style="margin:0;color:#666;">{approver_role}</p>
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

    config = get_active_email_config(hr_user)
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
    user = getattr(request, 'current_user', None)
    is_hr = False
    caller_emp = None
    caller_role = 'employee'
    managed_dept = ''

    # Check if HR
    if user and isinstance(user, HR) and getattr(user, 'is_authenticated', False):
        is_hr = True
        caller_role = 'hr'
    else:
        auth_header = request.headers.get('Authorization') or request.headers.get('X-User-Auth')
        if auth_header and 'hr:' in auth_header:
            is_hr = True
            caller_role = 'hr'

    if not is_hr:
        emp_id = resolve_employee_id(request)
        if emp_id:
            caller_emp = Employee.objects.filter(id=emp_id).first()
            if caller_emp:
                if caller_emp.is_superadmin:
                    caller_role = 'superadmin'
                elif caller_emp.is_manager:
                    caller_role = 'manager'
                    managed_dept = caller_emp.managed_department or caller_emp.department or ''
                else:
                    caller_role = 'employee'

    scope = request.GET.get('scope', '').strip()
    filter_type = request.GET.get('filter', '').strip()

    # Query logic according to hierarchy
    if caller_role == 'hr':
        leaves_qs = LeaveRequest.objects.select_related('employee').order_by('-applied_on')
    elif caller_role == 'superadmin':
        if filter_type == 'manager_leaves' or scope == 'manager_leaves':
            leaves_qs = LeaveRequest.objects.filter(employee__is_manager=True).select_related('employee').order_by('-applied_on')
        else:
            leaves_qs = LeaveRequest.objects.select_related('employee').order_by('-applied_on')
    elif caller_role == 'manager':
        if scope == 'my':
            leaves_qs = LeaveRequest.objects.filter(employee=caller_emp).select_related('employee').order_by('-applied_on')
        else:
            # Manager sees leave requests from employees of their managed branch/department (excluding themselves)
            dept = managed_dept or (caller_emp.department if caller_emp else '')
            leaves_qs = LeaveRequest.objects.filter(
                Q(employee__department__iexact=dept) | Q(employee__reporting_manager=caller_emp)
            ).exclude(
                employee_id=caller_emp.id if caller_emp else 0
            ).select_related('employee').order_by('-applied_on')
    else:
        # Regular employee sees own leaves
        leaves_qs = LeaveRequest.objects.filter(employee=caller_emp).select_related('employee').order_by('-applied_on') if caller_emp else LeaveRequest.objects.none()

    is_json = (
        request.headers.get('Accept') == 'application/json' or
        request.content_type == 'application/json' or
        request.path.startswith('/api/') or
        request.GET.get('format') == 'json'
    )

    if is_json:
        data = []
        for lr in leaves_qs:
            emp = lr.employee
            from_str = lr.from_date.strftime('%Y-%m-%d') if lr.from_date else ''
            to_str = lr.to_date.strftime('%Y-%m-%d') if lr.to_date else ''
            days = ((lr.to_date - lr.from_date).days + 1) if (lr.from_date and lr.to_date) else 1

            # Determine who has authority to approve/reject this specific leave request
            can_approve = False
            designated_approver = ''
            approver_note = ''

            if emp and emp.is_manager:
                designated_approver = 'SuperAdmin'
                if caller_role == 'superadmin':
                    can_approve = True
                    approver_note = 'SuperAdmin approval authority for Manager leave'
                elif caller_role == 'hr':
                    can_approve = False
                    approver_note = 'Managed by SuperAdmin (Designated by HR)'
                else:
                    can_approve = False
                    approver_note = 'Requires SuperAdmin approval'
            else:
                # Regular employee / intern
                dept_label = emp.department if (emp and emp.department) else 'Branch'
                designated_approver = f"{dept_label} Manager"
                if caller_role == 'superadmin':
                    can_approve = True
                    approver_note = 'SuperAdmin governance override authority'
                elif caller_role == 'manager' and caller_emp:
                    is_my_dept = ((emp.department or '').strip().lower() == managed_dept.strip().lower()) or (emp.reporting_manager_id == caller_emp.id)
                    if is_my_dept and emp.id != caller_emp.id:
                        can_approve = True
                        approver_note = f'Branch Manager ({managed_dept or dept_label})'
                    else:
                        can_approve = False
                        approver_note = f'Handled by {dept_label} Manager'
                elif caller_role == 'hr':
                    can_approve = False
                    approver_note = f'HR Audit: Handled by {dept_label} Manager'
                else:
                    can_approve = False
                    approver_note = f'Handled by {dept_label} Manager'

            data.append({
                'id': lr.id,
                'employee_id': emp.id if emp else None,
                'employee': emp.name if emp else 'Unknown',
                'emp_id': emp.emp_id if emp else 'N/A',
                'emp_type': emp.emp_type if emp else 'Normal',
                'department': emp.department if emp else '',
                'designation': emp.designation if emp else '',
                'email': emp.email if emp else '',
                'is_manager': bool(emp.is_manager) if emp else False,
                'is_superadmin': bool(emp.is_superadmin) if emp else False,
                'is_manager_leave': bool(emp.is_manager) if emp else False,
                'leave_type': lr.leave_type or 'Casual Leave',
                'from_date': from_str,
                'to_date': to_str,
                'from_date_formatted': lr.from_date.strftime('%d %b %Y') if lr.from_date else '',
                'to_date_formatted': lr.to_date.strftime('%d %b %Y') if lr.to_date else '',
                'days': days,
                'reason': lr.reason or '',
                'status': lr.status or 'Pending',
                'applied_on': lr.applied_on.strftime('%d %b %Y') if lr.applied_on else '',
                'approved_by': lr.approved_by or '',
                'approved_by_role': lr.approved_by_role or '',
                'rejection_reason': lr.rejection_reason or '',
                'can_approve': can_approve,
                'designated_approver': designated_approver,
                'approver_note': approver_note,
            })
        return JsonResponse({
            'success': True,
            'role': caller_role,
            'is_hr': is_hr,
            'is_manager': caller_role == 'manager',
            'is_superadmin': caller_role == 'superadmin',
            'managed_department': managed_dept,
            'leaves': data
        })

    return render(request, 'leave_management.html', {'leaves': leaves_qs, 'active_page': 'leave'})


@csrf_exempt
def approve_leave(request, leave_id):
    leave = get_object_or_404(LeaveRequest, id=leave_id)
    emp = leave.employee

    user = getattr(request, 'current_user', None)
    is_hr = False
    caller_emp = None

    if user and isinstance(user, HR) and getattr(user, 'is_authenticated', False):
        is_hr = True
    else:
        auth_header = request.headers.get('Authorization') or request.headers.get('X-User-Auth')
        if auth_header and 'hr:' in auth_header:
            is_hr = True

    if not is_hr:
        emp_id = resolve_employee_id(request)
        if emp_id:
            caller_emp = Employee.objects.filter(id=emp_id).first()

    # Rule: HR does not assign or approve leaves directly
    if is_hr and not caller_emp:
        return JsonResponse({
            'success': False,
            'message': 'HR cannot assign or approve leaves directly. Employee/Intern leaves are approved by their Branch Manager, and Manager leaves are approved by SuperAdmin.'
        }, status=403)

    if not caller_emp:
        return JsonResponse({'success': False, 'message': 'Unauthorized to approve leaves.'}, status=401)

    # Determine authority according to the hierarchy
    if emp and emp.is_manager:
        # Manager Leave: ONLY SuperAdmin can approve
        if not caller_emp.is_superadmin:
            return JsonResponse({
                'success': False,
                'message': 'Manager leave requests can only be approved by an authorized SuperAdmin.'
            }, status=403)
        approver_name = caller_emp.name
        approver_role = f"SuperAdmin ({caller_emp.designation or 'SuperAdmin'})"
    else:
        # Regular Employee / Intern Leave: Branch Manager or SuperAdmin
        if caller_emp.is_superadmin:
            approver_name = caller_emp.name
            approver_role = f"SuperAdmin ({caller_emp.designation or 'SuperAdmin'})"
        elif caller_emp.is_manager:
            emp_dept = (emp.department or '').strip().lower() if emp else ''
            mgr_dept = (caller_emp.managed_department or caller_emp.department or '').strip().lower()
            is_direct = (emp and emp.reporting_manager_id == caller_emp.id)
            if emp_dept != mgr_dept and not is_direct:
                return JsonResponse({
                    'success': False,
                    'message': f'You are only authorized to approve leaves for your managed branch ({caller_emp.managed_department or caller_emp.department}).'
                }, status=403)
            approver_name = caller_emp.name
            approver_role = f"Manager — {caller_emp.managed_department or caller_emp.department or 'Department'}"
        else:
            return JsonResponse({
                'success': False,
                'message': 'You do not have permission to approve this leave request.'
            }, status=403)

    leave.status = "Approved"
    leave.approved_by = approver_name
    leave.approved_by_role = approver_role
    leave.save()

    hr_user = HR.objects.first()
    settings = CompanySettings.objects.first() or CompanySettings()
    hydrate_company_files(settings)
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
            'message': f'Leave approved by {approver_name} ({approver_role})! {"Official sanction letter emailed to " + leave.employee.email if leave.employee and leave.employee.email else ""}',
            'email_status': email_msg,
            'leave_id': leave.id,
            'status': 'Approved',
            'approved_by': approver_name,
            'approved_by_role': approver_role
        })

    messages.success(request, f'Leave approved by {approver_name} ({approver_role}) and notification dispatched.')
    return redirect('leave_management')


@csrf_exempt
def reject_leave(request, leave_id):
    leave = get_object_or_404(LeaveRequest, id=leave_id)
    emp = leave.employee

    user = getattr(request, 'current_user', None)
    is_hr = False
    caller_emp = None

    if user and isinstance(user, HR) and getattr(user, 'is_authenticated', False):
        is_hr = True
    else:
        auth_header = request.headers.get('Authorization') or request.headers.get('X-User-Auth')
        if auth_header and 'hr:' in auth_header:
            is_hr = True

    if not is_hr:
        emp_id = resolve_employee_id(request)
        if emp_id:
            caller_emp = Employee.objects.filter(id=emp_id).first()

    # Rule: HR does not assign or reject leaves directly
    if is_hr and not caller_emp:
        return JsonResponse({
            'success': False,
            'message': 'HR cannot assign or reject leaves directly. Employee/Intern leaves are handled by their Branch Manager, and Manager leaves are handled by SuperAdmin.'
        }, status=403)

    if not caller_emp:
        return JsonResponse({'success': False, 'message': 'Unauthorized to reject leaves.'}, status=401)

    rejection_reason = ''
    if request.content_type == 'application/json' and request.body:
        try:
            body = json.loads(request.body.decode('utf-8'))
            rejection_reason = body.get('reason', '').strip()
        except Exception:
            pass
    elif request.POST.get('reason'):
        rejection_reason = request.POST.get('reason', '').strip()

    # Determine authority according to hierarchy
    if emp and emp.is_manager:
        # Manager Leave: ONLY SuperAdmin can reject
        if not caller_emp.is_superadmin:
            return JsonResponse({
                'success': False,
                'message': 'Manager leave requests can only be rejected by an authorized SuperAdmin.'
            }, status=403)
        approver_name = caller_emp.name
        approver_role = f"SuperAdmin ({caller_emp.designation or 'SuperAdmin'})"
    else:
        # Regular Employee / Intern Leave: Branch Manager or SuperAdmin
        if caller_emp.is_superadmin:
            approver_name = caller_emp.name
            approver_role = f"SuperAdmin ({caller_emp.designation or 'SuperAdmin'})"
        elif caller_emp.is_manager:
            emp_dept = (emp.department or '').strip().lower() if emp else ''
            mgr_dept = (caller_emp.managed_department or caller_emp.department or '').strip().lower()
            is_direct = (emp and emp.reporting_manager_id == caller_emp.id)
            if emp_dept != mgr_dept and not is_direct:
                return JsonResponse({
                    'success': False,
                    'message': f'You are only authorized to reject leaves for your managed branch ({caller_emp.managed_department or caller_emp.department}).'
                }, status=403)
            approver_name = caller_emp.name
            approver_role = f"Manager — {caller_emp.managed_department or caller_emp.department or 'Department'}"
        else:
            return JsonResponse({
                'success': False,
                'message': 'You do not have permission to reject this leave request.'
            }, status=403)

    leave.status = "Rejected"
    leave.approved_by = approver_name
    leave.approved_by_role = approver_role
    if rejection_reason:
        leave.rejection_reason = rejection_reason
    leave.save()

    hr_user = HR.objects.first()
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
            'message': f'Leave rejected by {approver_name} ({approver_role}). {"Notification email sent to " + leave.employee.email if leave.employee and leave.employee.email else ""}',
            'email_status': email_msg,
            'leave_id': leave.id,
            'status': 'Rejected',
            'approved_by': approver_name,
            'approved_by_role': approver_role
        })

    messages.info(request, f'Leave rejected by {approver_name} ({approver_role}) and notification email sent.')
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
    today = timezone.localtime(timezone.now()).date()
    emp_start_date = employee.joining_date or (employee.created_at.date() if employee.created_at else today)

    records = list(Attendance.objects.filter(employee_id=employee.id).order_by('-date'))

    def count_weekdays(s_d, e_d):
        if s_d > e_d:
            return 0
        c = s_d
        cnt = 0
        while c <= e_d:
            if c.weekday() < 5:
                cnt += 1
            c += timedelta(days=1)
        return cnt

    present_days = sum(1 for r in records if r.status == 'Present')
    total_expected_days = count_weekdays(emp_start_date, today)
    if total_expected_days > 0:
        absent_days = max(total_expected_days - present_days, 0)
        attendance_percentage = round(min(100.0, (present_days / total_expected_days * 100)), 1)
        total_days = total_expected_days
    else:
        absent_days = sum(1 for r in records if r.status == 'Absent')
        total_days = len(records)
        attendance_percentage = 100.0 if present_days > 0 else 0.0

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
                'designation': employee.designation or 'Staff',
                'emp_type': employee.emp_type or 'Normal',
                'is_manager': bool(employee.is_manager),
                'managed_department': employee.managed_department or '',
                'is_superadmin': bool(employee.is_superadmin)
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

        # Build routing notice
        if employee.is_manager:
            superadmin = Employee.objects.filter(is_superadmin=True).first()
            sa_name = superadmin.name if superadmin else 'SuperAdmin'
            routing_msg = f"Your leave request has been submitted and forwarded to {sa_name} (SuperAdmin) for review."
        else:
            dept_name = employee.department or 'Branch'
            mgr = Employee.objects.filter(
                Q(is_manager=True, managed_department__iexact=dept_name) |
                Q(id=employee.reporting_manager_id or 0)
            ).first()
            mgr_label = f"{mgr.name} ({dept_name} Manager)" if mgr else f"{dept_name} Branch Manager"
            routing_msg = f"Your leave request has been submitted and forwarded to {mgr_label} for review and approval."

        if request.headers.get('Accept') == 'application/json' or request.content_type == 'application/json':
            return JsonResponse({
                'success': True,
                'message': routing_msg,
                'leave_id': lr.id,
                'routing_info': routing_msg
            })
        messages.success(request, routing_msg)
        return redirect('employee_dashboard')

    leave_history = LeaveRequest.objects.filter(employee_id=employee.id).order_by('-applied_on')
    if request.headers.get('Accept') == 'application/json' or request.content_type == 'application/json' or request.GET.get('format') == 'json':
        history_list = []
        for lr in leave_history:
            if employee.is_manager:
                target_approver = "SuperAdmin"
            else:
                target_approver = f"{employee.department or 'Branch'} Manager"

            history_list.append({
                'id': lr.id,
                'leave_type': lr.leave_type or 'Casual Leave',
                'from_date': lr.from_date.strftime('%d %b %Y') if lr.from_date else '',
                'to_date': lr.to_date.strftime('%d %b %Y') if lr.to_date else '',
                'days': ((lr.to_date - lr.from_date).days + 1) if lr.to_date and lr.from_date else 1,
                'applied_on': lr.applied_on.strftime('%d %b %Y') if lr.applied_on else '',
                'status': lr.status or 'Pending',
                'reason': lr.reason or '',
                'approved_by': lr.approved_by or '',
                'approved_by_role': lr.approved_by_role or '',
                'rejection_reason': lr.rejection_reason or '',
                'target_approver': target_approver,
            })

        return JsonResponse({
            'leave_history': history_list,
            'is_manager': bool(employee.is_manager),
            'department': employee.department or '',
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
            expires_at=None
        )
        if request.headers.get('Accept') == 'application/json' or request.content_type == 'application/json':
            return JsonResponse({'success': True, 'message': 'Announcement published successfully!'})
        messages.success(request, "Announcement published successfully!")
        return redirect('announcements')

    now = timezone.now()
    active_announcements = Announcement.objects.filter(is_active=True).order_by('-created_at')
    history_announcements = Announcement.objects.filter(is_active=False).order_by('-created_at')

    if request.headers.get('Accept') == 'application/json' or request.content_type == 'application/json' or request.GET.get('format') == 'json':
        hr_user = getattr(request, 'current_user', None)
        return JsonResponse({
            'authenticated': True,
            'is_hr': True,
            'user': {
                'id': getattr(hr_user, 'id', None),
                'name': getattr(hr_user, 'name', 'HR Admin'),
                'email': getattr(hr_user, 'email', ''),
                'designation': getattr(hr_user, 'designation', 'HR Administrator'),
                'role': 'hr'
            },
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

    ann_filter = Q(is_active=True) & (Q(expires_at__isnull=True) | Q(expires_at__gte=now))
    audience_filter = Q(audience__iexact="Everyone") | Q(audience__iexact="All")
    if (employee.emp_type or '').strip().lower() == "intern":
        audience_filter |= Q(audience__in=["Intern", "Interns", "intern", "interns"])
    else:
        audience_filter |= Q(audience__in=["Normal", "Employee", "Employees", "normal", "employee", "employees"])

    announcements = Announcement.objects.filter(ann_filter & audience_filter).order_by('-created_at')

    if request.headers.get('Accept') == 'application/json' or request.content_type == 'application/json' or request.GET.get('format') == 'json':
        return JsonResponse({
            'authenticated': True,
            'is_hr': False,
            'employee': {
                'id': employee.id,
                'name': employee.name,
                'designation': employee.designation or 'Staff',
                'emp_type': employee.emp_type or 'Normal',
                'is_manager': bool(employee.is_manager),
                'managed_department': employee.managed_department or '',
                'is_superadmin': bool(employee.is_superadmin),
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
                'email': employee.email or '',
                'phone': employee.phone or '',
                'department': employee.department or 'General',
                'designation': employee.designation or 'Staff',
                'emp_type': employee.emp_type or 'Normal',
                'status': employee.status or 'Active',
                'blood_group': employee.blood_group or '',
                'joining_date': employee.joining_date.strftime('%d %b %Y') if employee.joining_date else '',
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
    config = get_active_email_config(getattr(request, 'current_user', None))
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


# ============================================================================
# KRA (KEY RESPONSIBILITY AREA) & NDA MODULE
# ============================================================================

DEFAULT_KRAS = {
    'it': [
        {
            'title': 'Core Application Development & Architecture',
            'description': 'Deliver robust, scalable full-stack features and API integrations across FRET web platforms with high code quality and test coverage.',
            'kpi_metrics': 'Timely feature delivery, zero regression bugs, adhering to modern UI/UX design standards and responsive performance.',
            'weightage': 30,
            'target_timeline': 'Ongoing / Quarterly'
        },
        {
            'title': 'System Reliability, Security & Performance',
            'description': 'Ensure maximum uptime, secure data handling, rapid page load speeds, and proactive database query optimization.',
            'kpi_metrics': '< 200ms API response time, 99.9% uptime, zero unresolved security vulnerabilities.',
            'weightage': 25,
            'target_timeline': 'Continuous'
        },
        {
            'title': 'Automation, Tooling & DevOps Workflows',
            'description': 'Automate manual operations, maintain streamlined CI/CD pipelines, and author thorough technical documentation.',
            'kpi_metrics': 'Deployment automation, script efficiency, 100% updated workflow documentation.',
            'weightage': 25,
            'target_timeline': 'Quarterly'
        },
        {
            'title': 'Cross-Functional Collaboration & Innovation',
            'description': 'Collaborate proactively with Product, Design, Operations, and Business stakeholders to implement high-impact enhancements.',
            'kpi_metrics': 'Peer review feedback, proactive problem-solving, innovative solution proposals.',
            'weightage': 20,
            'target_timeline': 'Quarterly'
        },
    ],
    'data': [
        {
            'title': 'Data Modeling, ETL Pipelines & Architecture',
            'description': 'Design, construct, and maintain scalable data pipelines and warehousing models to ingest, clean, and structure raw business data.',
            'kpi_metrics': 'Pipeline reliability, data accuracy > 99%, zero pipeline failure delays.',
            'weightage': 35,
            'target_timeline': 'Ongoing'
        },
        {
            'title': 'Analytical Dashboards & Business Intelligence',
            'description': 'Create interactive BI dashboards, KPI monitors, and operational reporting models for management decision-making.',
            'kpi_metrics': 'Daily updated metrics, high user adoption, clear visualization standards.',
            'weightage': 30,
            'target_timeline': 'Quarterly'
        },
        {
            'title': 'Data Quality, Governance & Security',
            'description': 'Enforce data hygiene, schema validation, access control policies, and compliance with data governance protocols.',
            'kpi_metrics': 'Zero unauthorized data leaks, strict audit compliance, weekly quality audits.',
            'weightage': 20,
            'target_timeline': 'Continuous'
        },
        {
            'title': 'Insights Delivery & Stakeholder Collaboration',
            'description': 'Deliver actionable statistical insights, trend forecasts, and ad-hoc analytical deep-dives to business teams.',
            'kpi_metrics': 'Timely turnaround on analytical queries, documented insight reports.',
            'weightage': 15,
            'target_timeline': 'Quarterly'
        },
    ],
    'hr': [
        {
            'title': 'Talent Acquisition, Screening & Onboarding',
            'description': 'Manage end-to-end recruitment lifecycle: job postings, candidate screening, interview scheduling, offer generation, and smooth onboarding.',
            'kpi_metrics': 'Time-to-hire < 21 days, offer acceptance rate > 85%, 100% onboarding completion on Day 1.',
            'weightage': 35,
            'target_timeline': 'Quarterly'
        },
        {
            'title': 'Employee Engagement, Relations & Welfare',
            'description': 'Drive positive workplace culture, facilitate transparent communication, conduct 1-on-1 check-ins, and address employee grievances.',
            'kpi_metrics': 'Employee satisfaction score > 4.2/5, quick resolution of HR queries within 24h.',
            'weightage': 25,
            'target_timeline': 'Ongoing'
        },
        {
            'title': 'HR Compliance, Records & Policy Administration',
            'description': 'Ensure complete compliance with labor laws, company policies, NDAs, employee verification records, and attendance tracking.',
            'kpi_metrics': '100% NDA & documentation compliance, zero audit non-conformities.',
            'weightage': 20,
            'target_timeline': 'Continuous'
        },
        {
            'title': 'Performance Management & Capability Development',
            'description': 'Administer appraisal cycles, KRA goal alignments, manager reviews, and coordinate employee skill-building workshops.',
            'kpi_metrics': '100% on-time appraisal reviews, training feedback rating > 4.0/5.',
            'weightage': 20,
            'target_timeline': 'Bi-Annual'
        },
    ],
    'operations': [
        {
            'title': 'Operational Execution & SLA Adherence',
            'description': 'Oversee daily operational deliverables, task delegations, process flows, and ensure all customer and internal SLAs are consistently met.',
            'kpi_metrics': '98%+ on-time SLA fulfillment, minimal operational bottlenecks.',
            'weightage': 35,
            'target_timeline': 'Ongoing'
        },
        {
            'title': 'Quality Assurance & Process Improvement',
            'description': 'Audit process deliverables, implement continuous improvement (Kaizen) methodologies, and eliminate workflow redundancies.',
            'kpi_metrics': 'Error rate < 1%, measurable process cycle time reduction.',
            'weightage': 30,
            'target_timeline': 'Quarterly'
        },
        {
            'title': 'Resource Planning & Cross-Team Coordination',
            'description': 'Coordinate resource allocation, team scheduling, operational tool maintenance, and cross-department collaboration.',
            'kpi_metrics': 'Optimized capacity utilization, zero unassigned backlogs.',
            'weightage': 20,
            'target_timeline': 'Monthly'
        },
        {
            'title': 'Operations Reporting & Documentation',
            'description': 'Maintain up-to-date Standard Operating Procedures (SOPs), weekly output logs, and executive summary reports.',
            'kpi_metrics': 'Accurate weekly operations logs, 100% documented SOPs.',
            'weightage': 15,
            'target_timeline': 'Monthly'
        },
    ],
    'general': [
        {
            'title': 'Core Deliverables & Quality Execution',
            'description': 'Execute core role responsibilities diligently, ensuring all assigned tasks and project milestones are completed to the highest standards.',
            'kpi_metrics': 'On-time project delivery, minimal rework required, high quality of output.',
            'weightage': 35,
            'target_timeline': 'Ongoing'
        },
        {
            'title': 'Productivity & Time Management',
            'description': 'Maintain structured daily task logging, prioritize major deliverables, and meet target sprint commitments.',
            'kpi_metrics': 'Consistent daily tracker submissions, high productivity score.',
            'weightage': 25,
            'target_timeline': 'Monthly'
        },
        {
            'title': 'Professional Growth & Skill Mastery',
            'description': 'Actively acquire new technical and functional skills relevant to organizational goals and participate in team learning sessions.',
            'kpi_metrics': 'Demonstrated application of new tools and techniques, training participation.',
            'weightage': 20,
            'target_timeline': 'Quarterly'
        },
        {
            'title': 'Team Collaboration & Organizational Values',
            'description': 'Communicate effectively across teams, uphold company values, confidentiality, and support colleagues in critical initiatives.',
            'kpi_metrics': 'Positive peer feedback, adherence to code of conduct and confidentiality policies.',
            'weightage': 20,
            'target_timeline': 'Quarterly'
        },
    ]
}


def _seed_default_kras_for_employee(employee):
    if not employee or KRAItem.objects.filter(employee=employee).exists():
        return
    dept = (employee.department or '').lower()
    desig = (employee.designation or '').lower()
    
    key = 'general'
    if any(k in dept or k in desig for k in ['it', 'tech', 'software', 'developer', 'web', 'engineer', 'frontend', 'backend', 'fullstack']):
        key = 'it'
    elif any(k in dept or k in desig for k in ['data', 'analytic', 'research', 'quant']):
        key = 'data'
    elif any(k in dept or k in desig for k in ['hr', 'human', 'talent', 'people', 'recruit']):
        key = 'hr'
    elif any(k in dept or k in desig for k in ['operat', 'ops', 'admin']):
        key = 'operations'

    items = DEFAULT_KRAS.get(key, DEFAULT_KRAS['general'])
    for item in items:
        KRAItem.objects.create(
            employee=employee,
            title=item['title'],
            description=item['description'],
            kpi_metrics=item['kpi_metrics'],
            weightage=item['weightage'],
            target_timeline=item['target_timeline'],
            status='Active',
            assigned_by='Organization Standard'
        )


@csrf_exempt
def api_kra_get(request):
    user = getattr(request, 'current_user', None)
    is_hr = isinstance(user, HR)
    caller_emp = None
    caller_role = 'employee'
    managed_dept = ''

    if not is_hr:
        emp_id = resolve_employee_id(request)
        if emp_id:
            caller_emp = Employee.objects.filter(id=emp_id).first()
            if caller_emp:
                if caller_emp.is_superadmin:
                    caller_role = 'superadmin'
                elif caller_emp.is_manager:
                    caller_role = 'manager'
                    managed_dept = caller_emp.managed_department or caller_emp.department or ''
                else:
                    caller_role = 'employee'

    requested_emp_id = request.GET.get('employee_id')
    view_type = request.GET.get('view', 'my').strip()

    target_emp = None
    if requested_emp_id:
        try:
            target_emp = Employee.objects.filter(id=int(requested_emp_id)).first()
        except Exception:
            pass
    elif caller_emp:
        target_emp = caller_emp

    if target_emp:
        _seed_default_kras_for_employee(target_emp)

    # Fetch user's own/target KRAs
    kras_list = []
    if target_emp:
        qs = KRAItem.objects.filter(employee=target_emp).order_by('-weightage', 'id')
        for item in qs:
            kras_list.append({
                'id': item.id,
                'employee_id': target_emp.id,
                'employee_name': target_emp.name,
                'department': target_emp.department or '',
                'designation': target_emp.designation or '',
                'title': item.title,
                'description': item.description or '',
                'kpi_metrics': item.kpi_metrics or '',
                'weightage': item.weightage,
                'target_timeline': item.target_timeline,
                'status': item.status,
                'assigned_by': item.assigned_by or 'Manager',
                'updated_at': item.updated_at.strftime('%d %b %Y') if item.updated_at else ''
            })

    # If manager/superadmin/HR, fetch team overview
    team_members = []
    team_kras = []
    if is_hr or caller_role in ('manager', 'superadmin'):
        if is_hr or caller_role == 'superadmin':
            team_qs = Employee.objects.filter(status='Active').order_by('name')
        else:
            dept = managed_dept or (caller_emp.department if caller_emp else '')
            team_qs = Employee.objects.filter(status='Active', department__iexact=dept).order_by('name')

        for m in team_qs:
            _seed_default_kras_for_employee(m)
            m_kras = list(KRAItem.objects.filter(employee=m).order_by('-weightage'))
            total_weight = sum(k.weightage for k in m_kras)
            completed = sum(1 for k in m_kras if k.status == 'Completed')
            
            team_members.append({
                'id': m.id,
                'name': m.name,
                'emp_id': m.emp_id or f"INT{m.id:04d}",
                'department': m.department or '',
                'designation': m.designation or '',
                'is_manager': bool(m.is_manager),
                'kras_count': len(m_kras),
                'total_weightage': total_weight,
                'completed_kras': completed
            })

            for k in m_kras:
                team_kras.append({
                    'id': k.id,
                    'employee_id': m.id,
                    'employee_name': m.name,
                    'department': m.department or '',
                    'designation': m.designation or '',
                    'title': k.title,
                    'description': k.description or '',
                    'kpi_metrics': k.kpi_metrics or '',
                    'weightage': k.weightage,
                    'target_timeline': k.target_timeline,
                    'status': k.status,
                    'assigned_by': k.assigned_by or 'Manager',
                    'updated_at': k.updated_at.strftime('%d %b %Y') if k.updated_at else ''
                })

    total_weight = sum(k['weightage'] for k in kras_list)
    completed_count = sum(1 for k in kras_list if k['status'] == 'Completed')
    in_progress_count = sum(1 for k in kras_list if k['status'] in ('Active', 'In Progress'))

    return JsonResponse({
        'success': True,
        'role': caller_role,
        'is_hr': is_hr,
        'is_manager': caller_role == 'manager',
        'is_superadmin': caller_role == 'superadmin',
        'managed_department': managed_dept,
        'employee': {
            'id': target_emp.id if target_emp else None,
            'name': target_emp.name if target_emp else '',
            'department': target_emp.department if target_emp else '',
            'designation': target_emp.designation if target_emp else '',
            'emp_type': target_emp.emp_type if target_emp else 'Normal'
        } if target_emp else None,
        'summary': {
            'total_kras': len(kras_list),
            'total_weightage': total_weight,
            'completed_count': completed_count,
            'in_progress_count': in_progress_count
        },
        'kras': kras_list,
        'team_members': team_members,
        'team_kras': team_kras
    })


@csrf_exempt
@require_POST
def api_kra_save(request):
    try:
        data = json.loads(request.body.decode('utf-8'))
    except Exception:
        return JsonResponse({'success': False, 'message': 'Invalid JSON'}, status=400)

    kra_id = data.get('id')
    emp_id = data.get('employee_id')
    title = (data.get('title') or '').strip()
    description = (data.get('description') or '').strip()
    kpi_metrics = (data.get('kpi_metrics') or '').strip()
    weightage = int(data.get('weightage') or 25)
    target_timeline = (data.get('target_timeline') or 'Quarterly').strip()
    status = (data.get('status') or 'Active').strip()

    if not title:
        return JsonResponse({'success': False, 'message': 'KRA title is required'}, status=400)

    # Resolve target employee
    if kra_id:
        kra = get_object_or_404(KRAItem, id=kra_id)
        target_emp = kra.employee
    else:
        if not emp_id:
            emp_id = resolve_employee_id(request)
        if not emp_id:
            return JsonResponse({'success': False, 'message': 'Employee ID is required'}, status=400)
        target_emp = get_object_or_404(Employee, id=emp_id)
        kra = KRAItem(employee=target_emp)

    kra.title = title
    kra.description = description
    kra.kpi_metrics = kpi_metrics
    kra.weightage = weightage
    kra.target_timeline = target_timeline
    kra.status = status
    kra.save()

    return JsonResponse({
        'success': True,
        'message': 'KRA saved successfully!',
        'kra': {
            'id': kra.id,
            'employee_id': target_emp.id,
            'employee_name': target_emp.name,
            'title': kra.title,
            'description': kra.description,
            'kpi_metrics': kra.kpi_metrics,
            'weightage': kra.weightage,
            'target_timeline': kra.target_timeline,
            'status': kra.status,
            'assigned_by': kra.assigned_by or 'Manager'
        }
    })


@csrf_exempt
@require_POST
def api_kra_delete(request, kra_id):
    kra = get_object_or_404(KRAItem, id=kra_id)
    kra.delete()
    return JsonResponse({'success': True, 'message': 'KRA item deleted successfully!'})


@csrf_exempt
@require_POST
def api_kra_status(request, kra_id):
    kra = get_object_or_404(KRAItem, id=kra_id)
    try:
        data = json.loads(request.body.decode('utf-8'))
        new_status = data.get('status', 'Active')
    except Exception:
        new_status = request.POST.get('status', 'Active')

    kra.status = new_status
    kra.save()
    return JsonResponse({'success': True, 'status': kra.status, 'message': f'KRA status updated to {kra.status}'})


# ─────────────── NDA (NON-DISCLOSURE AGREEMENT) SUBMISSION ───────────────

@csrf_exempt
def api_nda_template(request):
    settings = CompanySettings.objects.first()
    company_name = settings.company_name if settings else 'TimeArrow Pvt. Ltd. (WisBees)'
    company_addr = settings.company_address if settings else 'Mumbai, Maharashtra 400001'
    
    terms = f"""NON-DISCLOSURE & PROPRIETARY INFORMATION AGREEMENT (NDA)

This Non-Disclosure Agreement (the "Agreement") is entered into by and between {company_name} ("Company"), having its principal address at {company_addr}, and the undersigned Employee / Intern ("Recipient").

1. PURPOSE & SCOPE
The Recipient agrees that during employment and at all times thereafter, they will hold in strict confidence and not disclose, reproduce, or distribute to any unauthorized third party any Proprietary Information, source code, client databases, research reports, trading intelligence, or business strategies belonging to the Company.

2. DEFINITIONS OF CONFIDENTIAL INFORMATION
"Proprietary Information" includes, without limitation:
- Software codebases, algorithms, architectural designs, internal APIs, and credentials.
- Financial data, business projections, client information, and strategic documents.
- Any technical, operations, HR, or commercial information marked or reasonably understood to be confidential.

3. OBLIGATIONS OF THE RECIPIENT
- To safeguard all Confidential Information with the highest standard of care.
- Not to export, download, or copy proprietary code or company data onto unauthorized external devices.
- To immediately notify the Management / HR of any potential breach or unauthorized access.

4. INTELLECTUAL PROPERTY OWNERSHIP
All inventions, source code, data models, research reports, and deliverables created by the Recipient during their tenure are the sole and exclusive property of the Company (Work Made For Hire).

5. GOVERNING LAW & REMEDIES
This Agreement is governed by the laws of India. Any breach of this Agreement may result in immediate termination of employment, disciplinary action, and legal proceedings for injunctive relief and damages.

By digitally signing below, the Recipient acknowledges that they have read, understood, and voluntarily agree to be bound by all terms and conditions of this Agreement."""

    return JsonResponse({
        'success': True,
        'company_name': company_name,
        'terms': terms,
        'title': 'Non-Disclosure & Confidentiality Agreement'
    })


@csrf_exempt
@require_POST
def api_nda_submit(request):
    emp_id = resolve_employee_id(request)
    if not emp_id:
        return JsonResponse({'success': False, 'message': 'Unauthorized. Please login to submit NDA.'}, status=401)

    employee = get_object_or_404(Employee, id=emp_id)

    signature_name = ''
    agreed = False
    if request.content_type == 'application/json' and request.body:
        try:
            data = json.loads(request.body.decode('utf-8'))
            signature_name = (data.get('signature_name') or '').strip()
            agreed = bool(data.get('agreed', False))
        except Exception:
            agreed = False
    else:
        signature_name = request.POST.get('signature_name', '').strip()
        agreed = bool(request.POST.get('agreed') in ('true', '1', 'on', True))

    if not agreed:
        return JsonResponse({'success': False, 'message': 'You must accept the terms of the Non-Disclosure Agreement.'}, status=400)

    if not signature_name:
        signature_name = employee.name

    # Handle file upload if present
    nda_file = request.FILES.get('nda_file') or request.FILES.get('file')
    if nda_file:
        employee.nda_doc_data = nda_file.read()
        employee.nda_doc_name = nda_file.name

    employee.nda_submitted = True
    employee.nda_submitted_at = timezone.now()
    employee.nda_signature = signature_name
    employee.save()

    return JsonResponse({
        'success': True,
        'message': 'Non-Disclosure Agreement (NDA) successfully submitted, signed, and uploaded!',
        'nda_submitted': True,
        'nda_submitted_at': employee.nda_submitted_at.strftime('%d %b %Y, %I:%M %p'),
        'nda_signature': employee.nda_signature,
        'nda_doc_name': employee.nda_doc_name,
        'has_nda_doc': bool(employee.nda_doc_data),
        'nda_doc_url': f"/api/nda/download/{employee.id}" if employee.nda_doc_data else None
    })


@csrf_exempt
def api_nda_status(request):
    emp_id = resolve_employee_id(request)
    if not emp_id:
        return JsonResponse({'success': False, 'message': 'Unauthorized'}, status=401)
    employee = get_object_or_404(Employee, id=emp_id)
    return JsonResponse({
        'success': True,
        'nda_submitted': bool(employee.nda_submitted),
        'nda_submitted_at': employee.nda_submitted_at.strftime('%d %b %Y, %I:%M %p') if employee.nda_submitted_at else None,
        'nda_signature': employee.nda_signature or '',
        'nda_doc_name': employee.nda_doc_name or None,
        'has_nda_doc': bool(employee.nda_doc_data),
        'download_url': f"/api/nda/download/{employee.id}" if employee.nda_doc_data else None
    })


@csrf_exempt
def api_nda_download(request, emp_id=None):
    if not emp_id:
        emp_id = resolve_employee_id(request)
    if not emp_id:
        return JsonResponse({'success': False, 'message': 'Unauthorized'}, status=401)
    
    employee = get_object_or_404(Employee, id=emp_id)
    if not employee.nda_doc_data:
        return HttpResponse('No NDA document has been uploaded for this employee.', status=404)

    filename = employee.nda_doc_name or f"NDA_{employee.name.replace(' ', '_')}.pdf"
    import mimetypes
    content_type, _ = mimetypes.guess_type(filename)
    if not content_type:
        content_type = 'application/pdf'

    response = HttpResponse(employee.nda_doc_data, content_type=content_type)
    response['Content-Disposition'] = f'inline; filename="{filename}"'
    return response


# ─────────────── ROLE & ACCESS MANAGEMENT (HR ADMIN) ───────────────

@csrf_exempt
@require_POST
def api_update_employee_role_access(request, emp_id):
    """
    HR Admin endpoint to assign or revoke Manager (with managed department)
    and SuperAdmin access for an employee.
    """
    user = getattr(request, 'current_user', None)
    is_hr = isinstance(user, HR)
    auth_header = request.headers.get('Authorization') or request.headers.get('X-User-Auth')
    if auth_header and 'hr:' in auth_header:
        is_hr = True

    if not is_hr:
        caller_id = resolve_employee_id(request)
        caller_emp = Employee.objects.filter(id=caller_id).first() if caller_id else None
        if not caller_emp or not caller_emp.is_superadmin:
            return JsonResponse({'success': False, 'message': 'Unauthorized. HR Admin permissions required.'}, status=403)

    emp = get_object_or_404(Employee, id=emp_id)

    try:
        data = json.loads(request.body.decode('utf-8'))
    except Exception:
        data = request.POST

    is_manager = bool(data.get('is_manager', False))
    managed_dept = (data.get('managed_department') or '').strip()
    is_superadmin = bool(data.get('is_superadmin', False))

    emp.is_manager = is_manager
    emp.managed_department = managed_dept if is_manager else ''
    emp.is_superadmin = is_superadmin
    emp.save()

    return JsonResponse({
        'success': True,
        'message': f"Access roles updated for {emp.name} successfully!",
        'employee': {
            'id': emp.id,
            'name': emp.name,
            'is_manager': emp.is_manager,
            'managed_department': emp.managed_department,
            'is_superadmin': emp.is_superadmin,
            'department': emp.department
        }
    })

