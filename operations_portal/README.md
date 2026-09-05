# WisBees Operations Portal

A dedicated, full-stack **Operations Management Portal** with **Django REST Backend** and **Next.js 16 Frontend**.

---

## 🔑 Default Seeded Accounts

| Role | Email | Password | Assigned Designation / Role |
|---|---|---|---|
| **Operations Admin** | `admin@operations.wisbees.com` | `admin123` | Director of Operations |
| **Employee (Chhayakanta M.)** | `chhayakanta@wisbees.com` | `employee123` | IT Intern – Web & Automation Developer |

---

## 🚀 Running Locally

### 1. Backend (Django REST API - Port 8001)
```bash
cd operations_portal/backend
python manage.py migrate
python manage.py runserver 8001
```
Or double-click `operations_portal/run_ops_backend.bat`.

### 2. Frontend (Next.js - Port 3001)
```bash
cd operations_portal/frontend
npm install
npm run dev
```
Or double-click `operations_portal/run_ops_frontend.bat`.

Access the portal at: **`http://localhost:3001`**

---

## 🌟 Features

### 🛡️ 1. Operations Admin Console
- **Operations Overview Dashboard**: Real-time deliverable metrics, completion rates, and team activity timeline.
- **Employee Directory & Role Assignment**: Add/edit team members, assign operational roles, configure custom permission scopes.
- **Work & Task Manager**: Dual Kanban & List views, create tasks with assignee selectors, priority tags, and review submissions.
- **Role & Access Matrix**: Define operational responsibilities, seniority levels, and capability checklists.

### 👤 2. Employee Workspace (e.g. Chhayakanta Maharana)
- **Personalized Workspace**: View only your assigned tasks and responsibilities.
- **My Assigned Deliverables**: Interactive Kanban/Cards with status transitions (`Todo` → `In Progress` → `Under Review` → `Completed`), submission notes, and deliverable links.
- **My Role & Scope**: Details view of your assigned operational scope and system permissions.
- **Daily Work Logs**: Log hours and daily progress summaries with historical tracking.
