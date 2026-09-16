import os
import django
from datetime import timedelta
from django.utils import timezone

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'ops_project.settings')
django.setup()

from django.contrib.auth.models import User as DjangoSuperUser
from ops_core.models import (
    Department,
    OperationUser,
    OPUserDepartmentAccess,
    OPSession,
    LoginOTP,
    OperationalRole,
    WorkTask,
    WorkLog,
    ActivityLog,
)

def seed():
    print("Seeding OP Access Management Database...")

    # 1. Create / Update Django Admin Superuser (admin / admin123) for Django Administration (/admin/)
    superuser = DjangoSuperUser.objects.filter(username='admin').first()
    if not superuser:
        superuser = DjangoSuperUser.objects.create_superuser(
            username='admin',
            email='admin@operations.wisbees.com',
            password='admin123'
        )
        print("Created Django Superuser: username='admin', password='admin123'")
    else:
        superuser.set_password('admin123')
        superuser.is_staff = True
        superuser.is_superuser = True
        superuser.save()
        print("Updated Django Superuser: username='admin', password='admin123'")

    # 2. Seed All Reference Departments from Django Admin Screenshots
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
        # Operational departments
        {"name": "Digital Marketing", "page_key": "Digital Marketing", "is_active": True},
        {"name": "IT", "page_key": "IT", "is_active": True},
        {"name": "IA - Research", "page_key": "IA - Research", "is_active": True},
        {"name": "WBC", "page_key": "WBC", "is_active": True},
        {"name": "Wealth", "page_key": "Wealth", "is_active": True},
        {"name": "Content Publishing", "page_key": "Content Publishing", "is_active": True},
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
        if not created:
            obj.page_key = d["page_key"]
            obj.is_active = d["is_active"]
            obj.save()
        dept_objs[d["name"]] = obj

    print(f"Seeded {len(dept_objs)} departments into Department model.")

    # 3. Operational Roles
    role_mktg, _ = OperationalRole.objects.get_or_create(
        title="Digital Marketing Intern",
        defaults={
            'department': "Digital Marketing",
            'level': "Intern",
            'description': "Executes digital marketing campaigns, bulk email dispatch, SEO/SEM, newsletter distributions, and social media branding.",
            'responsibilities': "• Manage high-volume transactional and campaign bulk email dispatches.\n• Create engaging social media content and promotional assets.\n• Monitor campaign analytics, CTR, and conversion metrics.\n• Coordinate with research analysts for newsletter publishing.",
            'permissions': [
                "view_assigned_work",
                "update_task_status",
                "submit_work_logs",
                "attach_deliverables",
                "bulk_email_access",
            ]
        }
    )

    role_it, _ = OperationalRole.objects.get_or_create(
        title="IT Intern – Web & Automation Developer",
        defaults={
            'department': "IT",
            'level': "Intern",
            'description': "Designs, implements, and maintains operational web portals, task management workflows, and internal tooling.",
            'responsibilities': "• Develop interactive responsive Next.js frontend interfaces.\n• Integrate Django backend REST APIs and secure authentication.\n• Manage task management pipelines, SLAs, and automation scripts.\n• Submit daily progress and deliverable reports to Operations Admin.",
            'permissions': [
                "view_assigned_work",
                "update_task_status",
                "submit_work_logs",
                "attach_deliverables",
                "task_management_access",
            ]
        }
    )

    role_research, _ = OperationalRole.objects.get_or_create(
        title="Investment Research Analyst Intern",
        defaults={
            'department': "IA - Research",
            'level': "Intern",
            'description': "Conducts deep equity research, financial modeling, automated report generation, and portfolio dashboard tracking.",
            'responsibilities': "• Generate automated institutional investment research reports.\n• Maintain and analyze client portfolio tracking dashboards.\n• Perform macroeconomic analysis, company filings reviews, and market intelligence.\n• Deliver investment notes to wealth advisory desk.",
            'permissions': [
                "view_assigned_work",
                "update_task_status",
                "submit_work_logs",
                "attach_deliverables",
                "report_generation_access",
                "portfolio_dashboard_access",
            ]
        }
    )

    role_lead, _ = OperationalRole.objects.get_or_create(
        title="Director of Operations / Head",
        defaults={
            'department': "IT",
            'level': "Lead",
            'description': "Supervises project execution, employee multi-role assignments, department matrix, and task distribution.",
            'responsibilities': "• Assign and broadcast cross-functional tasks across departments.\n• Manage employee onboarding, role matrices, and module permissions.\n• Review submissions and provide sign-offs.",
            'permissions': [
                "manage_employees",
                "assign_roles",
                "create_tasks",
                "review_submissions",
                "export_reports",
            ]
        }
    )

    # 4. Create / Update Admin User
    admin_user = OperationUser.objects.filter(email='admin@operations.wisbees.com').first()
    if not admin_user:
        admin_user = OperationUser(
            name="Operations Administrator",
            full_name="Operations Administrator",
            email="admin@operations.wisbees.com",
            role="admin",
            phone="+91 9876543210",
            emp_code="OPS-ADMIN01",
            designation="Director of Operations",
            department="IT",
            assigned_departments=["IT", "Digital Marketing", "IA - Research", "Equity", "Treasury", "Accounts", "Compliance", "HR", "Mgmt View"],
            assigned_modules=["Bulk email", "Task Management", "Report Generation", "portfolio tracking dashboard"],
            status="Active",
            is_active=True,
            assigned_role=role_lead,
        )
        admin_user.set_password("admin123")
        admin_user.save()
        admin_user.assigned_roles.set([role_lead])
        print("Created Portal Admin: admin@operations.wisbees.com / admin123")
    else:
        admin_user.full_name = "Operations Administrator"
        admin_user.set_password("admin123")
        admin_user.is_active = True
        admin_user.status = "Active"
        admin_user.assigned_departments = ["IT", "Digital Marketing", "IA - Research", "Equity", "Treasury", "Accounts", "Compliance", "HR", "Mgmt View"]
        admin_user.assigned_modules = ["Bulk email", "Task Management", "Report Generation", "portfolio tracking dashboard"]
        admin_user.assigned_role = role_lead
        admin_user.save()
        admin_user.assigned_roles.set([role_lead])

    # Admin department accesses
    for dname in ["IT", "Equity", "Treasury", "Accounts", "Compliance", "HR", "Mgmt View", "Digital Marketing", "IA - Research"]:
        if dname in dept_objs:
            OPUserDepartmentAccess.objects.get_or_create(user=admin_user, department=dept_objs[dname], defaults={'is_active': True})

    # 5. Create / Update Employee Users with Department Access
    # 5.1 Chhayakanta Maharana (IT + Research + Equity + Compliance)
    emp_user = OperationUser.objects.filter(email='chhayakanta@wisbees.com').first()
    if not emp_user:
        emp_user = OperationUser(
            name="Chhayakanta Maharana",
            full_name="Chhayakanta Maharana",
            email="chhayakanta@wisbees.com",
            role="employee",
            phone="+91 8260770510",
            emp_code="OPS-INT025",
            designation="IT Intern – Web & Automation Developer",
            department="IT",
            assigned_departments=["IT", "IA - Research", "Equity", "Compliance"],
            assigned_modules=["Task Management", "Report Generation", "portfolio tracking dashboard"],
            status="Active",
            is_active=True,
            assigned_role=role_it,
            skills="React, Next.js, Django, Python, PostgreSQL, REST APIs, Automation",
        )
        emp_user.set_password("employee123")
        emp_user.save()
        emp_user.assigned_roles.set([role_it, role_research])
        print("Created Employee: chhayakanta@wisbees.com / employee123")
    else:
        emp_user.full_name = "Chhayakanta Maharana"
        emp_user.set_password("employee123")
        emp_user.is_active = True
        emp_user.status = "Active"
        emp_user.department = "IT"
        emp_user.assigned_departments = ["IT", "IA - Research", "Equity", "Compliance"]
        emp_user.assigned_modules = ["Task Management", "Report Generation", "portfolio tracking dashboard"]
        emp_user.assigned_role = role_it
        emp_user.save()
        emp_user.assigned_roles.set([role_it, role_research])

    for dname in ["IT", "IA - Research", "Equity", "Compliance"]:
        if dname in dept_objs:
            OPUserDepartmentAccess.objects.get_or_create(user=emp_user, department=dept_objs[dname], defaults={'is_active': True})

    # 5.2 Ashley Lobo (from reference screenshots - Digital Marketing, HR, HR Authorities, Equity)
    ashley = OperationUser.objects.filter(email__in=["ashley.lobo@wisbees.com", "ashleyianlobo@gmail.com"]).first()
    if not ashley:
        ashley = OperationUser.objects.create(
            name="Ashley Lobo",
            full_name="Ashley Lobo",
            email="ashley.lobo@wisbees.com",
            role="employee",
            phone="+91 9820011223",
            emp_code="OPS-INT011",
            designation="Digital Marketing Intern",
            department="Digital Marketing",
            assigned_departments=["Digital Marketing", "HR", "HR Authorities", "Equity"],
            assigned_modules=["Bulk email", "Campaign Analytics"],
            status="Active",
            is_active=True,
            assigned_role=role_mktg,
            skills="Social Media, Content Strategy, Brand Marketing, Email Newsletters",
        )
        ashley.set_password("intern123")
        ashley.save()
        ashley.assigned_roles.set([role_mktg])
    else:
        ashley.full_name = "Ashley Lobo"
        ashley.department = "Digital Marketing"
        ashley.is_active = True
        ashley.status = "Active"
        ashley.assigned_departments = ["Digital Marketing", "HR", "HR Authorities", "Equity"]
        ashley.assigned_modules = ["Bulk email", "Campaign Analytics"]
        ashley.assigned_role = role_mktg
        ashley.set_password("intern123")
        ashley.save()
        ashley.assigned_roles.set([role_mktg])

    for dname in ["Digital Marketing", "HR", "HR Authorities", "Equity"]:
        if dname in dept_objs:
            OPUserDepartmentAccess.objects.get_or_create(user=ashley, department=dept_objs[dname], defaults={'is_active': True})

    # 5.3 Additional Sample Employees with specific Department Accesses
    aditya = OperationUser.objects.filter(email__in=["aditya.jain@wisbees.com", "aadityajain5789@gmail.com"]).first()
    if not aditya:
        aditya = OperationUser.objects.create(
            name="Aditya Jain",
            full_name="Aditya Jain",
            email="aditya.jain@wisbees.com",
            role="employee",
            phone="+91 8984468248",
            emp_code="OPS-INT021",
            designation="Digital Marketing Intern",
            department="Digital Marketing",
            assigned_departments=["Digital Marketing", "Distribution"],
            assigned_modules=["Bulk email", "Social Media Strategy"],
            status="Active",
            is_active=True,
            assigned_role=role_mktg,
            skills="SEO/SEM, Meta Ads, Campaign Tracking, Copywriting",
        )
        aditya.set_password("intern123")
        aditya.save()
    for dname in ["Digital Marketing", "Distribution"]:
        if dname in dept_objs:
            OPUserDepartmentAccess.objects.get_or_create(user=aditya, department=dept_objs[dname], defaults={'is_active': True})

    # 6. Sample Work Tasks
    today = timezone.now().date()
    if not WorkTask.objects.filter(assigned_to=emp_user).exists():
        WorkTask.objects.create(
            title="Deploy OP Access Matrix & Department Management",
            description="Implement OP Access, department access mappings, and employee login creation matching enterprise admin specifications.",
            assigned_to=emp_user,
            created_by=admin_user,
            priority="Urgent",
            status="In Progress",
            deadline=today + timedelta(days=2),
            estimated_hours=8.0,
            tags="OP Access, Department Matrix, UAM",
        )

    # 7. Create Session
    OPSession.objects.get_or_create(
        user=admin_user,
        session_token="ops-session-admin-token-001",
        defaults={
            "ip_address": "127.0.0.1",
            "user_agent": "Operations Portal Admin Browser",
            "is_active": True,
            "expires_at": timezone.now() + timedelta(days=30),
        }
    )

    print("Successfully seeded all OP Access departments, superuser, and employee credentials!")

if __name__ == '__main__':
    seed()
