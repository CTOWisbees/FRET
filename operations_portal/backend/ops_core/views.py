import json
from datetime import datetime
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST, require_GET, require_http_methods
from django.shortcuts import get_object_or_404
from django.utils import timezone
from .models import OperationUser, OperationalRole, WorkTask, WorkLog, ActivityLog


def parse_request_json(request):
    try:
        if request.body:
            return json.loads(request.body.decode('utf-8'))
    except Exception:
        pass
    return {}


def get_current_user(request):
    """
    Extract user from Authorization / X-User-Auth header e.g. Bearer ops:employee:1 or ops:admin:2
    """
    auth_header = request.headers.get('Authorization') or request.headers.get('X-User-Auth')
    if not auth_header:
        # Fallback to X-Employee-Id or X-User-Id header
        uid = request.headers.get('X-User-Id') or request.headers.get('X-Employee-Id')
        if uid:
            try:
                return OperationUser.objects.filter(id=int(uid)).first()
            except Exception:
                pass
        return None

    token = auth_header.replace('Bearer ', '').strip()
    if token.startswith('ops:'):
        parts = token.split(':')
        if len(parts) >= 3:
            try:
                uid = int(parts[2])
                return OperationUser.objects.filter(id=uid).first()
            except Exception:
                pass
    return None


def serialize_user(user):
    role_obj = user.assigned_role
    return {
        'id': user.id,
        'name': user.name,
        'email': user.email,
        'role': user.role,
        'phone': user.phone,
        'emp_code': user.emp_code or f"OPS-{user.id:04d}",
        'designation': user.designation,
        'department': user.department,
        'status': user.status,
        'joining_date': user.joining_date.strftime('%Y-%m-%d') if user.joining_date else '',
        'avatar_url': user.avatar_url,
        'skills': user.skills,
        'assigned_role': {
            'id': role_obj.id,
            'title': role_obj.title,
            'level': role_obj.level,
            'department': role_obj.department,
            'permissions': role_obj.permissions,
            'responsibilities': role_obj.responsibilities,
        } if role_obj else None
    }


def serialize_task(task):
    return {
        'id': task.id,
        'title': task.title,
        'description': task.description,
        'priority': task.priority,
        'status': task.status,
        'deadline': task.deadline.strftime('%Y-%m-%d') if task.deadline else '',
        'estimated_hours': task.estimated_hours,
        'tags': [t.strip() for t in task.tags.split(',') if t.strip()] if task.tags else [],
        'attachment_url': task.attachment_url,
        'submission_notes': task.submission_notes,
        'submission_link': task.submission_link,
        'completed_at': task.completed_at.strftime('%Y-%m-%d %H:%M') if task.completed_at else None,
        'created_at': task.created_at.strftime('%Y-%m-%d %H:%M'),
        'assigned_to': {
            'id': task.assigned_to.id,
            'name': task.assigned_to.name,
            'email': task.assigned_to.email,
            'designation': task.assigned_to.designation,
            'emp_code': task.assigned_to.emp_code,
        } if task.assigned_to else None,
        'created_by': {
            'id': task.created_by.id,
            'name': task.created_by.name,
        } if task.created_by else None,
    }


# ─────────────────────────────────────────────────────────────
# 1. AUTHENTICATION APIS
# ─────────────────────────────────────────────────────────────

@csrf_exempt
@require_POST
def api_login(request):
    data = parse_request_json(request)
    email = data.get('email', '').strip().lower()
    password = data.get('password', '')
    expected_role = data.get('role')  # 'admin' or 'employee'

    if not email or not password:
        return JsonResponse({'success': False, 'error': 'Please provide email and password.'}, status=400)

    user = OperationUser.objects.filter(email__iexact=email).first()
    if not user or not user.check_password(password):
        return JsonResponse({'success': False, 'error': 'Invalid email or password.'}, status=401)

    if expected_role and user.role != expected_role:
        return JsonResponse({'success': False, 'error': f'Access restricted. You are registered as {user.get_role_display()}.'}, status=403)

    if user.status != 'Active':
        return JsonResponse({'success': False, 'error': 'Account is inactive. Please contact Operations Administrator.'}, status=403)

    token = f"ops:{user.role}:{user.id}"
    ActivityLog.objects.create(user=user, action='Logged in to Operations Portal')

    return JsonResponse({
        'success': True,
        'message': 'Login successful!',
        'token': token,
        'user': serialize_user(user),
    })


@csrf_exempt
@require_GET
def api_me(request):
    user = get_current_user(request)
    if not user:
        return JsonResponse({'authenticated': False, 'error': 'Unauthorized'}, status=401)

    return JsonResponse({
        'authenticated': True,
        'user': serialize_user(user)
    })


# ─────────────────────────────────────────────────────────────
# 2. ADMIN APIS (OPERATIONS HEAD)
# ─────────────────────────────────────────────────────────────

@csrf_exempt
@require_GET
def api_admin_dashboard(request):
    user = get_current_user(request)
    if not user or user.role != 'admin':
        return JsonResponse({'error': 'Admin privileges required'}, status=403)

    total_employees = OperationUser.objects.filter(role='employee').count()
    active_employees = OperationUser.objects.filter(role='employee', status='Active').count()
    total_tasks = WorkTask.objects.count()
    in_progress_tasks = WorkTask.objects.filter(status='In Progress').count()
    under_review_tasks = WorkTask.objects.filter(status='Under Review').count()
    completed_tasks = WorkTask.objects.filter(status='Completed').count()
    urgent_tasks = WorkTask.objects.filter(priority='Urgent', status__in=['Todo', 'In Progress']).count()

    recent_tasks = WorkTask.objects.order_by('-created_at')[:6]
    recent_activities = ActivityLog.objects.order_by('-created_at')[:8]

    return JsonResponse({
        'stats': {
            'total_employees': total_employees,
            'active_employees': active_employees,
            'total_tasks': total_tasks,
            'in_progress_tasks': in_progress_tasks,
            'under_review_tasks': under_review_tasks,
            'completed_tasks': completed_tasks,
            'urgent_tasks': urgent_tasks,
            'completion_rate': round((completed_tasks / total_tasks * 100), 1) if total_tasks else 0,
        },
        'recent_tasks': [serialize_task(t) for t in recent_tasks],
        'recent_activities': [{
            'id': a.id,
            'user_name': a.user.name,
            'user_role': a.user.role,
            'action': a.action,
            'details': a.details,
            'time': a.created_at.strftime('%d %b %H:%M'),
        } for a in recent_activities],
    })


@csrf_exempt
@require_http_methods(['GET', 'POST'])
def api_admin_employees(request):
    user = get_current_user(request)
    if not user or user.role != 'admin':
        return JsonResponse({'error': 'Admin privileges required'}, status=403)

    if request.method == 'GET':
        employees = OperationUser.objects.filter(role='employee').order_by('-created_at')
        return JsonResponse({
            'employees': [serialize_user(emp) for emp in employees]
        })

    if request.method == 'POST':
        data = parse_request_json(request)
        email = data.get('email', '').strip().lower()
        name = data.get('name', '').strip()
        raw_pwd = data.get('password', 'employee123')

        if not email or not name:
            return JsonResponse({'error': 'Name and Email are required'}, status=400)

        if OperationUser.objects.filter(email__iexact=email).exists():
            return JsonResponse({'error': 'An employee with this email already exists'}, status=400)

        assigned_role_id = data.get('assigned_role_id')
        role_instance = OperationalRole.objects.filter(id=assigned_role_id).first() if assigned_role_id else None

        new_emp = OperationUser(
            name=name,
            email=email,
            role='employee',
            phone=data.get('phone', ''),
            emp_code=data.get('emp_code', f"OPS-{OperationUser.objects.count()+1:04d}"),
            designation=data.get('designation', 'Operations Associate'),
            department=data.get('department', 'Operations'),
            assigned_role=role_instance,
            status=data.get('status', 'Active'),
            skills=data.get('skills', ''),
        )
        new_emp.set_password(raw_pwd)
        new_emp.save()

        ActivityLog.objects.create(user=user, action=f"Created new employee account for {new_emp.name}")
        return JsonResponse({'success': True, 'message': 'Employee created successfully', 'employee': serialize_user(new_emp)})


@csrf_exempt
@require_http_methods(['GET', 'PUT', 'DELETE'])
def api_admin_employee_detail(request, pk):
    admin_user = get_current_user(request)
    if not admin_user or admin_user.role != 'admin':
        return JsonResponse({'error': 'Admin privileges required'}, status=403)

    target_emp = get_object_or_404(OperationUser, id=pk)

    if request.method == 'GET':
        tasks = WorkTask.objects.filter(assigned_to=target_emp).order_by('-created_at')
        return JsonResponse({
            'employee': serialize_user(target_emp),
            'tasks': [serialize_task(t) for t in tasks]
        })

    if request.method == 'PUT':
        data = parse_request_json(request)
        target_emp.name = data.get('name', target_emp.name)
        target_emp.phone = data.get('phone', target_emp.phone)
        target_emp.designation = data.get('designation', target_emp.designation)
        target_emp.department = data.get('department', target_emp.department)
        target_emp.status = data.get('status', target_emp.status)
        target_emp.skills = data.get('skills', target_emp.skills)
        target_emp.emp_code = data.get('emp_code', target_emp.emp_code)

        if 'assigned_role_id' in data:
            role_id = data['assigned_role_id']
            target_emp.assigned_role = OperationalRole.objects.filter(id=role_id).first() if role_id else None

        if data.get('new_password'):
            target_emp.set_password(data['new_password'])

        target_emp.save()
        ActivityLog.objects.create(user=admin_user, action=f"Updated details for {target_emp.name}")
        return JsonResponse({'success': True, 'message': 'Employee updated successfully', 'employee': serialize_user(target_emp)})

    if request.method == 'DELETE':
        name = target_emp.name
        target_emp.delete()
        ActivityLog.objects.create(user=admin_user, action=f"Deleted employee record: {name}")
        return JsonResponse({'success': True, 'message': 'Employee deleted successfully'})


@csrf_exempt
@require_http_methods(['GET', 'POST'])
def api_admin_roles(request):
    user = get_current_user(request)
    if not user or user.role != 'admin':
        return JsonResponse({'error': 'Admin privileges required'}, status=403)

    if request.method == 'GET':
        roles = OperationalRole.objects.all().order_by('title')
        return JsonResponse({
            'roles': [{
                'id': r.id,
                'title': r.title,
                'department': r.department,
                'description': r.description,
                'level': r.level,
                'permissions': r.permissions,
                'responsibilities': r.responsibilities,
                'member_count': r.members.count(),
            } for r in roles]
        })

    if request.method == 'POST':
        data = parse_request_json(request)
        title = data.get('title', '').strip()
        if not title:
            return JsonResponse({'error': 'Role title is required'}, status=400)

        new_role = OperationalRole.objects.create(
            title=title,
            department=data.get('department', 'Operations'),
            description=data.get('description', ''),
            level=data.get('level', 'Intern'),
            permissions=data.get('permissions', ['view_assigned_work', 'submit_work_logs']),
            responsibilities=data.get('responsibilities', ''),
        )
        ActivityLog.objects.create(user=user, action=f"Created operational role: {new_role.title}")
        return JsonResponse({'success': True, 'message': 'Role created successfully', 'role_id': new_role.id})


@csrf_exempt
@require_http_methods(['GET', 'POST'])
def api_admin_tasks(request):
    user = get_current_user(request)
    if not user or user.role != 'admin':
        return JsonResponse({'error': 'Admin privileges required'}, status=403)

    if request.method == 'GET':
        tasks = WorkTask.objects.all().order_by('-created_at')
        status_filter = request.GET.get('status')
        assignee_filter = request.GET.get('assigned_to')

        if status_filter:
            tasks = tasks.filter(status=status_filter)
        if assignee_filter:
            tasks = tasks.filter(assigned_to_id=assignee_filter)

        return JsonResponse({
            'tasks': [serialize_task(t) for t in tasks]
        })

    if request.method == 'POST':
        data = parse_request_json(request)
        title = data.get('title', '').strip()
        assigned_to_id = data.get('assigned_to_id')

        if not title or not assigned_to_id:
            return JsonResponse({'error': 'Task title and Assignee are required.'}, status=400)

        assignee = get_object_or_404(OperationUser, id=assigned_to_id)
        deadline_str = data.get('deadline')
        deadline = datetime.strptime(deadline_str, '%Y-%m-%d').date() if deadline_str else None

        new_task = WorkTask.objects.create(
            title=title,
            description=data.get('description', ''),
            assigned_to=assignee,
            created_by=user,
            priority=data.get('priority', 'Medium'),
            status=data.get('status', 'Todo'),
            deadline=deadline,
            estimated_hours=float(data.get('estimated_hours', 0) or 0),
            tags=data.get('tags', ''),
            attachment_url=data.get('attachment_url', ''),
        )
        ActivityLog.objects.create(user=user, action=f"Assigned task '{new_task.title}' to {assignee.name}")
        return JsonResponse({'success': True, 'message': 'Task created and assigned successfully', 'task': serialize_task(new_task)})


@csrf_exempt
@require_http_methods(['GET', 'PUT', 'DELETE'])
def api_admin_task_detail(request, pk):
    admin_user = get_current_user(request)
    if not admin_user or admin_user.role != 'admin':
        return JsonResponse({'error': 'Admin privileges required'}, status=403)

    task = get_object_or_404(WorkTask, id=pk)

    if request.method == 'GET':
        logs = task.logs.all().order_by('-created_at')
        return JsonResponse({
            'task': serialize_task(task),
            'logs': [{
                'id': l.id,
                'user_name': l.user.name,
                'hours_spent': l.hours_spent,
                'work_summary': l.work_summary,
                'submission_link': l.submission_link,
                'created_at': l.created_at.strftime('%d %b %Y %H:%M'),
            } for l in logs]
        })

    if request.method == 'PUT':
        data = parse_request_json(request)
        task.title = data.get('title', task.title)
        task.description = data.get('description', task.description)
        task.priority = data.get('priority', task.priority)
        task.status = data.get('status', task.status)
        task.tags = data.get('tags', task.tags)
        task.estimated_hours = float(data.get('estimated_hours', task.estimated_hours) or 0)

        if data.get('deadline'):
            try:
                task.deadline = datetime.strptime(data['deadline'], '%Y-%m-%d').date()
            except Exception:
                pass

        if data.get('assigned_to_id'):
            task.assigned_to = get_object_or_404(OperationUser, id=data['assigned_to_id'])

        if task.status == 'Completed' and not task.completed_at:
            task.completed_at = timezone.now()

        task.save()
        ActivityLog.objects.create(user=admin_user, action=f"Updated task '{task.title}'")
        return JsonResponse({'success': True, 'message': 'Task updated successfully', 'task': serialize_task(task)})

    if request.method == 'DELETE':
        title = task.title
        task.delete()
        ActivityLog.objects.create(user=admin_user, action=f"Deleted task '{title}'")
        return JsonResponse({'success': True, 'message': 'Task deleted successfully'})


# ─────────────────────────────────────────────────────────────
# 3. EMPLOYEE APIS (TEAM MEMBER, e.g. Chhayakanta Maharana)
# ─────────────────────────────────────────────────────────────

@csrf_exempt
@require_GET
def api_employee_dashboard(request):
    emp = get_current_user(request)
    if not emp:
        return JsonResponse({'error': 'Unauthorized'}, status=401)

    my_tasks = WorkTask.objects.filter(assigned_to=emp)
    total_tasks = my_tasks.count()
    todo_count = my_tasks.filter(status='Todo').count()
    in_progress_count = my_tasks.filter(status='In Progress').count()
    under_review_count = my_tasks.filter(status='Under Review').count()
    completed_count = my_tasks.filter(status='Completed').count()
    urgent_count = my_tasks.filter(priority='Urgent', status__in=['Todo', 'In Progress']).count()

    active_tasks = my_tasks.exclude(status='Completed').order_by('deadline', '-created_at')[:5]
    recent_completed = my_tasks.filter(status='Completed').order_by('-completed_at')[:4]

    return JsonResponse({
        'employee': serialize_user(emp),
        'stats': {
            'total_tasks': total_tasks,
            'todo_count': todo_count,
            'in_progress_count': in_progress_count,
            'under_review_count': under_review_count,
            'completed_count': completed_count,
            'urgent_count': urgent_count,
            'completion_rate': round((completed_count / total_tasks * 100), 1) if total_tasks else 0,
        },
        'active_tasks': [serialize_task(t) for t in active_tasks],
        'recent_completed': [serialize_task(t) for t in recent_completed],
    })


@csrf_exempt
@require_GET
def api_employee_tasks(request):
    emp = get_current_user(request)
    if not emp:
        return JsonResponse({'error': 'Unauthorized'}, status=401)

    tasks = WorkTask.objects.filter(assigned_to=emp).order_by('-created_at')
    status_filter = request.GET.get('status')
    if status_filter:
        tasks = tasks.filter(status=status_filter)

    return JsonResponse({
        'tasks': [serialize_task(t) for t in tasks]
    })


@csrf_exempt
@require_POST
def api_employee_update_task_status(request, pk):
    emp = get_current_user(request)
    if not emp:
        return JsonResponse({'error': 'Unauthorized'}, status=401)

    task = get_object_or_404(WorkTask, id=pk, assigned_to=emp)
    data = parse_request_json(request)
    new_status = data.get('status')
    submission_notes = data.get('submission_notes', '')
    submission_link = data.get('submission_link', '')
    hours_logged = float(data.get('hours_spent', 0) or 0)

    if new_status in ['Todo', 'In Progress', 'Under Review', 'Completed']:
        task.status = new_status
        if submission_notes:
            task.submission_notes = submission_notes
        if submission_link:
            task.submission_link = submission_link

        if new_status == 'Completed':
            task.completed_at = timezone.now()

        task.save()

        # Record WorkLog if hours or summary provided
        if hours_logged > 0 or submission_notes:
            WorkLog.objects.create(
                task=task,
                user=emp,
                hours_spent=hours_logged,
                work_summary=submission_notes or f"Updated status to {new_status}",
                submission_link=submission_link,
            )

        ActivityLog.objects.create(
            user=emp,
            action=f"Updated status of '{task.title}' to {new_status}"
        )

        return JsonResponse({
            'success': True,
            'message': f"Task status updated to {new_status}",
            'task': serialize_task(task)
        })

    return JsonResponse({'error': 'Invalid status provided'}, status=400)


@csrf_exempt
@require_http_methods(['GET', 'POST'])
def api_employee_work_logs(request):
    emp = get_current_user(request)
    if not emp:
        return JsonResponse({'error': 'Unauthorized'}, status=401)

    if request.method == 'GET':
        logs = WorkLog.objects.filter(user=emp).order_by('-created_at')
        return JsonResponse({
            'logs': [{
                'id': l.id,
                'task_title': l.task.title,
                'task_id': l.task.id,
                'hours_spent': l.hours_spent,
                'work_summary': l.work_summary,
                'submission_link': l.submission_link,
                'created_at': l.created_at.strftime('%d %b %Y %H:%M'),
            } for l in logs]
        })

    if request.method == 'POST':
        data = parse_request_json(request)
        task_id = data.get('task_id')
        summary = data.get('work_summary', '').strip()
        hours = float(data.get('hours_spent', 0) or 0)

        if not task_id or not summary:
            return JsonResponse({'error': 'Task and work summary are required.'}, status=400)

        task = get_object_or_404(WorkTask, id=task_id, assigned_to=emp)
        new_log = WorkLog.objects.create(
            task=task,
            user=emp,
            hours_spent=hours,
            work_summary=summary,
            submission_link=data.get('submission_link', ''),
        )
        return JsonResponse({'success': True, 'message': 'Work log recorded successfully'})


@csrf_exempt
@require_GET
def api_employee_my_role(request):
    emp = get_current_user(request)
    if not emp:
        return JsonResponse({'error': 'Unauthorized'}, status=401)

    role_obj = emp.assigned_role
    return JsonResponse({
        'employee_name': emp.name,
        'designation': emp.designation,
        'department': emp.department,
        'role_title': role_obj.title if role_obj else 'Operations Team Member',
        'level': role_obj.level if role_obj else 'Intern',
        'responsibilities': role_obj.responsibilities if role_obj else 'Execute assigned development and operational automation workflows.',
        'permissions': role_obj.permissions if role_obj else [
            'view_assigned_work',
            'update_task_status',
            'submit_work_logs',
            'attach_deliverables',
        ],
        'skills': emp.skills,
        'joining_date': emp.joining_date.strftime('%d %b %Y') if emp.joining_date else '',
    })


# ─── ATTENDANCE & LIVE SHIFT TIMER ENDPOINTS ───

@csrf_exempt
@require_GET
def api_attendance_today(request):
    user = get_current_user(request)
    if not user:
        return JsonResponse({'error': 'Unauthorized'}, status=401)

    today = timezone.now().date()
    from .models import AttendanceRecord
    record = AttendanceRecord.objects.filter(user=user, date=today).first()

    if not record:
        return JsonResponse({
            'is_checked_in': False,
            'status': 'Not Checked In',
            'check_in_time': None,
            'check_out_time': None,
            'total_hours': 0.0,
            'elapsed_seconds': 0,
            'work_mode': 'Office',
        })

    is_checked_in = record.check_in_time is not None and record.check_out_time is None
    elapsed_seconds = 0
    if is_checked_in and record.check_in_time:
        elapsed_seconds = int((timezone.now() - record.check_in_time).total_seconds())

    return JsonResponse({
        'id': record.id,
        'is_checked_in': is_checked_in,
        'status': record.status,
        'check_in_time': record.check_in_time.strftime('%I:%M %p') if record.check_in_time else None,
        'check_in_iso': record.check_in_time.isoformat() if record.check_in_time else None,
        'check_out_time': record.check_out_time.strftime('%I:%M %p') if record.check_out_time else None,
        'check_out_iso': record.check_out_time.isoformat() if record.check_out_time else None,
        'total_hours': round(record.total_hours, 2),
        'elapsed_seconds': max(0, elapsed_seconds),
        'work_mode': record.work_mode,
        'date': record.date.strftime('%d %b %Y'),
    })


@csrf_exempt
@require_POST
def api_attendance_check_in(request):
    user = get_current_user(request)
    if not user:
        return JsonResponse({'error': 'Unauthorized'}, status=401)

    data = parse_request_json(request)
    work_mode = data.get('work_mode', 'Office')
    notes = data.get('notes', '')

    today = timezone.now().date()
    now = timezone.now()
    record = AttendanceRecord.objects.filter(user=user, date=today).first()
    if record:
        if record.status == 'Completed' or record.check_out_time is not None:
            return JsonResponse({
                'error': f"You have already completed your attendance shift for today ({record.date.strftime('%d %b %Y')}). You can check in again on your next working day."
            }, status=400)
        if record.check_in_time is not None:
            return JsonResponse({
                'error': "You are already checked in for today's shift."
            }, status=400)

    record = AttendanceRecord.objects.create(
        user=user,
        date=today,
        check_in_time=now,
        status='Checked In',
        work_mode=work_mode,
        notes=notes,
    )

    ActivityLog.objects.create(
        user=user,
        action=f"Checked In for work shift ({work_mode}) at {now.strftime('%I:%M %p')}."
    )

    return JsonResponse({
        'success': True,
        'message': f'Checked In successfully at {now.strftime("%I:%M %p")}!',
        'check_in_time': now.strftime('%I:%M %p'),
        'check_in_iso': now.isoformat(),
        'is_checked_in': True,
    })


@csrf_exempt
@require_POST
def api_attendance_check_out(request):
    user = get_current_user(request)
    if not user:
        return JsonResponse({'error': 'Unauthorized'}, status=401)

    data = parse_request_json(request)
    notes = data.get('notes', '')

    today = timezone.now().date()
    now = timezone.now()
    from .models import AttendanceRecord

    record = AttendanceRecord.objects.filter(user=user, date=today).first()
    if not record or not record.check_in_time:
        return JsonResponse({'error': 'No active check-in found for today.'}, status=400)

    record.check_out_time = now
    duration_hours = (now - record.check_in_time).total_seconds() / 3600.0
    record.total_hours = max(0.1, round(duration_hours, 2))
    record.status = 'Completed'
    if notes:
        record.notes = f"{record.notes}\nCheck-out notes: {notes}".strip()
    record.save()

    ActivityLog.objects.create(
        user=user,
        action=f"Checked Out of work shift at {now.strftime('%I:%M %p')} (Logged {record.total_hours:.2f} hrs)."
    )

    return JsonResponse({
        'success': True,
        'message': f'Checked Out successfully! Total duration: {record.total_hours:.2f} hours.',
        'check_out_time': now.strftime('%I:%M %p'),
        'check_out_iso': now.isoformat(),
        'total_hours': record.total_hours,
        'is_checked_in': False,
    })


@csrf_exempt
@require_GET
def api_attendance_history(request):
    user = get_current_user(request)
    if not user:
        return JsonResponse({'error': 'Unauthorized'}, status=401)

    from .models import AttendanceRecord
    records = AttendanceRecord.objects.filter(user=user).order_by('-date')[:30]

    items = []
    total_hours_sum = 0
    completed_shifts = 0

    for r in records:
        total_hours_sum += r.total_hours
        if r.status == 'Completed':
            completed_shifts += 1
        items.append({
            'id': r.id,
            'date': r.date.strftime('%d %b %Y'),
            'day': r.date.strftime('%A'),
            'check_in': r.check_in_time.strftime('%I:%M %p') if r.check_in_time else '—',
            'check_out': r.check_out_time.strftime('%I:%M %p') if r.check_out_time else '—',
            'total_hours': r.total_hours,
            'status': r.status,
            'work_mode': r.work_mode,
            'notes': r.notes,
        })

    return JsonResponse({
        'records': items,
        'summary': {
            'total_days_logged': len(records),
            'total_hours': round(total_hours_sum, 1),
            'avg_daily_hours': round(total_hours_sum / max(1, len(records)), 1),
            'completed_shifts': completed_shifts,
        }
    })

