import json
import csv
from datetime import datetime, date, timedelta
from io import BytesIO, StringIO
import pandas as pd

from django.shortcuts import render, redirect, get_object_or_404
from django.http import HttpResponse, JsonResponse, Http404
from django.contrib import messages
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST, require_http_methods
from django.db.models import Q, Count, Sum, Avg
from django.utils import timezone

from hrms.models import (
    HR, Employee, EmployeeAccount, Attendance, LeaveRequest,
    DailyTrackerDay, DailyTaskRow, DailyTrackerUnlockRequest,
    DailyTrackerAuditLog, DailyTrackerConfig, DailyAssignedTask
)


def _get_or_create_tracker_config():
    config = DailyTrackerConfig.objects.first()
    if not config:
        config = DailyTrackerConfig.objects.create(
            cutoff_hours=24,
            task_types_json='["Major", "Minor", "Research", "Documentation", "Meeting", "Support"]',
            custom_fields_json='[]',
            auto_lock_enabled=True
        )
    return config


def _resolve_user_and_employee(request):
    """
    Returns (user_obj, role, employee_obj)
    where role is 'hr', 'manager', or 'employee'
    """
    session = getattr(request, 'session', {})
    user = getattr(request, 'current_user', None) or getattr(request, 'user', None)
    
    # Check if HR
    if isinstance(user, HR):
        return user, 'hr', None

    if getattr(user, 'is_staff', False) or getattr(user, 'is_superuser', False):
        return user, 'hr', None

    # Check session hr_id
    if hasattr(session, 'get') and session.get('hr_id'):
        hr = HR.objects.filter(id=session['hr_id']).first()
        if hr:
            return hr, 'hr', None

    # Check token/headers
    auth_header = request.headers.get('Authorization') or request.headers.get('X-User-Auth')
    if auth_header:
        token = auth_header.replace('Bearer ', '').strip()
        if token.startswith('hr:'):
            try:
                hr_id = int(token.split(':', 1)[1])
                hr = HR.objects.filter(id=hr_id).first()
                if hr:
                    return hr, 'hr', None
            except Exception:
                pass

    # Resolve Employee
    emp_id = None
    if isinstance(user, EmployeeAccount):
        emp_id = user.employee_id
    elif isinstance(user, Employee):
        emp_id = user.id
    elif hasattr(user, 'email') and user.email:
        matched_emp = Employee.objects.filter(email__iexact=user.email).first()
        if matched_emp:
            emp_id = matched_emp.id
    elif request.headers.get('X-Employee-Id'):
        try:
            emp_id = int(request.headers.get('X-Employee-Id'))
        except Exception:
            pass
    elif hasattr(session, 'get') and session.get('employee_id'):
        emp_id = session.get('employee_id')
    elif hasattr(session, 'get') and session.get('account_id'):
        acc = EmployeeAccount.objects.filter(id=session['account_id']).first()
        if acc:
            emp_id = acc.employee_id

    if emp_id:
        emp = Employee.objects.filter(id=emp_id).first()
        if emp:
            if emp.is_manager:
                role = 'manager'
            elif emp.emp_type and emp.emp_type.lower() == 'intern':
                role = 'intern'
            else:
                role = 'employee'
            return emp, role, emp

    return None, 'anonymous', None


def _calculate_day_number(employee, target_date):
    """
    Calculates the sequence day number for the employee based on joining date
    or count of tracker days up to this date.
    """
    if employee.joining_date and target_date >= employee.joining_date:
        delta = (target_date - employee.joining_date).days + 1
        return max(1, delta)
    
    prev_count = DailyTrackerDay.objects.filter(employee=employee, date__lt=target_date).count()
    return prev_count + 1


def _check_and_apply_auto_lock(tracker_day, config=None):
    """
    Checks if a tracker should be automatically locked based on cutoff period.
    """
    if not tracker_day or tracker_day.status == 'Locked':
        return tracker_day

    if not config:
        config = _get_or_create_tracker_config()

    if not config.auto_lock_enabled:
        return tracker_day

    cutoff_hours = config.cutoff_hours or 24
    tracker_day_dt = datetime.combine(tracker_day.date, datetime.min.time()) + timedelta(days=1, hours=cutoff_hours)
    
    if timezone.now() > timezone.make_aware(tracker_day_dt, timezone.get_current_timezone() if timezone.is_aware(timezone.now()) else None):
        tracker_day.status = 'Locked'
        if not tracker_day.locked_at:
            tracker_day.locked_at = timezone.now()
        tracker_day.save()
        
        DailyTrackerAuditLog.objects.create(
            tracker_day=tracker_day,
            employee=tracker_day.employee,
            action='AUTO_LOCKED',
            performed_by_name='System Auto-Lock',
            performed_by_role='System',
            details=f'Tracker automatically locked after {cutoff_hours}h cutoff threshold.'
        )

def _calculate_streak_badges(longest_streak, current_streak=0):
    """
    Calculates milestone achievement badges for streaks: 21, 30, 60, 120, 240, 360 days.
    """
    best_streak = max(longest_streak or 0, current_streak or 0)
    badge_defs = [
        {
            'id': 'streak_21',
            'days': 21,
            'title': 'Habit Builder',
            'tier': 'Bronze',
            'icon': 'flame',
            'emoji': '🔥',
            'color': '#d97706',
            'bg_gradient': 'from-amber-500/20 to-orange-500/10',
            'description': 'Formed a consistent daily routine with a 21-day streak.',
        },
        {
            'id': 'streak_30',
            'days': 30,
            'title': 'Monthly Master',
            'tier': 'Silver',
            'icon': 'sparkles',
            'emoji': '✨',
            'color': '#64748b',
            'bg_gradient': 'from-slate-400/20 to-slate-600/10',
            'description': 'Completed a full uninterrupted 30-day work tracking milestone.',
        },
        {
            'id': 'streak_60',
            'days': 60,
            'title': 'Consistency Pro',
            'tier': 'Gold',
            'icon': 'zap',
            'emoji': '⚡',
            'color': '#eab308',
            'bg_gradient': 'from-yellow-400/20 to-amber-600/10',
            'description': 'Maintained peak consistency across 60 consecutive days.',
        },
        {
            'id': 'streak_120',
            'days': 120,
            'title': 'Centurion',
            'tier': 'Platinum',
            'icon': 'shield',
            'emoji': '🛡️',
            'color': '#06b6d4',
            'bg_gradient': 'from-cyan-400/20 to-blue-600/10',
            'description': 'Achieved an elite 120-day streak with relentless focus.',
        },
        {
            'id': 'streak_240',
            'days': 240,
            'title': 'Iron Will',
            'tier': 'Diamond',
            'icon': 'gem',
            'emoji': '💎',
            'color': '#8b5cf6',
            'bg_gradient': 'from-purple-400/20 to-indigo-600/10',
            'description': 'Completed 240 days of unbroken professional excellence.',
        },
        {
            'id': 'streak_360',
            'days': 360,
            'title': 'Grandmaster Legend',
            'tier': 'Legend',
            'icon': 'crown',
            'emoji': '👑',
            'color': '#ec4899',
            'bg_gradient': 'from-pink-500/20 to-rose-600/10',
            'description': 'Pinnacle 360-day full-year streak mastery achieved.',
        },
    ]

    badges = []
    for b in badge_defs:
        is_unlocked = best_streak >= b['days']
        pct = min(100, round((best_streak / b['days']) * 100)) if b['days'] > 0 else 0
        badges.append({
            **b,
            'is_unlocked': is_unlocked,
            'progress_percent': pct,
            'current_days': min(best_streak, b['days']),
            'remaining_days': max(0, b['days'] - best_streak)
        })
    return badges


def _get_employee_github_heatmap(employee, selected_date=None):
    """
    Builds the 52-week rolling GitHub-style contribution heatmap data.
    """
    if not selected_date:
        selected_date = date.today()

    # Align 52 weeks (Mon to Sun)
    days_to_sunday = 6 - selected_date.weekday()
    end_date = selected_date + timedelta(days=days_to_sunday)
    start_date = end_date - timedelta(days=52 * 7 - 1)

    trackers = DailyTrackerDay.objects.filter(
        employee=employee,
        date__gte=start_date,
        date__lte=end_date
    ).prefetch_related('tasks')

    tracker_map = {t.date: t for t in trackers}

    weeks = []
    current_week = []
    months_labels = []
    last_month = None

    curr_d = start_date
    week_idx = 0

    total_submitted_days = 0
    total_hours_sum = 0.0
    total_achievements_sum = 0
    longest_streak = 0
    running_streak = 0
    current_streak = 0

    # Calculate current ongoing streak
    today_dt = date.today()
    today_tracker = tracker_map.get(today_dt)
    
    if today_tracker and today_tracker.status in ['Submitted', 'Locked']:
        check_d = today_dt
    else:
        # Today is still ongoing; start checking from yesterday so pending state doesn't reset previous streak
        check_d = today_dt - timedelta(days=1)
    
    while check_d >= start_date:
        t = tracker_map.get(check_d)
        is_sub = t and t.status in ['Submitted', 'Locked']
        is_off = (check_d.weekday() in [5, 6]) or (t and t.day_status in ['Weekly Off', 'Holiday', 'Leave'])
        
        if is_sub:
            current_streak += 1
            check_d -= timedelta(days=1)
        elif is_off:
            # Weekends/Holidays/Leaves bridge the streak
            check_d -= timedelta(days=1)
        else:
            # Missed a working day
            break

    while curr_d <= end_date:
        m_name = curr_d.strftime('%b')
        if curr_d.day <= 7 and m_name != last_month:
            last_month = m_name
            months_labels.append({'name': m_name, 'week_col': week_idx})

        tracker = tracker_map.get(curr_d)
        if tracker:
            hours = tracker.total_hours
            tasks_count = tracker.tasks_count
            achievements = tracker.achievements_count
            status = tracker.status
            day_status = tracker.day_status
        else:
            hours = 0.0
            tasks_count = 0
            achievements = 0
            status = 'None'
            day_status = 'Weekly Off' if curr_d.weekday() in [5, 6] else 'Working Day'

        is_sub = status in ['Submitted', 'Locked']
        is_off_day = (curr_d.weekday() in [5, 6]) or (day_status in ['Weekly Off', 'Holiday', 'Leave'])

        if is_sub:
            total_submitted_days += 1
            running_streak += 1
            if running_streak > longest_streak:
                longest_streak = running_streak
        elif is_off_day:
            # Weekends or off days do not reset running streak
            pass
        elif curr_d < date.today():
            # Past working day was missed
            running_streak = 0

        total_hours_sum += hours
        total_achievements_sum += achievements

        # GitHub Contribution Level:
        # If Submitted/Locked -> Always show GREEN (Levels 1 to 4)
        if not is_sub:
            level = 0
        elif hours >= 9:
            level = 4
        elif hours >= 7:
            level = 3
        elif hours >= 4:
            level = 2
        else:
            level = 1

        day_info = {
            'date': curr_d.strftime('%Y-%m-%d'),
            'date_display': curr_d.strftime('%d-%b-%Y'),
            'day_name': curr_d.strftime('%A'),
            'weekday': curr_d.weekday(),
            'hours': round(hours, 1),
            'tasks_count': tasks_count,
            'achievements': achievements,
            'status': status,
            'day_status': day_status,
            'level': level,
            'is_selected': (curr_d == selected_date),
            'is_today': (curr_d == date.today())
        }

        current_week.append(day_info)

        if curr_d.weekday() == 6:
            weeks.append(current_week)
            current_week = []
            week_idx += 1

        curr_d += timedelta(days=1)

    if current_week:
        weeks.append(current_week)

    best_streak = max(longest_streak, current_streak)
    badges = _calculate_streak_badges(longest_streak=best_streak, current_streak=current_streak)
    unlocked_badges_count = sum(1 for b in badges if b['is_unlocked'])

    return {
        'weeks': weeks,
        'months_labels': months_labels,
        'total_submitted_days': total_submitted_days,
        'total_hours_year': round(total_hours_sum, 1),
        'total_achievements_year': total_achievements_sum,
        'longest_streak': best_streak,
        'current_streak': current_streak,
        'badges': badges,
        'unlocked_badges_count': unlocked_badges_count,
    }


# ============================================================================
# EMPLOYEE / INTERN TRACKER VIEWS
# ============================================================================


def daily_tracker_view(request):
    """
    Main spreadsheet/grid UI for Employees and Interns.
    """
    user_obj, role, employee = _resolve_user_and_employee(request)
    
    if not user_obj:
        return redirect('employee_login')

    if role == 'hr' and not request.GET.get('employee_id'):
        return redirect('daily_tracker_manager')

    target_emp = employee
    if role == 'hr' and request.GET.get('employee_id'):
        target_emp = Employee.objects.filter(id=request.GET.get('employee_id')).first() or employee

    if not target_emp:
        return redirect('employee_login')

    date_str = request.GET.get('date')
    if date_str:
        try:
            current_date = datetime.strptime(date_str, '%Y-%m-%d').date()
        except Exception:
            current_date = date.today()
    else:
        current_date = date.today()

    config = _get_or_create_tracker_config()
    day_number = _calculate_day_number(target_emp, current_date)
    
    has_leave = LeaveRequest.objects.filter(
        employee=target_emp,
        status='Approved',
        from_date__lte=current_date,
        to_date__gte=current_date
    ).exists()
    
    default_status = 'Leave' if has_leave else ('Weekly Off' if current_date.weekday() in [5, 6] else 'Working Day')

    tracker_day, created = DailyTrackerDay.objects.get_or_create(
        employee=target_emp,
        date=current_date,
        defaults={
            'day_number': day_number,
            'day_status': default_status,
            'status': 'Draft'
        }
    )
    
    _check_and_apply_auto_lock(tracker_day, config)

    try:
        task_types = json.loads(config.task_types_json)
    except Exception:
        task_types = ["Major", "Minor"]

    try:
        custom_fields = json.loads(config.custom_fields_json)
    except Exception:
        custom_fields = []

    # Monthly stats for calendar drawer
    month_start = current_date.replace(day=1)
    if current_date.month == 12:
        month_end = current_date.replace(year=current_date.year + 1, month=1, day=1) - timedelta(days=1)
    else:
        month_end = current_date.replace(month=current_date.month + 1, day=1) - timedelta(days=1)

    month_trackers = DailyTrackerDay.objects.filter(
        employee=target_emp,
        date__gte=month_start,
        date__lte=month_end
    ).prefetch_related('tasks')

    month_stats = {
        'total_submitted': month_trackers.filter(status__in=['Submitted', 'Locked']).count(),
        'total_draft': month_trackers.filter(status='Draft').count(),
        'total_hours': round(sum(t.total_hours for t in month_trackers), 1),
        'total_achievements': sum(t.achievements_count for t in month_trackers),
    }

    pending_unlock = DailyTrackerUnlockRequest.objects.filter(
        tracker_day=tracker_day,
        status='Pending'
    ).first()

    # Active assigned tasks for dropdown
    assigned_tasks = DailyAssignedTask.objects.filter(
        Q(assigned_to=target_emp) | (Q(department__iexact=target_emp.department or '') & Q(assigned_to__isnull=True))
    ).exclude(status='Completed').order_by('-created_at')

    # GitHub style contribution heatmap data
    heatmap_data = _get_employee_github_heatmap(target_emp, current_date)

    context = {
        'employee': target_emp,
        'current_user': user_obj,
        'user_role': role,
        'tracker_day': tracker_day,
        'tasks': tracker_day.tasks.all(),
        'assigned_tasks': assigned_tasks,
        'current_date': current_date.strftime('%Y-%m-%d'),
        'current_date_display': current_date.strftime('%d-%b-%Y'),
        'prev_date': (current_date - timedelta(days=1)).strftime('%Y-%m-%d'),
        'next_date': (current_date + timedelta(days=1)).strftime('%Y-%m-%d'),
        'task_types': task_types,
        'custom_fields': custom_fields,
        'month_stats': month_stats,
        'heatmap': heatmap_data,
        'pending_unlock': pending_unlock,
        'config': config,
    }

    return render(request, 'daily_tracker.html', context)


# ============================================================================
# API ENDPOINTS FOR TRACKER OPERATIONS
# ============================================================================

def api_daily_tracker_get(request):
    """
    Returns the JSON representation of tracker for a specific date and employee.
    """
    user_obj, role, employee = _resolve_user_and_employee(request)
    if not user_obj:
        return JsonResponse({'error': 'Unauthorized'}, status=401)

    emp_id = request.GET.get('employee_id')
    if emp_id and (role == 'hr' or str(getattr(employee, 'id', None)) == str(emp_id)):
        target_emp = Employee.objects.filter(id=emp_id).first()
    else:
        target_emp = employee

    if not target_emp:
        return JsonResponse({'error': 'Employee not found'}, status=404)

    date_str = request.GET.get('date', date.today().strftime('%Y-%m-%d'))
    try:
        current_date = datetime.strptime(date_str, '%Y-%m-%d').date()
    except Exception:
        current_date = date.today()

    config = _get_or_create_tracker_config()
    day_number = _calculate_day_number(target_emp, current_date)

    tracker_day, _ = DailyTrackerDay.objects.get_or_create(
        employee=target_emp,
        date=current_date,
        defaults={
            'day_number': day_number,
            'day_status': 'Weekly Off' if current_date.weekday() in [5, 6] else 'Working Day',
            'status': 'Draft'
        }
    )

    _check_and_apply_auto_lock(tracker_day, config)

    tasks_data = []
    for task in tracker_day.tasks.all():
        tasks_data.append({
            'id': task.id,
            'assigned_task_id': task.assigned_task_id,
            'is_flagged': bool(task.is_flagged),
            'flag_reason': task.flag_reason or '',
            'task_description': task.task_description,
            'task_type': task.task_type,
            'hours_worked': task.hours_worked,
            'is_achievement': task.is_achievement,
            'remarks': task.remarks or '',
            'order': task.order,
            'custom_data': task.custom_data or '{}'
        })

    # Assigned tasks available for employee/intern to pick from
    assigned_tasks_qs = DailyAssignedTask.objects.filter(
        Q(assigned_to=target_emp) | (Q(department__iexact=target_emp.department or '') & Q(assigned_to__isnull=True))
    ).exclude(status='Completed').order_by('-created_at')

    assigned_tasks_data = [
        {
            'id': at.id,
            'title': at.title,
            'description': at.description or '',
            'department': at.department,
            'task_type': at.task_type,
            'priority': at.priority,
            'due_date': at.due_date.isoformat() if at.due_date else None,
            'status': at.status,
            'is_flagged': at.is_flagged,
            'flag_reason': at.flag_reason or '',
            'assigned_by_name': at.assigned_by.name if at.assigned_by else 'Management/HR'
        }
        for at in assigned_tasks_qs
    ]

    pending_unlock = DailyTrackerUnlockRequest.objects.filter(
        tracker_day=tracker_day,
        status='Pending'
    ).first()

    heatmap_data = _get_employee_github_heatmap(target_emp, current_date)

    return JsonResponse({
        'id': tracker_day.id,
        'employee_id': target_emp.id,
        'employee_name': target_emp.name,
        'emp_type': target_emp.emp_type or 'Normal',
        'department': target_emp.department or '',
        'designation': target_emp.designation or '',
        'date': tracker_day.date.strftime('%Y-%m-%d'),
        'day_number': tracker_day.day_number,
        'day_status': tracker_day.day_status,
        'status': tracker_day.status,
        'submitted_at': tracker_day.submitted_at.isoformat() if tracker_day.submitted_at else None,
        'locked_at': tracker_day.locked_at.isoformat() if tracker_day.locked_at else None,
        'manager_rating': tracker_day.manager_rating,
        'manager_remarks': tracker_day.manager_remarks or '',
        'reviewed_by': tracker_day.reviewed_by or '',
        'reviewed_at': tracker_day.reviewed_at.isoformat() if tracker_day.reviewed_at else None,
        'total_hours': tracker_day.total_hours,
        'achievements_count': tracker_day.achievements_count,
        'tasks': tasks_data,
        'assigned_tasks': assigned_tasks_data,
        'heatmap': heatmap_data,
        'pending_unlock': {
            'id': pending_unlock.id,
            'reason': pending_unlock.reason,
            'requested_at': pending_unlock.requested_at.isoformat()
        } if pending_unlock else None
    })



@csrf_exempt
@require_POST
def api_daily_tracker_save(request):
    """
    Saves tracker as Draft or Submits it with mandatory validations.
    """
    user_obj, role, employee = _resolve_user_and_employee(request)
    if not user_obj:
        return JsonResponse({'error': 'Unauthorized'}, status=401)

    try:
        data = json.loads(request.body.decode('utf-8'))
    except Exception:
        return JsonResponse({'error': 'Invalid JSON body'}, status=400)

    emp_id = data.get('employee_id')
    if emp_id and (role == 'hr' or str(getattr(employee, 'id', None)) == str(emp_id)):
        target_emp = Employee.objects.filter(id=emp_id).first()
    else:
        target_emp = employee

    if not target_emp:
        return JsonResponse({'error': 'Employee not found'}, status=404)

    date_str = data.get('date', date.today().strftime('%Y-%m-%d'))
    try:
        current_date = datetime.strptime(date_str, '%Y-%m-%d').date()
    except Exception:
        return JsonResponse({'error': 'Invalid date format (YYYY-MM-DD)'}, status=400)

    action = data.get('action', 'draft').lower()  # 'draft' or 'submit'
    day_status = data.get('day_status', 'Working Day')
    tasks_input = data.get('tasks', [])

    config = _get_or_create_tracker_config()

    tracker_day, created = DailyTrackerDay.objects.get_or_create(
        employee=target_emp,
        date=current_date,
        defaults={
            'day_number': _calculate_day_number(target_emp, current_date),
            'day_status': day_status,
            'status': 'Draft'
        }
    )

    # Check lock status
    if tracker_day.status == 'Locked' and role != 'hr':
        return JsonResponse({
            'error': 'This tracker is locked. Please request an unlock to make corrections.'
        }, status=403)

    # Validations for submission
    if action == 'submit':
        if day_status == 'Working Day':
            if not tasks_input or len(tasks_input) == 0:
                return JsonResponse({'error': 'At least one task row is required for a Working Day.'}, status=400)

            total_h = 0.0
            for idx, t in enumerate(tasks_input):
                desc = (t.get('task_description') or '').strip()
                if not desc:
                    return JsonResponse({'error': f'Task description is mandatory on row {idx + 1}.'}, status=400)
                try:
                    h = float(t.get('hours_worked', 0))
                    if h < 0 or h > 24:
                        return JsonResponse({'error': f'Hours worked must be between 0 and 24 on row {idx + 1}.'}, status=400)
                    total_h += h
                except (ValueError, TypeError):
                    return JsonResponse({'error': f'Invalid hours value on row {idx + 1}.'}, status=400)

            if total_h > 24:
                return JsonResponse({'error': 'Total hours worked cannot exceed 24 hours in a single day.'}, status=400)

        tracker_day.status = 'Submitted'
        tracker_day.submitted_at = timezone.now()
    else:
        tracker_day.status = 'Draft'

    tracker_day.day_status = day_status
    tracker_day.save()

    # Re-sync task rows
    tracker_day.tasks.all().delete()
    created_tasks = []
    for idx, t in enumerate(tasks_input):
        desc = (t.get('task_description') or '').strip()
        if day_status != 'Working Day' and not desc:
            continue

        try:
            h = float(t.get('hours_worked', 0))
        except Exception:
            h = 0.0

        is_ach = bool(t.get('is_achievement', False))
        remarks = (t.get('remarks') or '').strip()
        task_type = (t.get('task_type') or 'Major').strip()
        assigned_task_id = t.get('assigned_task_id')
        is_flagged = bool(t.get('is_flagged', False))
        flag_reason = (t.get('flag_reason') or '').strip()
        custom_data = t.get('custom_data', '{}')
        if isinstance(custom_data, dict):
            custom_data = json.dumps(custom_data)

        assigned_task_obj = None
        if assigned_task_id:
            try:
                assigned_task_obj = DailyAssignedTask.objects.filter(id=assigned_task_id).first()
            except Exception:
                assigned_task_obj = None

        task_obj = DailyTaskRow.objects.create(
            tracker_day=tracker_day,
            assigned_task=assigned_task_obj,
            is_flagged=is_flagged,
            flag_reason=flag_reason,
            task_description=desc or 'Day Off / Leave',
            task_type=task_type,
            hours_worked=h if day_status == 'Working Day' else 0.0,
            is_achievement=is_ach,
            remarks=remarks,
            order=idx,
            custom_data=custom_data
        )
        created_tasks.append(task_obj)

        if assigned_task_obj:
            if is_flagged:
                assigned_task_obj.is_flagged = True
                assigned_task_obj.flag_reason = flag_reason
                assigned_task_obj.status = 'Flagged'
                assigned_task_obj.save()
            elif action == 'submit':
                assigned_task_obj.is_flagged = False
                assigned_task_obj.status = 'Completed'
                assigned_task_obj.completed_at = timezone.now()
                assigned_task_obj.save()
            elif action == 'draft' and assigned_task_obj.status == 'Pending':
                assigned_task_obj.status = 'In Progress'
                assigned_task_obj.save()

    # Audit Trail
    audit_action = 'SUBMITTED' if action == 'submit' else 'DRAFT_SAVED'
    performed_name = getattr(user_obj, 'name', 'Unknown')
    performed_role = 'HR / Admin' if role == 'hr' else ('Intern' if target_emp.emp_type == 'Intern' else 'Employee')
    
    DailyTrackerAuditLog.objects.create(
        tracker_day=tracker_day,
        employee=target_emp,
        action=audit_action,
        performed_by_name=performed_name,
        performed_by_role=performed_role,
        details=f"Tracker {audit_action.lower()} with {len(created_tasks)} tasks, Day Status: {day_status}, Total Hours: {tracker_day.total_hours}h."
    )

    return JsonResponse({
        'success': True,
        'message': f"Daily Tracker successfully {'submitted' if action == 'submit' else 'saved as draft'}.",
        'tracker_id': tracker_day.id,
        'status': tracker_day.status,
        'total_hours': tracker_day.total_hours,
        'achievements_count': tracker_day.achievements_count,
        'tasks_count': tracker_day.tasks_count
    })


@csrf_exempt
@require_POST
def api_daily_tracker_request_unlock(request):
    """
    Employee / Intern requests unlock for a locked tracker day.
    """
    user_obj, role, employee = _resolve_user_and_employee(request)
    if not user_obj or not employee:
        return JsonResponse({'error': 'Unauthorized'}, status=401)

    try:
        data = json.loads(request.body.decode('utf-8'))
    except Exception:
        return JsonResponse({'error': 'Invalid JSON'}, status=400)

    date_str = data.get('date')
    reason = (data.get('reason') or '').strip()

    if not reason:
        return JsonResponse({'error': 'A valid reason is required for requesting an unlock.'}, status=400)

    try:
        target_date = datetime.strptime(date_str, '%Y-%m-%d').date()
    except Exception:
        return JsonResponse({'error': 'Invalid date format (YYYY-MM-DD)'}, status=400)

    tracker_day = DailyTrackerDay.objects.filter(employee=employee, date=target_date).first()
    if not tracker_day:
        return JsonResponse({'error': 'Tracker record not found.'}, status=404)

    existing = DailyTrackerUnlockRequest.objects.filter(tracker_day=tracker_day, status='Pending').first()
    if existing:
        return JsonResponse({'error': 'An unlock request is already pending for this day.'}, status=400)

    unlock_req = DailyTrackerUnlockRequest.objects.create(
        tracker_day=tracker_day,
        employee=employee,
        reason=reason,
        status='Pending'
    )

    DailyTrackerAuditLog.objects.create(
        tracker_day=tracker_day,
        employee=employee,
        action='UNLOCK_REQUESTED',
        performed_by_name=employee.name,
        performed_by_role='Intern' if employee.emp_type == 'Intern' else 'Employee',
        details=f"Unlock requested with reason: {reason}"
    )

    return JsonResponse({
        'success': True,
        'message': 'Unlock request submitted successfully. Your Reporting Manager / HR will review it.',
        'request_id': unlock_req.id
    })


# ============================================================================
# MANAGER & HR DASHBOARDS / ACTIONS
# ============================================================================

def daily_tracker_manager_view(request):
    """
    Manager & HR Dashboard to view team trackers, achievements, unlocks, and ratings.
    """
    user_obj, role, employee = _resolve_user_and_employee(request)
    if not user_obj or role not in ['hr', 'manager', 'employee']:
        return redirect('login')

    date_str = request.GET.get('date', date.today().strftime('%Y-%m-%d'))
    try:
        filter_date = datetime.strptime(date_str, '%Y-%m-%d').date()
    except Exception:
        filter_date = date.today()

    department_filter = request.GET.get('department', '').strip()
    status_filter = request.GET.get('status', '').strip()
    type_filter = request.GET.get('emp_type', '').strip()
    search = request.GET.get('search', '').strip()

    employees_qs = Employee.objects.filter(status='Active')
    if department_filter:
        employees_qs = employees_qs.filter(department__iexact=department_filter)
    if type_filter:
        employees_qs = employees_qs.filter(emp_type__iexact=type_filter)
    if search:
        employees_qs = employees_qs.filter(Q(name__icontains=search) | Q(emp_id__icontains=search))

    employees_list = list(employees_qs.order_by('name'))

    trackers_map = {
        t.employee_id: t
        for t in DailyTrackerDay.objects.filter(date=filter_date, employee__in=employees_list).prefetch_related('tasks')
    }

    team_data = []
    stats = {
        'total_employees': len(employees_list),
        'submitted_count': 0,
        'pending_count': 0,
        'locked_count': 0,
        'draft_count': 0,
        'total_hours': 0.0,
        'total_achievements': 0
    }

    for emp in employees_list:
        tracker = trackers_map.get(emp.id)
        if tracker:
            t_status = tracker.status
            t_hours = tracker.total_hours
            t_achievements = tracker.achievements_count
            t_tasks_count = tracker.tasks_count
            t_rating = tracker.manager_rating
            t_remarks = tracker.manager_remarks
            t_day_status = tracker.day_status
            t_id = tracker.id
        else:
            t_status = 'Pending'
            t_hours = 0.0
            t_achievements = 0
            t_tasks_count = 0
            t_rating = 0
            t_remarks = ''
            t_day_status = 'Working Day'
            t_id = None

        if t_status == 'Submitted':
            stats['submitted_count'] += 1
        elif t_status == 'Locked':
            stats['locked_count'] += 1
        elif t_status == 'Draft':
            stats['draft_count'] += 1
        else:
            stats['pending_count'] += 1

        stats['total_hours'] += t_hours
        stats['total_achievements'] += t_achievements

        if status_filter and t_status != status_filter:
            continue

        team_data.append({
            'employee': emp,
            'tracker_id': t_id,
            'date': filter_date.strftime('%Y-%m-%d'),
            'date_display': filter_date.strftime('%d-%b-%Y'),
            'tasks_count': t_tasks_count,
            'hours': t_hours,
            'achievements': t_achievements,
            'status': t_status,
            'day_status': t_day_status,
            'manager_rating': t_rating,
            'manager_remarks': t_remarks,
            'tasks': list(tracker.tasks.all()) if tracker else []
        })

    pending_unlocks = DailyTrackerUnlockRequest.objects.filter(status='Pending').select_related('employee', 'tracker_day')
    departments = Employee.objects.exclude(department__isnull=True).exclude(department='').values_list('department', flat=True).distinct()
    config = _get_or_create_tracker_config()

    if role == 'manager' and employee:
        mgr_dept = employee.managed_department or employee.department or ''
        assigned_tasks_qs = DailyAssignedTask.objects.filter(Q(department__iexact=mgr_dept) | Q(assigned_by=employee)).select_related('assigned_to', 'assigned_by')
    else:
        assigned_tasks_qs = DailyAssignedTask.objects.all().select_related('assigned_to', 'assigned_by')

    context = {
        'current_user': user_obj,
        'user_role': role,
        'filter_date': filter_date.strftime('%Y-%m-%d'),
        'filter_date_display': filter_date.strftime('%d-%b-%Y'),
        'team_data': team_data,
        'stats': stats,
        'pending_unlocks': pending_unlocks,
        'assigned_tasks': assigned_tasks_qs.order_by('-created_at')[:100],
        'departments': departments,
        'selected_department': department_filter,
        'selected_status': status_filter,
        'selected_type': type_filter,
        'search': search,
        'config': config,
    }

    return render(request, 'daily_tracker_manager.html', context)


def api_daily_tracker_manager_data(request):
    """
    JSON API for Manager / HR Dashboard in Next.js frontend.
    """
    user_obj, role, employee = _resolve_user_and_employee(request)
    if not user_obj:
        return JsonResponse({'error': 'Unauthorized'}, status=401)

    date_str = request.GET.get('date', date.today().strftime('%Y-%m-%d'))
    try:
        filter_date = datetime.strptime(date_str, '%Y-%m-%d').date()
    except Exception:
        filter_date = date.today()

    department_filter = request.GET.get('department', '').strip()
    status_filter = request.GET.get('status', '').strip()
    type_filter = request.GET.get('emp_type', '').strip()
    search = request.GET.get('search', '').strip()

    employees_qs = Employee.objects.filter(status='Active')
    if department_filter:
        employees_qs = employees_qs.filter(department__iexact=department_filter)
    if type_filter:
        employees_qs = employees_qs.filter(emp_type__iexact=type_filter)
    if search:
        employees_qs = employees_qs.filter(Q(name__icontains=search) | Q(emp_id__icontains=search))

    employees_list = list(employees_qs.order_by('name'))

    trackers_map = {
        t.employee_id: t
        for t in DailyTrackerDay.objects.filter(date=filter_date, employee__in=employees_list).prefetch_related('tasks')
    }

    team_data = []
    stats = {
        'total_employees': len(employees_list),
        'submitted_count': 0,
        'pending_count': 0,
        'locked_count': 0,
        'draft_count': 0,
        'total_hours': 0.0,
        'total_achievements': 0
    }

    for emp in employees_list:
        tracker = trackers_map.get(emp.id)
        if tracker:
            t_status = tracker.status
            t_hours = tracker.total_hours
            t_achievements = tracker.achievements_count
            t_tasks_count = tracker.tasks_count
            t_rating = tracker.manager_rating
            t_remarks = tracker.manager_remarks or ''
            t_day_status = tracker.day_status
            t_id = tracker.id
            tasks_list = [
                {
                    'id': t.id,
                    'assigned_task_id': t.assigned_task_id,
                    'is_flagged': bool(t.is_flagged),
                    'flag_reason': t.flag_reason or '',
                    'task_description': t.task_description,
                    'task_type': t.task_type,
                    'hours_worked': t.hours_worked,
                    'is_achievement': t.is_achievement,
                    'remarks': t.remarks or ''
                }
                for t in tracker.tasks.all()
            ]
        else:
            t_status = 'Pending'
            t_hours = 0.0
            t_achievements = 0
            t_tasks_count = 0
            t_rating = 0
            t_remarks = ''
            t_day_status = 'Working Day'
            t_id = None
            tasks_list = []

        if t_status == 'Submitted':
            stats['submitted_count'] += 1
        elif t_status == 'Locked':
            stats['locked_count'] += 1
        elif t_status == 'Draft':
            stats['draft_count'] += 1
        else:
            stats['pending_count'] += 1

        stats['total_hours'] += t_hours
        stats['total_achievements'] += t_achievements

        if status_filter and t_status != status_filter:
            continue

        team_data.append({
            'employee_id': emp.id,
            'employee_name': emp.name,
            'emp_id': emp.emp_id or f"EMP{emp.id:04d}",
            'emp_type': emp.emp_type or 'Normal',
            'department': emp.department or '',
            'is_manager': emp.is_manager,
            'managed_department': emp.managed_department or '',
            'tracker_id': t_id,
            'date': filter_date.strftime('%Y-%m-%d'),
            'tasks_count': t_tasks_count,
            'hours': t_hours,
            'achievements': t_achievements,
            'status': t_status,
            'day_status': t_day_status,
            'manager_rating': t_rating,
            'manager_remarks': t_remarks,
            'tasks': tasks_list
        })

    pending_unlocks_qs = DailyTrackerUnlockRequest.objects.filter(status='Pending').select_related('employee', 'tracker_day')
    pending_unlocks = [
        {
            'id': u.id,
            'employee_name': u.employee.name,
            'emp_id': u.employee.emp_id or f"EMP{u.employee.id}",
            'date': u.tracker_day.date.strftime('%d-%b-%Y'),
            'reason': u.reason,
            'requested_at': u.requested_at.isoformat()
        }
        for u in pending_unlocks_qs
    ]

    # Delegated / Assigned tasks for manager / HR
    if role == 'manager' and employee:
        mgr_dept = employee.managed_department or employee.department or ''
        assigned_tasks_qs = DailyAssignedTask.objects.filter(Q(department__iexact=mgr_dept) | Q(assigned_by=employee)).select_related('assigned_to', 'assigned_by')
    else:
        assigned_tasks_qs = DailyAssignedTask.objects.all().select_related('assigned_to', 'assigned_by')

    assigned_tasks_list = [
        {
            'id': at.id,
            'title': at.title,
            'description': at.description or '',
            'department': at.department,
            'assigned_to_id': at.assigned_to_id,
            'assigned_to_name': at.assigned_to.name if at.assigned_to else 'All Team Members',
            'assigned_by_name': at.assigned_by.name if at.assigned_by else 'Management/HR',
            'task_type': at.task_type,
            'priority': at.priority,
            'due_date': at.due_date.isoformat() if at.due_date else None,
            'status': at.status,
            'is_flagged': at.is_flagged,
            'flag_reason': at.flag_reason or '',
            'completed_at': at.completed_at.isoformat() if at.completed_at else None,
            'created_at': at.created_at.strftime('%d-%b-%Y')
        }
        for at in assigned_tasks_qs.order_by('-created_at')[:150]
    ]

    departments = list(Employee.objects.exclude(department__isnull=True).exclude(department='').values_list('department', flat=True).distinct())

    mgr_dept_str = getattr(employee, 'managed_department', None) or getattr(employee, 'department', '') if employee else ''

    return JsonResponse({
        'filter_date': filter_date.strftime('%Y-%m-%d'),
        'team_data': team_data,
        'stats': stats,
        'pending_unlocks': pending_unlocks,
        'assigned_tasks': assigned_tasks_list,
        'departments': departments,
        'user_role': role,
        'is_manager_role': role in ['manager', 'hr'],
        'manager_department': mgr_dept_str
    })


@csrf_exempt
@require_POST
def api_daily_tracker_unlock_action(request):
    """
    Manager / HR approves or rejects an unlock request or overrides lock.
    """
    user_obj, role, _ = _resolve_user_and_employee(request)
    if not user_obj or role not in ['hr', 'manager']:
        return JsonResponse({'error': 'Unauthorized. Only Managers and HR can approve unlock requests.'}, status=403)

    try:
        data = json.loads(request.body.decode('utf-8'))
    except Exception:
        return JsonResponse({'error': 'Invalid JSON'}, status=400)

    req_id = data.get('request_id')
    tracker_day_id = data.get('tracker_day_id')
    action = data.get('action', 'approve').lower()  # 'approve', 'reject', 'force_unlock', 'force_lock'
    review_notes = (data.get('review_notes') or '').strip()

    reviewer_name = getattr(user_obj, 'name', 'HR/Manager')

    if req_id:
        req = DailyTrackerUnlockRequest.objects.filter(id=req_id).first()
        if not req:
            return JsonResponse({'error': 'Unlock request not found.'}, status=404)

        tracker_day = req.tracker_day
        if action == 'approve':
            req.status = 'Approved'
            req.reviewed_by = reviewer_name
            req.reviewed_at = timezone.now()
            req.review_notes = review_notes
            req.save()

            tracker_day.status = 'Draft'
            tracker_day.locked_at = None
            tracker_day.save()

            DailyTrackerAuditLog.objects.create(
                tracker_day=tracker_day,
                employee=tracker_day.employee,
                action='UNLOCKED',
                performed_by_name=reviewer_name,
                performed_by_role='HR / Admin' if role == 'hr' else 'Reporting Manager',
                details=f"Unlock request #{req.id} approved. Notes: {review_notes}"
            )
            return JsonResponse({'success': True, 'message': 'Unlock request approved. Tracker is now editable.'})
        else:
            req.status = 'Rejected'
            req.reviewed_by = reviewer_name
            req.reviewed_at = timezone.now()
            req.review_notes = review_notes
            req.save()

            DailyTrackerAuditLog.objects.create(
                tracker_day=tracker_day,
                employee=tracker_day.employee,
                action='UNLOCK_REJECTED',
                performed_by_name=reviewer_name,
                performed_by_role='HR / Admin' if role == 'hr' else 'Reporting Manager',
                details=f"Unlock request #{req.id} rejected. Notes: {review_notes}"
            )
            return JsonResponse({'success': True, 'message': 'Unlock request rejected.'})

    elif tracker_day_id:
        tracker_day = DailyTrackerDay.objects.filter(id=tracker_day_id).first()
        if not tracker_day:
            return JsonResponse({'error': 'Tracker record not found.'}, status=404)

        if action == 'force_unlock':
            tracker_day.status = 'Draft'
            tracker_day.locked_at = None
            tracker_day.save()

            DailyTrackerAuditLog.objects.create(
                tracker_day=tracker_day,
                employee=tracker_day.employee,
                action='UNLOCKED_OVERRIDE',
                performed_by_name=reviewer_name,
                performed_by_role='HR / Admin',
                details=f"Manual unlock override by {reviewer_name}. Reason: {review_notes or 'Admin override'}"
            )
            return JsonResponse({'success': True, 'message': 'Tracker manually unlocked by Admin.'})

        elif action == 'force_lock':
            tracker_day.status = 'Locked'
            tracker_day.locked_at = timezone.now()
            tracker_day.save()

            DailyTrackerAuditLog.objects.create(
                tracker_day=tracker_day,
                employee=tracker_day.employee,
                action='LOCKED_OVERRIDE',
                performed_by_name=reviewer_name,
                performed_by_role='HR / Admin',
                details=f"Manual lock applied by {reviewer_name}."
            )
            return JsonResponse({'success': True, 'message': 'Tracker manually locked.'})

    return JsonResponse({'error': 'Missing request_id or tracker_day_id.'}, status=400)


@csrf_exempt
@require_POST
def api_daily_tracker_manager_review(request):
    """
    Manager / HOD submits rating and feedback remarks for an employee tracker day.
    """
    user_obj, role, _ = _resolve_user_and_employee(request)
    if not user_obj or role not in ['hr', 'manager']:
        return JsonResponse({'error': 'Unauthorized'}, status=403)

    try:
        data = json.loads(request.body.decode('utf-8'))
    except Exception:
        return JsonResponse({'error': 'Invalid JSON'}, status=400)

    tracker_day_id = data.get('tracker_day_id')
    rating = int(data.get('rating', 0))
    remarks = (data.get('remarks') or '').strip()

    tracker_day = DailyTrackerDay.objects.filter(id=tracker_day_id).first()
    if not tracker_day:
        return JsonResponse({'error': 'Tracker day record not found.'}, status=404)

    tracker_day.manager_rating = max(0, min(5, rating))
    tracker_day.manager_remarks = remarks
    tracker_day.reviewed_by = getattr(user_obj, 'name', 'Manager')
    tracker_day.reviewed_at = timezone.now()
    tracker_day.save()

    DailyTrackerAuditLog.objects.create(
        tracker_day=tracker_day,
        employee=tracker_day.employee,
        action='MANAGER_REVIEW',
        performed_by_name=tracker_day.reviewed_by,
        performed_by_role='HR / Admin' if role == 'hr' else 'Reporting Manager',
        details=f"Rating: {rating}/5 Stars, Remarks: {remarks}"
    )

    return JsonResponse({
        'success': True,
        'message': 'Manager review & rating saved successfully.',
        'rating': tracker_day.manager_rating,
        'remarks': tracker_day.manager_remarks,
        'reviewed_by': tracker_day.reviewed_by
    })


# ============================================================================
# REPORTS & EXPORTS
# ============================================================================

def daily_tracker_reports_view(request):
    """
    Reports & Analytics view for Daily Work Trackers.
    """
    user_obj, role, employee = _resolve_user_and_employee(request)
    if not user_obj:
        return redirect('login')

    report_type = request.GET.get('type', 'daily')
    from_date_str = request.GET.get('from_date')
    to_date_str = request.GET.get('to_date')
    emp_id = request.GET.get('employee_id')
    department = request.GET.get('department', '').strip()

    today = date.today()
    if not from_date_str:
        from_date = today.replace(day=1)
    else:
        try:
            from_date = datetime.strptime(from_date_str, '%Y-%m-%d').date()
        except Exception:
            from_date = today.replace(day=1)

    if not to_date_str:
        to_date = today
    else:
        try:
            to_date = datetime.strptime(to_date_str, '%Y-%m-%d').date()
        except Exception:
            to_date = today

    tasks_query = DailyTaskRow.objects.filter(
        tracker_day__date__gte=from_date,
        tracker_day__date__lte=to_date
    ).select_related('tracker_day', 'tracker_day__employee')

    if role not in ['hr', 'manager'] and employee:
        tasks_query = tasks_query.filter(tracker_day__employee=employee)
    elif emp_id:
        tasks_query = tasks_query.filter(tracker_day__employee_id=emp_id)

    if department:
        tasks_query = tasks_query.filter(tracker_day__employee__department__iexact=department)

    total_hours = tasks_query.aggregate(Sum('hours_worked'))['hours_worked__sum'] or 0.0
    total_tasks = tasks_query.count()
    total_achievements = tasks_query.filter(is_achievement=True).count()
    major_tasks_count = tasks_query.filter(task_type__iexact='Major').count()
    minor_tasks_count = tasks_query.filter(task_type__iexact='Minor').count()

    employees = Employee.objects.filter(status='Active').order_by('name')
    departments = Employee.objects.exclude(department__isnull=True).exclude(department='').values_list('department', flat=True).distinct()
    records = tasks_query.order_by('-tracker_day__date', 'order')[:200]

    context = {
        'current_user': user_obj,
        'user_role': role,
        'report_type': report_type,
        'from_date': from_date.strftime('%Y-%m-%d'),
        'to_date': to_date.strftime('%Y-%m-%d'),
        'selected_employee_id': emp_id,
        'selected_department': department,
        'employees': employees,
        'departments': departments,
        'total_hours': round(total_hours, 1),
        'total_tasks': total_tasks,
        'total_achievements': total_achievements,
        'major_tasks_count': major_tasks_count,
        'minor_tasks_count': minor_tasks_count,
        'records': records,
    }

    return render(request, 'daily_tracker_reports.html', context)


def api_daily_tracker_export(request):
    """
    Exports daily work tracker data into Excel (XLSX) or CSV.
    """
    user_obj, role, employee = _resolve_user_and_employee(request)
    if not user_obj:
        return JsonResponse({'error': 'Unauthorized'}, status=401)

    export_format = request.GET.get('format', 'xlsx').lower()
    from_date_str = request.GET.get('from_date')
    to_date_str = request.GET.get('to_date')
    emp_id = request.GET.get('employee_id')
    department = request.GET.get('department')
    is_achievement_only = request.GET.get('achievements_only') == '1'

    today = date.today()
    try:
        from_date = datetime.strptime(from_date_str, '%Y-%m-%d').date() if from_date_str else today.replace(day=1)
    except Exception:
        from_date = today.replace(day=1)

    try:
        to_date = datetime.strptime(to_date_str, '%Y-%m-%d').date() if to_date_str else today
    except Exception:
        to_date = today

    tasks_query = DailyTaskRow.objects.filter(
        tracker_day__date__gte=from_date,
        tracker_day__date__lte=to_date
    ).select_related('tracker_day', 'tracker_day__employee')

    if role not in ['hr', 'manager'] and employee:
        tasks_query = tasks_query.filter(tracker_day__employee=employee)
    elif emp_id:
        tasks_query = tasks_query.filter(tracker_day__employee_id=emp_id)

    if department:
        tasks_query = tasks_query.filter(tracker_day__employee__department__iexact=department)

    if is_achievement_only:
        tasks_query = tasks_query.filter(is_achievement=True)

    tasks_list = tasks_query.order_by('-tracker_day__date', 'tracker_day__employee__name', 'order')

    data = []
    for task in tasks_list:
        day = task.tracker_day
        emp = day.employee
        data.append({
            'Date': day.date.strftime('%d-%m-%Y'),
            'Day #': f"Day {day.day_number}",
            'Employee ID': emp.emp_id or f"EMP{emp.id:04d}",
            'Employee Name': emp.name,
            'Role/Type': emp.emp_type or 'Normal',
            'Department': emp.department or '',
            'Day Status': day.day_status,
            'Task Worked On': task.task_description,
            'Task Type': task.task_type,
            'Hours Worked': task.hours_worked,
            'Achievement': '★ Yes' if task.is_achievement else 'No',
            'Remarks / Blockers': task.remarks or '',
            'Tracker Status': day.status,
            'Manager Rating': f"{day.manager_rating}/5" if day.manager_rating else '--',
            'Manager Remarks': day.manager_remarks or '--'
        })

    df = pd.DataFrame(data)
    if df.empty:
        df = pd.DataFrame(columns=[
            'Date', 'Day #', 'Employee ID', 'Employee Name', 'Role/Type', 'Department',
            'Day Status', 'Task Worked On', 'Task Type', 'Hours Worked', 'Achievement',
            'Remarks / Blockers', 'Tracker Status', 'Manager Rating', 'Manager Remarks'
        ])

    timestamp_str = today.strftime('%d_%m_%Y')

    if export_format == 'json':
        total_hours = tasks_query.aggregate(Sum('hours_worked'))['hours_worked__sum'] or 0.0
        total_tasks = tasks_query.count()
        total_achievements = tasks_query.filter(is_achievement=True).count()
        major_tasks_count = tasks_query.filter(task_type__iexact='Major').count()
        minor_tasks_count = tasks_query.filter(task_type__iexact='Minor').count()
        return JsonResponse({
            'records': data,
            'total_hours': round(total_hours, 1),
            'total_tasks': total_tasks,
            'total_achievements': total_achievements,
            'major_tasks_count': major_tasks_count,
            'minor_tasks_count': minor_tasks_count
        })

    if export_format == 'csv':
        csv_buffer = StringIO()
        df.to_csv(csv_buffer, index=False)
        response = HttpResponse(csv_buffer.getvalue(), content_type='text/csv')
        response['Content-Disposition'] = f'attachment; filename="Daily_Work_Tracker_Export_{timestamp_str}.csv"'
        return response

    output = BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        df.to_excel(writer, index=False, sheet_name='Daily Work Tracker')
    output.seek(0)

    response = HttpResponse(
        output.getvalue(),
        content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    )
    response['Content-Disposition'] = f'attachment; filename="Daily_Work_Tracker_Export_{timestamp_str}.xlsx"'
    return response


# ============================================================================
# AUDIT TRAIL & CONFIGURATION
# ============================================================================

def api_daily_tracker_audit_log(request):
    """
    Returns audit log entries for a tracker or globally for HR.
    """
    user_obj, role, _ = _resolve_user_and_employee(request)
    if not user_obj:
        return JsonResponse({'error': 'Unauthorized'}, status=401)

    tracker_day_id = request.GET.get('tracker_day_id')
    emp_id = request.GET.get('employee_id')

    logs_qs = DailyTrackerAuditLog.objects.all().select_related('employee', 'tracker_day')

    if tracker_day_id:
        logs_qs = logs_qs.filter(tracker_day_id=tracker_day_id)
    elif emp_id:
        logs_qs = logs_qs.filter(employee_id=emp_id)

    logs = []
    for item in logs_qs[:100]:
        logs.append({
            'id': item.id,
            'date': item.tracker_day.date.strftime('%d-%b-%Y') if item.tracker_day else '--',
            'action': item.action,
            'performed_by': item.performed_by_name,
            'role': item.performed_by_role,
            'details': item.details or '',
            'timestamp': item.timestamp.strftime('%d-%b-%Y %I:%M %p')
        })

    return JsonResponse({'logs': logs})


@csrf_exempt
@require_http_methods(["GET", "POST"])
def api_daily_tracker_config(request):
    """
    HR/Admin settings for Cutoff hours, Task types, and Custom fields.
    """
    user_obj, role, _ = _resolve_user_and_employee(request)
    if not user_obj or role != 'hr':
        return JsonResponse({'error': 'Unauthorized. Admin permissions required.'}, status=403)

    config = _get_or_create_tracker_config()

    if request.method == 'POST':
        try:
            data = json.loads(request.body.decode('utf-8'))
        except Exception:
            return JsonResponse({'error': 'Invalid JSON'}, status=400)

        if 'cutoff_hours' in data:
            try:
                config.cutoff_hours = int(data['cutoff_hours'])
            except Exception:
                pass

        if 'task_types' in data:
            config.task_types_json = json.dumps(data['task_types'])

        if 'custom_fields' in data:
            config.custom_fields_json = json.dumps(data['custom_fields'])

        if 'auto_lock_enabled' in data:
            config.auto_lock_enabled = bool(data['auto_lock_enabled'])

        config.save()
        return JsonResponse({'success': True, 'message': 'Tracker configuration updated successfully.'})

    try:
        task_types = json.loads(config.task_types_json)
    except Exception:
        task_types = ["Major", "Minor"]

    try:
        custom_fields = json.loads(config.custom_fields_json)
    except Exception:
        custom_fields = []

    return JsonResponse({
        'cutoff_hours': config.cutoff_hours,
        'auto_lock_enabled': config.auto_lock_enabled,
        'task_types': task_types,
        'custom_fields': custom_fields,
        'updated_at': config.updated_at.isoformat()
    })


# ============================================================================
# MANAGER ROLE DELEGATION & TASK ASSIGNMENT APIS
# ============================================================================

@csrf_exempt
@require_POST
def api_assign_manager_role(request):
    """
    HR / Admin designates an employee as a Manager for a specific department.
    """
    user_obj, role, _ = _resolve_user_and_employee(request)
    if not user_obj or role != 'hr':
        return JsonResponse({'error': 'Unauthorized. Admin permissions required to assign manager role.'}, status=403)

    try:
        data = json.loads(request.body.decode('utf-8'))
    except Exception:
        return JsonResponse({'error': 'Invalid JSON body'}, status=400)

    emp_id = data.get('employee_id')
    is_manager = bool(data.get('is_manager', False))
    managed_dept = (data.get('managed_department') or '').strip()
    is_superadmin = bool(data.get('is_superadmin', False))

    if not emp_id:
        return JsonResponse({'error': 'employee_id is required'}, status=400)

    emp = Employee.objects.filter(id=emp_id).first()
    if not emp:
        return JsonResponse({'error': 'Employee not found'}, status=404)

    emp.is_manager = is_manager
    emp.managed_department = managed_dept if is_manager else ''
    if 'is_superadmin' in data:
        emp.is_superadmin = is_superadmin
    emp.save()

    return JsonResponse({
        'success': True,
        'message': f"Access roles updated for {emp.name}.",
        'employee_id': emp.id,
        'is_manager': emp.is_manager,
        'managed_department': emp.managed_department,
        'is_superadmin': emp.is_superadmin
    })


def api_get_department_team(request):
    """
    Returns list of team members (employees & interns) in manager's department.
    """
    user_obj, role, employee = _resolve_user_and_employee(request)
    if not user_obj:
        return JsonResponse({'error': 'Unauthorized'}, status=401)

    dept = request.GET.get('department', '').strip()
    if not dept and role == 'manager' and employee:
        dept = employee.managed_department or employee.department or ''

    emps_qs = Employee.objects.filter(status='Active')
    if dept:
        emps_qs = emps_qs.filter(department__iexact=dept)

    data = [
        {
            'id': e.id,
            'name': e.name,
            'emp_id': e.emp_id or f"EMP{e.id:04d}",
            'email': e.email or '',
            'department': e.department or '',
            'designation': e.designation or '',
            'emp_type': e.emp_type or 'Normal',
            'is_manager': e.is_manager
        }
        for e in emps_qs.order_by('name')
    ]
    return JsonResponse({'department': dept, 'members': data})


@csrf_exempt
@require_POST
def api_daily_tracker_assign_task(request):
    """
    Manager assigns a task to an employee/intern or their entire department.
    """
    user_obj, role, employee = _resolve_user_and_employee(request)
    if not user_obj or role not in ['hr', 'manager']:
        return JsonResponse({'error': 'Unauthorized. Only Department Managers and HR can assign tasks.'}, status=403)

    try:
        data = json.loads(request.body.decode('utf-8'))
    except Exception:
        return JsonResponse({'error': 'Invalid JSON body'}, status=400)

    title = (data.get('title') or '').strip()
    description = (data.get('description') or '').strip()
    task_type = (data.get('task_type') or 'Major').strip()
    priority = (data.get('priority') or 'Medium').strip()
    department = (data.get('department') or '').strip()
    assigned_to_id = data.get('assigned_to_id')
    due_date_str = data.get('due_date')

    if not title:
        return JsonResponse({'error': 'Task title is required.'}, status=400)

    if role == 'manager' and employee:
        mgr_dept = employee.managed_department or employee.department or ''
        if not department:
            department = mgr_dept

    due_date = None
    if due_date_str:
        try:
            due_date = datetime.strptime(due_date_str, '%Y-%m-%d').date()
        except Exception:
            pass

    assigned_to = None
    if assigned_to_id and str(assigned_to_id) not in ['0', 'all', '']:
        assigned_to = Employee.objects.filter(id=assigned_to_id).first()
        if assigned_to and not department:
            department = assigned_to.department

    assigned_by_emp = employee if isinstance(user_obj, Employee) else None

    task = DailyAssignedTask.objects.create(
        title=title,
        description=description,
        department=department or 'General',
        assigned_by=assigned_by_emp,
        assigned_to=assigned_to,
        task_type=task_type,
        priority=priority,
        due_date=due_date,
        status='Pending'
    )

    return JsonResponse({
        'success': True,
        'message': f"Task '{task.title}' assigned successfully.",
        'task': {
            'id': task.id,
            'title': task.title,
            'description': task.description,
            'department': task.department,
            'assigned_to_name': task.assigned_to.name if task.assigned_to else 'All Department Members',
            'task_type': task.task_type,
            'priority': task.priority,
            'due_date': task.due_date.isoformat() if task.due_date else None,
            'status': task.status
        }
    })


def api_daily_tracker_assigned_tasks_list(request):
    """
    Returns list of assigned tasks (filtered by department, status, or assignee).
    """
    user_obj, role, employee = _resolve_user_and_employee(request)
    if not user_obj:
        return JsonResponse({'error': 'Unauthorized'}, status=401)

    dept_filter = request.GET.get('department', '').strip()
    status_filter = request.GET.get('status', '').strip()
    emp_id_filter = request.GET.get('employee_id')

    tasks_qs = DailyAssignedTask.objects.all().select_related('assigned_to', 'assigned_by')

    if role in ['employee', 'intern'] and employee:
        tasks_qs = tasks_qs.filter(
            Q(assigned_to=employee) | (Q(department__iexact=employee.department or '') & Q(assigned_to__isnull=True))
        )
    elif role == 'manager' and employee:
        mgr_dept = employee.managed_department or employee.department or ''
        if mgr_dept:
            tasks_qs = tasks_qs.filter(Q(department__iexact=mgr_dept) | Q(assigned_by=employee))

    if dept_filter:
        tasks_qs = tasks_qs.filter(department__iexact=dept_filter)
    if status_filter:
        tasks_qs = tasks_qs.filter(status__iexact=status_filter)
    if emp_id_filter:
        tasks_qs = tasks_qs.filter(assigned_to_id=emp_id_filter)

    tasks_list = []
    for t in tasks_qs.order_by('-created_at')[:200]:
        tasks_list.append({
            'id': t.id,
            'title': t.title,
            'description': t.description or '',
            'department': t.department,
            'assigned_to_id': t.assigned_to_id,
            'assigned_to_name': t.assigned_to.name if t.assigned_to else 'All Team Members',
            'assigned_by_name': t.assigned_by.name if t.assigned_by else 'Management/HR',
            'task_type': t.task_type,
            'priority': t.priority,
            'due_date': t.due_date.isoformat() if t.due_date else None,
            'status': t.status,
            'is_flagged': t.is_flagged,
            'flag_reason': t.flag_reason or '',
            'completed_at': t.completed_at.isoformat() if t.completed_at else None,
            'created_at': t.created_at.strftime('%d-%b-%Y')
        })

    return JsonResponse({'tasks': tasks_list})


@csrf_exempt
@require_POST
def api_daily_tracker_flag_task(request):
    """
    Flags/unflags a task with a blocker or impediment reason.
    """
    user_obj, role, employee = _resolve_user_and_employee(request)
    if not user_obj:
        return JsonResponse({'error': 'Unauthorized'}, status=401)

    try:
        data = json.loads(request.body.decode('utf-8'))
    except Exception:
        return JsonResponse({'error': 'Invalid JSON body'}, status=400)

    task_id = data.get('task_id') or data.get('assigned_task_id')
    is_flagged = bool(data.get('is_flagged', True))
    flag_reason = (data.get('flag_reason') or '').strip()

    if not task_id:
        return JsonResponse({'error': 'Task ID is required'}, status=400)

    task = DailyAssignedTask.objects.filter(id=task_id).first()
    if not task:
        return JsonResponse({'error': 'Assigned task not found.'}, status=404)

    task.is_flagged = is_flagged
    task.flag_reason = flag_reason if is_flagged else ''
    if is_flagged:
        task.status = 'Flagged'
    elif task.status == 'Flagged':
        task.status = 'In Progress'
    task.save()

    return JsonResponse({
        'success': True,
        'message': f"Task {'flagged with blocker' if is_flagged else 'unflagged'}.",
        'task_id': task.id,
        'is_flagged': task.is_flagged,
        'flag_reason': task.flag_reason,
        'status': task.status
    })

