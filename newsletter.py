"""
Ghost -> Microsoft Graph newsletter pipeline for FRET.

Wire it up in app.py, after `db = SQLAlchemy(app)`:

    from newsletter import init_newsletter
    init_newsletter(app, db)

Then delete the old /send-bulk-newsletter route.
"""
import base64
import hashlib
import hmac
import html as html_lib
import os
import threading
import time
from datetime import datetime, timedelta

import pandas as pd
import requests
import sqlalchemy
from flask import Blueprint, current_app, jsonify, request
from flask_login import current_user, login_required

import ghost_client
from email_html import prepare_for_email, email_feature_image

bp = Blueprint("newsletter", __name__)

# Graph throttles a single mailbox at roughly 30 messages/minute. Going faster
# earns 429s and damages the sending domain's reputation. 2.0s => ~30/min.
SEND_INTERVAL = float(os.environ.get("NEWSLETTER_SEND_INTERVAL", "2.0"))

_db = None
Job = Delivery = Unsubscribe = None


# ─────────────── auth ───────────────

def _may_send():
    dept = (getattr(current_user, "department", "") or "").strip().lower()
    desig = (getattr(current_user, "designation", "") or "").strip().lower()
    return "marketing" in dept or "marketing" in desig


# ─────────────── graph ───────────────

_token_cache = {"value": None, "expires": datetime.min}


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
    # Refresh a minute early; jobs can outlive a single token.
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
        # Bulk sends should not fill the shared mailbox's Sent Items.
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
    if r.status_code != 202:  # sendMail returns 202 Accepted, never 200
        raise RuntimeError(f"Graph {r.status_code}: {r.text[:200]}")


# ─────────────── unsubscribe ───────────────

def _sign(email):
    key = current_app.config["SECRET_KEY"].encode()
    return hmac.new(key, email.lower().encode(), hashlib.sha256).hexdigest()[:32]


def _unsub_url(email):
    blob = base64.urlsafe_b64encode(email.encode()).decode().rstrip("=")
    base = os.environ.get("APP_URL", "https://fret.wisbees.com").rstrip("/")
    return f"{base}/newsletter/unsubscribe?e={blob}&s={_sign(email)}"


def _decode_email(blob):
    padded = blob + "=" * (-len(blob) % 4)
    return base64.urlsafe_b64decode(padded.encode()).decode()


# ─────────────── email body ───────────────

def render_email(post, reader_name, unsub_url, custom_message=None):
    """Wrap the Ghost post HTML in the FRET newsletter shell."""
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


# ─────────────── job runner ───────────────

def _run_job(app, job_id):
    with app.app_context():
        job = _db.session.get(Job, job_id)
        try:
            cfg = _graph_config()
            post = ghost_client.get_newsletter_post(job.post_slug)

            job.status = "sending"
            _db.session.commit()

            # Only 'pending' rows, so a restarted job never re-mails anyone.
            pending = Delivery.query.filter_by(job_id=job.id, status="pending").all()

            for d in pending:
                token = _graph_token(cfg)  # refreshes itself mid-job
                body = render_email(post, d.name, _unsub_url(d.email), job.custom_message)
                try:
                    _send_one(token, cfg["NEWSLETTER_SENDER_EMAIL"], d.email, job.subject, body)
                    d.status = "sent"
                    job.sent_count += 1
                except Throttled as t:
                    time.sleep(t.retry_after)
                    continue  # row stays 'pending', retried on the next pass
                except Exception as e:
                    d.status = "failed"
                    d.error = str(e)[:300]
                    job.failed_count += 1

                d.attempted_at = datetime.utcnow()
                _db.session.commit()
                time.sleep(SEND_INTERVAL)

            job.status = "completed"
            job.finished_at = datetime.utcnow()
        except Exception as e:
            job.status = "failed"
            job.error = str(e)[:500]
            job.finished_at = datetime.utcnow()
        _db.session.commit()


# ─────────────── routes ───────────────

@bp.get("/api/newsletter/posts")
@login_required
def list_posts():
    # Read-only article metadata — every employee can browse it from the Work
    # Hub. Sending (below) stays gated to marketing via _may_send().
    try:
        return jsonify({"success": True, "posts": ghost_client.list_newsletter_posts()})
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 502


@bp.post("/send-bulk-newsletter")
@login_required
def send_bulk_newsletter():
    if not _may_send():
        return jsonify({"success": False, "message": "Unauthorized"}), 403

    slug = (request.form.get("post_slug") or "").strip()
    if not slug:
        return jsonify({"success": False, "message": "Pick a newsletter post"}), 400
    if "file" not in request.files or not request.files["file"].filename:
        return jsonify({"success": False, "message": "No recipient file uploaded"}), 400

    try:
        post = ghost_client.get_newsletter_post(slug)
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 502

    try:
        df = pd.read_excel(request.files["file"])
    except Exception as e:
        return jsonify({"success": False, "message": f"Could not read Excel: {e}"}), 400
    if "Email" not in df.columns or "Name" not in df.columns:
        return jsonify({"success": False, "message": 'Excel needs "Name" and "Email" columns'}), 400

    if Job.query.filter_by(post_slug=slug, status="completed").first():
        return jsonify({"success": False, "message": f'"{post["title"]}" has already been sent.'}), 409

    subject = (request.form.get("email_subject") or "").strip() or post["title"]
    custom_message = (request.form.get("custom_message") or "").strip()
    blocked = {u.email for u in Unsubscribe.query.all()}

    rows, seen = [], set()
    for _, r in df.iterrows():
        email = str(r["Email"]).strip().lower()
        if "@" not in email or email in seen or email in blocked:
            continue
        seen.add(email)
        rows.append((email, str(r["Name"]).strip()))

    if not rows:
        return jsonify({"success": False, "message": "No valid, subscribed recipients"}), 400

    job = Job(post_slug=slug, subject=subject, total=len(rows), custom_message=custom_message,
              created_by=getattr(current_user, "name", "unknown"))
    _db.session.add(job)
    _db.session.flush()
    _db.session.bulk_save_objects(
        [Delivery(job_id=job.id, email=e, name=n) for e, n in rows]
    )
    _db.session.commit()

    threading.Thread(
        target=_run_job, args=(current_app._get_current_object(), job.id), daemon=True
    ).start()

    eta = int(len(rows) * SEND_INTERVAL / 60) + 1
    return jsonify({
        "success": True, "job_id": job.id, "total": len(rows),
        "message": f"Queued {len(rows)} recipients. Roughly {eta} min at Graph's rate limit.",
    })


@bp.get("/api/newsletter/job/<int:job_id>")
@login_required
def job_status(job_id):
    job = _db.session.get(Job, job_id)
    if not job:
        return jsonify({"success": False, "message": "No such job"}), 404
    return jsonify({
        "success": True, "status": job.status, "total": job.total,
        "sent": job.sent_count, "failed": job.failed_count, "error": job.error,
    })


@bp.route("/newsletter/unsubscribe", methods=["GET", "POST"])
def unsubscribe():
    blob, sig = request.args.get("e", ""), request.args.get("s", "")
    try:
        email = _decode_email(blob).lower()
    except Exception:
        return "Invalid link", 400
    if not hmac.compare_digest(sig, _sign(email)):
        return "Invalid link", 400

    if not Unsubscribe.query.filter_by(email=email).first():
        _db.session.add(Unsubscribe(email=email))
        _db.session.commit()
    return (
        "<div style='font-family:sans-serif;padding:60px;text-align:center'>"
        "<h2>You're unsubscribed.</h2><p>You won't get any more WisBees newsletters.</p></div>"
    )


# ─────────────── init ───────────────

def init_newsletter(app, db):
    global _db, Job, Delivery, Unsubscribe
    _db = db

    class NewsletterJob(db.Model):
        __tablename__ = "newsletter_job"
        id = db.Column(db.Integer, primary_key=True)
        post_slug = db.Column(db.String(200), nullable=False, index=True)
        subject = db.Column(db.String(300))
        custom_message = db.Column(db.Text)
        status = db.Column(db.String(20), default="queued")  # queued|sending|completed|failed
        total = db.Column(db.Integer, default=0)
        sent_count = db.Column(db.Integer, default=0)
        failed_count = db.Column(db.Integer, default=0)
        error = db.Column(db.Text)
        created_by = db.Column(db.String(120))
        created_at = db.Column(db.DateTime, default=datetime.utcnow)
        finished_at = db.Column(db.DateTime)

    class NewsletterDelivery(db.Model):
        __tablename__ = "newsletter_delivery"
        id = db.Column(db.Integer, primary_key=True)
        job_id = db.Column(db.Integer, db.ForeignKey("newsletter_job.id"), index=True)
        email = db.Column(db.String(200), nullable=False)
        name = db.Column(db.String(200))
        status = db.Column(db.String(20), default="pending")  # pending|sent|failed
        error = db.Column(db.String(300))
        attempted_at = db.Column(db.DateTime)

    class NewsletterUnsubscribe(db.Model):
        __tablename__ = "newsletter_unsubscribe"
        id = db.Column(db.Integer, primary_key=True)
        email = db.Column(db.String(200), unique=True, nullable=False, index=True)
        created_at = db.Column(db.DateTime, default=datetime.utcnow)

    Job, Delivery, Unsubscribe = NewsletterJob, NewsletterDelivery, NewsletterUnsubscribe
    app.register_blueprint(bp)

    # db.create_all() never alters an existing table, so a DB from before the
    # custom_message column existed needs a one-time patch here.
    with app.app_context():
        inspector = sqlalchemy.inspect(db.engine)
        if inspector.has_table("newsletter_job"):
            cols = {c["name"] for c in inspector.get_columns("newsletter_job")}
            if "custom_message" not in cols:
                db.session.execute(sqlalchemy.text("ALTER TABLE newsletter_job ADD COLUMN custom_message TEXT"))
                db.session.commit()
