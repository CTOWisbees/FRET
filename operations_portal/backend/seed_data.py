import os
import django
from datetime import timedelta
from django.utils import timezone

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'ops_project.settings')
django.setup()

from ops_core.models import OperationUser, OperationalRole, WorkTask, WorkLog, ActivityLog

def seed():
    print("Seeding Operations Portal Database...")

    # 1. Create Operational Roles
    role_intern, _ = OperationalRole.objects.get_or_create(
        title="IT Intern – Web & Automation Developer",
        defaults={
            'department': "Data & Analytics",
            'level': "Intern",
            'description': "Designs, implements, and maintains operational web portals, automation pipelines, and internal tools.",
            'responsibilities': "• Develop interactive responsive Next.js frontend interfaces.\n• Integrate Django backend REST APIs and secure authentication.\n• Optimize database models and workflows for team operations.\n• Submit daily progress and deliverable reports to Operations Admin.",
            'permissions': [
                "view_assigned_work",
                "update_task_status",
                "submit_work_logs",
                "attach_deliverables",
                "view_personal_metrics",
            ]
        }
    )

    role_lead, _ = OperationalRole.objects.get_or_create(
        title="Senior Operations Lead",
        defaults={
            'department': "Operations",
            'level': "Lead",
            'description': "Supervises project execution, employee role assignments, and team deliverables.",
            'responsibilities': "• Assign and prioritize cross-functional tasks.\n• Review submissions and provide architectural feedback.\n• Manage operational resources and timelines.",
            'permissions': [
                "manage_employees",
                "assign_roles",
                "create_tasks",
                "review_submissions",
                "export_reports",
            ]
        }
    )

    role_qa, _ = OperationalRole.objects.get_or_create(
        title="Quality Assurance Engineer",
        defaults={
            'department': "Product & QA",
            'level': "Mid-Level",
            'description': "Executes end-to-end testing, cross-browser validation, and security auditing.",
            'responsibilities': "• Run automated integration test suites.\n• Verify edge cases and report regression bugs.",
            'permissions': ["view_assigned_work", "update_task_status", "submit_work_logs"]
        }
    )

    # 2. Create Admin User
    admin_user = OperationUser.objects.filter(email='admin@operations.wisbees.com').first()
    if not admin_user:
        admin_user = OperationUser(
            name="Operations Administrator",
            email="admin@operations.wisbees.com",
            role="admin",
            phone="+91 9876543210",
            emp_code="OPS-ADMIN01",
            designation="Director of Operations",
            department="Operations",
            status="Active",
            assigned_role=role_lead,
        )
        admin_user.set_password("admin123")
        admin_user.save()
        print("Created Admin: admin@operations.wisbees.com / admin123")
    else:
        admin_user.set_password("admin123")
        admin_user.save()

    # 3. Create Employee User (Chhayakanta Maharana)
    emp_user = OperationUser.objects.filter(email='chhayakanta@wisbees.com').first()
    if not emp_user:
        emp_user = OperationUser(
            name="Chhayakanta Maharana",
            email="chhayakanta@wisbees.com",
            role="employee",
            phone="+91 8260770510",
            emp_code="OPS-INT025",
            designation="IT Intern – Web & Automation Developer",
            department="Data & Analytics",
            status="Active",
            assigned_role=role_intern,
            skills="React, Next.js, Django, Python, PostgreSQL, REST APIs, Automation",
        )
        emp_user.set_password("employee123")
        emp_user.save()
        print("Created Employee: chhayakanta@wisbees.com / employee123")
    else:
        emp_user.set_password("employee123")
        emp_user.assigned_role = role_intern
        emp_user.save()

    # 4. Create Sample Tasks
    if not WorkTask.objects.filter(assigned_to=emp_user).exists():
        today = timezone.now().date()
        t1 = WorkTask.objects.create(
            title="Build Next.js Operations Frontend Portal",
            description="Create the independent Next.js App Router portal with dedicated Admin & Employee layouts, task kanban boards, and role review views.",
            assigned_to=emp_user,
            created_by=admin_user,
            priority="Urgent",
            status="In Progress",
            deadline=today + timedelta(days=2),
            estimated_hours=12.0,
            tags="Frontend, Next.js, Tailwind, UI/UX",
        )

        t2 = WorkTask.objects.create(
            title="Integrate Django Operations REST APIs",
            description="Connect login authentication, task status updates, role management, and work logging endpoints between Next.js and Django.",
            assigned_to=emp_user,
            created_by=admin_user,
            priority="High",
            status="In Progress",
            deadline=today + timedelta(days=3),
            estimated_hours=8.0,
            tags="Backend, Django, REST API, Auth",
        )

        t3 = WorkTask.objects.create(
            title="Automate Leave & Experience Certificate Generation",
            description="Implement letterhead ReportLab PDF generator and automated SMTP notification dispatches with dynamic signing.",
            assigned_to=emp_user,
            created_by=admin_user,
            priority="Medium",
            status="Completed",
            deadline=today - timedelta(days=1),
            estimated_hours=6.0,
            tags="Automation, PDF, Letterhead",
            submission_notes="Completed PDF letterhead generator and email dispatch routines.",
            completed_at=timezone.now(),
        )

        t4 = WorkTask.objects.create(
            title="Setup Operation Activity Logs & Task Reviews",
            description="Add activity logging triggers when tasks are moved between statuses or when work logs are submitted.",
            assigned_to=emp_user,
            created_by=admin_user,
            priority="Low",
            status="Todo",
            deadline=today + timedelta(days=6),
            estimated_hours=4.0,
            tags="Auditing, Security, Logging",
        )

        WorkLog.objects.create(
            task=t3,
            user=emp_user,
            hours_spent=5.5,
            work_summary="Generated PDF layout template with WisBees branding and company letterhead header/footer.",
        )

        ActivityLog.objects.create(
            user=admin_user,
            action="Initialized Operations Portal with role templates and tasks."
        )

    print("[OK] Seeding completed successfully!")

if __name__ == '__main__':
    seed()
