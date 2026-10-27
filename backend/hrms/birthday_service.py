"""
WisBees — Automated Birthday Wishes Dispatcher Service
Handles finding active employees/interns/HR/admins with birthdays today,
generating customized celebratory PDF and banner assets, and delivering via SMTP.
"""

import os
import smtplib
from datetime import date, datetime
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.image import MIMEImage
from email.mime.application import MIMEApplication
from pathlib import Path
from django.conf import settings
from hrms.models import Employee, HR
from hrms.birthday_banner import create_birthday_banner
from hrms.birthday_pdf import generate_birthday_wishes_pdf


def get_smtp_connection():
    """
    Returns an authenticated SMTP connection.
    Prioritizes port 465 SSL for maximum reliability on all network environments.
    """
    host = getattr(settings, 'EMAIL_HOST', 'smtp.gmail.com')
    port = int(getattr(settings, 'EMAIL_PORT', 465))
    user = getattr(settings, 'EMAIL_HOST_USER', 'chhayakantamaharan@gmail.com')
    password = getattr(settings, 'EMAIL_HOST_PASSWORD', 'iggqxkylejyilqod')

    # 1. Try SSL (Port 465)
    try:
        server = smtplib.SMTP_SSL(host, 465, timeout=15)
        server.login(user, password)
        return server, user
    except Exception as ssl_err:
        print(f"[BirthdayService] SMTP_SSL 465 failed: {ssl_err}, falling back to TLS 587...")

    # 2. Fallback to TLS (Port 587)
    try:
        server = smtplib.SMTP(host, 587, timeout=15)
        server.starttls()
        server.login(user, password)
        return server, user
    except Exception as tls_err:
        raise RuntimeError(f"Failed to authenticate with SMTP server {host}: {tls_err}")


def generate_birthday_email_html(name, role_title="Leader", is_vip=False):
    """
    Constructs an elegant, festive HTML email with inline banner image.
    """
    first_name = name.split()[0] if name else "Valued Colleague"

    if is_vip:
        personal_note = f"""
        <p style="font-size: 16px; line-height: 1.7; color: #2d3748; margin-bottom: 18px;">
          On this very special day, the entire <strong>WisBees family</strong> comes together with immense joy and profound admiration to wish you a <strong>Very Happy Birthday!</strong>
        </p>
        <p style="font-size: 15px; line-height: 1.7; color: #4a5568; margin-bottom: 18px;">
          Your visionary leadership, strategic mentorship, and relentless passion inspire every developer, researcher, and intern across our organization. Thank you for guiding us with patience and purpose.
        </p>
        <p style="font-size: 15px; line-height: 1.7; color: #4a5568; margin-bottom: 24px;">
          May this milestone birthday bring you exceptional health, unending happiness, lasting peace, and magnificent success in all your forward-looking endeavors!
        </p>
        """
    else:
        personal_note = f"""
        <p style="font-size: 16px; line-height: 1.7; color: #2d3748; margin-bottom: 18px;">
          Dear <strong>{name}</strong>,
        </p>
        <p style="font-size: 15px; line-height: 1.7; color: #4a5568; margin-bottom: 18px;">
          Warmest birthday greetings from all of us at <strong>WisBees</strong>! We celebrate you today and want to express our sincere appreciation for all your dedication, energy, and contributions to our team.
        </p>
        <p style="font-size: 15px; line-height: 1.7; color: #4a5568; margin-bottom: 24px;">
          Wishing you a brilliant year ahead filled with personal growth, milestone career achievements, great health, and happiness!
        </p>
        """

    html = f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Happy Birthday from WisBees</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f0f4f8; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f0f4f8; padding: 30px 10px;">
    <tr>
      <td align="center">
        <!-- Main Email Container -->
        <table role="presentation" width="100%" max-width="620" cellspacing="0" cellpadding="0" border="0" style="max-width: 620px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.08); border: 1px solid #e2e8f0;">
          
          <!-- Embedded Inline Banner Graphic -->
          <tr>
            <td style="padding: 0; background-color: #06101e; text-align: center;">
              <img src="cid:birthday_banner" alt="Happy Birthday Wishes" style="display: block; width: 100%; max-width: 620px; height: auto; border: 0;" />
            </td>
          </tr>

          <!-- Golden Border Ribbon -->
          <tr>
            <td style="height: 4px; background: linear-gradient(90deg, #d4af37, #f6e082, #d4af37);"></td>
          </tr>

          <!-- Email Content Body -->
          <tr>
            <td style="padding: 36px 32px 24px 32px;">
              <div style="text-align: center; margin-bottom: 20px;">
                <span style="display: inline-block; padding: 5px 16px; background-color: #fefcbf; color: #975a16; border-radius: 20px; font-size: 12px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase;">
                  Celebrating Your Special Day
                </span>
              </div>

              {personal_note}

              <!-- Commemorative Attachment Notice Box -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f7fafc; border-left: 4px solid #d4af37; border-radius: 6px; margin: 24px 0 28px 0;">
                <tr>
                  <td style="padding: 16px 18px;">
                    <div style="font-size: 14px; font-weight: 700; color: #1a202c; margin-bottom: 4px;">
                      📎 Official Birthday Keepsake Attached
                    </div>
                    <div style="font-size: 13px; color: #718096; line-height: 1.5;">
                      Please find attached your personalized <strong>WisBees Commemorative Birthday Letter (PDF)</strong> and high-resolution <strong>Celebration Banner</strong>.
                    </div>
                  </td>
                </tr>
              </table>

              <!-- Sign-off Block -->
              <div style="border-top: 1px solid #edf2f7; padding-top: 20px; margin-top: 10px;">
                <p style="font-size: 14px; color: #718096; margin: 0 0 4px 0;">With Warmest Regards & Deep Respect,</p>
                <p style="font-size: 16px; font-weight: 700; color: #06101e; margin: 0 0 2px 0;">Team WisBees</p>
                <p style="font-size: 12px; color: #a0aec0; margin: 0;">TimeArrow Pvt. Ltd. &bull; Mumbai, India</p>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; padding: 18px 24px; text-align: center; border-top: 1px solid #edf2f7;">
              <p style="font-size: 11px; color: #a0aec0; margin: 0;">
                This commemorative greeting was sent by WisBees People Operations.<br/>
                &copy; {date.today().year} WisBees. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
"""
    return html


def send_birthday_wish(user_data, force=False):
    """
    Generates assets and delivers birthday wish email to a single recipient.
    user_data dict requires:
    {
        'id': user_id,
        'name': name,
        'email': target_email,
        'designation': designation,
        'department': department,
        'is_superadmin': bool,
        'emp_type': str,
        'model': 'Employee' or 'HR'
    }
    """
    recipient_email = user_data['email']
    name = user_data['name']
    designation = user_data.get('designation') or ('Director' if user_data.get('is_superadmin') else 'Team Member')
    department = user_data.get('department') or 'WisBees'
    is_vip = bool(user_data.get('is_superadmin') or 'jnana' in recipient_email.lower() or 'jnana' in name.lower())

    first_name = name.split()[0]
    display_title = "Jnana Sir" if is_vip else first_name

    print(f"[BirthdayService] Preparing wish for: {name} <{recipient_email}> (VIP={is_vip})...")

    # 1. Assets storage directory
    static_dir = Path(settings.BASE_DIR) / "static" / "birthday"
    static_dir.mkdir(parents=True, exist_ok=True)

    banner_filename = f"banner_{user_data['id']}.png" if not is_vip else "WisBees_Birthday_Banner.png"
    banner_path = static_dir / banner_filename
    create_birthday_banner(name=display_title, title=designation, output_path=str(banner_path))

    pdf_filename = f"WisBees_Birthday_Wishes_{first_name}.pdf" if not is_vip else "WisBees_Birthday_Wishes_Jnana_Sir.pdf"
    pdf_path = static_dir / pdf_filename
    generate_birthday_wishes_pdf(
        name=name,
        designation=designation,
        department=department,
        output_path=str(pdf_path)
    )

    # 2. Email Construction (MIMEMultipart 'related' for inline image + attachments)
    msg_root = MIMEMultipart('related')
    subject = (
        f"🎉 Happy Birthday {display_title}! 🎂 — Warmest Wishes from Team WisBees"
        if is_vip else
        f"🎉 Happy Birthday {display_title}! 🎂 — Best Wishes from WisBees"
    )
    from_header = getattr(settings, 'DEFAULT_FROM_EMAIL', 'WisBees HR <chhayakantamaharan@gmail.com>')
    msg_root['Subject'] = subject
    msg_root['From'] = from_header
    msg_root['To'] = recipient_email

    msg_alternative = MIMEMultipart('alternative')
    msg_root.attach(msg_alternative)

    # Plain text fallback
    plain_text = (
        f"Happy Birthday {name}!\n\n"
        f"The entire WisBees team wishes you an extraordinary birthday filled with health, "
        f"happiness, and outstanding achievements.\n\n"
        f"Please view the attached celebratory card and banner.\n\n"
        f"Warm regards,\nTeam WisBees"
    )
    msg_alternative.attach(MIMEText(plain_text, 'plain', 'utf-8'))

    # Rich HTML Body
    html_body = generate_birthday_email_html(name, role_title=designation, is_vip=is_vip)
    msg_alternative.attach(MIMEText(html_body, 'html', 'utf-8'))

    # 3. Attach Inline Banner for display inside HTML (cid:birthday_banner)
    with open(banner_path, 'rb') as f:
        banner_data = f.read()
    img_inline = MIMEImage(banner_data)
    img_inline.add_header('Content-ID', '<birthday_banner>')
    img_inline.add_header('Content-Disposition', 'inline', filename='banner.png')
    msg_root.attach(img_inline)

    # 4. Standalone File Attachments (PDF and banner.png)
    with open(pdf_path, 'rb') as f:
        pdf_data = f.read()
    pdf_attachment = MIMEApplication(pdf_data, _subtype="pdf")
    pdf_attachment.add_header('Content-Disposition', 'attachment', filename=pdf_filename)
    msg_root.attach(pdf_attachment)

    banner_attachment = MIMEApplication(banner_data, _subtype="png")
    banner_attachment.add_header('Content-Disposition', 'attachment', filename="banner.png")
    msg_root.attach(banner_attachment)

    # 5. SMTP Transmission
    server, sender_email = get_smtp_connection()
    try:
        server.sendmail(sender_email, [recipient_email], msg_root.as_string())
        server.quit()
        print(f"[BirthdayService] SUCCESS! Birthday email successfully dispatched to: {recipient_email}")
    except Exception as e:
        try:
            server.quit()
        except Exception:
            pass
        raise e

    # 6. Record last_birthday_wish_year to prevent duplicate delivery
    current_year = date.today().year
    model_name = user_data.get('model')
    user_id = user_data.get('id')
    if model_name == 'Employee':
        Employee.objects.filter(id=user_id).update(last_birthday_wish_year=current_year)
    elif model_name == 'HR':
        HR.objects.filter(id=user_id).update(last_birthday_wish_year=current_year)

    return {
        'success': True,
        'email': recipient_email,
        'name': name,
        'pdf_attached': pdf_filename,
        'banner_attached': "banner.png"
    }


def find_birthday_recipients_for_date(target_date=None, force=False):
    """
    Finds all active employees, interns, HRs, and admins whose birthday is on target_date.
    De-duplicates by recipient email address.
    """
    if target_date is None:
        target_date = date.today()

    month = target_date.month
    day = target_date.day
    current_year = target_date.year

    candidates = []

    # 1. Employees & Interns
    emp_qs = Employee.objects.filter(
        date_of_birth__month=month,
        date_of_birth__day=day,
        status='Active'
    )
    for emp in emp_qs:
        if not force and emp.last_birthday_wish_year == current_year:
            print(f"[BirthdayService] Employee {emp.name} already wished for {current_year}. Skipping.")
            continue
        email = emp.personal_email or emp.email
        if email:
            candidates.append({
                'id': emp.id,
                'name': emp.name,
                'email': email.strip(),
                'designation': emp.designation,
                'department': emp.department,
                'is_superadmin': emp.is_superadmin,
                'emp_type': emp.emp_type,
                'model': 'Employee'
            })

    # 2. HR & Admins
    hr_qs = HR.objects.filter(
        date_of_birth__month=month,
        date_of_birth__day=day
    )
    for hr in hr_qs:
        if not force and hr.last_birthday_wish_year == current_year:
            print(f"[BirthdayService] HR {hr.name} already wished for {current_year}. Skipping.")
            continue
        email = hr.personal_email or hr.email
        if email:
            candidates.append({
                'id': hr.id,
                'name': hr.name,
                'email': email.strip(),
                'designation': hr.designation or 'HR Manager',
                'department': hr.department or 'Human Resources',
                'is_superadmin': True,
                'emp_type': 'HR',
                'model': 'HR'
            })

    # De-duplicate by email
    unique_candidates = []
    seen_emails = set()
    for c in candidates:
        e = c['email'].lower()
        if e not in seen_emails:
            seen_emails.add(e)
            unique_candidates.append(c)

    return unique_candidates
