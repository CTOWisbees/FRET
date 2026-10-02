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
    DepartmentManagerAssignment,
    DailyTrackerConfig,
    DailyAssignedTask,
    DailyTrackerDay,
    DailyTaskRow,
    DailyTrackerUnlockRequest,
    DailyTrackerAuditLog,
)

def seed():
    print("Seeding Operations Portal Database with Superadmin, Managers, Tracker, and Assigned Tasks...")

    # 1. Create / Update Django Admin Superuser
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

    # 2. Seed All Reference Departments
    REFERENCE_DEPARTMENTS = [
        {"name": "IT", "page_key": "IT", "is_active": True},
        {"name": "Digital Marketing", "page_key": "Digital Marketing", "is_active": True},
        {"name": "IA - Research", "page_key": "IA - Research", "is_active": True},
        {"name": "Equity", "page_key": "Equity", "is_active": True},
        {"name": "Accounts", "page_key": "Accounts", "is_active": True},
        {"name": "Compliance", "page_key": "Compliance", "is_active": True},
        {"name": "HR", "page_key": "HR", "is_active": True},
        {"name": "HR Authorities", "page_key": "HR Authorities", "is_active": True},
        {"name": "Compliance Checker", "page_key": "Compliance Checker", "is_active": True},
        {"name": "Debt", "page_key": "Debt", "is_active": True},
        {"name": "Distribution", "page_key": "Distribution", "is_active": True},
        {"name": "Investor Relations", "page_key": "Investor Relations", "is_active": True},
        {"name": "Mgmt View", "page_key": "Mgmt View", "is_active": True},
        {"name": "Treasury", "page_key": "Treasury", "is_active": True},
        {"name": "WBC", "page_key": "WBC", "is_active": True},
        {"name": "Wealth", "page_key": "Wealth", "is_active": True},
        {"name": "Content Publishing", "page_key": "Content Publishing", "is_active": True},
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
        if not created:
            obj.page_key = d["page_key"]
            obj.is_active = d["is_active"]
            obj.save()
        dept_objs[d["name"]] = obj

    print(f"[+] Seeded {len(dept_objs)} departments into Department model.")

    # 3. Operational Roles
    role_mktg, _ = OperationalRole.objects.get_or_create(
        title="Digital Marketing Intern",
        defaults={
            'department': "Digital Marketing",
            'level': "Intern",
            'description': "Executes digital marketing campaigns, bulk email dispatch, SEO/SEM, newsletter distributions, and social media branding.",
            'responsibilities': "• Manage bulk email dispatches.\n• Create social media content.\n• Monitor campaign analytics.",
            'permissions': ["view_assigned_work", "update_task_status", "submit_work_logs", "bulk_email_access"]
        }
    )

    role_it, _ = OperationalRole.objects.get_or_create(
        title="IT Intern – Web & Automation Developer",
        defaults={
            'department': "IT",
            'level': "Intern",
            'description': "Designs, implements, and maintains operational web portals, task management workflows, and internal tooling.",
            'responsibilities': "• Develop interactive responsive Next.js interfaces.\n• Integrate Django backend REST APIs.\n• Manage daily progress and deliverables.",
            'permissions': ["view_assigned_work", "update_task_status", "submit_work_logs", "task_management_access"]
        }
    )

    role_lead, _ = OperationalRole.objects.get_or_create(
        title="Superadmin / Managing Director",
        defaults={
            'department': "Operations",
            'level': "Lead",
            'description': "Supervises company-wide execution, department manager assignments, employee task distribution, and daily performance.",
            'responsibilities': "• Appoint department managers.\n• Assign and broadcast cross-functional tasks.\n• Review submissions and daily work logs.",
            'permissions': ["manage_employees", "assign_managers", "assign_roles", "create_tasks", "review_trackers", "export_reports"]
        }
    )

    # 4. Superadmin: Jnana Sir
    jnana_user = OperationUser.objects.filter(email='jnana@wisbees.com').first()
    if not jnana_user:
        jnana_user = OperationUser(
            name="Jnana Ranjan Mohanty",
            full_name="Jnana Ranjan Mohanty (Jnana Sir)",
            email="jnana@wisbees.com",
            role="admin",
            is_superadmin=True,
            is_manager=True,
            phone="+91 9800000001",
            emp_code="OPS-SUPER01",
            designation="Managing Director & Super Admin",
            department="Operations",
            assigned_departments=[d["name"] for d in REFERENCE_DEPARTMENTS],
            assigned_modules=["Bulk email", "Task Management", "Report Generation", "portfolio tracking dashboard"],
            status="Active",
            is_active=True,
            assigned_role=role_lead,
        )
        jnana_user.set_password("superadmin123")
        jnana_user.save()
        jnana_user.assigned_roles.set([role_lead])
        print("[+] Created Superadmin: Jnana Sir (jnana@wisbees.com / superadmin123)")
    else:
        jnana_user.name = "Jnana Ranjan Mohanty"
        jnana_user.full_name = "Jnana Ranjan Mohanty (Jnana Sir)"
        jnana_user.role = "admin"
        jnana_user.is_superadmin = True
        jnana_user.is_manager = True
        jnana_user.is_active = True
        jnana_user.status = "Active"
        jnana_user.assigned_departments = [d["name"] for d in REFERENCE_DEPARTMENTS]
        jnana_user.set_password("superadmin123")
        jnana_user.save()
        jnana_user.assigned_roles.set([role_lead])
        print("[*] Updated Superadmin: Jnana Sir (jnana@wisbees.com / superadmin123)")

    for d_obj in dept_objs.values():
        OPUserDepartmentAccess.objects.get_or_create(user=jnana_user, department=d_obj, defaults={'is_active': True})

    # Admin User (admin@operations.wisbees.com)
    admin_user = OperationUser.objects.filter(email='admin@operations.wisbees.com').first()
    if not admin_user:
        admin_user = OperationUser(
            name="Operations Administrator",
            full_name="Operations Administrator",
            email="admin@operations.wisbees.com",
            role="admin",
            is_superadmin=True,
            is_manager=True,
            phone="+91 9876543210",
            emp_code="OPS-ADMIN01",
            designation="Director of Operations",
            department="Operations",
            assigned_departments=[d["name"] for d in REFERENCE_DEPARTMENTS],
            status="Active",
            is_active=True,
            assigned_role=role_lead,
        )
        admin_user.set_password("admin123")
        admin_user.save()
        admin_user.assigned_roles.set([role_lead])
        print("[+] Created Portal Admin: admin@operations.wisbees.com / admin123")
    else:
        admin_user.is_superadmin = True
        admin_user.is_manager = True
        admin_user.set_password("admin123")
        admin_user.save()

    for d_obj in dept_objs.values():
        OPUserDepartmentAccess.objects.get_or_create(user=admin_user, department=d_obj, defaults={'is_active': True})

    # 5. Ashley Lobo (Employee / Intern, can be manager of IT)
    ashley = OperationUser.objects.filter(email__in=["ashley.lobo@wisbees.com", "ashleyianlobo@gmail.com"]).first()
    if not ashley:
        ashley = OperationUser.objects.create(
            name="Ashley Lobo",
            full_name="Ashley Lobo",
            email="ashley.lobo@wisbees.com",
            role="employee",
            is_manager=False,
            emp_type="Intern",
            phone="+91 9820011223",
            emp_code="OPS-INT011",
            designation="Digital Marketing Intern",
            department="IT",
            assigned_departments=["IT", "Digital Marketing", "HR", "Equity"],
            assigned_modules=["Bulk email", "Campaign Analytics", "Task Management"],
            status="Active",
            is_active=True,
            assigned_role=role_mktg,
            skills="Team Management, IT Coordination, Digital Media",
        )
        ashley.set_password("intern123")
        ashley.save()
        ashley.assigned_roles.set([role_mktg])
        print("[+] Created Employee: Ashley Lobo (ashley.lobo@wisbees.com / intern123)")
    else:
        ashley.department = "IT"
        ashley.emp_type = "Intern"
        ashley.is_active = True
        ashley.status = "Active"
        if "IT" not in ashley.assigned_departments:
            ashley.assigned_departments.append("IT")
        ashley.set_password("intern123")
        ashley.save()

    for dname in ["IT", "Digital Marketing", "HR", "Equity"]:
        if dname in dept_objs:
            OPUserDepartmentAccess.objects.get_or_create(user=ashley, department=dept_objs[dname], defaults={'is_active': True})

    # 6. Chhayakanta Maharana (IT Employee / Intern)
    emp_user = OperationUser.objects.filter(email='chhayakanta@wisbees.com').first()
    if not emp_user:
        emp_user = OperationUser(
            name="Chhayakanta Maharana",
            full_name="Chhayakanta Maharana",
            email="chhayakanta@wisbees.com",
            role="employee",
            emp_type="Intern",
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
        emp_user.assigned_roles.set([role_it])
        print("[+] Created Employee: Chhayakanta Maharana (chhayakanta@wisbees.com / employee123)")
    else:
        emp_user.department = "IT"
        emp_user.emp_type = "Intern"
        emp_user.is_active = True
        emp_user.status = "Active"
        emp_user.set_password("employee123")
        emp_user.save()

    for dname in ["IT", "IA - Research", "Equity", "Compliance"]:
        if dname in dept_objs:
            OPUserDepartmentAccess.objects.get_or_create(user=emp_user, department=dept_objs[dname], defaults={'is_active': True})

    # 7. Aditya Jain
    aditya = OperationUser.objects.filter(email__in=["aditya.jain@wisbees.com", "aadityajain5789@gmail.com"]).first()
    if not aditya:
        aditya = OperationUser.objects.create(
            name="Aditya Jain",
            full_name="Aditya Jain",
            email="aditya.jain@wisbees.com",
            role="employee",
            emp_type="Intern",
            phone="+91 8984468248",
            emp_code="OPS-INT021",
            designation="Digital Marketing Intern",
            department="Digital Marketing",
            assigned_departments=["Digital Marketing", "Distribution"],
            status="Active",
            is_active=True,
            assigned_role=role_mktg,
        )
        aditya.set_password("intern123")
        aditya.save()

    # 8. Daily Tracker Config
    config = DailyTrackerConfig.objects.first()
    if not config:
        DailyTrackerConfig.objects.create(
            cutoff_hours=24,
            task_types_json='["Major", "Minor", "Research", "Documentation", "Meeting", "Support"]',
            custom_fields_json='[]',
            auto_lock_enabled=True
        )
        print("[+] Initialized DailyTrackerConfig (24h cutoff threshold)")

    # 9. Sample Daily Assigned Tasks
    today = timezone.now().date()
    if not DailyAssignedTask.objects.filter(assigned_to=emp_user).exists():
        DailyAssignedTask.objects.create(
            title="Deploy Unified Operations Portal & Daily Tracker",
            description="Implement single user login, superadmin manager appointment dropdown, and full daily work tracker integration.",
            department="IT",
            assigned_by=jnana_user,
            assigned_to=emp_user,
            task_type="Major",
            priority="Urgent",
            due_date=today + timedelta(days=2),
            status="In Progress"
        )
        DailyAssignedTask.objects.create(
            title="Optimize IT Department Work Tracker & Heatmap",
            description="Ensure 52-week contribution heatmap, streak milestone badges, and review ratings work seamlessly across all screens.",
            department="IT",
            assigned_by=ashley,
            assigned_to=emp_user,
            task_type="Major",
            priority="High",
            due_date=today + timedelta(days=3),
            status="Pending"
        )
        print("[+] Created Sample Daily Assigned Tasks for Chhayakanta (IT)")

    print("\n--------------------------------------------------")
    print("Seed Complete! All models and initial users ready.")
    print("Superadmin: jnana@wisbees.com (superadmin123)")
    print("Manager: ashley.lobo@wisbees.com (intern123)")
    print("Employee: chhayakanta@wisbees.com (employee123)")
    print("--------------------------------------------------")

if __name__ == '__main__':
    seed()
