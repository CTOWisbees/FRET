from django.db import models
from django.utils import timezone
from django.contrib.auth.hashers import make_password, check_password

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

    name = models.CharField(max_length=150)
    email = models.EmailField(unique=True)
    password = models.CharField(max_length=255)
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='employee')
    phone = models.CharField(max_length=30, blank=True, default='')
    emp_code = models.CharField(max_length=50, blank=True, default='')
    designation = models.CharField(max_length=150, blank=True, default='')
    department = models.CharField(max_length=100, blank=True, default='Operations')
    assigned_role = models.ForeignKey(OperationalRole, on_delete=models.SET_NULL, null=True, blank=True, related_name='members')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='Active')
    joining_date = models.DateField(default=timezone.now)
    avatar_url = models.CharField(max_length=255, blank=True, default='')
    skills = models.CharField(max_length=255, blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)

    def set_password(self, raw_password):
        self.password = make_password(raw_password)

    def check_password(self, raw_password):
        return check_password(raw_password, self.password)

    def __str__(self):
        return f"{self.name} ({self.role}) - {self.email}"


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

