"""
WisbeesHR — PDF Offer Letter Generator
TimeArrow Pvt. Ltd. (WisBees)
Exact letter format as specified.
Margins: top=5cm, bottom=4.42cm, left=1.39cm, right=1.39cm
"""

import io
import os
from datetime import date, timedelta
from pydoc import doc
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm
from reportlab.lib.colors import HexColor, black
from reportlab.pdfgen import canvas as rl_canvas
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_JUSTIFY, TA_CENTER, TA_RIGHT
from flask import current_app
from reportlab.platypus import Image as RLImage

# ── Page geometry ─────────────────────────────────────────────────────────────
PAGE_W, PAGE_H = A4          # 595.27 x 841.89 pts
MAR_TOP    = 5.00 * cm
MAR_BOTTOM = 4.42 * cm
MAR_LEFT   = 1.39 * cm
MAR_RIGHT  = 1.39 * cm
BODY_W     = PAGE_W - MAR_LEFT - MAR_RIGHT

# ── Colours ───────────────────────────────────────────────────────────────────
BLACK     = HexColor('#000000')
DARK      = HexColor('#1a1a1a')
GRAY      = HexColor('#444444')
LIGHTGRAY = HexColor('#666666')

# ── Role catalogue ────────────────────────────────────────────────────────────
# Only the responsibilities change per role — all other text is identical.
ROLE_DATA = {
    "IT Intern – Web & Automation Developer": {
        "intro": (
            "This internship is designed to provide hands-on exposure to modern web application "
            "development, process automation, API integration, AI-powered solutions, and software "
            "engineering practices. You will work on real-world projects contributing to the "
            "development of internal platforms, automation tools, and innovative AI-driven applications."
        ),
        "responsibilities": [
            "Assist in the development and integration of web applications, dashboards, APIs, and backend services.",
            "Support the creation of automation tools and workflow optimization solutions.",
            "Contribute to building AI-powered applications, including LLM and RAG-based prototypes and research assistants.",
            "Participate in testing, debugging, and improving application performance and reliability.",
            "Prepare and maintain technical documentation for code, processes, and internal tools.",
            "Research emerging technologies and recommend innovative solutions for business challenges.",
            "Collaborate with WisBees mentors and team members to deliver high-quality technology solutions.",
            "Adhere to development best practices, maintain confidentiality, and ensure timely communication and reporting.",
        ],
    },
    "Equity Research Intern": {
        "intro": (
            "This internship is designed to provide hands-on exposure to equity research, "
            "financial analysis, and investment evaluation. You will work on real-world research "
            "projects contributing to fundamental analysis, sector coverage, and investment insights."
        ),
        "responsibilities": [
            "Conduct fundamental and technical analysis of listed equities across sectors.",
            "Prepare sector reports, company profiles, and investment summaries for internal use.",
            "Track macroeconomic indicators, market trends, corporate actions, and regulatory updates.",
            "Support senior analysts in financial modelling and valuation exercises (DCF, P/E, EV/EBITDA).",
            "Compile and verify data from NSE/BSE filings, SEBI disclosures, and company annual reports.",
            "Attend and summarise management calls, earnings releases, and investor presentations.",
            "Collaborate with the research team to produce structured and accurate investment reports.",
            "Adhere to research best practices, maintain confidentiality of proprietary data, and report timely.",
        ],
    },
    "HR Intern": {
        "intro": (
            "This internship is designed to provide hands-on exposure to recruitment, "
            "employee engagement, HR operations, onboarding processes, documentation, "
            "and talent management practices."
        ),
        "responsibilities": [
            "Assist in recruitment activities, including candidate sourcing, screening, and interview coordination.",
            "Support employee onboarding, documentation, and record management.",
            "Assist in maintaining HR databases, trackers, and reports.",
            "Coordinate employee engagement and internship programs.",
            "Support policy documentation and HR process improvement initiatives.",
            "Maintain professionalism, confidentiality, and timely communication.",
        ],
    },
    "Legal, Secretarial and Compliance Intern": {
        "intro": (
            "This internship is designed to provide you with practical exposure to corporate legal matters, "
            "secretarial functions, regulatory compliance, and governance processes. You will gain hands-on "
            "experience in company law compliances, SEBI Investment Adviser regulations, corporate documentation, "
            "legal drafting, statutory filings, and compliance management, helping you build a strong foundation "
            "in legal, secretarial, and regulatory affairs."
        ),
        "responsibilities": [
            "Assist in share transfer processes and corporate documentation.",
            "Support Partnership, LLP, and Company registration activities.",
            "Assist in SEBI Investment Adviser compliance and regulatory documentation.",
            "Maintain compliance calendars and track regulatory deadlines.",
            "Monitor SCORES complaints and maintain complaint registers.",
            "Assist in Client KYC documentation, agreements, and regulatory record maintenance.",
            "Track SEBI and IAASB circulars and support compliance research activities.",
            "Assist in drafting board resolutions, meeting minutes, and governance documents.",
            "Support preparation and review of contracts, NDAs, MOUs, and other legal documents.",
            "Assist in Director appointment, resignation, and related statutory filings.",
            "Maintain proper documentation, confidentiality, and compliance records at all times.",
            "Provide legal, secretarial, and compliance support to the Founder's Office and management team.",
        ],
    },

    "Digital Marketing Intern": {
        "intro": (
            "This internship is designed to provide hands-on exposure to digital marketing, "
            "social media management, content creation, branding, campaign execution, and online "
            "audience engagement. You will work closely with the marketing team to support business "
            "growth and brand visibility across digital platforms."
        ),
        "responsibilities": [
            "Assist in creating and publishing content for social media, websites, and marketing campaigns.",
            "Support digital marketing initiatives, including SEO, email marketing, and online promotions.",
            "Help manage social media accounts and track engagement metrics.",
            "Conduct market and competitor research to identify trends and opportunities.",
            "Assist in designing marketing materials, presentations, and promotional content.",
            "Support event promotions, lead generation, and brand awareness activities.",
            "Prepare marketing reports and maintain campaign documentation.",
            "Collaborate with WisBees mentors and team members to execute marketing strategies effectively.",
        ],
    },

    "Finance Content Writer Intern": {
        "intro": (
            "This internship is designed to provide hands-on exposure to financial markets, "
            "investment research, content creation, financial literacy, and digital publishing. "
            "You will work closely with the research and marketing teams to create engaging and "
            "informative finance-related content for investors, students, and the broader financial community."
        ),
        "responsibilities": [
            "Create articles, blogs, newsletters, and social media content on finance, investing, mutual funds, and stock markets.",
            "Simplify complex financial concepts into easy-to-understand content for different audiences.",
            "Support the preparation of financial literacy materials, presentations, and educational resources.",
            "Conduct research on market trends, economic developments, and investment opportunities.",
            "Assist in content planning, proofreading, and maintaining content quality standards.",
            "Collaborate with research and marketing teams to develop engaging and informative financial content.",
            "Ensure accuracy, professionalism, and compliance in all published content.",
            "Maintain confidentiality, timely communication, and structured documentation.",
        ],
    },
    "Wealth Management Intern": {
        "intro": (
            "This internship is designed to provide hands-on exposure to wealth management, "
            "financial planning, investment products, portfolio analysis, client engagement, "
            "and financial advisory services. You will work closely with experienced professionals "
            "to understand how investment solutions are designed and delivered to meet clients' financial goals."
        ),
        "responsibilities": [
            "Assist in researching investment products, including Mutual Funds, Stocks, Bonds, PMS, and AIFs.",
            "Support portfolio analysis, asset allocation reviews, and preparation of client investment reports.",
            "Conduct market and economic research to identify investment opportunities and trends.",
            "Assist in preparing financial planning and wealth management presentations.",
            "Support client onboarding, documentation, and relationship management activities.",
            "Help create financial literacy and investor awareness content for clients and prospects.",
            "Maintain accurate records, reports, and documentation related to wealth management activities.",
            "Demonstrate professionalism, confidentiality, and timely communication in all assignments.",
        ],
    },
    "Research and Content Analyst Intern": {
        "intro": (
            "This internship is designed to provide you with hands-on exposure to financial markets, wealth management "
            "concepts, investment research, and financial content creation. You will develop the ability to analyze market  "
            "trends, simplify complex financial concepts, and create engaging content that educates and informs investors, "
            "while building a strong foundation in personal finance, investments, and wealth management."
        ),
        "responsibilities": [
            "Create deeply investigated and data driven research articles.",
            "Create articles, blogs, newsletters, market updates, and educational content on finance and investments.",
            "Simplify complex financial concepts into reader-friendly content.",
            "Develop SEO-friendly content for websites, email newsletters, and investor communication.",
            "Research trending financial topics and prepare insightful write-ups.",
            "Collaborate with marketing and research teams to create engaging financial content.",
            "Ensure content accuracy, clarity, and compliance with company standards."
        ],

    }
}
ROLE_KEYS = list(ROLE_DATA.keys())


# ── Letterhead background ─────────────────────────────────────────────────────
def _draw_letterhead(c, letterhead_path):
    """Draw letterhead image as full-page background — called BEFORE text."""
    if not letterhead_path or not os.path.exists(letterhead_path):
        return
    try:
        c.saveState()
        c.drawImage(
            letterhead_path,
            0, 0,
            width=PAGE_W, height=PAGE_H,
            preserveAspectRatio=False,
            mask='auto'
        )
        c.restoreState()
    except Exception:
        pass



# ── Main generator ────────────────────────────────────────────────────────────
def generate_offer_letter_pdf(emp, hr_user, settings, role_key, custom_notes=''):
    """
    Returns a BytesIO buffer containing the offer letter PDF.

    emp         — Employee ORM object (needs: name, emp_id, joining_date, end_date, salary)
    hr_user     — HR ORM object (needs: name, designation, signature_path)
    settings    — CompanySettings ORM object
    role_key    — str, one of ROLE_KEYS
    """
    buf = io.BytesIO()

    letterhead_path = getattr(settings, 'letterhead_path', None)
    company_name    = getattr(settings, 'company_name',    'TimeArrow Pvt. Ltd. (WisBees)') or 'TimeArrow Pvt. Ltd. (WisBees)'
    company_email   = getattr(settings, 'company_email',   '') or ''
    company_phone   = getattr(settings, 'company_phone',   '') or ''

    role_info = ROLE_DATA.get(role_key, list(ROLE_DATA.values())[0])

    # Dates
    today_str    = date.today().strftime('%d-%b-%Y')
    start_str    = emp.joining_date.strftime('%d-%b-%Y') if emp.joining_date else '___________'
    end_date_val = getattr(emp, 'end_date', None)
    end_str      = end_date_val.strftime('%d-%b-%Y') if end_date_val else '___________'

    # Duration in months (approximate)
    if emp.joining_date and end_date_val:
        delta_days = (end_date_val - emp.joining_date).days
        months = round(delta_days / 30)
        duration_str = f"{months} month{'s' if months != 1 else ''}"
    else:
        duration_str = "3 months"

    # ── Document setup ────────────────────────────────────────────────────────
    doc = SimpleDocTemplate(
        buf,
        pagesize=A4,
        topMargin=MAR_TOP,
        bottomMargin=MAR_BOTTOM,
        leftMargin=MAR_LEFT,
        rightMargin=MAR_RIGHT,
    )

    # ── Paragraph styles ──────────────────────────────────────────────────────
    def PS(name, **kw):
        return ParagraphStyle(name, **kw)

    BASE = dict(fontName='Helvetica', textColor=DARK, leading=15)

    sty_title   = PS('Title',   fontName='Helvetica-Bold', fontSize=14,
                     textColor=BLACK, alignment=TA_CENTER, spaceAfter=10, leading=18)
    sty_date    = PS('Date',    fontSize=10, alignment=TA_RIGHT, textColor=DARK, spaceAfter=2,  **{k:v for k,v in BASE.items() if k != 'textColor'})
    sty_salute  = PS('Salute',  fontSize=10, textColor=DARK, spaceAfter=6,  fontName='Helvetica', leading=15)
    sty_body    = PS('Body',    fontSize=10, textColor=DARK, spaceAfter=7,
                     alignment=TA_JUSTIFY, fontName='Helvetica', leading=15)
    sty_bold    = PS('Bold',    fontSize=10, textColor=BLACK, spaceAfter=4,
                     fontName='Helvetica-Bold', leading=14)
    sty_bullet  = PS('Bullet',  fontSize=10, textColor=DARK, spaceAfter=3,
                     fontName='Helvetica', leading=14, leftIndent=10)
    sty_sign    = PS('Sign',    fontSize=10, textColor=DARK, spaceAfter=2,
                     fontName='Helvetica', leading=14)
    sty_signb   = PS('SignB',   fontSize=10, textColor=BLACK, spaceAfter=1,
                     fontName='Helvetica-Bold', leading=14)

    story = []

    # ── INTERNSHIP OFFER LETTER heading ───────────────────────────────────────
    # Date
    story.append(Paragraph(f"Date: {today_str}", sty_date))
    story.append(Spacer(1, 0.15*cm))

    # Title
    story.append(Paragraph("INTERNSHIP OFFER LETTER", sty_title))
    story.append(Spacer(1, 0.20*cm))

    # ── Salutation ────────────────────────────────────────────────────────────
    story.append(Paragraph(f"Dear {emp.name},", sty_salute))
    story.append(Spacer(1, 0.1*cm))

    # ── Opening paragraph ─────────────────────────────────────────────────────
    story.append(Paragraph(
        f"We are pleased to offer you the position of <b>{role_key}</b> at "
        f"<b>{company_name}</b>.",
        sty_body
    ))

    # ── Role intro (changes per role) ─────────────────────────────────────────
    story.append(Paragraph(role_info["intro"], sty_body))

    # ── Duration / mode paragraph ─────────────────────────────────────────────
    story.append(Paragraph(
        f"Your internship duration will be <b>{duration_str}</b>, commencing from "
        f"<b>{start_str}</b> to <b>{end_str}</b> and the mode of work will be <b>remote</b>. "
        f"This is an <b>unpaid internship</b>, intended for practical learning, research "
        f"exposure, and professional skill development.",
        sty_body
    ))

    # ── Key Roles & Responsibilities ──────────────────────────────────────────
    story.append(Spacer(1, 0.15*cm))
    story.append(Paragraph("Key Roles &amp; Responsibilities", sty_bold))
    story.append(Paragraph("During your internship, you will be expected to:", sty_body))

    for item in role_info["responsibilities"]:
        story.append(Paragraph(f"·&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; {item}", sty_bullet))


    # ── NDA paragraph ─────────────────────────────────────────────────────────
    story.append(Paragraph(
        "You are required to sign the attached <b>Non-Disclosure Agreement (NDA)</b> and strictly "
        "maintain confidentiality regarding all company research data, reports, internal tools, "
        "strategies, and proprietary information.",
        sty_body
    ))

    story.append(Spacer(1, 0.15*cm))

    # ── Upon completion ────────────────────────────────────────────────────────
    story.append(Paragraph(
        "Upon successful completion of the internship and fulfilment of assigned responsibilities, "
        "you will receive:",
        sty_body
    ))
    for benefit in [
        "Internship Experience Letter",
        "Letter of Recommendation (if applicable)",
    ]:
        story.append(Paragraph(f"·&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; {benefit}", sty_bullet))

    story.append(Spacer(1, 0.25*cm))

    # ── Acceptance paragraph ──────────────────────────────────────────────────
    story.append(Paragraph(
        "To formally accept this offer, please sign and return a copy of this letter along with the NDA.",
        sty_body
    ))
    story.append(Paragraph(
        f"We look forward to having you onboard and contributing to your professional growth in "
        f"{role_key.lower().replace(' intern', '')} and related domains.",
        sty_body
    ))

    # ── Signature block ───────────────────────────────────────────────────────
    story.append(Spacer(1, 0.4*cm))
    story.append(Paragraph("Warm regards,", sty_sign))
    story.append(Spacer(1, 0.15*cm))

    # HR signature image
    if hr_user.signature_path and os.path.exists(hr_user.signature_path):
        from reportlab.platypus import Image as RLImage
        try:
            sig = RLImage(hr_user.signature_path, width=3.5*cm, height=1.1*cm)
            sig.hAlign = 'LEFT'
            story.append(sig)
        except Exception:
            story.append(Spacer(1, 0.9*cm))
    else:
        story.append(Spacer(1, 0.9*cm))

    story.append(Paragraph(f"<b>{hr_user.name}</b>", sty_signb))
    story.append(Paragraph(hr_user.designation, sty_sign))
    story.append(Paragraph(company_name, sty_sign))

    # ── Build ─────────────────────────────────────────────────────────────────
    def add_letterhead(canvas, doc):
        _draw_letterhead(canvas, letterhead_path)

    doc.build(
        story,
        onFirstPage=add_letterhead,
        onLaterPages=add_letterhead
    )
    buf.seek(0)
    return buf

def generate_experience_letter_pdf(emp, settings, prefix="Ms."):
    """
    Generate Experience Certificate / Internship Experience Certificate.
    Matches the clean layout, font sizes, colors, and bullet points of the provided image.
    
    Dynamically maps pronouns and loads specific bullet responsibilities using emp.designation 
    from the global ROLE_DATA configuration.
    """
    import io
    import os
    from datetime import date
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
    from reportlab.platypus import Image as RLImage
    from reportlab.lib.styles import ParagraphStyle
    from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY, TA_LEFT
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.units import cm
    from reportlab.lib.colors import HexColor

    buf = io.BytesIO()
    letterhead_path = getattr(settings, 'letterhead_path', None)
    company_name = getattr(settings, "company_name", "TimeArrow Pvt. Ltd. (WisBees)")

    # ── DYNAMIC PRONOUN MAPPING FROM PREFIX ───────────────────────────────────
    is_male = (prefix.strip().lower() == "mr.")
    
    p_sub  = "he" if is_male else "she"      # Subjective: he/she
    p_poss = "his" if is_male else "her"     # Possessive: his/her
    p_obj  = "him" if is_male else "her"     # Objective: him/her
    
    p_sub_cap  = p_sub.capitalize()
    p_poss_cap = p_poss.capitalize()

    # Define strict professional typography matching the document layout image
    COLOR_PRIMARY = HexColor("#004D40")  # Deep Teal for matching main headers
    COLOR_TEXT = HexColor("#2D3748")     # Sleek charcoal grey for body legibility
    COLOR_DARK = HexColor("#1A202C")     # Off-black for emphasized fields

    doc = SimpleDocTemplate(
        buf,
        pagesize=A4,
        topMargin=MAR_TOP,       
        bottomMargin=MAR_BOTTOM,
        leftMargin=MAR_LEFT,
        rightMargin=MAR_RIGHT,
    )

    def PS(name, **kw):
        return ParagraphStyle(name, **kw)

    # Core typography styles with precise leading calculations to prevent line overlaps
    sty_date = PS(
        "DocDate",
        fontName="Helvetica",
        fontSize=11,
        leading=16,
        alignment=TA_LEFT,
        textColor=COLOR_TEXT,
        spaceAfter=25
    )

    sty_title = PS(
        "DocTitle",
        fontName="Helvetica-Bold",
        fontSize=16,
        leading=18,
        alignment=TA_CENTER,
        textColor=COLOR_PRIMARY,
        spaceAfter=25
    )

    sty_body = PS(
        "DocBody",
        fontName="Helvetica",
        fontSize=11,
        leading=18,
        alignment=TA_JUSTIFY,
        textColor=COLOR_TEXT,
        spaceAfter=1
    )

    sty_bullet = PS(
        "DocBullet",
        fontName="Helvetica",
        fontSize=11,
        leading=16,
        alignment=TA_LEFT,
        textColor=COLOR_TEXT,
        leftIndent=20,
        firstLineIndent=-10,
        spaceAfter=6
    )

    sty_sign = PS(
        "DocSign",
        fontName="Helvetica",
        fontSize=11,
        leading=15,
        textColor=COLOR_DARK,

    )

    sty_signb = PS(
        "DocSignBold",
        fontName="Helvetica-Bold",
        fontSize=12,
        leading=16,
        textColor=COLOR_PRIMARY,
        spaceAfter=4
    )

    story = []

    # # 1. Date (Left aligned matching the reference image layout)
    # today_str = date.today().strftime("%d %B %Y")
    # story.append(Paragraph(f"Date: {today_str}", sty_date))
    # story.append(Spacer(1, 0.2 * cm))

    # 2. Document Title
    is_intern = (getattr(emp, 'emp_type', 'Intern') == "Intern")
    title_text = "INTERNSHIP EXPERIENCE CERTIFICATE" if is_intern else "EXPERIENCE CERTIFICATE"
    story.append(Paragraph(title_text, sty_title))
    story.append(Spacer(1, 0.4 * cm))

    # 3. Salutation & Opening Frame
    story.append(Paragraph("To Whom It May Concern,", sty_body))
    
    join = emp.joining_date.strftime("%d %B %Y") if emp.joining_date else "___________"
    end = emp.end_date.strftime("%d %B %Y") if emp.end_date else "Present"

    # Opening Certification Line
    opening_text = (
        f"This is to certify that <b>{prefix} {emp.name}</b> has successfully "
        f"completed {p_poss} internship with <b>{company_name}</b> as "
        f"an <b>{emp.designation}</b> from {join} to {end}."
    )
    story.append(Paragraph(opening_text, sty_body))

    # 4. Dynamic Responsibilities and Bullet Points Processing
    story.append(Paragraph(f"During {p_poss} internship, {p_sub} was actively involved in:", sty_body))
    
    # ── EXTRACT DATA FROM ROLE_DATA MAP ───────────────────────────────────────
    # Sanitizes input strings to safely track keys despite subtle spacing discrepancies
    emp_role_key = str(emp.designation).strip()
    role_info = ROLE_DATA.get(emp_role_key)
    
    # Fuzzy match fallback logic in case strings don't exactly line up line-for-line
    if not role_info:
        for key, value in ROLE_DATA.items():
            if key.lower().replace(" ", "") == emp_role_key.lower().replace(" ", ""):
                role_info = value
                break

    # Fallback to Equity Research defaults if no matching dictionary profile key can be verified
    if role_info and "responsibilities" in role_info:
        responsibilities = role_info["responsibilities"]
    else:
        responsibilities = [
            "Fundamental and financial statement analysis of listed companies",
            "Preparation of buy side research presentations and investment summaries",
            "Industry and sector research to assess market dynamics and competitive positioning",
            "Application of valuation techniques."
        ]
    
    for resp in responsibilities:
        story.append(Paragraph(f"•&nbsp;&nbsp; {resp}", sty_bullet))
    
    story.append(Spacer(1, 0.2 * cm))

    # 5. Review Assessment Paragraph
    if is_intern:
        assessment_text = (
            f"{p_sub_cap} demonstrated strong analytical ability, research discipline, and attention to detail. "
            f"{p_poss_cap} work reflected professionalism, initiative, and a keen interest in related financial or operational domains."
        )
    else:
        assessment_text = (
            f"During the tenure, <b>{emp.name}</b> carried out {p_poss} assigned duties with dedication, "
            f"sincerity and professionalism. {p_sub_cap} consistently demonstrated excellent work ethics, "
            f"teamwork, and commitment towards organizational goals."
        )
    story.append(Paragraph(assessment_text, sty_body))

    # Appreciation Closing
    closing_text = f"We appreciate {p_poss} contributions and wish {p_obj} success in {p_poss} future endeavours."
    story.append(Paragraph(closing_text, sty_body))

    story.append(Spacer(1, 0.6 * cm))

    # 6. Authority Signatures Block
    FOUNDER_SIGNATURE = os.path.join(
        current_app.root_path,
        "static",
        "founder_signature.png"
    )

    if os.path.exists(FOUNDER_SIGNATURE):
        try:
            sig = RLImage(FOUNDER_SIGNATURE, width=6* cm, height=2.5 * cm)
            sig.hAlign = "LEFT"
            story.append(sig)
        except Exception:
            story.append(Spacer(1, 1.0 * cm))
    else:
        story.append(Spacer(1, 1.0 * cm))

    story.append(Paragraph("<b>Founder & CEO</b>", sty_signb))
    story.append(Paragraph(company_name, sty_sign))

    # 7. Letterhead Generation Bindings
    def add_letterhead(canvas, doc):
        _draw_letterhead(canvas, letterhead_path)

    doc.build(
        story,
        onFirstPage=add_letterhead,
        onLaterPages=add_letterhead
    )
    
    buf.seek(0)
    return buf
