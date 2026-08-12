# FRET — Wisbees HR & Research Platform

A Flask-based internal platform for Wisbees that combines a full HR Management System with an Equity Research report builder and a Ghost-blog newsletter pipeline. Dark-mode UI, role-based logins for HR staff and employees/interns, and heavy automation around document generation and email delivery.

---

## 🚀 Quick Start

### 1. Install dependencies
```bash
pip install -r requirements.txt
```

### 2. Configure environment
```bash
cp .env.example .env
# then edit .env — see "Environment Variables" below
```

### 3. Run the app
```bash
python run.py
```

### 4. Open your browser
```
http://localhost:5000
```

### 5. Register your HR account
Go to `/register` → fill in your name, designation, and **upload your signature** (PNG with transparent background works best). Registration is gated by a 6-digit OTP emailed to `cto@wisbees.com` via Microsoft Graph — see [Environment Variables](#-environment-variables).

---

## ✨ Features

### 🔐 Authentication
- Separate login flows for **HR staff** (`/login`) and **Employees/Interns** (`/employee-login`)
- HR self-registration (`/register`) gated by an email OTP sent to `cto@wisbees.com`
- Forced password change on first employee login (`must_change_password`)
- Digital signature stored per HR account (DB-backed, survives redeploys) and auto-embedded in generated documents

### 📊 HR Dashboard
- Live stats (total, active, new this month, offers sent)
- Monthly/weekly hiring trend chart and department distribution chart
- Recent hires list and quick actions panel

### 👥 Employee Management
- Add, edit, delete employees (Normal staff or Interns)
- Auto-generated Employee IDs (`EMP0001`, `EMP0002`, …)
- Filter by department/status, search by name/email/ID
- Profile photo, gender, blood group, joining/end date tracking
- Digital ID card view per employee (`/employee/<id>/id-card`)

### 📄 Offer & Experience Letters
- **Offer Letter**: pick a role, preview/edit the generated text, download as PDF, or email it directly — HR name, designation, company name, date and signature are auto-inserted
- **Experience Letter**: generated from joining/end date + role, downloadable as PDF or emailed
- **Send confirmation dialog**: clicking "Send Email" on either letter shows a confirmation step with the employee's name, email, internship duration, and date before anything is sent
- **CC picker**: tick common recipients (`jd@wisbees.com`, `gouri.sankar@wisbees.com`, `cto@wisbees.com`) and/or type in extra addresses — both are merged into the CC list
- NDA stored once in Settings and attached automatically alongside the offer letter

### 📧 Email Automation
- Offer/experience letters and NDA sent via SMTP or Microsoft Graph (per-HR `EmailConfig`: tenant/client credentials)
- HR registration OTP delivery via Microsoft Graph (app-level `AZURE_*` env vars)

### 🕒 Attendance
- Employee/intern self check-in / check-out
- HR-side attendance management view with employee/date-range filters
- Export attendance records

### 🌴 Leave Management
- Employees apply for leave (`/apply-leave`)
- HR approves/rejects requests from a central queue

### 📣 Announcements
- HR posts announcements targeted at Everyone / Employees / Interns, with priority levels and optional expiry
- Employees see a filtered feed on their own dashboard

### 🧑‍💼 Employee Self-Service Portal
- Personal dashboard, profile management, avatar upload
- Digital ID card, announcements feed, leave application, attendance check-in/out

### 📈 Equity Research Report Builder ("Work Hub")
For Equity Research interns — a dossier-style report generator (`/work`, `/research/generate`):
- Live NSE/BSE stock search and autocomplete (Yahoo Finance search API)
- Auto-pulled CMP, market cap, P/E, ROE, ROCE, OPM, EV/EBITDA (Yahoo Finance quote/fundamentals APIs)
- 3-year historical financials (revenue, EBITDA, net profit, OPM, EPS)
- Street/analyst coverage & consensus calls (scraped from Moneycontrol broker research)
- Peer/financial-year comparison tables with a searchable broker/company picker
- AI-powered "Rephrase with AI" toolbar (Groq `llama-3.3-70b-versatile`) to polish analyst commentary
- Compiled dossier can be emailed out via Microsoft Graph (`/research/mail`)

### 📰 Newsletter Pipeline
- Pulls posts from a Ghost CMS blog (Content API) and renders them as email-safe HTML
- Bulk-sends to a subscriber list via Microsoft Graph, throttled to respect mailbox sending limits
- Restricted to Marketing department/designation users

### ⚙️ Settings
- Company name, address, email, phone, letterhead
- Upload NDA PDF once (reused for every employee)
- Per-HR SMTP / Microsoft Graph email configuration

---

## 🗂️ Project Structure

```
app.py              Main Flask app — models, routes, business logic
pdf_generator.py     Offer/experience letter PDF generation (ReportLab)
newsletter.py        Ghost → Microsoft Graph bulk newsletter blueprint
ghost_client.py       Read-only Ghost Content API client
email_html.py         Converts Ghost's web HTML into email-safe HTML
run.py               Local dev entry point (python run.py)
wsgi.py              Production entry point (gunicorn wsgi:app)
templates/            Jinja2 templates (HR + employee portals, letters, reports)
static/               Static assets (logo, uploads for research report images)
uploads/              Runtime file storage (signatures, attachments)
render.yaml           Render.com deployment config
requirements.txt      Python dependencies
```

---

## 🔑 Environment Variables

Copy `.env.example` to `.env` and fill in what you need. Not every integration is required to run the core HRMS locally.

| Variable | Used for | Required? |
|---|---|---|
| `SECRET_KEY` | Flask session signing | Yes |
| `DATABASE_URL` | Postgres (e.g. Neon) connection string; falls back to local SQLite (`hrms.db`) if unset | No |
| `FLASK_DEBUG` | `1` for local debugging, `0` in production | No |
| `PORT` | Port to bind (defaults to 5000) | No |
| `GROQ_API_KEY` | AI rephrase in the research report builder | For research module |
| `AZURE_TENANT_ID` / `AZURE_CLIENT_ID` / `AZURE_CLIENT_SECRET` / `AZURE_SENDER_EMAIL` | Microsoft Graph app credentials used to send the HR registration OTP email | For `/register` |
| `AZURE_NOTIFICATION_EMAIL` | Where the registration OTP is sent (defaults to `cto@wisbees.com`) | No |
| `NEWSLETTER_SENDER_EMAIL` / `NEWSLETTER_TENANT_ID` / `NEWSLETTER_CLIENT_ID` / `NEWSLETTER_CLIENT_SECRET` | Microsoft Graph credentials for the newsletter blueprint | For newsletter module |
| `NEWSLETTER_SEND_INTERVAL` | Seconds between newsletter sends (default `2.0`, ~30/min) | No |
| `GHOST_URL` / `GHOST_CONTENT_API_KEY` / `GHOST_ADMIN_API_KEY` | Ghost CMS Content API access for the newsletter source blog | For newsletter module |
| `GHOST_NEWSLETTER_TAG` / `GHOST_WEALTH_HELP_TAG` | Ghost post tags used to filter newsletter content | No |
| `APP_URL` | Base URL used in newsletter links (e.g. unsubscribe) | For newsletter module |

Per-HR SMTP/Graph credentials for offer/experience letter emails are configured in-app under **Settings**, not via environment variables.

---

## 📧 Email Setup

### Gmail (SMTP, per-HR in Settings)
1. Enable 2-Factor Authentication on your Google account
2. Go to: Google Account → Security → 2-Step Verification → App passwords
3. Create an app password for "Mail"
4. Use that 16-character password in Settings → Email Config

### Microsoft Graph (OTP, research dossier, newsletter)
Register an Azure AD app with `Mail.Send` application permission and grant admin consent, then set the corresponding `AZURE_*` / `NEWSLETTER_*` environment variables above.

---

## ☁️ Deployment

Configured for [Render](https://render.com) via `render.yaml`:
- `gunicorn wsgi:app` as the start command
- `DATABASE_URL` should point at a Postgres instance (e.g. [Neon](https://neon.tech)) — SQLite is for local dev only
- `SECRET_KEY` is auto-generated by Render; other secrets (`AZURE_*`, `GROQ_API_KEY`, `GHOST_*`, `NEWSLETTER_*`) must be set manually in the Render dashboard
- Python version pinned via `runtime.txt` / `PYTHON_VERSION`

---

## 🎨 Design Highlights

- Deep dark background (`#0f1117`) — not generic grey
- Indigo + violet accent gradient
- Inter + Plus Jakarta Sans typography
- Smooth `slideUp`, `fadeIn` animations on page load
- Animated background grid on login page
- Chart.js charts for hiring trends & department breakdown
- Live clock on dashboard
- Toast notifications for all actions
