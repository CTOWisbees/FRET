import os
import sys
import psycopg2
import psycopg2.extras
import django

# Setup Django environment for Operations Portal
sys.path.insert(0, os.path.abspath('e:/Django/Fret/operations_portal/backend'))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'ops_project.settings')
django.setup()

from django.contrib.auth.models import User as DjangoSuperUser
from ops_core.models import (
    Department,
    OperationalRole,
    OperationUser,
    OPUserDepartmentAccess,
    WorkTask,
    WorkLog,
    ActivityLog,
    AttendanceRecord,
)

FRET_DB_URL = os.environ.get('FRET_DATABASE_URL', '')
OPS_DB_URL = os.environ.get('DATABASE_URL', os.environ.get('OPS_DATABASE_URL', ''))

def run_migration():
    print("==================================================")
    print("STARTING DATA MIGRATION: FRET NEON DB -> OPERATIONS NEON DB")
    print("==================================================")

    # 1. Create / Update Django Superuser (admin / admin123)
    superuser = DjangoSuperUser.objects.filter(username='admin').first()
    if not superuser:
        superuser = DjangoSuperUser.objects.create_superuser(
            username='admin',
            email='admin@operations.wisbees.com',
            password='admin123'
        )
        print("[+] Created Django Superuser: username='admin', password='admin123'")
    else:
        superuser.set_password('admin123')
        superuser.is_staff = True
        superuser.is_superuser = True
        superuser.save()
        print("[*] Updated Django Superuser: username='admin', password='admin123'")

    # 2. Seed All Reference Departments
    REFERENCE_DEPARTMENTS = [
        {"name": "Accounts", "page_key": "Accounts", "is_active": True},
        {"name": "Compliance", "page_key": "Compliance", "is_active": True},
        {"name": "Compliance Checker", "page_key": "Compliance Checker", "is_active": True},
        {"name": "Debt", "page_key": "Debt", "is_active": True},
        {"name": "Distribution", "page_key": "Distribution", "is_active": True},
        {"name": "Equity", "page_key": "Equity", "is_active": True},
        {"name": "HR", "page_key": "HR", "is_active": True},
        {"name": "HR Authorities", "page_key": "HR Authorities", "is_active": True},
        {"name": "Investor Relations", "page_key": "Investor Relations", "is_active": True},
        {"name": "Mgmt View", "page_key": "Mgmt View", "is_active": True},
        {"name": "Treasury", "page_key": "Treasury", "is_active": True},
        {"name": "Digital Marketing", "page_key": "Digital Marketing", "is_active": True},
        {"name": "IT", "page_key": "IT", "is_active": True},
        {"name": "IA - Research", "page_key": "IA - Research", "is_active": True},
        {"name": "WBC", "page_key": "WBC", "is_active": True},
        {"name": "Wealth", "page_key": "Wealth", "is_active": True},
        {"name": "Content Publishing", "page_key": "Content Publishing", "is_active": True},
        {"name": "Engineering", "page_key": "Engineering", "is_active": True},
        {"name": "Marketing", "page_key": "Marketing", "is_active": True},
        {"name": "Finance", "page_key": "Finance", "is_active": True},
        {"name": "Research", "page_key": "Research", "is_active": True},
        {"name": "Data & Analytics", "page_key": "Data & Analytics", "is_active": True},
        {"name": "Operations", "page_key": "Operations", "is_active": True},
    ]

    dept_objs = {}
    for d in REFERENCE_DEPARTMENTS:
        obj, created = Department.objects.get_or_create(
            name=d["name"],
            defaults={
                "page_key": d["page_key"],
                "is_active": d["is_active"]
            }
        )
        dept_objs[d["name"]] = obj

    print(f"[+] Seeded {len(dept_objs)} departments into Operations DB.")

    # 3. Seed Operational Roles
    roles = {}
    role_defs = [
        {
            "title": "Digital Marketing Intern",
            "department": "Digital Marketing",
            "level": "Intern",
            "description": "Executes digital marketing campaigns, bulk email dispatch, SEO/SEM, newsletter distributions, and social media branding.",
            "responsibilities": "• Manage high-volume transactional and campaign bulk email dispatches.\n• Create engaging social media content and promotional assets.\n• Monitor campaign analytics, CTR, and conversion metrics.\n• Coordinate with research analysts for newsletter publishing.",
            "permissions": ["view_assigned_work", "update_task_status", "submit_work_logs", "attach_deliverables", "bulk_email_access"]
        },
        {
            "title": "IT Intern – Web & Automation Developer",
            "department": "IT",
            "level": "Intern",
            "description": "Designs and develops responsive web interfaces, implements automated workflows, integrates APIs, and maintains frontend components.",
            "responsibilities": "• Develop scalable web features using Next.js, React, and Django REST APIs.\n• Implement automated notification pipelines and third-party integrations.\n• Fix UI/UX inconsistencies, optimize client-side rendering speed.\n• Collaborate on system architecture and cloud deployments.",
            "permissions": ["view_assigned_work", "update_task_status", "submit_work_logs", "attach_deliverables", "api_integration_access", "code_repository_access"]
        },
        {
            "title": "Research and Content Analyst Intern",
            "department": "IA - Research",
            "level": "Intern",
            "description": "Performs institutional equity research, financial modeling, industry market reports, and macroeconomic analysis.",
            "responsibilities": "• Conduct fundamental and technical analysis on listed equities.\n• Draft daily market commentary and macroeconomic bulletins.\n• Maintain equity valuation models and earnings trackers.\n• Prepare analytical notes for investment committee review.",
            "permissions": ["view_assigned_work", "update_task_status", "submit_work_logs", "attach_deliverables", "stock_research_access", "financial_models_access"]
        },
        {
            "title": "Equity Research Intern",
            "department": "Equity",
            "level": "Intern",
            "description": "Supports equity research desk, financial statement modeling, screening of equities, and investment thesis documentation.",
            "responsibilities": "• Build and update discounted cash flow (DCF) and relative valuation models.\n• Synthesize quarterly corporate earnings releases.\n• Identify sector trends and emerging investment themes.\n• Assist senior analysts with client research requests.",
            "permissions": ["view_assigned_work", "update_task_status", "submit_work_logs", "attach_deliverables", "stock_research_access"]
        },
        {
            "title": "Business & Strategy Intern",
            "department": "Marketing",
            "level": "Intern",
            "description": "Drives strategic market expansion, competitive intelligence, client outreach campaigns, and operational partnerships.",
            "responsibilities": "• Map addressable markets and identify high-value institutional prospects.\n• Assist in pitching, stakeholder presentations, and partnership proposals.\n• Analyze operational bottlenecks and suggest process improvements.\n• Track KPI dashboards and business performance metrics.",
            "permissions": ["view_assigned_work", "update_task_status", "submit_work_logs", "attach_deliverables"]
        },
        {
            "title": "Principal Investment Advisor",
            "department": "Research",
            "level": "Senior",
            "description": "Leads investment advisory strategies, portfolio allocations, institutional client advisory, and research governance.",
            "responsibilities": "• Oversee strategic equity research publications.\n• Advise institutional clients on risk-adjusted asset allocation.\n• Review and approve analytical research models.\n• Supervise research analyst team.",
            "permissions": ["view_assigned_work", "update_task_status", "submit_work_logs", "attach_deliverables", "stock_research_access", "financial_models_access", "admin_review"]
        },
        {
            "title": "CAPSTONE Project - Developer",
            "department": "IT",
            "level": "Intern",
            "description": "Develops core capstone engineering modules, high-throughput microservices, and specialized enterprise tooling.",
            "responsibilities": "• Implement core architecture modules and full-stack integration.\n• Write automated unit and integration test suites.\n• Optimize database indexing and API latency.\n• Maintain system documentation and architecture diagrams.",
            "permissions": ["view_assigned_work", "update_task_status", "submit_work_logs", "attach_deliverables", "code_repository_access"]
        },
        {
            "title": "Operations Associate",
            "department": "Operations",
            "level": "Junior",
            "description": "Coordinates day-to-day operations, task tracking, employee workflows, and inter-departmental operations.",
            "responsibilities": "• Monitor task boards and operational deliverables.\n• Facilitate employee onboarding and department access.\n• Generate operational performance reports.\n• Maintain operational data accuracy.",
            "permissions": ["view_assigned_work", "update_task_status", "submit_work_logs", "attach_deliverables"]
        }
    ]

    for rd in role_defs:
        r_obj, _ = OperationalRole.objects.get_or_create(
            title=rd["title"],
            defaults=rd
        )
        roles[rd["title"]] = r_obj

    print(f"[+] Seeded {len(roles)} operational roles into Operations DB.")

    # 4. Create / Ensure Default Admin Operations User
    admin_op, created = OperationUser.objects.get_or_create(
        email='admin@operations.wisbees.com',
        defaults={
            'name': 'Operations Admin',
            'full_name': 'Operations Admin',
            'role': 'admin',
            'emp_code': 'OPS-ADM001',
            'designation': 'Operations Manager / Administrator',
            'department': 'Operations',
            'status': 'Active',
            'is_active': True,
            'skills': 'Operations, Management, Cloud, Analytics',
            'assigned_departments': [d['name'] for d in REFERENCE_DEPARTMENTS],
        }
    )
    admin_op.set_password('admin123')
    admin_op.role = 'admin'
    admin_op.is_active = True
    admin_op.save()
    for d_obj in dept_objs.values():
        OPUserDepartmentAccess.objects.get_or_create(user=admin_op, department=d_obj, defaults={'is_active': True})
    print(f"[+] Configured Admin Operation User: admin@operations.wisbees.com (admin123)")

    # 5. Fetch all Employees & Accounts from FRET Neon Database
    print("\nConnecting to FRET Neon DB to extract employee records...")
    fret_conn = psycopg2.connect(FRET_DB_URL)
    fret_cur = fret_conn.cursor(cursor_factory=psycopg2.extras.DictCursor)

    fret_cur.execute("""
        SELECT e.id, e.emp_id, e.name, e.email, e.phone, e.department, e.designation, 
               e.salary, e.joining_date, e.end_date, e.status, e.emp_type, e.gender,
               e.created_at,
               ea.password_hash as acc_password, ea.is_active as acc_active
        FROM employee e
        LEFT JOIN employee_accounts ea ON e.id = ea.employee_id
        ORDER BY e.id ASC;
    """)
    fret_employees = fret_cur.fetchall()
    print(f"Found {len(fret_employees)} employees in FRET DB.\n")

    # Helper role matcher
    def match_role(designation, department):
        desig_lower = (designation or '').lower()
        dept_lower = (department or '').lower()

        if 'digital marketing' in desig_lower or 'newsletter' in desig_lower:
            return roles.get("Digital Marketing Intern")
        elif 'web' in desig_lower or 'developer' in desig_lower or 'it intern' in desig_lower:
            if 'capstone' in desig_lower:
                return roles.get("CAPSTONE Project - Developer")
            return roles.get("IT Intern – Web & Automation Developer")
        elif 'capstone' in desig_lower:
            return roles.get("CAPSTONE Project - Developer")
        elif 'content analyst' in desig_lower or 'research and content' in desig_lower:
            return roles.get("Research and Content Analyst Intern")
        elif 'equity research' in desig_lower:
            return roles.get("Equity Research Intern")
        elif 'principal' in desig_lower or 'advisor' in desig_lower:
            return roles.get("Principal Investment Advisor")
        elif 'business' in desig_lower or 'strategy' in desig_lower:
            return roles.get("Business & Strategy Intern")
        elif 'trainee' in desig_lower and 'research' in dept_lower:
            return roles.get("Research and Content Analyst Intern")
        elif 'trainee' in desig_lower:
            return roles.get("Business & Strategy Intern")
        else:
            return roles.get("Operations Associate")

    # Helper department matcher
    def resolve_department(department_name, role_obj):
        dept_str = (department_name or '').strip()
        if dept_str and dept_str in dept_objs:
            return dept_objs[dept_str]
        
        # Mapping common names
        mapping = {
            'Engineering': 'IT',
            'Marketing': 'Digital Marketing',
            'Research': 'IA - Research',
            'Finance': 'Equity',
            'Data & Analytics': 'IT',
            'HR': 'HR',
            'Operations': 'Operations',
        }
        mapped_name = mapping.get(dept_str)
        if mapped_name and mapped_name in dept_objs:
            return dept_objs[mapped_name]
        
        if role_obj and role_obj.department in dept_objs:
            return dept_objs[role_obj.department]
        
        return dept_objs.get('Operations')

    migrated_count = 0
    updated_count = 0
    seen_emails = set()

    for row in fret_employees:
        raw_email = (row['email'] or '').strip()
        name = (row['name'] or '').strip()
        emp_code = (row['emp_id'] or '').strip() or f"EMP-{row['id']:04d}"

        # If email is empty or duplicated, synthesize a valid clean unique email
        if not raw_email or raw_email == 'digital@mail':
            clean_name = "".join(c for c in name.lower() if c.isalnum()) or f"user{row['id']}"
            email = f"{clean_name}@operations.wisbees.com"
        else:
            email = raw_email.lower()

        if email in seen_emails:
            clean_name = "".join(c for c in name.lower() if c.isalnum()) or f"user{row['id']}"
            email = f"{clean_name}.{emp_code.lower()}@operations.wisbees.com"

        seen_emails.add(email)

        raw_desig = row['designation'] or 'Operations Associate'
        designation = raw_desig.replace('\ufffd', '-').replace('\u2013', '-').replace('\u2014', '-').strip()
        fret_dept = (row['department'] or '').strip()
        status_val = 'Active' if (row['status'] or '').lower() in ['active', 'true', '1'] else 'Inactive'
        is_active_val = (status_val == 'Active')
        phone = (row['phone'] or '').strip()

        matched_role = match_role(designation, fret_dept)
        resolved_dept_obj = resolve_department(fret_dept, matched_role)
        dept_name = resolved_dept_obj.name if resolved_dept_obj else (fret_dept or 'Operations')

        # Check if user already exists
        op_user = OperationUser.objects.filter(email__iexact=email).first()
        if not op_user:
            op_user = OperationUser(
                name=name,
                full_name=name,
                email=email,
                role='employee',
                phone=phone,
                emp_code=emp_code,
                designation=designation,
                department=dept_name,
                status=status_val,
                is_active=is_active_val,
                assigned_role=matched_role,
                assigned_departments=[dept_name],
                assigned_modules=[dept_name.lower().replace(' ', '_')],
                joining_date=row['joining_date'] or django.utils.timezone.now().date(),
                skills=f"{designation}, {dept_name}",
            )
            
            # Password assignment: if acc_password exists from FRET, preserve hash directly!
            if row['acc_password']:
                op_user.password = row['acc_password']
            else:
                op_user.set_password('employee123')
            
            op_user.save()
            migrated_count += 1
            print(f"[+] Migrated Employee: {name} ({email}) | Code: {emp_code} | Dept: {dept_name} | Desig: {designation}")
        else:
            op_user.name = name
            op_user.full_name = name
            op_user.emp_code = emp_code
            op_user.designation = designation
            op_user.department = dept_name
            op_user.status = status_val
            op_user.is_active = is_active_val
            op_user.phone = phone
            op_user.assigned_role = matched_role
            if dept_name not in op_user.assigned_departments:
                op_user.assigned_departments.append(dept_name)
            if row['acc_password'] and not op_user.password:
                op_user.password = row['acc_password']
            op_user.save()
            updated_count += 1
            print(f"[*] Updated Employee: {name} ({email})")

        # Assign Role relation
        if matched_role:
            op_user.assigned_roles.add(matched_role)

        # Assign Department Access
        if resolved_dept_obj:
            OPUserDepartmentAccess.objects.get_or_create(
                user=op_user,
                department=resolved_dept_obj,
                defaults={'is_active': True}
            )

    print("\n--------------------------------------------------")
    print(f"Migration Complete: {migrated_count} new employees migrated, {updated_count} updated.")
    print(f"Total Operation Users in Neon DB: {OperationUser.objects.count()}")
    print("--------------------------------------------------")

if __name__ == '__main__':
    run_migration()
