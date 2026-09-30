from django.db import models
from django.utils import timezone
from werkzeug.security import generate_password_hash, check_password_hash

class HR(models.Model):
    id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=100)
    email = models.CharField(max_length=120, unique=True)
    password_hash = models.CharField(max_length=200)
    designation = models.CharField(max_length=100, default='HR Manager')
    department = models.CharField(max_length=100, default='Human Resources')
    signature_path = models.CharField(max_length=200, null=True, blank=True)
    signature_data = models.BinaryField(null=True, blank=True)
    phone = models.CharField(max_length=20, null=True, blank=True)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = 'hr'

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

    @property
    def is_authenticated(self):
        return True

    @property
    def is_active(self):
        return True

    @property
    def is_anonymous(self):
        return False

    def get_id(self):
        return str(self.id)


class Employee(models.Model):
    id = models.AutoField(primary_key=True)
    emp_id = models.CharField(max_length=20, unique=True, null=True, blank=True)
    name = models.CharField(max_length=100)
    email = models.CharField(max_length=120, null=True, blank=True)
    phone = models.CharField(max_length=20, null=True, blank=True)
    department = models.CharField(max_length=100, null=True, blank=True)
    designation = models.CharField(max_length=100, null=True, blank=True)
    salary = models.FloatField(default=0)
    joining_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=20, default='Active')
    offer_sent = models.BooleanField(default=False)
    nda_sent = models.BooleanField(default=False)
    created_at = models.DateTimeField(default=timezone.now)
    created_by = models.ForeignKey(HR, on_delete=models.SET_NULL, null=True, db_column='created_by')
    emp_type = models.CharField(max_length=20, default='Normal')  # 'Intern' or 'Normal'
    gender = models.CharField(max_length=10, default='female')
    profile_pic_data = models.BinaryField(null=True, blank=True)
    profile_pic_mime = models.CharField(max_length=20, null=True, blank=True)
    blood_group = models.CharField(max_length=5, null=True, blank=True)
    remarks = models.TextField(null=True, blank=True)
    rating = models.IntegerField(default=0)
    is_manager = models.BooleanField(default=False)
    managed_department = models.CharField(max_length=100, null=True, blank=True)
    reporting_manager = models.ForeignKey('self', on_delete=models.SET_NULL, null=True, blank=True, related_name='direct_reports')

    class Meta:
        db_table = 'employee'


class EmployeeAccount(models.Model):
    id = models.AutoField(primary_key=True)
    employee = models.OneToOneField(Employee, on_delete=models.CASCADE, db_column='employee_id', related_name='account')
    email = models.CharField(max_length=120, unique=True)
    password_hash = models.CharField(max_length=255, null=True, blank=True)
    is_active = models.BooleanField(default=True)
    must_change_password = models.BooleanField(default=True)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = 'employee_accounts'

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

    @property
    def is_authenticated(self):
        return True

    @property
    def is_anonymous(self):
        return False

    def get_id(self):
        return str(self.id)


class Attendance(models.Model):
    id = models.AutoField(primary_key=True)
    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, db_column='employee_id', related_name='attendance_records')
    date = models.DateField(default=timezone.now)
    check_in = models.DateTimeField(null=True, blank=True)
    check_out = models.DateTimeField(null=True, blank=True)
    status = models.CharField(max_length=20, default='Present')

    class Meta:
        db_table = 'attendance'


class LeaveRequest(models.Model):
    id = models.AutoField(primary_key=True)
    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, db_column='employee_id', related_name='leave_requests', null=True)
    leave_type = models.CharField(max_length=50, null=True, blank=True)
    from_date = models.DateField(null=True, blank=True)
    to_date = models.DateField(null=True, blank=True)
    reason = models.TextField(null=True, blank=True)
    status = models.CharField(max_length=20, default='Pending')
    applied_on = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = 'leave_request'


class EmailConfig(models.Model):
    id = models.AutoField(primary_key=True)
    sender_email = models.CharField(max_length=120, null=True, blank=True)
    tenant_id = models.CharField(max_length=200, null=True, blank=True)
    client_id = models.CharField(max_length=200, null=True, blank=True)
    client_secret = models.CharField(max_length=500, null=True, blank=True)
    hr = models.ForeignKey(HR, on_delete=models.CASCADE, db_column='hr_id', null=True, blank=True)

    class Meta:
        db_table = 'email_config'


class CompanySettings(models.Model):
    id = models.AutoField(primary_key=True)
    company_name = models.CharField(max_length=200, default='Wisbees')
    company_address = models.TextField(default=' Mumbai, Maharashtra 400001')
    company_email = models.CharField(max_length=120, default='info@wisbees.com')
    company_phone = models.CharField(max_length=20, default='+91 0000000000')
    offer_letter_template = models.TextField(null=True, blank=True)
    email_template = models.TextField(null=True, blank=True)
    nda_path = models.CharField(max_length=200, null=True, blank=True)
    letterhead_path = models.CharField(max_length=200, null=True, blank=True)
    nda_data = models.BinaryField(null=True, blank=True)
    nda_filename = models.CharField(max_length=200, null=True, blank=True)
    letterhead_data = models.BinaryField(null=True, blank=True)
    letterhead_mime = models.CharField(max_length=20, null=True, blank=True)
    roles_json = models.TextField(null=True, blank=True)
    departments_json = models.TextField(null=True, blank=True)
    durations_json = models.TextField(null=True, blank=True)

    class Meta:
        db_table = 'company_settings'


class OfferLetterDraft(models.Model):
    id = models.AutoField(primary_key=True)
    employee = models.OneToOneField(Employee, on_delete=models.CASCADE, db_column='employee_id', related_name='offer_draft')
    role_key = models.CharField(max_length=120, null=True, blank=True)
    role_title = models.CharField(max_length=200, null=True, blank=True)
    full_letter_text = models.TextField(null=True, blank=True)
    email_body_text = models.TextField(null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'offer_letter_draft'


class Announcement(models.Model):
    id = models.AutoField(primary_key=True)
    title = models.CharField(max_length=200)
    message = models.TextField()
    audience = models.CharField(max_length=20, default='Everyone')  # Everyone | Employees | Interns
    priority = models.CharField(max_length=20, default='Normal')    # Normal | Important | Urgent
    posted_by = models.CharField(max_length=100, null=True, blank=True)
    created_at = models.DateTimeField(default=timezone.now)
    is_active = models.BooleanField(default=True)
    expires_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'announcements'


class ResearchReport(models.Model):
    id = models.AutoField(primary_key=True)
    company_name = models.CharField(max_length=200, null=True, blank=True)
    form_data = models.TextField()  # JSON dump of submitted form
    chart_filename = models.CharField(max_length=255, null=True, blank=True)
    created_by = models.ForeignKey(EmployeeAccount, on_delete=models.SET_NULL, db_column='created_by', null=True, blank=True)
    author_name = models.CharField(max_length=100, null=True, blank=True)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'research_reports'


class NewsletterJob(models.Model):
    id = models.AutoField(primary_key=True)
    post_id = models.CharField(max_length=100, null=True, blank=True)
    post_slug = models.CharField(max_length=200, db_index=True)
    subject = models.CharField(max_length=300, null=True, blank=True)
    custom_message = models.TextField(null=True, blank=True)
    status = models.CharField(max_length=20, default='queued')  # queued|sending|completed|failed
    total = models.IntegerField(default=0)
    sent_count = models.IntegerField(default=0)
    failed_count = models.IntegerField(default=0)
    error = models.TextField(null=True, blank=True)
    created_by = models.CharField(max_length=120, null=True, blank=True)
    created_at = models.DateTimeField(default=timezone.now)
    finished_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'newsletter_job'


class NewsletterDelivery(models.Model):
    id = models.AutoField(primary_key=True)
    job = models.ForeignKey(NewsletterJob, on_delete=models.CASCADE, db_column='job_id', db_index=True)
    email = models.CharField(max_length=200)
    name = models.CharField(max_length=200, null=True, blank=True)
    status = models.CharField(max_length=20, default='pending')  # pending|sent|failed
    error = models.CharField(max_length=300, null=True, blank=True)
    attempted_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'newsletter_delivery'


class NewsletterUnsubscribe(models.Model):
    id = models.AutoField(primary_key=True)
    email = models.CharField(max_length=200, unique=True, db_index=True)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = 'newsletter_unsubscribe'


# ============================================================================
# DAILY WORK TRACKER MODULE (BRD Implementation)
# ============================================================================

class DailyTrackerDay(models.Model):
    id = models.AutoField(primary_key=True)
    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, db_column='employee_id', related_name='daily_trackers')
    date = models.DateField(db_index=True)
    day_number = models.IntegerField(default=1)  # Sequence / Day number (e.g. Day 1, Day 2)
    day_status = models.CharField(max_length=30, default='Working Day')  # Working Day | Weekly Off | Holiday | Leave | Other
    status = models.CharField(max_length=20, default='Draft')  # Draft | Submitted | Locked
    submitted_at = models.DateTimeField(null=True, blank=True)
    locked_at = models.DateTimeField(null=True, blank=True)
    manager_rating = models.IntegerField(default=0)  # 1 to 5 stars
    manager_remarks = models.TextField(null=True, blank=True)
    reviewed_by = models.CharField(max_length=100, null=True, blank=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'daily_tracker_day'
        unique_together = ('employee', 'date')

    @property
    def total_hours(self):
        return sum((task.hours_worked or 0) for task in self.tasks.all())

    @property
    def achievements_count(self):
        return self.tasks.filter(is_achievement=True).count()

    @property
    def tasks_count(self):
        return self.tasks.count()


class DailyAssignedTask(models.Model):
    id = models.AutoField(primary_key=True)
    title = models.CharField(max_length=255)
    description = models.TextField()
    department = models.CharField(max_length=100, db_index=True)
    assigned_by = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name='assigned_tasks_created')
    assigned_to = models.ForeignKey(Employee, on_delete=models.CASCADE, null=True, blank=True, related_name='assigned_tasks_received')
    task_type = models.CharField(max_length=50, default='Major')
    priority = models.CharField(max_length=20, default='Normal')  # Normal | High | Urgent
    due_date = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=30, default='Pending')  # Pending | In Progress | Completed | Flagged
    is_flagged = models.BooleanField(default=False)
    flag_reason = models.TextField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'daily_assigned_task'
        ordering = ['-created_at']


class DailyTaskRow(models.Model):
    id = models.AutoField(primary_key=True)
    tracker_day = models.ForeignKey(DailyTrackerDay, on_delete=models.CASCADE, db_column='tracker_day_id', related_name='tasks')
    assigned_task = models.ForeignKey(DailyAssignedTask, on_delete=models.SET_NULL, null=True, blank=True, related_name='daily_log_rows')
    task_description = models.TextField()
    task_type = models.CharField(max_length=50, default='Major')  # Major / Minor or Admin Configured
    hours_worked = models.FloatField(default=0.0)  # 0 to 24 hours
    is_achievement = models.BooleanField(default=False)
    is_flagged = models.BooleanField(default=False)
    flag_reason = models.TextField(null=True, blank=True)
    remarks = models.TextField(null=True, blank=True)  # Blockers, dependencies, support required, delays, observations
    order = models.IntegerField(default=0)
    custom_data = models.TextField(null=True, blank=True)  # JSON for dynamic custom fields

    class Meta:
        db_table = 'daily_task_row'
        ordering = ['order', 'id']


class DailyTrackerUnlockRequest(models.Model):
    id = models.AutoField(primary_key=True)
    tracker_day = models.ForeignKey(DailyTrackerDay, on_delete=models.CASCADE, db_column='tracker_day_id', related_name='unlock_requests')
    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, db_column='employee_id', related_name='tracker_unlock_requests')
    reason = models.TextField()
    status = models.CharField(max_length=20, default='Pending')  # Pending | Approved | Rejected
    requested_at = models.DateTimeField(default=timezone.now)
    reviewed_by = models.CharField(max_length=100, null=True, blank=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)
    review_notes = models.TextField(null=True, blank=True)

    class Meta:
        db_table = 'daily_tracker_unlock_request'
        ordering = ['-requested_at']


class DailyTrackerAuditLog(models.Model):
    id = models.AutoField(primary_key=True)
    tracker_day = models.ForeignKey(DailyTrackerDay, on_delete=models.SET_NULL, null=True, blank=True, db_column='tracker_day_id', related_name='audit_logs')
    employee = models.ForeignKey(Employee, on_delete=models.SET_NULL, null=True, blank=True, db_column='employee_id')
    action = models.CharField(max_length=50)  # CREATED, DRAFT_SAVED, SUBMITTED, LOCKED, UNLOCK_REQUESTED, UNLOCKED, EDITED_AFTER_UNLOCK, MANAGER_REVIEW
    performed_by_name = models.CharField(max_length=100)
    performed_by_role = models.CharField(max_length=50)  # Employee | Intern | Reporting Manager | HR / Admin
    details = models.TextField(null=True, blank=True)
    ip_address = models.CharField(max_length=50, null=True, blank=True)
    timestamp = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = 'daily_tracker_audit_log'
        ordering = ['-timestamp']


class DailyTrackerConfig(models.Model):
    id = models.AutoField(primary_key=True)
    cutoff_hours = models.IntegerField(default=24)  # Hours past midnight or tracker date after which tracker locks
    task_types_json = models.TextField(default='["Major", "Minor"]')
    custom_fields_json = models.TextField(default='[]')  # List of {id, name, type, required}
    auto_lock_enabled = models.BooleanField(default=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'daily_tracker_config'

