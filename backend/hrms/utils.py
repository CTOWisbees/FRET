import os
import re
import time
import json
import base64
from datetime import datetime, date, timedelta
from io import BytesIO
import requests
from bs4 import BeautifulSoup
from django.conf import settings as django_settings
from django.utils import timezone
from django.http import Http404
from django.core.exceptions import PermissionDenied
from pdf_generator import ROLE_KEYS, ROLE_DATA, GENERIC_ROLE_TEMPLATE
from hrms.models import HR, Employee, EmployeeAccount, EmailConfig, CompanySettings, OfferLetterDraft, ResearchReport

BASE_DIR = django_settings.BASE_DIR
UPLOAD_DIR = os.path.join(BASE_DIR, 'uploads')
RESEARCH_UPLOAD_DIR = os.path.join(BASE_DIR, 'static', 'uploads')
os.makedirs(RESEARCH_UPLOAD_DIR, exist_ok=True)
os.makedirs(os.path.join(UPLOAD_DIR, 'signatures'), exist_ok=True)
os.makedirs(os.path.join(UPLOAD_DIR, 'attachments'), exist_ok=True)

ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'pdf'}
RESEARCH_REPORT_RETENTION_DAYS = 30

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def _materialize(data, path):
    if not data:
        return None
    os.makedirs(os.path.dirname(path), exist_ok=True)
    if not os.path.exists(path):
        with open(path, 'wb') as f:
            f.write(data)
    return path

def hydrate_hr_signature(hr):
    if hr is not None and getattr(hr, 'signature_data', None):
        # Convert memoryview/bytes to raw bytes if needed
        data = bytes(hr.signature_data)
        hr.signature_path = _materialize(
            data,
            os.path.join(UPLOAD_DIR, 'signatures', f'sig_{hr.id}.png')
        )
    return getattr(hr, 'signature_path', None) if hr is not None else None

def hydrate_company_files(settings):
    if settings is None:
        return
    if getattr(settings, 'letterhead_data', None):
        ext = (getattr(settings, 'letterhead_mime', None) or 'png')
        settings.letterhead_path = _materialize(
            bytes(settings.letterhead_data),
            os.path.join(UPLOAD_DIR, 'attachments', f'letterhead_{settings.id}.{ext}')
        )
    if getattr(settings, 'nda_data', None):
        settings.nda_path = _materialize(
            bytes(settings.nda_data),
            os.path.join(UPLOAD_DIR, 'attachments', f'nda_{settings.id}.pdf')
        )

DEFAULT_AZURE_TENANT_ID = os.environ.get('AZURE_TENANT_ID', '')
DEFAULT_AZURE_CLIENT_ID = os.environ.get('AZURE_CLIENT_ID', '')
DEFAULT_AZURE_CLIENT_SECRET = os.environ.get('AZURE_CLIENT_SECRET', '')
DEFAULT_AZURE_SENDER_EMAIL = os.environ.get('AZURE_SENDER_EMAIL', 'info@wisbees.com')

def get_active_email_config(current_user=None):
    env_tenant = os.environ.get('AZURE_TENANT_ID', '').strip()
    env_client_id = os.environ.get('AZURE_CLIENT_ID', '').strip()
    env_client_secret = os.environ.get('AZURE_CLIENT_SECRET', '').strip()
    env_sender = os.environ.get('AZURE_SENDER_EMAIL', 'info@wisbees.com').strip()

    config = None
    if current_user and getattr(current_user, 'id', None):
        config = EmailConfig.objects.filter(hr_id=current_user.id).exclude(sender_email__isnull=True).exclude(sender_email='').first()
    if not config or not config.sender_email:
        config = EmailConfig.objects.filter(sender_email__isnull=False).exclude(sender_email='').first()
    if not config:
        config = EmailConfig.objects.first()

    # If still no config or incomplete in DB, create an in-memory fallback config from environment variables
    if not config or not config.sender_email:
        fallback = EmailConfig(
            sender_email=env_sender or DEFAULT_AZURE_SENDER_EMAIL,
            tenant_id=env_tenant or DEFAULT_AZURE_TENANT_ID,
            client_id=env_client_id or DEFAULT_AZURE_CLIENT_ID,
            client_secret=env_client_secret or DEFAULT_AZURE_CLIENT_SECRET,
        )
        return fallback

    # Ensure missing individual fields on an existing config fall back to environment defaults
    if not config.tenant_id:
        config.tenant_id = env_tenant or DEFAULT_AZURE_TENANT_ID
    if not config.client_id:
        config.client_id = env_client_id or DEFAULT_AZURE_CLIENT_ID
    if not config.client_secret:
        config.client_secret = env_client_secret or DEFAULT_AZURE_CLIENT_SECRET
    if not config.sender_email:
        config.sender_email = env_sender or DEFAULT_AZURE_SENDER_EMAIL

    return config

def get_graph_token(current_user=None):
    config = get_active_email_config(current_user)

    env_tenant = os.environ.get('AZURE_TENANT_ID', '').strip()
    env_client_id = os.environ.get('AZURE_CLIENT_ID', '').strip()
    env_client_secret = os.environ.get('AZURE_CLIENT_SECRET', '').strip()

    tenant_id = (config.tenant_id if config and config.tenant_id else None) or env_tenant or DEFAULT_AZURE_TENANT_ID
    client_id = (config.client_id if config and config.client_id else None) or env_client_id or DEFAULT_AZURE_CLIENT_ID
    client_secret = (config.client_secret if config and config.client_secret else None) or env_client_secret or DEFAULT_AZURE_CLIENT_SECRET

    if not tenant_id or not client_id or not client_secret:
        raise Exception("Microsoft Graph API authentication parameters are missing from EmailConfig / environment variables.")

    url = f"https://login.microsoftonline.com/{tenant_id}/oauth2/v2.0/token"
    headers = {"Content-Type": "application/x-www-form-urlencoded"}
    payload = {
        "client_id": client_id,
        "scope": "https://graph.microsoft.com/.default",
        "client_secret": client_secret,
        "grant_type": "client_credentials"
    }
    response = requests.post(url, headers=headers, data=payload, timeout=15)
    if response.status_code != 200:
        raise Exception(f"Failed to retrieve Azure token: {response.text}")
    return response.json().get("access_token")



def _default_email_body_text(emp, role_key, role_title, offer_type='Intern'):
    clean_role = (role_title or role_key or '').replace(' Intern', '').replace('Intern – ', '').replace(' Trainee', '').replace('Trainee – ', '').strip()
    joining_str = (
        emp.joining_date.strftime('%d %B %Y').lstrip('0')
        if emp.joining_date else 'the agreed date'
    )
    email_val = getattr(emp, 'email', '') or 'your registered email'

    type_norm = str(offer_type or 'Intern').strip().lower()
    if 'trainee' in type_norm:
        position_text = f"Trainee – {clean_role}" if clean_role else "Trainee"
        doc_name = "Trainee Offer Letter"
    elif 'full' in type_norm or type_norm in ('normal', 'employee'):
        position_text = clean_role or "Full-time Employee"
        doc_name = "Employment Offer Letter"
    else:
        position_text = f"Intern – {clean_role}" if clean_role else "Intern"
        doc_name = "Internship Offer Letter"

    return (
        f"We are pleased to offer you the position of {position_text} with "
        f"TimeArrow Pvt. Ltd. (WisBees), effective {joining_str}.\n\n"
        f"Please find attached:\n(1) {doc_name}\n(2) Non-Disclosure Agreement (NDA)\n\n"
        "Please return the signed copies at your earliest convenience to confirm your acceptance of the offer.\n\n"
        f"Your login email is {email_val}.\n"
        "Your Default Password for the WisBees portal is: Wisbees@2026. Please log in and change your password immediately after your first login.\n\n"
        "WisBees Operations Portal Access Details:\n"
        "• Portal URL: https://ops.wisbees.com\n"
        f"• Username / Email: {email_val}\n"
        "• Default Password: Wisbees@2026\n\n"
        "Should you have any questions or require any clarification, please feel free to reach out.\n\n"
        "We look forward to your continued association and contribution to WisBees."
    )

DEFAULT_MASTER_ROLES = [
    "IT Intern – Web & Automation Developer",
    "Equity Research Intern",
    "HR Intern",
    "Legal, Secretarial and Compliance Intern",
    "Digital Marketing Intern",
    "Finance Content Writer Intern",
    "Wealth Management Intern",
    "Research and Content Analyst Intern",
    "Software Engineer",
    "Senior Lead Engineer",
    "Financial Controller",
    "Marketing Lead"
]

DEFAULT_MASTER_DEPARTMENTS = [
    "Engineering",
    "Product",
    "Design",
    "Marketing",
    "Sales",
    "Human Resources",
    "Finance",
    "Operations",
    "Research",
    "Legal",
    "Customer Success",
    "Data & Analytics"
]

DEFAULT_MASTER_DURATIONS = [
    {"label": "1 Week", "value": "1w", "unit": "week", "amount": 1, "days": 7},
    {"label": "2 Weeks", "value": "2w", "unit": "week", "amount": 2, "days": 14},
    {"label": "3 Weeks", "value": "3w", "unit": "week", "amount": 3, "days": 21},
    {"label": "4 Weeks", "value": "4w", "unit": "week", "amount": 4, "days": 28},
    {"label": "6 Weeks", "value": "6w", "unit": "week", "amount": 6, "days": 42},
    {"label": "8 Weeks", "value": "8w", "unit": "week", "amount": 8, "days": 56},
    {"label": "1 Month", "value": "1m", "unit": "month", "amount": 1, "months": 1},
    {"label": "2 Months", "value": "2m", "unit": "month", "amount": 2, "months": 2},
    {"label": "3 Months", "value": "3m", "unit": "month", "amount": 3, "months": 3},
    {"label": "4 Months", "value": "4m", "unit": "month", "amount": 4, "months": 4},
    {"label": "6 Months", "value": "6m", "unit": "month", "amount": 6, "months": 6},
    {"label": "12 Months", "value": "12m", "unit": "month", "amount": 12, "months": 12}
]

def get_master_roles():
    settings = CompanySettings.objects.first()
    if settings and settings.roles_json:
        try:
            roles = json.loads(settings.roles_json)
            if isinstance(roles, list) and len(roles) > 0:
                return roles
        except Exception:
            pass
    return DEFAULT_MASTER_ROLES

def get_master_departments():
    settings = CompanySettings.objects.first()
    if settings and settings.departments_json:
        try:
            depts = json.loads(settings.departments_json)
            if isinstance(depts, list) and len(depts) > 0:
                return depts
        except Exception:
            pass
    return DEFAULT_MASTER_DEPARTMENTS

def get_master_durations():
    settings = CompanySettings.objects.first()
    if settings and settings.durations_json:
        try:
            durations = json.loads(settings.durations_json)
            if isinstance(durations, list) and len(durations) > 0:
                return durations
        except Exception:
            pass
    return DEFAULT_MASTER_DURATIONS

def _default_full_letter_text(emp, role_key, role_title, offer_type='Intern'):
    role_info = ROLE_DATA.get(role_key, GENERIC_ROLE_TEMPLATE)
    company_name = 'TimeArrow Pvt. Ltd. (WisBees)'
    type_norm = str(offer_type or 'Intern').strip().lower()

    clean_title = (role_title or role_key or '').replace(' Intern', '').replace('Intern – ', '').replace(' Trainee', '').replace('Trainee – ', '').strip()

    if 'trainee' in type_norm:
        display_title = role_title if (role_title and 'trainee' in role_title.lower()) else (f"{clean_title} Trainee" if clean_title else "Trainee")
    elif 'full' in type_norm or type_norm in ('normal', 'employee'):
        display_title = clean_title if clean_title else "Full-time Employee"
    else:
        display_title = role_title if (role_title and 'intern' in role_title.lower()) else (f"{clean_title} Intern" if clean_title else "Intern")

    start_str = emp.joining_date.strftime('%d-%b-%Y') if emp.joining_date else '___________'
    end_date_val = getattr(emp, 'end_date', None)
    end_str = end_date_val.strftime('%d-%b-%Y') if end_date_val else '___________'
    if emp.joining_date and end_date_val:
        diff_days = (end_date_val - emp.joining_date).days + 1
        if diff_days % 7 == 0 and diff_days < 60:
            weeks = diff_days // 7
            duration_str = f"{weeks} week{'s' if weeks != 1 else ''}"
        else:
            months = max(1, round(diff_days / 30))
            duration_str = f"{months} month{'s' if months != 1 else ''}"
    else:
        duration_str = "3 months" if ('trainee' in type_norm or 'intern' in type_norm) else "indefinite"

    responsibilities = '\n'.join(f"- {r}" for r in role_info.get('responsibilities', []))
    role_display = display_title.lower().replace(' intern', '').replace(' trainee', '').strip()

    stipend_val = getattr(emp, 'salary', 0)

    if 'trainee' in type_norm:
        intro_text = (
            role_info.get('intro', '')
            .replace('This internship is designed', 'This training program is designed')
            .replace('This internship', 'This training program')
            .replace('internship is designed', 'training program is designed')
        )
        duration_clause = (
            f"Your training period will be {duration_str}, commencing from {start_str} to {end_str} "
            f"and the mode of work will be remote. This program is designed for intensive practical training, "
            f"hands-on exposure, and structured professional skill development."
        )
        if stipend_val and stipend_val > 0:
            duration_clause += f" You will receive a monthly stipend/compensation of ₹{stipend_val:,.0f}."
        roles_header = f"Key Roles & Responsibilities\nDuring your training tenure, you will be expected to:\n{responsibilities}"
        completion_clause = (
            "Upon successful completion of the training period and performance evaluation, you may "
            "be considered for transition to a full-time role. You will also receive:\n"
            "- Trainee Experience Certificate\n- Letter of Recommendation (based on performance)"
        )
    elif 'full' in type_norm or type_norm in ('normal', 'employee'):
        intro_text = (
            role_info.get('intro', '')
            .replace('This internship is designed', 'This role is focused on')
            .replace('This internship', 'This role')
            .replace('internship is designed', 'role is focused on')
        )
        duration_clause = (
            f"Your employment will be on a full-time regular basis, commencing on {start_str}. "
            f"The mode of work will be remote / hybrid as directed by your reporting manager."
        )
        if stipend_val and stipend_val > 0:
            duration_clause += f" Your annual Cost to Company (CTC) will be ₹{stipend_val:,.0f} per annum."
        roles_header = f"Key Roles & Responsibilities\nIn this position, you will be expected to:\n{responsibilities}"
        completion_clause = (
            "This offer of employment is contingent upon successful background verification, "
            "reference checks, and submission of the signed Non-Disclosure Agreement and onboarding documents."
        )
    else: # Intern
        intro_text = role_info.get('intro', '')
        duration_clause = (
            f"Your internship duration will be {duration_str}, commencing from {start_str} to {end_str} "
            f"and the mode of work will be remote. This is an unpaid internship, intended for practical "
            f"learning, research exposure, and professional skill development."
        )
        if stipend_val and stipend_val > 0:
            duration_clause = duration_clause.replace("This is an unpaid internship", f"You will receive a stipend of ₹{stipend_val:,.0f}")
        roles_header = f"Key Roles & Responsibilities\nDuring your internship, you will be expected to:\n{responsibilities}"
        completion_clause = (
            "Upon successful completion of the internship and fulfilment of assigned responsibilities, you "
            "will receive:\n- Internship Experience Letter\n- Letter of Recommendation (if applicable)"
        )

    return '\n\n'.join([
        f"We are pleased to offer you the position of {display_title} at {company_name}.",
        intro_text,
        duration_clause,
        roles_header,
        "You are required to sign the attached Non-Disclosure Agreement (NDA) and strictly maintain "
        "confidentiality regarding all company research data, reports, internal tools, strategies, and "
        "proprietary information.",
        completion_clause,
        "To formally accept this offer, please sign and return a copy of this letter along with the NDA.",
        f"We look forward to having you onboard and contributing to your professional growth in "
        f"{role_display} and related domains.",
    ])

def _seed_offer_draft_fields(emp, role_key, offer_type=None, role_title=None):
    from hrms.ai_service import detect_offer_type_from_role

    resolved_title = role_title or (role_key if role_key and role_key != '__other__' else getattr(emp, 'designation', None))
    if not offer_type or offer_type == 'Intern':
        detected = detect_offer_type_from_role(resolved_title)
        offer_type = detected if detected else (offer_type or 'Intern')

    if not resolved_title or resolved_title == '__other__':
        clean_role = (role_key or getattr(emp, 'designation', '') or '').replace(' Intern', '').replace('Intern – ', '').replace(' Trainee', '').replace('Trainee – ', '').strip()
        if offer_type == 'Trainee':
            resolved_title = f"{clean_role} Trainee" if clean_role else "Trainee"
        elif offer_type == 'Full-time':
            resolved_title = clean_role or "Full-time Employee"
        else:
            resolved_title = role_key if role_key in ROLE_KEYS else (getattr(emp, 'designation', None) or (f"{clean_role} Intern" if clean_role else 'Intern'))

    return {
        'role_key': role_key or '__other__',
        'role_title': resolved_title,
        'offer_type': offer_type,
        'full_letter_text': _default_full_letter_text(emp, role_key, resolved_title, offer_type=offer_type),
        'email_body_text': _default_email_body_text(emp, role_key, resolved_title, offer_type=offer_type),
    }

def _get_offer_draft_data(emp, role_key=None, offer_type=None, role_title=None):
    from hrms.ai_service import detect_offer_type_from_role

    draft = OfferLetterDraft.objects.filter(employee_id=emp.id).first()
    
    # Auto-detect offer_type from role_title if not explicitly set
    if not offer_type or offer_type == 'Intern':
        target_check = role_title or (draft.role_title if draft else None) or getattr(emp, 'designation', None)
        detected = detect_offer_type_from_role(target_check)
        if detected:
            offer_type = detected

    resolved_type = offer_type or (getattr(draft, 'offer_type', None) if draft else None)
    if not resolved_type:
        emp_t = str(getattr(emp, 'emp_type', 'Intern') or 'Intern').strip().lower()
        resolved_type = 'Trainee' if 'trainee' in emp_t else ('Full-time' if ('full' in emp_t or emp_t in ('normal', 'employee')) else 'Intern')

    if draft:
        type_changed = offer_type and draft.offer_type and offer_type.lower() != draft.offer_type.lower()
        role_matches = (not role_key or draft.role_key == role_key or (role_key == '__other__' and (draft.role_key == '__other__' or draft.role_title)))
        if not type_changed and role_matches:
            matched_key = draft.role_key or role_key or (emp.designation if emp.designation in ROLE_KEYS else '__other__')
            saved_title = draft.role_title or role_title or matched_key or ''
            return {
                'role_key': matched_key,
                'role_title': saved_title,
                'offer_type': draft.offer_type or resolved_type,
                'full_letter_text': draft.full_letter_text or _default_full_letter_text(emp, matched_key, saved_title, offer_type=draft.offer_type or resolved_type),
                'email_body_text': draft.email_body_text or _default_email_body_text(emp, matched_key, saved_title, offer_type=draft.offer_type or resolved_type),
            }

    if not role_key:
        if getattr(emp, 'designation', None) and emp.designation in ROLE_KEYS:
            role_key = emp.designation
        else:
            role_key = ROLE_KEYS[0] if ROLE_KEYS else '__other__'
    return _seed_offer_draft_fields(emp, role_key, offer_type=resolved_type, role_title=role_title)

def _upsert_offer_draft(emp, role_key, role_title, full_letter_text, email_body_text, offer_type=None):
    draft, _ = OfferLetterDraft.objects.get_or_create(employee_id=emp.id)
    draft.role_key = role_key
    draft.role_title = role_title
    if offer_type:
        draft.offer_type = offer_type
    draft.full_letter_text = full_letter_text
    draft.email_body_text = email_body_text
    draft.save()
    fields_to_update = []
    if role_title:
        emp.designation = role_title
        fields_to_update.append('designation')
    if offer_type:
        emp.emp_type = offer_type
        fields_to_update.append('emp_type')
    if fields_to_update:
        emp.save(update_fields=fields_to_update)
    return draft

RESEARCH_REPORT_RETENTION_DAYS = 3

def _compile_research_context(form_dict_list, chart_filename):
    """form_dict_list is request.POST (a QueryDict with getlist) or parsed dict."""
    if hasattr(form_dict_list, 'dict'):
        form_data = {k: form_dict_list[k] for k in form_dict_list.keys()}
        dates = form_dict_list.getlist('an_date[]')
        brokers = form_dict_list.getlist('an_broker[]')
        calls = form_dict_list.getlist('an_call[]')
        targets = form_dict_list.getlist('an_target[]')
    elif isinstance(form_dict_list, dict):
        form_data = {k: (v[0] if isinstance(v, list) and len(v) == 1 else v) for k, v in form_dict_list.items()}
        dates = form_dict_list.get('an_date[]', [])
        brokers = form_dict_list.get('an_broker[]', [])
        calls = form_dict_list.get('an_call[]', [])
        targets = form_dict_list.get('an_target[]', [])
    else:
        form_data = {}
        dates, brokers, calls, targets = [], [], [], []

    try:
        cmp_val = float(form_data.get('cmp', 0))
        target_val = float(form_data.get('target_price', 0))
        upside = round(((target_val - cmp_val) / cmp_val) * 100, 2) if cmp_val > 0 else 0
    except (ValueError, TypeError):
        upside = 0
    form_data['upside'] = upside

    analysts_list = []
    for i in range(len(dates)):
        if dates[i] or (i < len(brokers) and brokers[i]):
            analysts_list.append({
                'date': dates[i],
                'broker': brokers[i] if i < len(brokers) else '',
                'call': calls[i] if i < len(calls) else '',
                'target': targets[i] if i < len(targets) else ''
            })

    comparison_mode = form_data.get('comparison_mode', 'peer')
    if comparison_mode == 'financial_year':
        metric_labels = [
            ('mcap', 'Revenue (Cr)'),
            ('pe', 'EBITDA (Cr)'),
            ('roe', 'Net Profit (Cr)'),
            ('roce', 'OPM (%)'),
            ('opm', 'EPS (₹)'),
            ('ev', 'Dividend / Share (₹)'),
        ]
    else:
        metric_labels = [
            ('mcap', 'Market Cap (Cr)'),
            ('pe', 'P/E Ratio'),
            ('roe', 'ROE (%)'),
            ('roce', 'ROCE (%)'),
            ('opm', 'OPM (%)'),
            ('ev', 'EV / EBITDA'),
        ]

    comparison_columns = []
    col_index = 1
    while f'comp_{col_index}' in form_data:
        col_name = str(form_data.get(f'comp_{col_index}', '')).strip()
        if col_name:
            comparison_columns.append({
                'name': col_name,
                'metrics': {key: form_data.get(f'{key}_{col_index}', '') for key, _ in metric_labels}
            })
        col_index += 1

    return {
        'data': form_data,
        'chart_filename': chart_filename,
        'analysts': analysts_list,
        'comparison_mode': comparison_mode,
        'comparison_columns': comparison_columns,
        'metric_labels': metric_labels,
    }

def _purge_expired_research_reports():
    cutoff = timezone.now() - timedelta(days=RESEARCH_REPORT_RETENTION_DAYS)
    ResearchReport.objects.filter(created_at__lt=cutoff).delete()

def _research_report_or_403(report_id, current_user):
    report = ResearchReport.objects.filter(id=report_id).first()
    if not report:
        raise Http404("Report not found")
    if isinstance(current_user, EmployeeAccount) and report.created_by_id != current_user.id:
        raise PermissionDenied("Access denied")
    return report

# Yahoo Finance helpers
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept-Language": "en-US,en;q=0.9"
}

_yahoo_session = requests.Session()
_yahoo_session.headers.update(HEADERS)
_yahoo_crumb = None

YAHOO_CRUMB_RETRY_BACKOFFS = [0, 2]
YAHOO_REQUEST_RETRY_BACKOFFS = [0, 2]

def _get_yahoo_crumb(force_refresh=False):
    global _yahoo_crumb
    if _yahoo_crumb and not force_refresh:
        return _yahoo_crumb

    if force_refresh:
        _yahoo_crumb = None
        _yahoo_session.cookies.clear()

    for i, wait in enumerate(YAHOO_CRUMB_RETRY_BACKOFFS, start=1):
        if wait:
            time.sleep(wait)
        try:
            _yahoo_session.get('https://fc.yahoo.com', timeout=5)
            res = _yahoo_session.get('https://query1.finance.yahoo.com/v1/test/getcrumb', timeout=5)
            if res.status_code == 200 and res.text and 'Unauthorized' not in res.text:
                _yahoo_crumb = res.text.strip()
                return _yahoo_crumb
            if res.status_code != 429:
                break
        except requests.RequestException:
            pass
    return _yahoo_crumb

def _yahoo_get(url, params):
    force_refresh = False
    attempts = len(YAHOO_REQUEST_RETRY_BACKOFFS)
    for i, wait in enumerate(YAHOO_REQUEST_RETRY_BACKOFFS, start=1):
        if wait:
            time.sleep(wait)
        crumb = _get_yahoo_crumb(force_refresh=force_refresh)
        force_refresh = False
        if not crumb:
            return None
        try:
            res = _yahoo_session.get(url, params={**params, 'crumb': crumb}, timeout=8)
        except requests.RequestException:
            return None
        if res.status_code == 200:
            return res
        if res.status_code in (401, 403):
            force_refresh = True
        elif res.status_code != 429:
            return None
    return None

def _yahoo_quote_summary(yahoo_symbol, modules):
    try:
        res = _yahoo_get(
            f"https://query1.finance.yahoo.com/v10/finance/quoteSummary/{yahoo_symbol}",
            {'modules': modules}
        )
        if res is None:
            return None
        result = res.json().get('quoteSummary', {}).get('result') or []
        return result[0] if result else None
    except Exception:
        return None

def _raw(block, key):
    val = (block or {}).get(key)
    return val.get('raw') if isinstance(val, dict) else None

def _yahoo_fundamentals_timeseries(yahoo_symbol, metric_types):
    try:
        period2 = int(datetime.now().timestamp())
        period1 = period2 - 5 * 365 * 24 * 3600
        res = _yahoo_get(
            f"https://query2.finance.yahoo.com/ws/fundamentals-timeseries/v1/finance/timeseries/{yahoo_symbol}",
            {'type': metric_types, 'period1': period1, 'period2': period2}
        )
        if res is None:
            return None
        result = res.json().get('timeseries', {}).get('result') or []
        by_type = {}
        for block in result:
            meta_types = ((block or {}).get('meta') or {}).get('type') or []
            if not meta_types:
                continue
            t = meta_types[0]
            entries = block.get(t) or []
            by_type[t] = {
                e['asOfDate']: (e.get('reportedValue') or {}).get('raw')
                for e in entries if e
            }
        return by_type
    except Exception:
        return None
