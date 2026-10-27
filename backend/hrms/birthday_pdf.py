"""
WisBees — Birthday Letter & Wishes PDF Generator
Produces a high-resolution, luxury corporate birthday card / letter in PDF format.
"""

import io
from pathlib import Path
from datetime import date
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm
from reportlab.lib.colors import HexColor
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_JUSTIFY, TA_RIGHT
from reportlab.pdfgen import canvas


# Color Palette
NAVY_DEEP = HexColor('#061426')
NAVY_LIGHT = HexColor('#1a365d')
GOLD_DARK = HexColor('#B8860B')
GOLD_METALLIC = HexColor('#D4AF37')
GOLD_LIGHT = HexColor('#F6E082')
CHARCOAL = HexColor('#2D3748')
SLATE_GRAY = HexColor('#4A5568')


class NumberedCanvas(canvas.Canvas):
    """Adds decorative double gold & navy frame borders to every page."""
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_decorative_elements()
            super().showPage()
        super().save()

    def draw_decorative_elements(self):
        self.saveState()
        w, h = A4

        # Outer navy border
        self.setStrokeColor(NAVY_DEEP)
        self.setLineWidth(3)
        self.rect(20, 20, w - 40, h - 40)

        # Inner gold border
        self.setStrokeColor(GOLD_METALLIC)
        self.setLineWidth(1)
        self.rect(25, 25, w - 50, h - 50)

        # Corner flourish accents
        flourish_size = 12
        for cx, cy in [(25, 25), (w - 25, 25), (25, h - 25), (w - 25, h - 25)]:
            self.setFillColor(GOLD_METALLIC)
            self.circle(cx, cy, 3, stroke=0, fill=1)

        # Footer security & branding note
        self.setFont("Helvetica", 8)
        self.setFillColor(HexColor('#718096'))
        footer_text = "WisBees Internal Corporate Communication • Confidential & Commemorative"
        self.drawCentredString(w / 2.0, 12, footer_text)

        self.restoreState()


def generate_birthday_wishes_pdf(
    name="Jnana Ranjan Mohanty (Jnana Sir)",
    designation="Founder & Director",
    department="Management",
    output_path=None
):
    """
    Generates a personalized Birthday Wishes PDF letter.
    Returns bytes or writes to output_path.
    """
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer if output_path is None else output_path,
        pagesize=A4,
        leftMargin=1.6 * cm,
        rightMargin=1.6 * cm,
        topMargin=2.0 * cm,
        bottomMargin=2.0 * cm
    )

    styles = getSampleStyleSheet()

    # Custom typography styles
    style_company_title = ParagraphStyle(
        'CompanyTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=18,
        leading=22,
        alignment=TA_CENTER,
        textColor=NAVY_DEEP
    )

    style_company_subtitle = ParagraphStyle(
        'CompanySubtitle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=13,
        alignment=TA_CENTER,
        textColor=SLATE_GRAY
    )

    style_badge = ParagraphStyle(
        'Badge',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=11,
        leading=14,
        alignment=TA_CENTER,
        textColor=GOLD_DARK
    )

    style_main_heading = ParagraphStyle(
        'MainHeading',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=24,
        leading=28,
        alignment=TA_CENTER,
        textColor=NAVY_DEEP
    )

    style_recipient = ParagraphStyle(
        'Recipient',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=13,
        leading=17,
        textColor=NAVY_LIGHT
    )

    style_meta = ParagraphStyle(
        'Meta',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=10,
        leading=14,
        textColor=SLATE_GRAY
    )

    style_salutation = ParagraphStyle(
        'Salutation',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=12,
        leading=16,
        textColor=CHARCOAL
    )

    style_body = ParagraphStyle(
        'Body',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=10.5,
        leading=16,
        alignment=TA_JUSTIFY,
        textColor=CHARCOAL,
        spaceAfter=12
    )

    style_closing = ParagraphStyle(
        'Closing',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=11,
        leading=15,
        textColor=NAVY_DEEP
    )

    style_signoff = ParagraphStyle(
        'Signoff',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=10,
        leading=14,
        textColor=SLATE_GRAY
    )

    story = []

    # 1. Header Banner
    story.append(Paragraph("TIMEARROW PVT. LTD. &bull; WISBEES", style_company_title))
    story.append(Spacer(1, 3))
    story.append(Paragraph("Corporate Office &bull; Mumbai, Maharashtra 400001 &bull; www.wisbees.com", style_company_subtitle))
    story.append(Spacer(1, 10))

    # Divider bar
    story.append(HRFlowable(width="100%", thickness=1.5, color=GOLD_METALLIC, spaceBefore=4, spaceAfter=14))

    # 2. Celebration Badge
    story.append(Paragraph("&#9733; SPECIAL COMMEMORATIVE LETTER &#9733;", style_badge))
    story.append(Spacer(1, 6))
    story.append(Paragraph("HAPPY BIRTHDAY", style_main_heading))
    story.append(Spacer(1, 14))

    # 3. Recipient Details Box
    today_str = date.today().strftime("%B %d, %Y")
    recipient_html = f"""
    <b>Honourable Recipient:</b> {name}<br/>
    <b>Designation:</b> {designation} &bull; <b>Department:</b> {department}<br/>
    <b>Date of Commemoration:</b> 28th October
    """
    recipient_table = Table(
        [[Paragraph(recipient_html, style_meta)]],
        colWidths=[17.5 * cm]
    )
    recipient_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), HexColor('#F7FAFC')),
        ('BOX', (0, 0), (-1, -1), 0.75, HexColor('#E2E8F0')),
        ('PADDING', (0, 0), (-1, -1), 10),
    ]))
    story.append(recipient_table)
    story.append(Spacer(1, 18))

    # 4. Salutation
    story.append(Paragraph(f"Respected {name},", style_salutation))
    story.append(Spacer(1, 8))

    # 5. Core Letter Body
    p1 = (
        "On this joyful and auspicious occasion of your <b>Birthday</b>, the entire <b>WisBees family</b>—including "
        "the management team, executive personnel, developers, researchers, and interns—comes together to extend "
        "our warmest, most heartfelt birthday greetings and felicitations!"
    )
    story.append(Paragraph(p1, style_body))

    p2 = (
        "Your visionary leadership, strategic foresight, and boundless enthusiasm serve as a beacon of guidance "
        "for our entire organization. Under your mentorship, each team member is inspired to aim higher, learn "
        "tirelessly, and strive for excellence every single day. Your belief in cultivating innovation and nurturing talent "
        "has laid the solid foundation upon which WisBees proudly thrives."
    )
    story.append(Paragraph(p2, style_body))

    p3 = (
        "Today, we take a moment not only to celebrate your special milestone, but also to express our deepest gratitude "
        "for your relentless commitment, patience, and encouraging support across all our initiatives and projects."
    )
    story.append(Paragraph(p3, style_body))

    p4 = (
        "As you celebrate another glorious year around the sun, we pray for your <b>vibrant health, lasting happiness, "
        "unmatched peace of mind, and tremendous prosperity</b>. May the coming year reward you with groundbreaking "
        "successes and the fulfillment of all your aspirations."
    )
    story.append(Paragraph(p4, style_body))

    story.append(Spacer(1, 16))

    # 6. Official Closing & Sign-off
    story.append(Paragraph("With Deepest Respect, Warmest Wishes & Sincere Gratitude,", style_closing))
    story.append(Spacer(1, 4))
    story.append(Paragraph("<b>TEAM WISBEES</b><br/>Management, HR, Employees & Interns", style_signoff))
    story.append(Spacer(1, 14))

    # Decorative bottom accent
    story.append(HRFlowable(width="60%", thickness=1, color=GOLD_METALLIC, spaceBefore=8, spaceAfter=8))
    quote_text = "<i>\"Leadership is the capacity to translate vision into reality.\" — Thank you for leading by example!</i>"
    story.append(Paragraph(quote_text, style_company_subtitle))

    # Build the document
    if output_path:
        doc.build(story, canvasmaker=NumberedCanvas)
        return output_path
    else:
        doc.build(story, canvasmaker=NumberedCanvas)
        return buffer.getvalue()


if __name__ == "__main__":
    test_pdf = Path(__file__).resolve().parent.parent / "static" / "birthday" / "WisBees_Birthday_Wishes_Jnana_Sir.pdf"
    generate_birthday_wishes_pdf("Jnana Ranjan Mohanty (Jnana Sir)", output_path=str(test_pdf))
    print(f"Generated PDF at: {test_pdf}")
