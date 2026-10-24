import os
import json
import logging
import requests

logger = logging.getLogger(__name__)

def get_groq_api_key():
    key = os.environ.get('GROQ_API_KEY')
    if not key:
        # Check backend/.env or root .env
        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        for env_path in [os.path.join(base_dir, '.env'), os.path.join(os.path.dirname(base_dir), '.env')]:
            if os.path.exists(env_path):
                try:
                    with open(env_path, 'r', encoding='utf-8') as f:
                        for line in f:
                            if line.strip().startswith('GROQ_API_KEY='):
                                key = line.strip().split('=', 1)[1].strip().strip('"\'')
                                break
                except Exception:
                    pass
            if key:
                break
    return key or ''

GROQ_MODELS = [
    'qwen/qwen3.8-27b',
    'openai/gpt-oss-120b',
    'openai/gpt-oss-20b'
]

def _call_groq_chat(prompt, system_instruction=None, max_tokens=1500, temperature=0.3):
    """Calls Groq API with failover across available models."""
    api_key = get_groq_api_key()
    if not api_key:
        return None

    headers = {
        "Authorization": f"Bearer {api_key.strip()}",
        "Content-Type": "application/json"
    }

    messages = []
    if system_instruction:
        messages.append({"role": "system", "content": system_instruction})
    messages.append({"role": "user", "content": prompt})

    for model_name in GROQ_MODELS:
        try:
            payload = {
                "model": model_name,
                "messages": messages,
                "temperature": temperature,
                "max_tokens": max_tokens
            }
            res = requests.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers=headers,
                json=payload,
                timeout=18
            )
            if res.status_code == 200:
                data = res.json()
                content = data.get('choices', [{}])[0].get('message', {}).get('content', '')
                if content:
                    return content.strip()
            else:
                logger.warning(f"Groq model {model_name} returned status {res.status_code}: {res.text[:200]}")
        except Exception as e:
            logger.warning(f"Groq model {model_name} failed: {e}")
            continue

    return None


def detect_offer_type_from_role(role_title, explicit_type=None):
    """Infers appointment type (Intern, Trainee, Full-time) from title if not explicitly set."""
    if explicit_type and explicit_type in ('Intern', 'Trainee', 'Full-time'):
        return explicit_type
    
    title_lower = (role_title or '').lower().strip()
    if 'trainee' in title_lower:
        return 'Trainee'
    if 'intern' in title_lower or 'internship' in title_lower:
        return 'Intern'
    if any(k in title_lower for k in ['full time', 'full-time', 'lead', 'manager', 'officer', 'head', 'developer', 'engineer', 'analyst', 'controller', 'executive']):
        return 'Full-time'
    return 'Intern'


def generate_ai_offer_content(candidate_name, role_title, offer_type=None, joining_date=None, end_date=None, salary=0, custom_notes=None):
    """
    Uses Groq AI to generate a complete, customized offer letter and matching email body.
    Falls back gracefully to standard WisBees templating if AI call is unavailable.
    """
    resolved_type = detect_offer_type_from_role(role_title, offer_type)
    joining_str = joining_date.strftime('%d-%b-%Y') if hasattr(joining_date, 'strftime') else (str(joining_date) if joining_date else '19-Oct-2026')
    end_str = end_date.strftime('%d-%b-%Y') if hasattr(end_date, 'strftime') else (str(end_date) if end_date else '')

    salary_clause_hint = ""
    if salary and float(salary) > 0:
        if resolved_type == 'Full-time':
            salary_clause_hint = f"Annual CTC: Rs. {float(salary):,.0f} per annum."
        elif resolved_type == 'Trainee':
            salary_clause_hint = f"Monthly Training Stipend/Compensation: Rs. {float(salary):,.0f} per month."
        else:
            salary_clause_hint = f"Monthly Internship Stipend: Rs. {float(salary):,.0f} per month."
    else:
        if resolved_type == 'Intern':
            salary_clause_hint = "Unpaid internship intended for practical learning and professional skill development."

    system_prompt = (
        "You are the Chief HR Officer at TimeArrow Pvt. Ltd. (WisBees). "
        "Generate a formal, highly professional Indian corporate appointment offer letter and matching email body. "
        "You must respond in valid JSON format ONLY with exactly two string keys:\n"
        "\"full_letter_text\": The full text body of the offer letter.\n"
        "\"email_body\": The candidate email body text.\n"
        "Do NOT include markdown fences (```json), output raw JSON."
    )

    user_prompt = f"""
Candidate Name: {candidate_name or 'Candidate'}
Role Title: {role_title}
Appointment Type: {resolved_type}
Joining Date: {joining_str}
End Date: {end_str or ('Not applicable (Full-Time Regular)' if resolved_type == 'Full-time' else 'To be mutually determined')}
Compensation / Stipend: {salary_clause_hint}
Extra Admin Notes: {custom_notes or 'Standard professional terms'}

Rules for "full_letter_text":
1. First line must be: "We are pleased to offer you the position of {role_title} at TimeArrow Pvt. Ltd. (WisBees)."
2. Second paragraph: Executive introduction describing the role function, scope, and teamwork at TimeArrow Pvt. Ltd. (WisBees).
3. Third paragraph: Duration / appointment terms, remote/hybrid mode, joining date ({joining_str}), and compensation ({salary_clause_hint}).
4. Section titled "Key Roles & Responsibilities": Include 4 to 6 specific, high-caliber, practical bullet points for this exact role ({role_title}), each starting strictly with "- ".
5. NDA Paragraph: Explicitly mandate signing the attached Non-Disclosure Agreement (NDA) and maintaining strict confidentiality regarding company research, reports, algorithms, and client information.
6. Completion & Growth Paragraph:
   - For Full-time: Subject to background check, 6 months probation, onboarding submission.
   - For Trainee: Training evaluation, performance review for transition to full-time employment, and Trainee Certificate.
   - For Intern: Internship completion letter and Letter of Recommendation upon performance.
7. Acceptance clause: Instructions to sign and return the letter along with the NDA to confirm acceptance.

Rules for "email_body":
- Professional email to {candidate_name or 'the candidate'}.
- Explicitly state attachments: (1) {resolved_type} Offer Letter (2) Non-Disclosure Agreement (NDA).
- Include WisBees Operations Portal URL: https://ops.wisbees.com and mention credentials will be issued upon onboarding.
- Polite corporate sign-off from HR-DEPARTMENT, TimeArrow Pvt. Ltd. (WisBees).
"""

    raw_response = _call_groq_chat(user_prompt, system_instruction=system_prompt, max_tokens=1800)
    if raw_response:
        try:
            # Clean up any potential markdown wrapping
            cleaned = raw_response.strip()
            if cleaned.startswith("```json"):
                cleaned = cleaned[7:]
            if cleaned.startswith("```"):
                cleaned = cleaned[3:]
            if cleaned.endswith("```"):
                cleaned = cleaned[:-3]
            data = json.loads(cleaned.strip())
            if data.get('full_letter_text') and data.get('email_body'):
                letter_text = data['full_letter_text'].strip()
                return {
                    'success': True,
                    'ai_generated': True,
                    'offer_type': resolved_type,
                    'role_title': role_title,
                    'full_letter_text': letter_text,
                    'full_text': letter_text,
                    'email_body': data['email_body'].strip(),
                }
        except Exception as err:
            logger.warning(f"Failed to parse Groq JSON response: {err}. Raw was:\n{raw_response[:300]}")

    # Fallback to local deterministic generator
    fallback_letter = _local_fallback_full_letter(candidate_name, role_title, resolved_type, joining_str, end_str, salary_clause_hint)
    return {
        'success': True,
        'ai_generated': False,
        'offer_type': resolved_type,
        'role_title': role_title,
        'full_letter_text': fallback_letter,
        'full_text': fallback_letter,
        'email_body': _local_fallback_email_body(candidate_name, role_title, resolved_type, joining_str),
    }


def generate_ai_experience_content(candidate_name, role_title, exp_type=None, joining_date=None, end_date=None, gender=None):
    """
    Uses Groq AI to generate custom experience certificate body and delivery email.
    """
    resolved_type = detect_offer_type_from_role(role_title, exp_type)
    is_male = str(gender or '').strip().lower() in ('male', 'm')
    prefix = "Mr." if is_male else "Ms."
    poss = "his" if is_male else "her"
    sub = "he" if is_male else "she"
    obj = "him" if is_male else "her"
    sub_cap = "He" if is_male else "She"
    poss_cap = "His" if is_male else "Her"

    start_str = joining_date.strftime('%d %B %Y') if hasattr(joining_date, 'strftime') else (str(joining_date) if joining_date else '01-Jan-2026')
    end_str = end_date.strftime('%d %B %Y') if hasattr(end_date, 'strftime') else (str(end_date) if end_date else 'Present')

    tenure_term = "internship" if resolved_type == 'Intern' else ("training tenure" if resolved_type == 'Trainee' else "employment tenure")

    system_prompt = (
        "You are Chief HR Officer at TimeArrow Pvt. Ltd. (WisBees). "
        "Generate a formal Experience Certificate body paragraph and delivery email body. "
        "Output valid JSON ONLY with keys \"full_text\" and \"email_body\"."
    )

    user_prompt = f"""
Candidate: {prefix} {candidate_name}
Role: {role_title}
Tenure Type: {resolved_type} ({tenure_term})
Period: From {start_str} to {end_str}
Gender Pronouns: {sub}/{obj}/{poss}

Certificate body requirements:
- Formal certification certifying successful completion of {poss} {tenure_term} as {role_title} from {start_str} to {end_str}.
- 4 bullet points of actual professional contributions in {role_title}, each starting with "- ".
- Assessment of work ethic, analytical capability, and discipline.
- Closing appreciation and well wishes for future endeavours.
"""

    raw_response = _call_groq_chat(user_prompt, system_instruction=system_prompt, max_tokens=1200)
    if raw_response:
        try:
            cleaned = raw_response.strip()
            if cleaned.startswith("```json"):
                cleaned = cleaned[7:]
            if cleaned.startswith("```"):
                cleaned = cleaned[3:]
            if cleaned.endswith("```"):
                cleaned = cleaned[:-3]
            data = json.loads(cleaned.strip())
            if data.get('full_text') and data.get('email_body'):
                exp_text = data['full_text'].strip()
                return {
                    'success': True,
                    'ai_generated': True,
                    'exp_type': resolved_type,
                    'full_text': exp_text,
                    'full_letter_text': exp_text,
                    'email_body': data['email_body'].strip(),
                }
        except Exception as e:
            logger.warning(f"Groq exp parse error: {e}")

    # Local fallback
    fallback_text = (
        f"This is to certify that {prefix} {candidate_name} has successfully completed {poss} {tenure_term} "
        f"with TimeArrow Pvt. Ltd. (WisBees) as {role_title} from {start_str} to {end_str}.\n\n"
        f"During {poss} {tenure_term}, {sub} was actively involved in:\n"
        f"- Spearheading day-to-day execution, operational analysis, and functional deliverables in {role_title}\n"
        f"- Collaborating with cross-functional mentors and internal stakeholders to produce verified results\n"
        f"- Preparing executive summaries, progress reports, and documentation adhering to company standards\n"
        f"- Demonstrating professional initiative, research rigor, and attention to detail\n\n"
        f"{sub_cap} exhibited strong analytical capability, discipline, and commitment throughout. "
        f"{poss_cap} work reflected reliability and high ethical standards.\n\n"
        f"We appreciate {poss} contributions and wish {obj} all success in {poss} future endeavours."
    )
    fallback_email = (
        f"Dear {candidate_name},\n\n"
        f"Please find attached your official Experience Certificate for your tenure as {role_title} with TimeArrow Pvt. Ltd. (WisBees).\n\n"
        f"We sincerely thank you for your contributions and wish you the very best in your professional career."
    )
    return {
        'success': True,
        'ai_generated': False,
        'exp_type': resolved_type,
        'full_text': fallback_text,
        'email_body': fallback_email
    }


def _local_fallback_full_letter(candidate_name, role_title, offer_type, start_str, end_str, salary_clause_hint):
    if offer_type == 'Full-time':
        intro = (
            f"This role is focused on core functional execution, strategic initiatives, and cross-team "
            f"collaboration within the organization. You will take ownership of business deliverables, "
            f"operational excellence, and quality standards."
        )
        duration = f"Your employment will be on a regular full-time basis, commencing on {start_str}. Mode of work will be remote / hybrid as directed by management. {salary_clause_hint}"
        completion = (
            "This offer of employment is subject to standard reference checks, background verification, "
            "and completion of onboarding documentation. A formal probation period of 6 months will apply."
        )
    elif offer_type == 'Trainee':
        intro = (
            f"This structured training program is designed to provide intensive hands-on immersion into {role_title}, "
            f"mentorship by senior specialists, and practical exposure to live operational workflows."
        )
        duration = f"Your training period will commence on {start_str} to {end_str or 'mutually agreed duration'}. The mode of work will be remote. {salary_clause_hint}"
        completion = (
            "Upon successful completion of the training period and performance review, you will be considered "
            "for absorption into a regular full-time position. You will also receive a Trainee Experience Certificate."
        )
    else: # Intern
        intro = (
            f"This internship is designed to provide practical learning and hands-on exposure to {role_title}, "
            f"working closely with the relevant team on real-world projects and day-to-day responsibilities."
        )
        duration = f"Your internship duration will commence on {start_str} to {end_str or 'mutually agreed duration'}. The mode of work will be remote. {salary_clause_hint}"
        completion = "Upon successful completion of the internship, you will receive an Internship Certificate and Letter of Recommendation (based on performance)."

    return '\n\n'.join([
        f"We are pleased to offer you the position of {role_title} at TimeArrow Pvt. Ltd. (WisBees).",
        intro,
        duration,
        f"Key Roles & Responsibilities\nIn this position, you will be expected to:\n- Execute core tasks, analytical assignments, and project deliverables related to {role_title}\n- Prepare clear reports, documentation, and research findings for team review\n- Collaborate with WisBees mentors and internal stakeholders to ensure high-quality outcomes\n- Adhere to company policies, code of conduct, and timely communication protocols",
        "You are required to sign the attached Non-Disclosure Agreement (NDA) and strictly maintain confidentiality regarding all company research data, reports, internal tools, strategies, and proprietary information.",
        completion,
        "To formally accept this offer, please sign and return a copy of this letter along with the NDA.",
        f"We look forward to having you onboard and contributing to your professional growth in {role_title}."
    ])


def _local_fallback_email_body(candidate_name, role_title, offer_type, start_str):
    doc_name = "Employment Offer Letter" if offer_type == 'Full-time' else ("Trainee Offer Letter" if offer_type == 'Trainee' else "Internship Offer Letter")
    return (
        f"We are pleased to offer you the position of {role_title} with TimeArrow Pvt. Ltd. (WisBees), effective {start_str}.\n\n"
        f"Please find attached:\n(1) {doc_name}\n(2) Non-Disclosure Agreement (NDA)\n\n"
        "Please review, sign, and return the duplicate copies at your earliest convenience to confirm your acceptance.\n\n"
        "WisBees Operations Portal Access:\n"
        "• Portal URL: https://ops.wisbees.com\n"
        "• Your account login credentials will be activated upon receipt of your signed documents.\n\n"
        "Should you have any questions or require clarification, please feel free to reach out to us.\n\n"
        "We look forward to welcoming you to the WisBees team!"
    )
