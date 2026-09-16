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
    is_active = models.BooleanField(default=True, verbose_name="Is active")
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='employee', verbose_name="Role")
    phone = models.CharField(max_length=30, blank=True, default='', verbose_name="Phone")
    emp_code = models.CharField(max_length=50, blank=True, default='', verbose_name="Employee Code")
    designation = models.CharField(max_length=150, blank=True, default='', verbose_name="Designation")
    department = models.CharField(max_length=100, blank=True, default='Operations', verbose_name="Department")
    assigned_role = models.ForeignKey(OperationalRole, on_delete=models.SET_NULL, null=True, blank=True, related_name='members')
    assigned_roles = models.ManyToManyField(OperationalRole, blank=True, related_name='members_multi')
    assigned_departments = models.JSONField(default=list, blank=True)
    assigned_modules = models.JSONField(default=list, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='Active')
    joining_date = models.DateField(default=timezone.now)
    avatar_url = models.CharField(max_length=255, blank=True, default='')
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
        return check_password(raw_password, self.password)

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
    priority = models.CharField(max_length=20, choices=PRIORITY_CHOICES, default='Medium')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='Todo')
    deadline = models.DateField(null=True, blank=True)
    estimated_hours = models.FloatField(default=0.0)
    tags = models.CharField(max_length=200, blank=True, default='')
    attachment_url = models.CharField(max_length=255, blank=True, default='')
    submission_notes = models.TextField(blank=True, default='')
    submission_link = models.CharField(max_length=255, blank=True, default='')
    completed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
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
    created_at = models.DateTimeField(auto_now_add=True)

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
    date = models.DateField(default=timezone.now)
    check_in_time = models.DateTimeField(null=True, blank=True)
    check_out_time = models.DateTimeField(null=True, blank=True)
    total_hours = models.FloatField(default=0.0)
    status = models.CharField(max_length=30, choices=STATUS_CHOICES, default='Checked In')
    work_mode = models.CharField(max_length=30, default='Office')
    notes = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-date', '-check_in_time']
        unique_together = ('user', 'date')

    def __str__(self):
        return f"Attendance: {self.user.name} on {self.date} ({self.status}) - {self.total_hours:.1f}h"
