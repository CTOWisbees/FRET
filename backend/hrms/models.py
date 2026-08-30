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
