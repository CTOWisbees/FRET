# FRET — Human Resource Management System

A modern, full-featured HRMS built with Flask. Dark-mode UI with smooth animations, HR login with signature management, offer letter generation, and automated email sending.

---

## 🚀 Quick Start

### 1. Install dependencies
```bash
pip install -r requirements.txt
```

### 2. Run the app
```bash
python run.py
```

### 3. Open your browser
```
http://localhost:5000
```

### 4. Register your HR account
Go to `/register` → fill in your name, designation, and **upload your signature** (PNG with transparent background works best).

---

## ✨ Features

### 🔐 HR Login System
- Separate accounts for each HR member
- Name and designation stored per account
- Digital signature stored in backend — used automatically in documents

### 📊 Dashboard
- Live stats (total, active, new this month, offers sent)
- Monthly/Weekly hiring trend chart
- Department distribution chart
- Recent hires list
- Quick actions panel

### 👥 Employee Management
- Add, edit, delete employees
- Auto-generated Employee IDs (EMP0001, EMP0002, …)
- Filter by department, status, search by name/email
- Track offer letter & NDA status per employee

### 📄 Offer Letter Generation
- Select employee → click Download
- Auto-inserts: HR name, designation, company name, date
- **Automatically embeds HR signature** (no manual upload per letter)
- Downloads as `.docx`

### 📧 Email Automation
- Send Offer Letter and/or NDA via email
- NDA stored once in Settings → sent as attachment automatically
- Configure SMTP (Gmail App Password supported)

### ⚙️ Settings
- Company name, address, email, phone
- Upload NDA PDF once (reused for all employees)
- SMTP email configuration

---


## 📧 Gmail Setup for Email

1. Enable 2-Factor Authentication on your Google account
2. Go to: Google Account → Security → 2-Step Verification → App passwords
3. Create an app password for "Mail"
4. Use that 16-character password in Settings → Email Config

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
