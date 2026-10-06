from django.db import models
from django.utils import timezone
from django.contrib.auth.hashers import make_password, check_password


class Department(models.Model):
    name = models.CharField(max_length=150, unique=True, verbose_name="Name")
    page_key = models.CharField(max_length=150, unique=True, verbose_name="Page Key")
    is_active = models.BooleanField(default=True, verbose_name="Is Active")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Department"
        verbose_name_plural = "Departments"
        ordering = ['name']

    def __str__(self):
        return self.name


class OperationalRole(models.Model):
    title = models.CharField(max_length=150)
    department = models.CharField(max_length=100, default='Operations')
    description = models.TextField(blank=True, default='')
    level = models.CharField(max_length=50, default='Intern')  # Intern, Junior, Mid, Senior, Lead
    permissions = models.JSONField(default=list, blank=True)
    responsibilities = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.title} ({self.department})"


class OperationUser(models.Model):
    ROLE_CHOICES = [
        ('admin', 'Admin / Operations Manager'),
        ('employee', 'Employee / Team Member'),
    ]

    STATUS_CHOICES = [
        ('Active', 'Active'),
        ('Inactive', 'Inactive'),
        ('On Leave', 'On Leave'),
    ]

    name = models.CharField(max_length=150, verbose_name="Name")
    full_name = models.CharField(max_length=150, blank=True, default='', verbose_name="Full name")
    email = models.EmailField(unique=True, verbose_name="Email")
    password = models.CharField(max_length=255, verbose_name="Password")
    is_active = models.BooleanField(default=True, verbose_name="Is active", db_index=True)
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='employee', verbose_name="Role", db_index=True)
    is_superadmin = models.BooleanField(default=False, verbose_name="Is Superadmin")
    is_manager = models.BooleanField(default=False, verbose_name="Is Manager")
    managed_department = models.CharField(max_length=100, blank=True, null=True, verbose_name="Managed Department")
    managed_departments = models.JSONField(default=list, blank=True, verbose_name="Managed Departments List")
    emp_type = models.CharField(max_length=50, default='Normal', verbose_name="Employee Type")  # 'Intern' or 'Normal' or 'Employee'
    reporting_manager = models.ForeignKey('self', on_delete=models.SET_NULL, null=True, blank=True, related_name='direct_reports')

    phone = models.CharField(max_length=30, blank=True, default='', verbose_name="Phone")
    emp_code = models.CharField(max_length=50, blank=True, default='', verbose_name="Employee Code")
    designation = models.CharField(max_length=150, blank=True, default='', verbose_name="Designation")
    department = models.CharField(max_length=100, blank=True, default='Operations', verbose_name="Department", db_index=True)
    assigned_role = models.ForeignKey(OperationalRole, on_delete=models.SET_NULL, null=True, blank=True, related_name='members')
    assigned_roles = models.ManyToManyField(OperationalRole, blank=True, related_name='members_multi')
    assigned_departments = models.JSONField(default=list, blank=True)
    assigned_modules = models.JSONField(default=list, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='Active', db_index=True)
    joining_date = models.DateField(default=timezone.now)
    avatar_url = models.TextField(blank=True, default='')
    skills = models.CharField(max_length=255, blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "OP user"
        verbose_name_plural = "OP users"
        ordering = ['name', 'email']

    def save(self, *args, **kwargs):
        if not self.full_name and self.name:
            self.full_name = self.name
        elif self.full_name and not self.name:
            self.name = self.full_name
        elif self.full_name and self.name and self.full_name != self.name:
            self.name = self.full_name

        if self.is_active and self.status == 'Inactive':
            self.status = 'Active'
        elif not self.is_active and self.status == 'Active':
            self.status = 'Inactive'
        super().save(*args, **kwargs)

    def set_password(self, raw_password):
        self.password = make_password(raw_password)

    def check_password(self, raw_password):
        if not self.password or not raw_password:
            return False
        # 1. Django standard check_password
        try:
            if check_password(raw_password, self.password):
                return True
        except Exception:
            pass
        # 2. Werkzeug / Flask scrypt/pbkdf2 hash compatibility from FRET
        try:
            from werkzeug.security import check_password_hash as wz_check
            if wz_check(self.password, raw_password):
                # Auto-upgrade to Django password hash on successful login
                self.set_password(raw_password)
                self.save(update_fields=['password'])
                return True
        except Exception:
            pass
        # 3. Plaintext fallback if needed
        return self.password == raw_password


    def __str__(self):
        display_name = self.full_name or self.name or self.email
        return f"{display_name} ({self.email})"


# Alias for backward and OP naming compatibility
OPUser = OperationUser


class OPUserDepartmentAccess(models.Model):
    user = models.ForeignKey(
        OperationUser,
        on_delete=models.CASCADE,
        related_name='department_accesses',
        verbose_name="OP User"
    )
    department = models.ForeignKey(
        Department,
        on_delete=models.CASCADE,
        related_name='user_accesses',
        verbose_name="Department"
    )
    is_active = models.BooleanField(default=True, verbose_name="Is active")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "OP User Department Access"
        verbose_name_plural = "OP User Department Accesses"
        unique_together = ('user', 'department')
        ordering = ['user', 'department']

    def __str__(self):
        return f"{self.user.email} -> {self.department.name}"


class OPSession(models.Model):
    user = models.ForeignKey(
        OperationUser,
        on_delete=models.CASCADE,
        related_name='op_sessions',
        verbose_name="OP User"
    )
    session_token = models.CharField(max_length=255, unique=True, verbose_name="Session Token")
    ip_address = models.GenericIPAddressField(null=True, blank=True, verbose_name="IP Address")
    user_agent = models.TextField(blank=True, default='', verbose_name="User Agent")
    is_active = models.BooleanField(default=True, verbose_name="Is active")
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        verbose_name = "OP session"
        verbose_name_plural = "OP sessions"
        ordering = ['-created_at']

    def __str__(self):
        return f"Session: {self.user.email} ({self.session_token[:12]}...)"


class LoginOTP(models.Model):
    user = models.ForeignKey(
        OperationUser,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='login_otps',
        verbose_name="OP User"
    )
    email = models.EmailField(verbose_name="Email")
    otp_code = models.CharField(max_length=10, verbose_name="OTP Code")
    is_verified = models.BooleanField(default=False, verbose_name="Is verified")
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        verbose_name = "Login otp"
        verbose_name_plural = "Login otps"
        ordering = ['-created_at']

    def __str__(self):
        return f"OTP for {self.email}: {self.otp_code}"


class WorkTask(models.Model):
    PRIORITY_CHOICES = [
        ('Low', 'Low'),
        ('Medium', 'Medium'),
        ('High', 'High'),
        ('Urgent', 'Urgent'),
    ]

    STATUS_CHOICES = [
        ('Todo', 'To Do'),
        ('In Progress', 'In Progress'),
        ('Under Review', 'Under Review'),
        ('Completed', 'Completed'),
    ]

    title = models.CharField(max_length=200)
    description = models.TextField(blank=True, default='')
    assigned_to = models.ForeignKey(OperationUser, on_delete=models.CASCADE, related_name='assigned_tasks')
    created_by = models.ForeignKey(OperationUser, on_delete=models.SET_NULL, null=True, related_name='created_tasks')
    priority = models.CharField(max_length=20, choices=PRIORITY_CHOICES, default='Medium', db_index=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='Todo', db_index=True)
    deadline = models.DateField(null=True, blank=True)
    estimated_hours = models.FloatField(default=0.0)
    tags = models.CharField(max_length=200, blank=True, default='')
    attachment_url = models.CharField(max_length=255, blank=True, default='')
    submission_notes = models.TextField(blank=True, default='')
    submission_link = models.CharField(max_length=255, blank=True, default='')
    completed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"[{self.priority}] {self.title} -> {self.assigned_to.name} ({self.status})"


class WorkLog(models.Model):
    task = models.ForeignKey(WorkTask, on_delete=models.CASCADE, related_name='logs')
    user = models.ForeignKey(OperationUser, on_delete=models.CASCADE, related_name='work_logs')
    hours_spent = models.FloatField(default=0.0)
    work_summary = models.TextField()
    submission_link = models.CharField(max_length=255, blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Log by {self.user.name} for {self.task.title} ({self.hours_spent}h)"


class ActivityLog(models.Model):
    user = models.ForeignKey(OperationUser, on_delete=models.CASCADE, related_name='activities')
    action = models.CharField(max_length=150)
    details = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    def __str__(self):
        return f"[{self.created_at.strftime('%Y-%m-%d %H:%M')}] {self.user.name}: {self.action}"


class AttendanceRecord(models.Model):
    STATUS_CHOICES = [
        ('Checked In', 'Currently Working'),
        ('Completed', 'Shift Completed'),
        ('Half Day', 'Half Day'),
        ('Late', 'Late Check-In'),
    ]

    user = models.ForeignKey(OperationUser, on_delete=models.CASCADE, related_name='attendance_records')
    date = models.DateField(default=timezone.now, db_index=True)
    check_in_time = models.DateTimeField(null=True, blank=True)
    check_out_time = models.DateTimeField(null=True, blank=True)
    total_hours = models.FloatField(default=0.0)
    status = models.CharField(max_length=30, choices=STATUS_CHOICES, default='Checked In', db_index=True)
    work_mode = models.CharField(max_length=30, default='Office')
    notes = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-date', '-check_in_time']
        unique_together = ('user', 'date')

    def __str__(self):
        return f"Attendance: {self.user.name} on {self.date} ({self.status}) - {self.total_hours:.1f}h"


# ─────────────────────────────────────────────────────────────
# DEPARTMENT MANAGER APPOINTMENT MODULE
# ─────────────────────────────────────────────────────────────

class DepartmentManagerAssignment(models.Model):
    department = models.ForeignKey(Department, on_delete=models.CASCADE, related_name='manager_assignments')
    manager = models.ForeignKey(OperationUser, on_delete=models.CASCADE, related_name='department_managements')
    assigned_by = models.ForeignKey(OperationUser, on_delete=models.SET_NULL, null=True, blank=True, related_name='managers_appointed')
    is_active = models.BooleanField(default=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Department Manager Assignment"
        verbose_name_plural = "Department Manager Assignments"
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.manager.name} -> Manager of {self.department.name} (Active: {self.is_active})"


# ─────────────────────────────────────────────────────────────
# DAILY WORK TRACKER MODULE (Operations Portal BRD Implementation)
# ─────────────────────────────────────────────────────────────

class DailyTrackerConfig(models.Model):
    cutoff_hours = models.IntegerField(default=24)  # Hours past cutoff threshold
    task_types_json = models.TextField(default='["Major", "Minor", "Research", "Documentation", "Meeting", "Support"]')
    custom_fields_json = models.TextField(default='[]')  # List of {id, name, type, required}
    auto_lock_enabled = models.BooleanField(default=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Daily Tracker Config"
        verbose_name_plural = "Daily Tracker Configs"

    def __str__(self):
        return f"Daily Tracker Config (Cutoff: {self.cutoff_hours}h, Auto-Lock: {self.auto_lock_enabled})"


class DailyAssignedTask(models.Model):
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True, default='')
    department = models.CharField(max_length=100, db_index=True)
    assigned_by = models.ForeignKey(OperationUser, on_delete=models.CASCADE, related_name='ops_assigned_tasks_created')
    assigned_to = models.ForeignKey(OperationUser, on_delete=models.CASCADE, null=True, blank=True, related_name='ops_assigned_tasks_received')
    task_type = models.CharField(max_length=50, default='Major')
    priority = models.CharField(max_length=20, default='Normal', db_index=True)  # Low | Normal | High | Urgent
    due_date = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=30, default='Pending', db_index=True)  # Pending | In Progress | Completed | Flagged
    is_flagged = models.BooleanField(default=False)
    flag_reason = models.TextField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(default=timezone.now, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Daily Assigned Task"
        verbose_name_plural = "Daily Assigned Tasks"
        ordering = ['-created_at']

    def __str__(self):
        assignee = self.assigned_to.name if self.assigned_to else f"All {self.department}"
        return f"[{self.priority}] {self.title} -> {assignee} ({self.status})"


class DailyTrackerDay(models.Model):
    user = models.ForeignKey(OperationUser, on_delete=models.CASCADE, related_name='daily_trackers')
    date = models.DateField(db_index=True)
    day_number = models.IntegerField(default=1)  # Sequence / Day number (e.g. Day 1, Day 2)
    day_status = models.CharField(max_length=30, default='Working Day')  # Working Day | Weekly Off | Holiday | Leave | Other
    status = models.CharField(max_length=20, default='Draft', db_index=True)  # Draft | Submitted | Locked
    submitted_at = models.DateTimeField(null=True, blank=True)
    locked_at = models.DateTimeField(null=True, blank=True)
    manager_rating = models.IntegerField(default=0)  # 1 to 5 stars
    manager_remarks = models.TextField(null=True, blank=True)
    reviewed_by = models.CharField(max_length=150, null=True, blank=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Daily Tracker Day"
        verbose_name_plural = "Daily Tracker Days"
        unique_together = ('user', 'date')
        ordering = ['-date']

    @property
    def total_hours(self):
        if hasattr(self, '_prefetched_objects_cache') and 'tasks' in self._prefetched_objects_cache:
            return sum((task.hours_worked or 0) for task in self._prefetched_objects_cache['tasks'])
        return sum((task.hours_worked or 0) for task in self.tasks.all())

    @property
    def achievements_count(self):
        if hasattr(self, '_prefetched_objects_cache') and 'tasks' in self._prefetched_objects_cache:
            return sum(1 for task in self._prefetched_objects_cache['tasks'] if task.is_achievement)
        return sum(1 for task in self.tasks.all() if task.is_achievement)

    @property
    def tasks_count(self):
        if hasattr(self, '_prefetched_objects_cache') and 'tasks' in self._prefetched_objects_cache:
            return len(self._prefetched_objects_cache['tasks'])
        return len(self.tasks.all())

    def __str__(self):
        return f"{self.user.name} - {self.date} ({self.status}) [{self.total_hours:.1f}h]"


class DailyTaskRow(models.Model):
    tracker_day = models.ForeignKey(DailyTrackerDay, on_delete=models.CASCADE, related_name='tasks')
    assigned_task = models.ForeignKey(DailyAssignedTask, on_delete=models.SET_NULL, null=True, blank=True, related_name='daily_log_rows')
    task_description = models.TextField()
    task_type = models.CharField(max_length=50, default='Major')  # Major, Minor, Research, Documentation, Meeting, Support
    hours_worked = models.FloatField(default=0.0)  # 0 to 24 hours
    is_achievement = models.BooleanField(default=False)
    is_flagged = models.BooleanField(default=False)
    flag_reason = models.TextField(null=True, blank=True)
    remarks = models.TextField(null=True, blank=True)  # Blockers, dependencies, support required, delays, observations
    order = models.IntegerField(default=0)
    custom_data = models.TextField(null=True, blank=True, default='{}')  # JSON for dynamic custom fields

    class Meta:
        verbose_name = "Daily Task Row"
        verbose_name_plural = "Daily Task Rows"
        ordering = ['order', 'id']

    def __str__(self):
        return f"Row {self.order + 1}: {self.task_description[:40]} ({self.hours_worked}h)"


class DailyTrackerUnlockRequest(models.Model):
    tracker_day = models.ForeignKey(DailyTrackerDay, on_delete=models.CASCADE, related_name='unlock_requests')
    user = models.ForeignKey(OperationUser, on_delete=models.CASCADE, related_name='tracker_unlock_requests')
    reason = models.TextField()
    status = models.CharField(max_length=20, default='Pending')  # Pending | Approved | Rejected
    requested_at = models.DateTimeField(default=timezone.now)
    reviewed_by = models.CharField(max_length=150, null=True, blank=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)
    review_notes = models.TextField(null=True, blank=True)

    class Meta:
        verbose_name = "Daily Tracker Unlock Request"
        verbose_name_plural = "Daily Tracker Unlock Requests"
        ordering = ['-requested_at']

    def __str__(self):
        return f"Unlock Request by {self.user.name} for {self.tracker_day.date} ({self.status})"


class DailyTrackerAuditLog(models.Model):
    tracker_day = models.ForeignKey(DailyTrackerDay, on_delete=models.SET_NULL, null=True, blank=True, related_name='audit_logs')
    user = models.ForeignKey(OperationUser, on_delete=models.SET_NULL, null=True, blank=True)
    action = models.CharField(max_length=50)  # CREATED, DRAFT_SAVED, SUBMITTED, LOCKED, UNLOCK_REQUESTED, UNLOCKED, EDITED_AFTER_UNLOCK, MANAGER_REVIEW
    performed_by_name = models.CharField(max_length=150)
    performed_by_role = models.CharField(max_length=50)  # Employee | Intern | Reporting Manager | Operations Admin | Superadmin
    details = models.TextField(null=True, blank=True)
    ip_address = models.CharField(max_length=50, null=True, blank=True)
    timestamp = models.DateTimeField(default=timezone.now)

    class Meta:
        verbose_name = "Daily Tracker Audit Log"
        verbose_name_plural = "Daily Tracker Audit Logs"
        ordering = ['-timestamp']

    def __str__(self):
        return f"[{self.timestamp.strftime('%Y-%m-%d %H:%M')}] {self.performed_by_name} ({self.performed_by_role}): {self.action}"


class StockRecommendation(models.Model):
    RECOMMENDATION_CHOICES = [
        ('Buy', 'Buy'),
        ('Strong Buy', 'Strong Buy'),
        ('Accumulate', 'Accumulate'),
        ('Hold', 'Hold'),
        ('Sell', 'Sell'),
    ]
    STATUS_CHOICES = [
        ('Active', 'Active'),
        ('Target Hit', 'Target Hit'),
        ('Stop Loss Hit', 'Stop Loss Hit'),
        ('Closed', 'Closed'),
    ]
    created_by = models.ForeignKey(OperationUser, on_delete=models.SET_NULL, null=True, blank=True, related_name='stock_recommendations')
    symbol = models.CharField(max_length=50, verbose_name="Stock Symbol / Ticker")
    company_name = models.CharField(max_length=150, verbose_name="Company Name")
    sector = models.CharField(max_length=100, blank=True, default='Equities')
    client_name = models.CharField(max_length=150, blank=True, default='', verbose_name="Client / Portfolio Name")
    recommendation_type = models.CharField(max_length=30, choices=RECOMMENDATION_CHOICES, default='Buy')
    recommendation_date = models.DateField(default=timezone.now, verbose_name="Recommended Date")
    recommended_price = models.DecimalField(max_digits=12, decimal_places=2, verbose_name="Recommended Buying Price (₹)")
    target_price = models.DecimalField(max_digits=12, decimal_places=2, verbose_name="Target Price (₹)")
    stop_loss = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True, verbose_name="Stop Loss (₹)")
    time_horizon = models.CharField(max_length=50, default='3 Months', verbose_name="Time Horizon")
    current_price = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True, verbose_name="Last Tracked Market Price")
    last_price_update = models.DateTimeField(null=True, blank=True)
    status = models.CharField(max_length=30, choices=STATUS_CHOICES, default='Active')
    exit_price = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    exit_date = models.DateField(null=True, blank=True)
    notes = models.TextField(blank=True, default='', verbose_name="Investment Rationale")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Stock Recommendation"
        verbose_name_plural = "Stock Recommendations"
        ordering = ['-recommendation_date', '-created_at']

    def __str__(self):
        return f"{self.symbol} ({self.recommendation_type} @ ₹{self.recommended_price}) on {self.recommendation_date}"

