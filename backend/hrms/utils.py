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

def get_graph_token(current_user=None):
    if current_user:
        config = EmailConfig.objects.filter(hr_id=current_user.id).first()
    else:
        config = EmailConfig.objects.first()

    if not config or not config.tenant_id or not config.client_id or not config.client_secret:
        raise Exception("Microsoft Graph API authentication parameters are missing from EmailConfig database.")

    url = f"https://login.microsoftonline.com/{config.tenant_id}/oauth2/v2.0/token"
    headers = {"Content-Type": "application/x-www-form-urlencoded"}
    payload = {
        "client_id": config.client_id,
        "scope": "https://graph.microsoft.com/.default",
        "client_secret": config.client_secret,
        "grant_type": "client_credentials"
    }
    response = requests.post(url, headers=headers, data=payload)
    if response.status_code != 200:
        raise Exception(f"Failed to retrieve Azure token: {response.text}")
    return response.json().get("access_token")

def _default_email_body_text(emp, role_key, role_title):
    role_display = (role_title or role_key or 'Intern').replace(' Intern', '').replace('Intern – ', '').strip()
    joining_str = (
        emp.joining_date.strftime('%d %B %Y').lstrip('0')
        if emp.joining_date else 'the agreed date'
    )
    return (
        f"We are pleased to offer you the position of Intern – {role_display} with "
        f"TimeArrow Pvt. Ltd. (WisBees), effective {joining_str}.\n\n"
        "Please find attached:\n(1) Internship Offer Letter\n(2) Non-Disclosure Agreement (NDA)\n\n"
        "Please return the signed copies at your earliest convenience to confirm your acceptance of the offer.\n\n"
        "Should you have any questions or require any clarification, please feel free to reach out.\n\n"
        f"Your login email is {emp.email}.\n"
        "Your Default Password for the WisBees portal is: Wisbees@2026. Please log in and change your password immediately after your first login.\n\n"
        "We look forward to your continued association and contribution to WisBees."
    )

def _default_full_letter_text(emp, role_key, role_title):
    role_info = ROLE_DATA.get(role_key, GENERIC_ROLE_TEMPLATE)
    display_title = role_title or role_key
    company_name = 'TimeArrow Pvt. Ltd. (WisBees)'

    start_str = emp.joining_date.strftime('%d-%b-%Y') if emp.joining_date else '___________'
    end_date_val = getattr(emp, 'end_date', None)
    end_str = end_date_val.strftime('%d-%b-%Y') if end_date_val else '___________'
    if emp.joining_date and end_date_val:
        months = round((end_date_val - emp.joining_date).days / 30)
        duration_str = f"{months} month{'s' if months != 1 else ''}"
    else:
        duration_str = "3 months"

    responsibilities = '\n'.join(f"- {r}" for r in role_info['responsibilities'])
    role_display = display_title.lower().replace(' intern', '') if display_title else ''

    return '\n\n'.join([
        f"We are pleased to offer you the position of {display_title} at {company_name}.",
        role_info['intro'],
        f"Your internship duration will be {duration_str}, commencing from {start_str} to {end_str} "
        f"and the mode of work will be remote. This is an unpaid internship, intended for practical "
        f"learning, research exposure, and professional skill development.",
        f"Key Roles & Responsibilities\nDuring your internship, you will be expected to:\n{responsibilities}",
        "You are required to sign the attached Non-Disclosure Agreement (NDA) and strictly maintain "
        "confidentiality regarding all company research data, reports, internal tools, strategies, and "
        "proprietary information.",
        "Upon successful completion of the internship and fulfilment of assigned responsibilities, you "
        "will receive:\n- Internship Experience Letter\n- Letter of Recommendation (if applicable)",
        "To formally accept this offer, please sign and return a copy of this letter along with the NDA.",
        f"Your login email is {emp.email}.\n"
        "Your Default Password for the WisBees portal is: Wisbees@2026. Please log in and change your password immediately after your first login.\n\n"
        f"We look forward to having you onboard and contributing to your professional growth in "
        f"{role_display} and related domains.",
    ])

def _seed_offer_draft_fields(emp, role_key):
    role_title = role_key if role_key in ROLE_KEYS else (emp.designation or role_key or '')
    return {
        'role_key': role_key,
        'role_title': role_title,
        'full_letter_text': _default_full_letter_text(emp, role_key, role_title),
        'email_body_text': _default_email_body_text(emp, role_key, role_title),
    }

def _get_offer_draft_data(emp, role_key):
    draft = OfferLetterDraft.objects.filter(employee_id=emp.id).first()
    if draft and draft.role_key == role_key:
        return {
            'role_key': draft.role_key,
            'role_title': draft.role_title or draft.role_key or '',
            'full_letter_text': draft.full_letter_text or '',
            'email_body_text': draft.email_body_text or '',
        }
    return _seed_offer_draft_fields(emp, role_key)

def _upsert_offer_draft(emp, role_key, role_title, full_letter_text, email_body_text):
    draft, _ = OfferLetterDraft.objects.get_or_create(employee_id=emp.id)
    draft.role_key = role_key
    draft.role_title = role_title
    draft.full_letter_text = full_letter_text
    draft.email_body_text = email_body_text
    draft.save()
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
