import os
import sys
import sqlite3
import django

DATABASE_URL = "postgresql://neondb_owner:npg_zGjkfO4E2xTN@ep-hidden-wind-b4fncj1m-pooler.c-6.us-east-2.aws.neon.tech/neondb?sslmode=require"
os.environ['DATABASE_URL'] = DATABASE_URL
os.environ['DJANGO_SETTINGS_MODULE'] = 'ops_project.settings'
sys.path.insert(0, r"E:\Django\Fret\operations_portal\backend")

django.setup()

from django.db import connection
from ops_core.models import (
    OperationUser, Department, OperationalRole, OPUserDepartmentAccess,
    WorkTask, DailyTrackerConfig, DailyTrackerDay, DailyTaskRow,
    DailyTrackerUnlockRequest, StockRecommendation, DepartmentManagerAssignment
)

ops_db_path = r"E:\Django\Fret\operations_portal\backend\ops.db"
print(f"Connecting to {ops_db_path}...")
conn = sqlite3.connect(ops_db_path)
conn.row_factory = sqlite3.Row
c = conn.cursor()

# 1. Departments
try:
    rows = c.execute("SELECT * FROM ops_core_department").fetchall()
    for r in rows:
        d = dict(r)
        Department.objects.update_or_create(
            id=d['id'],
            defaults={
                'name': d.get('name'),
                'page_key': d.get('page_key', ''),
                'is_active': bool(d.get('is_active', True)),
            }
        )
    print(f"[OK] Departments: {len(rows)} rows synced.")
except Exception as e:
    print(f"[WARN] Departments: {e}")

# 2. Operational Roles
try:
    rows = c.execute("SELECT * FROM ops_core_operationalrole").fetchall()
    for r in rows:
        d = dict(r)
        OperationalRole.objects.update_or_create(
            id=d['id'],
            defaults={
                'title': d.get('title'),
                'department': d.get('department', 'General'),
                'level': d.get('level', 'Associate'),
                'description': d.get('description', ''),
                'responsibilities': d.get('responsibilities', ''),
                'permissions': d.get('permissions', '[]'),
            }
        )
    print(f"[OK] Operational Roles: {len(rows)} rows synced.")
except Exception as e:
    print(f"[WARN] Operational Roles: {e}")

# 3. Operation Users
try:
    rows = c.execute("SELECT * FROM ops_core_operationuser").fetchall()
    for r in rows:
        d = dict(r)
        OperationUser.objects.update_or_create(
            id=d['id'],
            defaults={
                'name': d.get('name', ''),
                'full_name': d.get('full_name', '') or d.get('name', ''),
                'email': d.get('email', ''),
                'password': d.get('password', ''),
                'phone': d.get('phone', ''),
                'designation': d.get('designation', ''),
                'department': d.get('department', ''),
                'assigned_departments': d.get('assigned_departments', '[]') if isinstance(d.get('assigned_departments'), list) else d.get('assigned_departments', ''),
                'emp_code': d.get('emp_code', ''),
                'emp_type': d.get('emp_type', 'Normal'),
                'skills': d.get('skills', ''),
                'avatar_url': d.get('avatar_url', ''),
                'role': d.get('role', 'employee'),
                'is_superadmin': bool(d.get('is_superadmin', False) or d.get('is_admin', False)),
                'is_manager': bool(d.get('is_manager', False)),
                'is_active': bool(d.get('is_active', True)),
            }
        )
    print(f"[OK] Operation Users: {len(rows)} rows synced.")
except Exception as e:
    print(f"[WARN] Operation Users: {e}")

# 4. OPUserDepartmentAccess
try:
    rows = c.execute("SELECT * FROM ops_core_opuserdepartmentaccess").fetchall()
    for r in rows:
        d = dict(r)
        user = OperationUser.objects.filter(id=d['user_id']).first()
        dept = Department.objects.filter(id=d['department_id']).first()
        if user and dept:
            OPUserDepartmentAccess.objects.update_or_create(
                id=d['id'],
                defaults={
                    'user': user,
                    'department': dept,
                    'is_active': bool(d.get('is_active', True)),
                }
            )
    print(f"[OK] Department Accesses: {len(rows)} rows synced.")
except Exception as e:
    print(f"[WARN] Department Accesses: {e}")

# 5. Work Tasks
try:
    rows = c.execute("SELECT * FROM ops_core_worktask").fetchall()
    for r in rows:
        d = dict(r)
        assigned_to = OperationUser.objects.filter(id=d['assigned_to_id']).first() if d.get('assigned_to_id') else None
        created_by = OperationUser.objects.filter(id=d.get('created_by_id') or d.get('assigned_by_id')).first()
        if assigned_to:
            WorkTask.objects.update_or_create(
                id=d['id'],
                defaults={
                    'title': d.get('title', ''),
                    'description': d.get('description', ''),
                    'assigned_to': assigned_to,
                    'created_by': created_by,
                    'priority': d.get('priority', 'Medium'),
                    'status': d.get('status', 'Todo'),
                    'estimated_hours': d.get('estimated_hours', 0.0),
                    'deadline': d.get('deadline'),
                    'tags': d.get('tags', ''),
                }
            )
    print(f"[OK] Work Tasks: {len(rows)} rows synced.")
except Exception as e:
    print(f"[WARN] Work Tasks: {e}")

# 6. Reset Sequences for Operations Portal
with connection.cursor() as pg_cur:
    tables = [
        ('ops_core_department', 'id'),
        ('ops_core_operationalrole', 'id'),
        ('ops_core_operationuser', 'id'),
        ('ops_core_opuserdepartmentaccess', 'id'),
        ('ops_core_worktask', 'id'),
    ]
    for table, col in tables:
        try:
            pg_cur.execute(f"SELECT setval(pg_get_serial_sequence('{table}', '{col}'), COALESCE((SELECT MAX({col}) FROM {table}), 1));")
        except Exception:
            pass
print("[OK] Operations Portal Sequences updated.")

print("\n--- OPERATIONS PORTAL DATA TRANSFER COMPLETED SUCCESSFULLY ---")
