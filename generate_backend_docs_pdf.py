import os
import sys
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm
from reportlab.lib.colors import HexColor
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable, PageBreak, KeepTogether
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY, TA_RIGHT
from reportlab.graphics.shapes import Drawing, Rect, String, Line, Polygon, Group

def create_architecture_diagram():
    # Width ~ 510 pt, Height ~ 220 pt
    d = Drawing(510, 230)

    # Color definitions
    COLOR_FE_BG = HexColor("#EFF6FF")      # Light Blue
    COLOR_FE_BORDER = HexColor("#3B82F6")  # Blue
    COLOR_FE_NODE = HexColor("#1E40AF")    # Dark Blue

    COLOR_BE_BG = HexColor("#ECFDF5")      # Light Emerald
    COLOR_BE_BORDER = HexColor("#10B981")  # Emerald
    COLOR_BE_NODE = HexColor("#065F46")    # Dark Emerald

    COLOR_DB_BG = HexColor("#F8FAFC")      # Slate
    COLOR_DB_BORDER = HexColor("#64748B")  # Slate Border
    COLOR_DB_NODE = HexColor("#0F172A")    # Dark Slate

    # 1. FRONTEND CONTAINER (Next.js)
    d.add(Rect(10, 140, 490, 80, rx=8, ry=8, fillColor=COLOR_FE_BG, strokeColor=COLOR_FE_BORDER, strokeWidth=1.5))
    d.add(String(20, 205, "FRONTEND LAYER — Next.js 16 (React, Tailwind CSS)", fontName="Helvetica-Bold", fontSize=9, fillColor=COLOR_FE_NODE))

    # Node 1.1: Next.js Views
    d.add(Rect(25, 150, 200, 42, rx=5, ry=5, fillColor=HexColor("#FFFFFF"), strokeColor=COLOR_FE_BORDER, strokeWidth=1))
    d.add(String(35, 175, "App Router Pages & UI Components", fontName="Helvetica-Bold", fontSize=8.5, fillColor=COLOR_FE_NODE))
    d.add(String(35, 160, "/dashboard, /employees, /profile", fontName="Helvetica", fontSize=7.5, fillColor=HexColor("#475569")))

    # Arrow 1.1 -> 1.2
    d.add(Line(225, 171, 260, 171, strokeColor=COLOR_FE_BORDER, strokeWidth=1.5))
    d.add(Polygon([260, 174, 266, 171, 260, 168], fillColor=COLOR_FE_BORDER, strokeColor=COLOR_FE_BORDER))

    # Node 1.2: API Client
    d.add(Rect(266, 150, 220, 42, rx=5, ry=5, fillColor=HexColor("#FFFFFF"), strokeColor=COLOR_FE_BORDER, strokeWidth=1))
    d.add(String(276, 175, "API Service Layer (frontend/lib/api.ts)", fontName="Helvetica-Bold", fontSize=8.5, fillColor=COLOR_FE_NODE))
    d.add(String(276, 160, "Axios REST HTTP Client (with CORS & Auth)", fontName="Helvetica", fontSize=7.5, fillColor=HexColor("#475569")))

    # Connector Arrow: Frontend -> Backend
    d.add(Line(376, 150, 376, 120, strokeColor=HexColor("#2563EB"), strokeWidth=2))
    d.add(Polygon([372, 120, 376, 114, 380, 120], fillColor=HexColor("#2563EB"), strokeColor=HexColor("#2563EB")))
    d.add(String(385, 130, "HTTP REST API / JSON Payload", fontName="Helvetica-Bold", fontSize=8, fillColor=HexColor("#1D4ED8")))

    # 2. BACKEND CONTAINER (Django)
    d.add(Rect(10, 65, 490, 55, rx=8, ry=8, fillColor=COLOR_BE_BG, strokeColor=COLOR_BE_BORDER, strokeWidth=1.5))
    d.add(String(20, 105, "BACKEND LAYER — Django Framework (Python 3.12)", fontName="Helvetica-Bold", fontSize=9, fillColor=COLOR_BE_NODE))

    # Node 2.1: Router & Middleware
    d.add(Rect(25, 72, 200, 26, rx=4, ry=4, fillColor=HexColor("#FFFFFF"), strokeColor=COLOR_BE_BORDER, strokeWidth=1))
    d.add(String(35, 87, "URLs & Auth Middleware", fontName="Helvetica-Bold", fontSize=8, fillColor=COLOR_BE_NODE))
    d.add(String(35, 77, "urls.py · middleware.py (Session Guard)", fontName="Helvetica", fontSize=7, fillColor=HexColor("#475569")))

    # Arrow 2.1 -> 2.2
    d.add(Line(225, 85, 260, 85, strokeColor=COLOR_BE_BORDER, strokeWidth=1.5))
    d.add(Polygon([260, 88, 266, 85, 260, 82], fillColor=COLOR_BE_BORDER, strokeColor=COLOR_BE_BORDER))

    # Node 2.2: Views Controller
    d.add(Rect(266, 72, 220, 26, rx=4, ry=4, fillColor=HexColor("#FFFFFF"), strokeColor=COLOR_BE_BORDER, strokeWidth=1))
    d.add(String(276, 87, "Controller Views (hrms/views.py)", fontName="Helvetica-Bold", fontSize=8, fillColor=COLOR_BE_NODE))
    d.add(String(276, 77, "REST API Endpoints & Business Logic", fontName="Helvetica", fontSize=7, fillColor=HexColor("#475569")))

    # 3. SERVICES & DATABASE LAYER (3 Columns)
    # Connector arrows down to services
    d.add(Line(90, 65, 90, 48, strokeColor=COLOR_DB_BORDER, strokeWidth=1.5))
    d.add(Polygon([87, 48, 90, 42, 93, 48], fillColor=COLOR_DB_BORDER, strokeColor=COLOR_DB_BORDER))

    d.add(Line(255, 65, 255, 48, strokeColor=COLOR_DB_BORDER, strokeWidth=1.5))
    d.add(Polygon([252, 48, 255, 42, 258, 48], fillColor=COLOR_DB_BORDER, strokeColor=COLOR_DB_BORDER))

    d.add(Line(420, 65, 420, 48, strokeColor=COLOR_DB_BORDER, strokeWidth=1.5))
    d.add(Polygon([417, 48, 420, 42, 423, 48], fillColor=COLOR_DB_BORDER, strokeColor=COLOR_DB_BORDER))

    # Service 3.1: Database
    d.add(Rect(10, 5, 155, 38, rx=5, ry=5, fillColor=COLOR_DB_BG, strokeColor=COLOR_DB_BORDER, strokeWidth=1))
    d.add(String(18, 28, "Dual Database ORM", fontName="Helvetica-Bold", fontSize=8, fillColor=COLOR_DB_NODE))
    d.add(String(18, 16, "SQLite (Local) / Neon Postgres", fontName="Helvetica", fontSize=7, fillColor=HexColor("#475569")))
    d.add(String(18, 8, "hrms/models.py (HR, Employee)", fontName="Helvetica", fontSize=6.5, fillColor=HexColor("#64748B")))

    # Service 3.2: PDF Generator
    d.add(Rect(175, 5, 160, 38, rx=5, ry=5, fillColor=COLOR_DB_BG, strokeColor=COLOR_DB_BORDER, strokeWidth=1))
    d.add(String(183, 28, "ReportLab PDF Engine", fontName="Helvetica-Bold", fontSize=8, fillColor=COLOR_DB_NODE))
    d.add(String(183, 16, "pdf_generator.py", fontName="Helvetica", fontSize=7, fillColor=HexColor("#475569")))
    d.add(String(183, 8, "Offer Letters & Experience Certs", fontName="Helvetica", fontSize=6.5, fillColor=HexColor("#64748B")))

    # Service 3.3: Email & Cloud
    d.add(Rect(345, 5, 155, 38, rx=5, ry=5, fillColor=COLOR_DB_BG, strokeColor=COLOR_DB_BORDER, strokeWidth=1))
    d.add(String(353, 28, "Email & OAuth Dispatch", fontName="Helvetica-Bold", fontSize=8, fillColor=COLOR_DB_NODE))
    d.add(String(353, 16, "email_html.py · ghost_client.py", fontName="Helvetica", fontSize=7, fillColor=HexColor("#475569")))
    d.add(String(353, 8, "Microsoft Graph / Azure OAuth2", fontName="Helvetica", fontSize=6.5, fillColor=HexColor("#64748B")))

    return d

def create_pdf(filename):
    doc = SimpleDocTemplate(
        filename,
        pagesize=A4,
        leftMargin=1.5 * cm,
        rightMargin=1.5 * cm,
        topMargin=1.8 * cm,
        bottomMargin=1.8 * cm
    )

    styles = getSampleStyleSheet()

    # Custom Color Palette
    PRIMARY = HexColor("#0E9F6E")     # Emerald Green
    PRIMARY_DARK = HexColor("#0A7A54")
    NAVY = HexColor("#0F172A")         # Dark slate
    TEXT_DARK = HexColor("#1E293B")
    TEXT_MUTED = HexColor("#64748B")
    BG_LIGHT = HexColor("#F8FAFC")
    BORDER_COLOR = HexColor("#E2E8F0")

    # Typography Styles
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Heading1'],
        fontName='Helvetica-Bold',
        fontSize=22,
        leading=26,
        textColor=NAVY,
        spaceAfter=4
    )

    subtitle_style = ParagraphStyle(
        'DocSubtitle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=11,
        leading=15,
        textColor=PRIMARY,
        spaceAfter=12
    )

    h1_style = ParagraphStyle(
        'SectionH1',
        parent=styles['Heading2'],
        fontName='Helvetica-Bold',
        fontSize=13,
        leading=16,
        textColor=PRIMARY_DARK,
        spaceBefore=12,
        spaceAfter=6,
        keepWithNext=True
    )

    body_style = ParagraphStyle(
        'BodyDark',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=13,
        textColor=TEXT_DARK,
        spaceAfter=6
    )

    bullet_style = ParagraphStyle(
        'BulletText',
        parent=body_style,
        leftIndent=10,
        spaceAfter=3
    )

    table_body_style = ParagraphStyle(
        'TableBody',
        fontName='Helvetica',
        fontSize=8,
        leading=11,
        textColor=TEXT_DARK
    )

    code_style = ParagraphStyle(
        'CodeStyle',
        fontName='Courier-Bold',
        fontSize=8,
        leading=10,
        textColor=PRIMARY_DARK
    )

    story = []

    # Title Banner Block
    story.append(Paragraph("WisBees HRMS", title_style))
    story.append(Paragraph("Full-Stack Next.js & Django Architecture Reference", subtitle_style))
    story.append(HRFlowable(width="100%", thickness=1.5, color=PRIMARY, spaceAfter=10))

    # Section 1: Executive Overview
    story.append(Paragraph("1. System Overview & Technology Stack", h1_style))
    overview_text = (
        "The <b>WisBees HRMS Application</b> is built on a modern decoupled full-stack architecture. "
        "The <b>Frontend</b> is powered by <b>Next.js 16 (React 19)</b> with Tailwind CSS, providing a high-performance "
        "single-page application interface. The <b>Backend</b> is driven by a <b>Django</b> REST server that manages business logic, "
        "authenticates sessions, generates automated ReportLab PDF documents (Offer & Experience letters), dispatches "
        "Microsoft Graph API emails, and connects dynamically to local SQLite or cloud PostgreSQL (Neon Postgres)."
    )
    story.append(Paragraph(overview_text, body_style))

    # Section 2: Visual Architecture Flow Diagram
    story.append(Paragraph("2. Frontend & Backend End-to-End Architecture Flow Diagram", h1_style))
    story.append(create_architecture_diagram())
    story.append(Spacer(1, 10))

    # Section 3: Data Flow Lifecycle
    story.append(Paragraph("3. Full-Stack Data Execution Lifecycle", h1_style))
    flow_steps = [
        "<b>1. Client Action (Next.js SPA)</b>: User interacts with Next.js pages (e.g. <code>/employees</code>, <code>/dashboard</code>). React state changes trigger HTTP requests via <code>frontend/lib/api.ts</code>.",
        "<b>2. CORS & Auth Check</b>: Requests cross to Django (port 8000). <code>corsheaders</code> handles domain origins while <code>hrms/middleware.py</code> inspects session storage to attach authenticated <code>request.user</code>.",
        "<b>3. URL Routing & Controller Logic</b>: <code>fret_project/urls.py</code> routes requests to <code>hrms/views.py</code> handlers (e.g. <code>api_employees_list</code>, <code>api_dashboard_stats</code>).",
        "<b>4. ORM Querying & Dual Database</b>: Views perform CRUD operations against <code>hrms/models.py</code>. Django routes queries to local <code>SQLite</code> (dev) or cloud <code>Neon PostgreSQL</code> (prod).",
        "<b>5. PDF & Email Document Pipeline</b>: Offer/Experience letters are compiled into byte buffers via ReportLab in <code>pdf_generator.py</code>, formatted into HTML by <code>email_html.py</code>, and sent via Azure OAuth2 Graph API in <code>ghost_client.py</code>.",
        "<b>6. Payload Response</b>: Django responds with JSON payloads to Next.js or direct PDF binary streams for download."
    ]
    for step in flow_steps:
        story.append(Paragraph(step, bullet_style))

    story.append(Spacer(1, 8))

    # Section 4: File Directory Table
    story.append(Paragraph("4. Complete File Directory & Module Reference", h1_style))

    files_data = [
        ["File Path", "Layer / Role", "Description & Technical Responsibilities"],
        [
            Paragraph("frontend/app/", code_style),
            Paragraph("Next.js SPA", table_body_style),
            Paragraph("Next.js 16 App Router pages: /dashboard, /employees, /attendance, /announcements, /profile, /settings.", table_body_style)
        ],
        [
            Paragraph("frontend/lib/api.ts", code_style),
            Paragraph("API Service", table_body_style),
            Paragraph("Axios REST client configured with base URL (http://127.0.0.1:8000) and credentials for session authentication.", table_body_style)
        ],
        [
            Paragraph("frontend/components/", code_style),
            Paragraph("React Components", table_body_style),
            Paragraph("Reusable UI components: Sidebar.tsx (navigation & mobile drawer), Header.tsx (topbar title & dark mode toggle).", table_body_style)
        ],
        [
            Paragraph("backend/manage.py", code_style),
            Paragraph("Django CLI", table_body_style),
            Paragraph("Standard Django administrative script for running dev server, migrations, and management commands.", table_body_style)
        ],
        [
            Paragraph("backend/fret_project/<br/>settings.py", code_style),
            Paragraph("Backend Config", table_body_style),
            Paragraph("Configures dual DB routing (SQLite/PostgreSQL), CORS headers, authentication middleware, media paths, and Jinja2 template engines.", table_body_style)
        ],
        [
            Paragraph("backend/fret_project/<br/>urls.py", code_style),
            Paragraph("URL Routing", table_body_style),
            Paragraph("Central URL directory mapping endpoints: auth (/login, /logout), REST APIs (/api/employees), and PDF generation routes.", table_body_style)
        ],
        [
            Paragraph("backend/hrms/<br/>models.py", code_style),
            Paragraph("Database Models", table_body_style),
            Paragraph("Django ORM schemas: HR (admin auth & binary signatures), Employee (ID codes, salary, department), Attendance, Announcement, LeaveRequest.", table_body_style)
        ],
        [
            Paragraph("backend/hrms/<br/>views.py", code_style),
            Paragraph("Core Controller", table_body_style),
            Paragraph("Primary business logic engine (70KB+) handling authentication, Next.js REST API responses, employee management, and document triggers.", table_body_style)
        ],
        [
            Paragraph("backend/hrms/<br/>utils.py", code_style),
            Paragraph("Utility Helpers", table_body_style),
            Paragraph("Candidate ID code generators (EMP001/INT0026), password hashing, date formatters, and SMTPLib email fallback wrappers.", table_body_style)
        ],
        [
            Paragraph("backend/hrms/<br/>middleware.py", code_style),
            Paragraph("Auth Middleware", table_body_style),
            Paragraph("Validates session cookies and binds logged-in HR Manager or Employee instance to request.user.", table_body_style)
        ],
        [
            Paragraph("backend/<br/>pdf_generator.py", code_style),
            Paragraph("PDF Engine", table_body_style),
            Paragraph("ReportLab layout engine compiling offer letters, CTC compensation tables, terms, and digital signatures into byte streams.", table_body_style)
        ],
        [
            Paragraph("backend/<br/>email_html.py", code_style),
            Paragraph("HTML Email Builder", table_body_style),
            Paragraph("Constructs responsive HTML email templates for offer letters, NDA packages, experience letters, and OTP notifications.", table_body_style)
        ],
        [
            Paragraph("backend/<br/>ghost_client.py", code_style),
            Paragraph("Azure Email API", table_body_style),
            Paragraph("Handles Azure OAuth2 token generation and sends automated emails via Microsoft Graph API / Ghost CMS API.", table_body_style)
        ],
    ]

    col_widths = [3.4 * cm, 3.0 * cm, 11.6 * cm]
    file_table = Table(files_data, colWidths=col_widths, repeatRows=1)
    file_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), PRIMARY),
        ('TEXTCOLOR', (0, 0), (-1, 0), HexColor("#FFFFFF")),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('PADDING', (0, 0), (-1, -1), 5),
        ('GRID', (0, 0), (-1, -1), 0.5, BORDER_COLOR),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [HexColor("#FFFFFF"), BG_LIGHT]),
    ]))

    story.append(file_table)
    story.append(Spacer(1, 10))

    # Footer note
    footer_text = "<b>WisBees HRMS Project</b> · System Architecture & API Flow Reference · Technical Documentation"
    story.append(Paragraph(footer_text, ParagraphStyle('Footer', parent=body_style, alignment=TA_CENTER, textColor=TEXT_MUTED, fontSize=7.5)))

    doc.build(story)
    print(f"PDF documentation successfully generated: {filename}")

if __name__ == '__main__':
    out_pdf = os.path.join(os.getcwd(), "WisBees_HRMS_Backend_Architecture_Documentation.pdf")
    create_pdf(out_pdf)
