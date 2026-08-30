import os
import time
import base64
import hmac
import hashlib
import threading
import html as html_lib
from datetime import datetime, timedelta
import pandas as pd
import requests

from django.conf import settings as django_settings
from django.shortcuts import render, redirect
from django.http import HttpResponse, JsonResponse
from django.views.decorators.http import require_POST, require_GET
from django.utils import timezone

import ghost_client
from email_html import prepare_for_email, email_feature_image
from hrms.models import NewsletterJob, NewsletterDelivery, NewsletterUnsubscribe, EmployeeAccount
from hrms.views import login_required_custom

SEND_INTERVAL = float(os.environ.get("NEWSLETTER_SEND_INTERVAL", "2.0"))
_token_cache = {"value": None, "expires": datetime.min}


def _may_send(user):
    dept = (getattr(user, "department", "") or "").strip().lower()
    desig = (getattr(user, "designation", "") or "").strip().lower()
    return "marketing" in dept or "marketing" in desig


def _graph_config():
    keys = ("NEWSLETTER_SENDER_EMAIL", "NEWSLETTER_TENANT_ID",
            "NEWSLETTER_CLIENT_ID", "NEWSLETTER_CLIENT_SECRET")
    cfg = {k: os.environ.get(k) for k in keys}
    missing = [k for k, v in cfg.items() if not v]
    if missing:
        raise RuntimeError(f"Missing env vars: {', '.join(missing)}")
    return cfg


def _graph_token(cfg):
    if _token_cache["value"] and datetime.utcnow() < _token_cache["expires"]:
        return _token_cache["value"]

    r = requests.post(
        f"https://login.microsoftonline.com/{cfg['NEWSLETTER_TENANT_ID']}/oauth2/v2.0/token",
        data={
            "client_id": cfg["NEWSLETTER_CLIENT_ID"],
            "client_secret": cfg["NEWSLETTER_CLIENT_SECRET"],
            "scope": "https://graph.microsoft.com/.default",
            "grant_type": "client_credentials",
        },
        timeout=20,
    )
    if r.status_code != 200:
        raise RuntimeError(f"Azure token error {r.status_code}: {r.text[:200]}")

    body = r.json()
    _token_cache["value"] = body["access_token"]
    _token_cache["expires"] = datetime.utcnow() + timedelta(
        seconds=int(body.get("expires_in", 3600)) - 60
    )
    return _token_cache["value"]


class Throttled(Exception):
    def __init__(self, retry_after):
        self.retry_after = retry_after


def _send_one(token, sender, to_email, subject, body_html):
    payload = {
        "message": {
            "subject": subject,
            "body": {"contentType": "HTML", "content": body_html},
            "toRecipients": [{"emailAddress": {"address": to_email}}],
        },
        "saveToSentItems": False,
    }
    r = requests.post(
        f"https://graph.microsoft.com/v1.0/users/{sender}/sendMail",
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        json=payload,
        timeout=30,
    )
    if r.status_code == 429:
        raise Throttled(int(r.headers.get("Retry-After", 30)))
    if r.status_code != 202:
        raise RuntimeError(f"Graph {r.status_code}: {r.text[:200]}")


def _sign(email):
    key = django_settings.SECRET_KEY.encode()
    return hmac.new(key, email.lower().encode(), hashlib.sha256).hexdigest()[:32]


def _unsub_url(email):
    blob = base64.urlsafe_b64encode(email.encode()).decode().rstrip("=")
    base = os.environ.get("APP_URL", "https://fret.wisbees.com").rstrip("/")
    return f"{base}/newsletter/unsubscribe?e={blob}&s={_sign(email)}"


def _decode_email(blob):
    padded = blob + "=" * (-len(blob) % 4)
    return base64.urlsafe_b64decode(padded.encode()).decode()


def render_email(post, reader_name, unsub_url, custom_message=None):
    if custom_message:
        greeting = html_lib.escape(custom_message).replace("\n", "<br>")
    else:
        greeting = f"Hi {html_lib.escape(str(reader_name))}," if reader_name else "Hi there,"

    hero = ""
    if post.get("feature_image"):
        src = html_lib.escape(email_feature_image(post["feature_image"]), quote=True)
        hero = (
            '<tr><td align="center" style="padding:10px 35px 25px 35px;">'
            f'<img src="{src}" alt="" width="510" '
            'style="width:100%;max-width:510px;height:auto;display:block;border:0;border-radius:8px;"></td></tr>'
        )

    return f"""
<div style="background-color:#f4f6f8;padding:40px 15px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width:580px;background-color:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0;">
    <tr><td align="center" style="padding:35px 24px 25px 24px;border-bottom:2px solid #f1f5f9;">
      <img src="https://fret.wisbees.com/static/logo.png" alt="WisBees" width="150" style="display:block;border:0;max-width:100%;height:auto;">
    </td></tr>
    {hero}
    <tr><td style="padding:10px 35px 40px 35px;color:#1e293b;font-size:16px;line-height:1.8;">
      <p style="font-size:18px;font-weight:600;color:#0f172a;margin:0 0 24px 0;">{greeting}</p>
      <h1 style="font-size:26px;font-weight:800;color:#0f172a;line-height:1.3;margin:0 0 20px 0;letter-spacing:-0.5px;">{html_lib.escape(post["title"])}</h1>
      <div style="color:#334155;">{prepare_for_email(post["html"])}</div>
    </td></tr>
    <tr><td align="center" style="padding:30px 24px;background-color:#fafbfc;border-top:1px solid #e2e8f0;color:#64748b;font-size:13px;">
      <p style="margin:0 0 4px 0;font-weight:700;color:#0f172a;">TimeArrow Private Limited (WisBees)</p>
      <p style="margin:0 0 12px 0;color:#94a3b8;font-size:12px;">Mumbai, Maharashtra, India</p>
      <a href="{unsub_url}" style="color:#94a3b8;font-size:12px;">Unsubscribe</a>
    </td></tr>
  </table>
</div>"""


def _run_job_bg(job_id):
    job = NewsletterJob.objects.filter(id=job_id).first()
    if not job:
        return
    try:
        cfg = _graph_config()
        post = ghost_client.get_newsletter_post(job.post_slug)

        job.status = "sending"
        job.save()

        pending = NewsletterDelivery.objects.filter(job_id=job.id, status="pending")
        for d in pending:
            token = _graph_token(cfg)
            body = render_email(post, d.name, _unsub_url(d.email), job.custom_message)
            try:
                _send_one(token, cfg["NEWSLETTER_SENDER_EMAIL"], d.email, job.subject, body)
                d.status = "sent"
                job.sent_count += 1
            except Throttled as t:
                time.sleep(t.retry_after)
                continue
            except Exception as e:
                d.status = "failed"
                d.error = str(e)[:300]
                job.failed_count += 1

            d.attempted_at = timezone.now()
            d.save()
            job.save()
            time.sleep(SEND_INTERVAL)

        job.status = "completed"
        job.finished_at = timezone.now()
    except Exception as e:
        job.status = "failed"
        job.error = str(e)[:500]
        job.finished_at = timezone.now()
    job.save()


@login_required_custom
def list_posts(request):
    try:
        return JsonResponse({"success": True, "posts": ghost_client.list_newsletter_posts()})
    except Exception as e:
        return JsonResponse({"success": False, "message": str(e)}, status=502)


@login_required_custom
def list_wealth_help_posts(request):
    try:
        return JsonResponse({"success": True, "posts": ghost_client.list_wealth_help_posts()})
    except Exception as e:
        return JsonResponse({"success": False, "message": str(e)}, status=502)


@login_required_custom
def list_sendable_posts(request):
    if not _may_send(request.current_user):
        return JsonResponse({"success": False, "message": "Unauthorized"}, status=403)
    try:
        return JsonResponse({"success": True, "posts": ghost_client.list_sendable_posts()})
    except Exception as e:
        return JsonResponse({"success": False, "message": str(e)}, status=502)


@login_required_custom
@require_POST
def send_bulk_newsletter(request):
    if not _may_send(request.current_user):
        return JsonResponse({"success": False, "message": "Unauthorized"}, status=403)

    slug = (request.POST.get("post_slug") or "").strip()
    if not slug:
        return JsonResponse({"success": False, "message": "Pick a newsletter post"}, status=400)
    if "file" not in request.FILES or not request.FILES["file"].name:
        return JsonResponse({"success": False, "message": "No recipient file uploaded"}, status=400)

    try:
        post = ghost_client.get_newsletter_post(slug)
    except Exception as e:
        return JsonResponse({"success": False, "message": str(e)}, status=502)

    try:
        df = pd.read_excel(request.FILES["file"])
    except Exception as e:
        return JsonResponse({"success": False, "message": f"Could not read Excel: {e}"}, status=400)
    if "Email" not in df.columns or "Name" not in df.columns:
        return JsonResponse({"success": False, "message": 'Excel needs "Name" and "Email" columns'}, status=400)

    if NewsletterJob.objects.filter(post_slug=slug, status="completed").exists():
        return JsonResponse({"success": False, "message": f'"{post["title"]}" has already been sent.'}, status=409)

    subject = (request.POST.get("email_subject") or "").strip() or post["title"]
    custom_message = (request.POST.get("custom_message") or "").strip()
    blocked = set(NewsletterUnsubscribe.objects.values_list('email', flat=True))

    rows, seen = [], set()
    for _, r in df.iterrows():
        email = str(r["Email"]).strip().lower()
        if "@" not in email or email in seen or email in blocked:
            continue
        seen.add(email)
        rows.append((email, str(r["Name"]).strip()))

    if not rows:
        return JsonResponse({"success": False, "message": "No valid, subscribed recipients"}, status=400)

    author = getattr(request.current_user, "name", "unknown")
    job = NewsletterJob.objects.create(
        post_slug=slug, subject=subject, total=len(rows),
        custom_message=custom_message, created_by=author
    )

    NewsletterDelivery.objects.bulk_create([
        NewsletterDelivery(job_id=job.id, email=e, name=n) for e, n in rows
    ])

    threading.Thread(target=_run_job_bg, args=(job.id,), daemon=True).start()

    eta = int(len(rows) * SEND_INTERVAL / 60) + 1
    return JsonResponse({
        "success": True, "job_id": job.id, "total": len(rows),
        "message": f"Queued {len(rows)} recipients. Roughly {eta} min at Graph's rate limit.",
    })


@login_required_custom
def job_status(request, job_id):
    job = NewsletterJob.objects.filter(id=job_id).first()
    if not job:
        return JsonResponse({"success": False, "message": "No such job"}, status=404)
    return JsonResponse({
        "success": True, "status": job.status, "total": job.total,
        "sent": job.sent_count, "failed": job.failed_count, "error": job.error,
    })


def unsubscribe(request):
    blob = request.GET.get("e", "")
    sig = request.GET.get("s", "")
    try:
        email = _decode_email(blob).lower()
    except Exception:
        return HttpResponse("Invalid link", status=400)
    if not hmac.compare_digest(sig, _sign(email)):
        return HttpResponse("Invalid link", status=400)

    if not NewsletterUnsubscribe.objects.filter(email=email).exists():
        NewsletterUnsubscribe.objects.create(email=email)
    return HttpResponse(
        "<div style='font-family:sans-serif;padding:60px;text-align:center'>"
        "<h2>You're unsubscribed.</h2><p>You won't get any more WisBees newsletters.</p></div>"
    )
