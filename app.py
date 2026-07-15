from xmlrpc import server
from openpyxl import reader
import requests
import base64
from flask import Flask, render_template, request, redirect, url_for, flash, jsonify, send_file, session
from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager, UserMixin, config, login_user, logout_user, login_required, current_user
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.utils import secure_filename
from datetime import datetime, date
import os
import json
import base64
from io import BytesIO
import pandas as pd
from docx import Document
from pdf_generator import generate_experience_letter_pdf, generate_offer_letter_pdf, ROLE_KEYS
from datetime import datetime, timedelta
import requests
import base64

app = Flask(__name__)

# Absolute paths — DB is always in the same place no matter where you run from
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, 'hrms.db')
UPLOAD_DIR = os.path.join(BASE_DIR, 'uploads')

app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'hrms-secret-key-2024')

# Database: use DATABASE_URL (e.g. Neon Postgres) in production, fall back to local SQLite.
_db_url = os.environ.get('DATABASE_URL')
if _db_url:
    # SQLAlchemy needs the 'postgresql://' scheme; some providers hand out 'postgres://'.
    if _db_url.startswith('postgres://'):
        _db_url = _db_url.replace('postgres://', 'postgresql://', 1)
    app.config['SQLALCHEMY_DATABASE_URI'] = _db_url
else:
    app.config['SQLALCHEMY_DATABASE_URI'] = f'sqlite:///{DB_PATH}'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
# Neon (and most serverless Postgres) silently closes idle SSL connections;
# pre_ping catches the dead connection and reconnects instead of a 500.
app.config['SQLALCHEMY_ENGINE_OPTIONS'] = {'pool_pre_ping': True, 'pool_recycle': 280}
app.config['UPLOAD_FOLDER'] = UPLOAD_DIR
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024

db = SQLAlchemy(app)

from newsletter import init_newsletter
init_newsletter(app, db)

login_manager = LoginManager(app)
login_manager.login_view = 'login'
@login_manager.user_loader
def load_user(user_id):
    """
    Polymorphic user loader. Checks the HR table first; if no match is found,
    it checks the EmployeeAccount table so Interns don't get booted out.
    """
    # Try looking in HR table
    user = HR.query.get(int(user_id))
    if user:
        return user
        
    # Try looking in EmployeeAccount table
    account = EmployeeAccount.query.get(int(user_id))
    if account:
        # We attach the underlying employee details directly onto the account object
        # so things like current_user.designation work perfectly in your templates!
        emp = Employee.query.get(account.employee_id)
        if emp:
            account.designation = emp.designation
            account.department = emp.department
            account.name = emp.name
        return account
        
    return None


ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'pdf'}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def _materialize(data, path):
    """Write bytes to the (ephemeral) disk so libraries that need a file path work.
    Returns the path, or None if there's no data."""
    if not data:
        return None
    os.makedirs(os.path.dirname(path), exist_ok=True)
    if not os.path.exists(path):
        with open(path, 'wb') as f:
            f.write(data)
    return path

def hydrate_hr_signature(hr):
    """Ensure the HR signature exists on disk (from DB bytes) before PDF generation."""
    if hr is not None and getattr(hr, 'signature_data', None):
        hr.signature_path = _materialize(
            hr.signature_data,
            os.path.join(UPLOAD_DIR, 'signatures', f'sig_{hr.id}.png')
        )
    return getattr(hr, 'signature_path', None) if hr is not None else None

def hydrate_company_files(settings):
    """Ensure letterhead/NDA exist on disk (from DB bytes) before PDF generation."""
    if settings is None:
        return
    if getattr(settings, 'letterhead_data', None):
        ext = (getattr(settings, 'letterhead_mime', None) or 'png')
        settings.letterhead_path = _materialize(
            settings.letterhead_data,
            os.path.join(UPLOAD_DIR, 'attachments', f'letterhead_{settings.id}.{ext}')
        )
    if getattr(settings, 'nda_data', None):
        settings.nda_path = _materialize(
            settings.nda_data,
            os.path.join(UPLOAD_DIR, 'attachments', f'nda_{settings.id}.pdf')
        )

# ─────────────── MODELS ───────────────

class HR(UserMixin, db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(200), nullable=False)
    designation = db.Column(db.String(100), default='HR Manager')
    department = db.Column(db.String(100), default='Human Resources')
    signature_path = db.Column(db.String(200))
    signature_data = db.Column(db.LargeBinary)  # persistent store (Render free has no disk)
    phone = db.Column(db.String(20))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

class Employee(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    emp_id = db.Column(db.String(20), unique=True)
    name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(120))
    phone = db.Column(db.String(20))
    department = db.Column(db.String(100))
    designation = db.Column(db.String(100))
    salary = db.Column(db.Float, default=0)
    joining_date = db.Column(db.Date)
    end_date = db.Column(db.Date)
    status = db.Column(db.String(20), default='Active')
    offer_sent = db.Column(db.Boolean, default=False)
    nda_sent = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    created_by = db.Column(db.Integer, db.ForeignKey('hr.id'))
    emp_type = db.Column(db.String(20), default='Normal')  # 'Intern' or 'Normal'
    gender = db.Column(db.String(10), nullable=False, default='female')

class EmployeeAccount(UserMixin, db.Model):
    __tablename__ = 'employee_accounts'
    id = db.Column(db.Integer, primary_key=True)
    employee_id = db.Column(db.Integer,db.ForeignKey('employee.id'),unique=True,nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(255))
    is_active = db.Column(db.Boolean, default=True)
    must_change_password = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime,default=datetime.utcnow)
    employee = db.relationship('Employee',backref='account')

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(
            self.password_hash,
            password
        )

class Attendance(db.Model):
    id = db.Column(db.Integer, primary_key=True)

    employee_id = db.Column(
        db.Integer,
        db.ForeignKey('employee.id'),
        nullable=False
    )

    date = db.Column(
        db.Date,
        default=date.today
    )

    check_in = db.Column(
        db.DateTime
    )

    check_out = db.Column(
        db.DateTime
    )

    status = db.Column(
        db.String(20),
        default='Present'
    )

    employee = db.relationship(
        'Employee',
        backref='attendance_records'
    )

class LeaveRequest(db.Model):

    id = db.Column(
        db.Integer,
        primary_key=True
    )

    employee_id = db.Column(
        db.Integer,
        db.ForeignKey('employee.id')
    )

    leave_type = db.Column(
        db.String(50)
    )

    from_date = db.Column(
        db.Date
    )

    to_date = db.Column(
        db.Date
    )

    reason = db.Column(
        db.Text
    )

    status = db.Column(
        db.String(20),
        default='Pending'
    )

    applied_on = db.Column(
        db.DateTime,
        default=datetime.utcnow
    )

    employee = db.relationship(
        'Employee',
        backref='leave_requests'
    )


class EmailConfig(db.Model):
    id = db.Column(db.Integer,primary_key=True)
    sender_email = db.Column(db.String(120))
    tenant_id = db.Column(db.String(200))
    client_id = db.Column(db.String(200))
    client_secret = db.Column(db.String(500))
    hr_id = db.Column(db.Integer,db.ForeignKey('hr.id') )

class CompanySettings(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    company_name = db.Column(db.String(200), default='Wisbees')
    company_address = db.Column(db.Text, default=' Mumbai, Maharashtra 400001')
    company_email = db.Column(db.String(120), default='info@wisbees.com')
    company_phone = db.Column(db.String(20), default='+91 0000000000')
    offer_letter_template = db.Column(db.Text)
    email_template = db.Column(db.Text)
    nda_path = db.Column(db.String(200))
    letterhead_path = db.Column(db.String(200))
    # Persistent binary stores (Render free tier has no permanent disk)
    nda_data = db.Column(db.LargeBinary)
    nda_filename = db.Column(db.String(200))
    letterhead_data = db.Column(db.LargeBinary)
    letterhead_mime = db.Column(db.String(20))

class Announcement(db.Model):
    __tablename__ = "announcements"

    id = db.Column(db.Integer, primary_key=True)

    title = db.Column(db.String(200), nullable=False)

    message = db.Column(db.Text, nullable=False)

    audience = db.Column(
        db.String(20),
        default="Everyone"
    )       # Everyone | Employees | Interns

    priority = db.Column(
        db.String(20),
        default="Normal"
    )       # Normal | Important | Urgent

    posted_by = db.Column(
        db.String(100)
    )

    created_at = db.Column(
        db.DateTime,
        default=datetime.utcnow
    )

    is_active = db.Column(
        db.Boolean,
        default=True
    )

    expires_at = db.Column(db.DateTime) 

def get_graph_token():
    """
    Fetches an application-level OAuth2 access token from Microsoft identity platform
    using the credentials configured by the current logged-in user.
    """
    import requests
    
    # Query your newly migrated configuration table
    config = EmailConfig.query.filter_by(hr_id=current_user.id).first()
    if not config or not config.tenant_id or not config.client_id or not config.client_secret:
        raise Exception("Microsoft Graph API authentication parameters are missing from EmailConfig database.")

    # Microsoft OAuth v2Token endpoint token request architecture
    url = f"https://login.microsoftonline.com/{config.tenant_id}/oauth2/v2.0/token"
    
    headers = {
        "Content-Type": "application/x-www-form-urlencoded"
    }
    
    payload = {
        "client_id": config.client_id,
        "scope": "https://graph.microsoft.com/.default",
        "client_secret": config.client_secret,
        "grant_type": "client_credentials"
    }
    
    response = requests.post(url, headers=headers, data=payload)
    
    if response.status_code != 200:
        raise Exception(f"Failed to retrieve Azure token: {response.text}")
        
    token_json = response.json()
    return token_json.get("access_token")


# ─────────────── AUTH ROUTES ───────────────

@app.route('/')
def index():
    if current_user.is_authenticated:
        return redirect(url_for('dashboard'))
    return redirect(url_for('login'))

@app.route('/login', methods=['GET', 'POST'])
def login():
    if current_user.is_authenticated:
        return redirect(url_for('dashboard'))
    if request.method == 'POST':

        email = request.form.get('email')
        password = request.form.get('password')
        login_type = request.form.get('login_type', 'hr')

        if login_type == 'hr':

            user = HR.query.filter_by(email=email).first()

            if user and user.check_password(password):
                login_user(user)
                return redirect(url_for('dashboard'))

            flash('Invalid HR credentials', 'error')

        else:

            account = EmployeeAccount.query.filter_by(
                email=email,
                is_active=True
            ).first()

            if account and account.check_password(password):
                if account.must_change_password:

                    session['employee_id'] = account.employee_id

                    return redirect(
                        url_for('change_password')
                    )
                login_user(account)
                session['employee_id'] = account.employee_id

                employee = Employee.query.get(
                    account.employee_id
                )

                if employee.emp_type == 'Intern':
                    return redirect(url_for('intern_dashboard'))

                return redirect(url_for('employee_dashboard'))

            flash('Invalid Employee credentials', 'error')

    return render_template('login.html')

@app.route('/employee-login', methods=['GET', 'POST'])
def employee_login():

    if request.method == 'POST':

        email = request.form.get('email')
        password = request.form.get('password')

        account = EmployeeAccount.query.filter_by(
            email=email,
            is_active=True
        ).first()

        if account and account.check_password(password):
            if account.must_change_password:

                session['employee_id'] = account.employee_id

                return redirect(
                    url_for('change_password')
                )
            
            login_user(account)
            session['employee_id'] = account.employee_id

            employee = Employee.query.get(account.employee_id)

            if employee.emp_type == "Intern":
                return redirect(url_for('intern_dashboard'))

            return redirect(url_for('employee_dashboard'))

        flash('Invalid credentials', 'error')

    return render_template('employee_login.html')

@app.route('/change-password', methods=['GET', 'POST'])
def change_password():

    if 'employee_id' not in session:
        return redirect(url_for('login'))

    employee = Employee.query.get(
        session['employee_id']
    )

    account = EmployeeAccount.query.filter_by(
        employee_id=employee.id
    ).first()

    if request.method == 'POST':

        new_password = request.form.get(
            'new_password'
        )

        confirm_password = request.form.get(
            'confirm_password'
        )

        if new_password != confirm_password:

            flash(
                'Passwords do not match',
                'error'
            )

            return redirect(
                url_for('change_password')
            )

        account.set_password(new_password)

        account.must_change_password = False

        db.session.commit()

        flash(
            'Password updated successfully',
            'success'
        )

        return redirect(
            url_for('employee_dashboard')
        )

    return render_template(
        'change_password.html'
    )

from datetime import date

@app.route('/employee-dashboard')
def employee_dashboard():

    if 'employee_id' not in session:
        return redirect(url_for('login'))

    employee = Employee.query.get(
        session['employee_id']
    )

    today_attendance = Attendance.query.filter_by(
        employee_id=employee.id,
        date=date.today()
    ).first()
    leave_requests = LeaveRequest.query\
        .filter_by(
            employee_id=employee.id
        )\
        .order_by(
            LeaveRequest.applied_on.desc()
        )\
        .limit(5)\
        .all()

    announcements = Announcement.query\
        .order_by(
            Announcement.created_at.desc()
        )\
        .limit(5)\
        .all()
    
    today = date.today()

    leave_request_list = LeaveRequest.query\
        .filter(
            LeaveRequest.employee_id == employee.id,
            LeaveRequest.to_date >= today
        )\
        .order_by(
            LeaveRequest.from_date.asc()
        )\
        .all()
    
    today = date.today()

    monthly_attendance = Attendance.query.filter(
        Attendance.employee_id == employee.id,
        db.extract('month', Attendance.date) == today.month,
        db.extract('year', Attendance.date) == today.year
    ).all()

    present_days = len([
        a for a in monthly_attendance
        if a.status == "Present"
    ])

    total_days = len(monthly_attendance)

    attendance_percent = round(
        (present_days / total_days * 100),
        2
    ) if total_days else 0

    approved_leaves = LeaveRequest.query.filter(
        LeaveRequest.employee_id == employee.id,
        LeaveRequest.status == "Approved"
    ).all()

    leaves_taken = sum(
        (leave.to_date - leave.from_date).days + 1
        for leave in approved_leaves
    )

    leave_balance = max(
        12 - leaves_taken,
        0
    )  

    pending_leaves = LeaveRequest.query.filter(
        LeaveRequest.employee_id == employee.id,
        LeaveRequest.status == "Pending"
    ).count()  

    latest_announcements = Announcement.query.filter(
        Announcement.is_active == True,
        (
            (Announcement.audience == "Everyone") |
            (Announcement.audience == employee.emp_type)
        )
    ).order_by(
        Announcement.created_at.desc()
    ).limit(3).all()
    return render_template(
        'employee_dashboard.html',
        employee=employee,
        now_hour=datetime.now().hour,
        today_attendance=today_attendance,
        leave_requests=leave_requests,
        announcements=announcements,
        leave_request_list=leave_request_list,
        attendance_percent=attendance_percent,
        leave_balance=leave_balance,
        leaves_taken=leaves_taken,
        pending_leaves=pending_leaves,
        latest_announcements=latest_announcements
    )
    

@app.route('/intern-dashboard')
def intern_dashboard():
    return redirect(url_for('employee_dashboard'))

@app.route('/employee-logout')
def employee_logout():

    session.pop('employee_id', None)

    logout_user()

    session.clear()

    return redirect(
        url_for('login')
    )


@app.route('/register', methods=['GET', 'POST'])
def register():
    if request.method == 'POST':
        name = request.form.get('name')
        email = request.form.get('email')
        password = request.form.get('password')
        designation = request.form.get('designation', 'HR Manager')
        phone = request.form.get('phone')

        if HR.query.filter_by(email=email).first():
            flash('Email already registered', 'error')
            return render_template('register.html')

        hr = HR(name=name, email=email, designation=designation, phone=phone)
        hr.set_password(password)

        # Handle signature upload (stored in DB so it survives restarts)
        if 'signature' in request.files:
            file = request.files['signature']
            if file and file.filename and allowed_file(file.filename):
                hr.signature_data = file.read()

        # 1. Stage the unverified user details inside a temporary flask session dictionary
        session['pending_hr_data'] = {
            'name': name,
            'email': email,
            'designation': designation,
            'phone': phone,
            'password': password,
            # Read and encode the signature bytes if uploaded, so it can be reconstructed later
            'signature_data': base64.b64encode(request.files['signature'].read()).decode('utf-8') if ('signature' in request.files and request.files['signature'].filename) else None
        }
        
        # 2. Generate a secure 6-digit verification passkey code
        import random
        otp = str(random.randint(100000, 999999))
        session['hr_registration_otp'] = otp
        
        # 3. Fire the authorization notification directly to cto@wisbees.com
        try:
            # We fetch a dynamic token via your systemic OAuth generator
            # If a primary config hasn't been set up yet, fall back to environment configurations
            tenant_id = os.environ.get('AZURE_TENANT_ID')
            client_id = os.environ.get('AZURE_CLIENT_ID')
            client_secret = os.environ.get('AZURE_CLIENT_SECRET')
            sender_email = os.environ.get('AZURE_SENDER_EMAIL')
            
            token_url = f"https://login.microsoftonline.com/{tenant_id}/oauth2/v2.0/token"
            token_res = requests.post(token_url, data={
                'grant_type': 'client_credentials',
                'client_id': client_id,
                'client_secret': client_secret,
                'scope': 'https://graph.microsoft.com/.default'
            }).json()
            
            access_token = token_res.get('access_token')
            if not access_token:
                raise Exception("Could not retrieve application-level graph access token.")
                
            send_url = f"https://graph.microsoft.com/v1.0/users/{sender_email}/sendMail"
            email_payload = {
                "message": {
                    "subject": "FRET Portal Security — New HR Profile Registration Request",
                    "body": {
                        "contentType": "HTML",
                        "content": f"""
                        <div style="font-family: Arial, sans-serif; max-width: 500px; color: #333;">
                            <h3>HR Profile Access Verification Request</h3>
                            <p>An administrator profile registration request was initiated on the FRET network system.</p>
                            <p><strong>Name:</strong> {name}<br><strong>Email:</strong> {email}</p>
                            <p>Please authorize this administrative privilege request by providing the applicant with the following passkey code:</p>
                            <h2 style="color: #0E9F6E; font-size: 26px; letter-spacing: 2px; margin: 15px 0;">{otp}</h2>
                            <p style="font-size: 11px; color: #777;">If this session was not requested by your digital staff, please audit portal logs.</p>
                        </div>
                        """
                    },
                    "toRecipients": [{"emailAddress": {"address": os.environ.get('AZURE_NOTIFICATION_EMAIL', 'cto@wisbees.com')}}]
                }
            }
            
            res = requests.post(send_url, json=email_payload, headers={
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json"
            })
            
            if res.status_code != 202:
                raise Exception(res.text)
                
            flash('A security verification pass code has been dispatched to cto@wisbees.com.', 'success')
            return redirect(url_for('verify_otp'))
            
        except Exception as e:
            session.pop('pending_hr_data', None)
            session.pop('hr_registration_otp', None)
            flash(f'Security transmission pipeline breakdown: {str(e)}', 'error')
            return render_template('register.html')
    return render_template('register.html')

@app.route('/verify-otp', methods=['GET', 'POST'])
def verify_otp():
    # Safeguard against direct access without registration context
    if 'pending_hr_data' not in session or 'hr_registration_otp' not in session:
        flash('Session timeout or invalid sequence indexing.', 'error')
        return redirect(url_for('register'))
        
    if request.method == 'POST':
        input_otp = request.form.get('otp_code')
        cached_otp = session.get('hr_registration_otp')
        
        if input_otp and input_otp.strip() == cached_otp:
            # Code verified! Extract dictionary object from cookie cache
            hr_data = session.get('pending_hr_data')
            
            # Reconstruct model blueprint instance
            hr = HR(
                name=hr_data['name'], 
                email=hr_data['email'], 
                designation=hr_data['designation'], 
                phone=hr_data['phone']
            )
            hr.set_password(hr_data['password'])
            
            # Rehydrate binary signature bytes if they exist
            if hr_data['signature_data']:
                hr.signature_data = base64.b64decode(hr_data['signature_data'].encode('utf-8'))
                
            # Permanently commit user data rows to DB store
            db.session.add(hr)
            db.session.commit()
            
            # Clear temporary session data
            session.pop('pending_hr_data', None)
            session.pop('hr_registration_otp', None)
            
            flash('HR Profile authorized and created successfully! Please log in.', 'success')
            return redirect(url_for('login'))
        else:
            flash('Invalid entry passkey match. Authorization request declined.', 'error')
            return redirect(url_for('verify_otp'))
            
    return render_template('verify_otp.html')

@app.route('/logout')
@login_required
def logout():
    logout_user()
    return redirect(url_for('login'))

# ─────────────── DASHBOARD ───────────────

@app.route('/dashboard')
@login_required
def dashboard():
    total_employees  = Employee.query.count()
    active_employees = Employee.query.filter_by(status='Active').count()
    new_this_month   = Employee.query.filter(
        Employee.created_at >= datetime(datetime.now().year, datetime.now().month, 1)
    ).count()
    offers_sent      = Employee.query.filter_by(offer_sent=True).count()

    # Intern vs Normal counts
    total_interns    = Employee.query.filter_by(emp_type='Intern').count()
    total_normal     = Employee.query.filter_by(emp_type='Normal').count()
    active_interns   = Employee.query.filter_by(emp_type='Intern', status='Active').count()

    # Monthly data for chart
    monthly_data = []
    for month in range(1, 13):
        count = Employee.query.filter(
            db.extract('month', Employee.created_at) == month,
            db.extract('year', Employee.created_at) == datetime.now().year
        ).count()
        monthly_data.append(count)

    # Dept distribution
    departments = db.session.query(
        Employee.department, db.func.count(Employee.id)
    ).group_by(Employee.department).all()

    dept_labels = [d[0] or 'Unknown' for d in departments]
    dept_data   = [d[1] for d in departments]

    # Type distribution for second chart
    type_labels = ['Interns', 'Normal Employees']
    type_data   = [total_interns, total_normal]

    # Weekly data (last 7 days)
    from datetime import timedelta
    weekly_data   = []
    weekly_labels = []
    for i in range(6, -1, -1):
        day = date.today() - timedelta(days=i)
        count = Employee.query.filter(
            db.func.date(Employee.created_at) == day
        ).count()
        weekly_data.append(count)
        weekly_labels.append(day.strftime('%a'))

    recent_employees = Employee.query.order_by(Employee.created_at.desc()).limit(5).all()
    active_announcements = Announcement.query.filter(
        Announcement.is_active == True,
        Announcement.expires_at > datetime.utcnow()
    ).order_by(
        Announcement.created_at.desc()
    ).limit(3).all()
    return render_template('dashboard.html',
        total_employees=total_employees,
        active_employees=active_employees,
        new_this_month=new_this_month,
        offers_sent=offers_sent,
        total_interns=total_interns,
        total_normal=total_normal,
        active_interns=active_interns,
        monthly_data=json.dumps(monthly_data),
        dept_labels=json.dumps(dept_labels),
        dept_data=json.dumps(dept_data),
        type_labels=json.dumps(type_labels),
        type_data=json.dumps(type_data),
        weekly_data=json.dumps(weekly_data),
        weekly_labels=json.dumps(weekly_labels),
        recent_employees=recent_employees,
        active_announcements=active_announcements,
        now_hour=datetime.now().hour
    )

# ─────────────── EMPLOYEES ───────────────

@app.route('/employees')
@login_required
def employees():
    search = request.args.get('search', '')
    dept_filter = request.args.get('department', '')
    status_filter = request.args.get('status', '')

    query = Employee.query
    if search:
        query = query.filter(
            (Employee.name.ilike(f'%{search}%')) |
            (Employee.email.ilike(f'%{search}%')) |
            (Employee.emp_id.ilike(f'%{search}%'))
        )
    if dept_filter:
        query = query.filter_by(department=dept_filter)
    if status_filter:
        query = query.filter_by(status=status_filter)

    employees_list = query.order_by(Employee.created_at.desc()).all()
    departments = db.session.query(Employee.department).distinct().all()
    return render_template('employees.html',
        employees=employees_list,
        departments=[d[0] for d in departments if d[0]],
        search=search, dept_filter=dept_filter, status_filter=status_filter
    )

@app.route('/employees/add', methods=['GET', 'POST'])
@login_required
def add_employee():
    if request.method == 'POST':
        # Generate EMP ID
        emp_type = request.form.get('emp_type', 'Normal')

        if emp_type == 'Intern':

            last = Employee.query.filter(
                Employee.emp_id.like('INT%')
            ).order_by(Employee.id.desc()).first()

            num = int(last.emp_id[3:]) + 1 if last else 1

            emp_id = f"INT{num:04d}"

        else:

            last = Employee.query.filter(
                Employee.emp_id.like('EMP%')
            ).order_by(Employee.id.desc()).first()

            num = int(last.emp_id[3:]) + 1 if last else 1

            emp_id = f"EMP{num:04d}"

        joining_date_str = request.form.get('joining_date')
        joining_date = datetime.strptime(joining_date_str, '%Y-%m-%d').date() if joining_date_str else date.today()
        end_date_str = request.form.get('end_date')
        end_date = datetime.strptime(end_date_str, '%Y-%m-%d').date() if end_date_str else None

        # Handle emp_type and designation
        emp_type = request.form.get('emp_type', 'Normal')
        designation = request.form.get('designation', '')
        if designation == 'other':
            designation = request.form.get('designation_other', '')

        emp = Employee(
            emp_id=emp_id,
            name=request.form.get('name'),
            email=request.form.get('email'),
            phone=request.form.get('phone'),
            department=request.form.get('department'),
            designation=designation,
            salary=float(request.form.get('salary', 0) or 0),
            joining_date=joining_date,
            end_date=end_date,
            status=request.form.get('status', 'Active'),
            emp_type=emp_type,
            created_by=current_user.id,
            gender=request.form.get('gender')
        )
        db.session.add(emp)
        db.session.commit()
        account = EmployeeAccount(
            employee_id=emp.id,
            email=emp.email,
            must_change_password=True
        )

        account.set_password("Wisbees@2026")

        db.session.add(account)
        db.session.commit()
        flash(f'Employee {emp.name} added successfully!', 'success')
        return redirect(url_for('employees'))
    return render_template('add_employee.html')

@app.route('/employees/<int:emp_id>/edit', methods=['GET', 'POST'])
@login_required
def edit_employee(emp_id):
    emp = Employee.query.get_or_404(emp_id)
    if request.method == 'POST':
        emp.name = request.form.get('name')
        emp.email = request.form.get('email')
        emp.phone = request.form.get('phone')
        emp.department = request.form.get('department')
        emp.designation = request.form.get('designation')
        emp.salary = float(request.form.get('salary', 0))
        emp.status = request.form.get('status', 'Active')
        joining_date_str = request.form.get('joining_date')
        emp.gender = request.form.get('gender')
        # Inside your edit employee route handling POST:
        if joining_date_str:
            emp.joining_date = datetime.strptime(joining_date_str, '%Y-%m-%d').date()
        end_date_str = request.form.get('end_date')
        if end_date_str:
            emp.end_date = datetime.strptime(end_date_str, '%Y-%m-%d').date()
        db.session.commit()
        flash('Employee updated!', 'success')
        return redirect(url_for('employees'))
    return render_template('edit_employee.html', emp=emp)

@app.route('/employees/<int:emp_id>/delete', methods=['POST'])
@login_required
def delete_employee(emp_id):
    emp = Employee.query.get_or_404(emp_id)

    # 1. Block deletion if the employee status is still Active
    if emp.status == 'Active':
        return jsonify({
            'success': False, 
            'message': 'Cannot delete an active employee. Change status to Inactive first!'
        }), 400

    # 2. If status is Inactive, clear their logs and account structure safely
    # This prevents foreign key crashes since we aren't blocking by history anymore
    Attendance.query.filter_by(employee_id=emp.id).delete()
    LeaveRequest.query.filter_by(employee_id=emp.id).delete()

    account = EmployeeAccount.query.filter_by(employee_id=emp.id).first()
    if account:
        db.session.delete(account)

    # 3. Permanently drop the core employee record
    db.session.delete(emp)
    db.session.commit()

    return jsonify({'success': True})

@app.route('/employee-profile')
def employee_profile():

    if 'employee_id' not in session:
        return redirect(
            url_for('employee_login')
        )

    employee = Employee.query.get(
        session['employee_id']
    )

    return render_template(
        'employee_profile.html',
        employee=employee
    )

# ─────────────── OFFER LETTER ───────────────

@app.route('/offer-letter')
@login_required
def offer_letter_page():
    employees_list = Employee.query.filter_by(status='Active').all()
    settings = CompanySettings.query.first()
    return render_template('offer_letter.html', employees=employees_list,
                           role_keys=ROLE_KEYS, settings=settings)

@app.route('/generate-offer-letter', methods=['POST'])
@login_required
def generate_offer_letter():
    emp_id  = request.form.get('employee_id')
    role_key = request.form.get('role_key', '')
    emp     = Employee.query.get_or_404(emp_id)
    custom_notes = request.form.get('custom_notes', '')
    settings = CompanySettings.query.first()
    if not settings:
        settings = CompanySettings()

    # Validate role
    if role_key not in ROLE_KEYS:
        flash('Please select a valid role category.', 'error')
        return redirect(url_for('offer_letter_page'))

    try:
        hydrate_hr_signature(current_user)
        hydrate_company_files(settings)
        buf = generate_offer_letter_pdf(emp, current_user, settings, role_key, custom_notes)
        

    except Exception as e:
        flash(f'PDF generation failed: {e}', 'error')
        return redirect(url_for('offer_letter_page'))

    emp.offer_sent = True
    db.session.commit()

    safe_name = emp.name.replace(' ', '_')
    safe_role = role_key.replace(' ', '_').replace('–', '-')[:30]
    filename = f"Offer_Letter_{safe_name}_{safe_role}.pdf"
    return send_file(buf, as_attachment=True, download_name=filename,
                     mimetype='application/pdf')

@app.route('/experience-letter/<int:emp_id>')
@login_required
def experience_letter(emp_id):
    employee = Employee.query.get_or_404(emp_id)

    settings = CompanySettings.query.first()
    if not settings:
        settings = CompanySettings()

    # ── DETERMINE PREFIX FROM DB VALUE ────────────────────────────────────────
    # Safely look for a 'gender' field on your model. 
    # Adjust the condition if your DB stores it differently (e.g., 'M', 'F', or lowercase)
    gender = getattr(employee, 'gender', 'female') or 'female'
    
    if str(gender).strip().lower() in ['male', 'm']:
        salutation_prefix = "Mr."
    else:
        salutation_prefix = "Ms."

    # Pass the prefix to your updated PDF generator function
    hydrate_company_files(settings)
    buf = generate_experience_letter_pdf(
        employee,
        settings,
        prefix=salutation_prefix
    )

    return send_file(
        buf,
        download_name=f"{employee.name}_Experience_Letter.pdf",
        as_attachment=True,
        mimetype="application/pdf",
    )
# ─────────────── EMAIL ───────────────
@app.route('/send-email', methods=['POST'])
@login_required
def send_email_route():
    data = request.get_json() or {}
    
    settings_check = CompanySettings.query.first()
    emp_id = data.get('employee_id')
    email_type = data.get('type', 'offer')  # offer / nda / both

    emp = Employee.query.get(emp_id)
    if not emp:
        return jsonify({'success': False, 'message': 'Employee not found'})

    config = EmailConfig.query.filter_by(hr_id=current_user.id).first()
    if not config or not config.sender_email:
        return jsonify({'success': False, 'message': 'Email not configured. Go to Settings > Email Config.'})

    settings = CompanySettings.query.first()

    try:
        attachments = []
        role_display = data.get('role_key', 'Intern').replace(' Intern', '').replace('Intern – ', '').strip()
        
        joining_str = (
            emp.joining_date.strftime('%d %B %Y').lstrip('0')
            if emp.joining_date
            else 'the agreed date'
        )
        subject = f"{emp.name} | Internship Offer Letter – {role_display} | TimeArrow Pvt. Ltd (WisBees)"

        body = f"""Dear {emp.name},...""" # Keeping your fallback plain string format intact

        html_body = f"""
        <div style="font-family:Arial,sans-serif;font-size:14px;color:#222;max-width:600px;">
          <p>Dear {emp.name},</p>
          <p>We are pleased to offer you the position of <strong>Intern – {role_display}</strong> with <strong>TimeArrow Pvt. Ltd. (WisBees)</strong>, effective {joining_str}.</p>
          <p>Please find attached:<br>&nbsp;&nbsp;(1) Internship Offer Letter<br>&nbsp;&nbsp;(2) Non-Disclosure Agreement (NDA)</p>
          <p>Please return the signed copies at your earliest convenience to confirm your acceptance of the offer.</p>
          <p>Should you have any questions or require any clarification, please feel free to reach out.</p>
          <p>We look forward to your continued association and contribution to WisBees.</p>
          <br>
          <p style="margin:0;">Yours sincerely,</p>
          <p style="margin:0;"><strong>{current_user.name}</strong></p>
          <p style="margin:0;">HR-DEPARTMENT</p>
          <p style="margin:0;"><a href="mailto:info@wisbees.com" style="color:#4f46e5;">info@wisbees.com</a></p>
          <br>
          <p style="margin:0;font-size:12px;color:#666;">TimeArrow Private Limited (WisBees)</p>
          <img src="https://fret.wisbees.com/static/logo.png" 
                   alt="WisBees Logo" 
                   width="120" 
                   style="display: block; border: 0; max-width: 100%; height: auto;" />
        </div>
        """    

        # Attach offer letter PDF
        if email_type in ['offer', 'both']:
            role_key = data.get('role_key', '')
            if role_key in ROLE_KEYS:
                try:
                    sender_hr = HR.query.get(emp.created_by) or HR.query.first()
                    hydrate_hr_signature(sender_hr)
                    hydrate_company_files(settings)
                    pdf_buf = generate_offer_letter_pdf(
                        emp,
                        sender_hr,
                        settings,
                        role_key
                    )
                    safe_name = emp.name.replace(' ', '_')
                    pdf_bytes = pdf_buf.getvalue()

                    attachments.append({
                        "@odata.type": "#microsoft.graph.fileAttachment",
                        "name": f"Offer_Letter_{safe_name}.pdf",
                        "contentBytes": base64.b64encode(pdf_bytes).decode('utf-8')
                    })
                except Exception as e:
                    print(f"DEBUG: Offer letter error = {e}")

        # Attach NDA
        if email_type in ['nda', 'both']:
            nda_bytes = None
            if settings and getattr(settings, 'nda_data', None):
                nda_bytes = settings.nda_data
            elif settings and settings.nda_path and os.path.exists(settings.nda_path):
                with open(settings.nda_path, 'rb') as f:
                    nda_bytes = f.read()
            if nda_bytes:
                try:
                    attachments.append({
                        "@odata.type": "#microsoft.graph.fileAttachment",
                        "name": f"NDA_{emp.name.replace(' ', '_')}.pdf",
                        "contentBytes": base64.b64encode(nda_bytes).decode('utf-8')
                    })
                except Exception as e:
                    print(f"DEBUG: NDA error = {e}")

        # ── 1. DYNAMIC CC LIST PROCESSING FROM FRONTEND INPUT ──
        cc_recipients = []
        raw_cc_input = data.get('cc_emails', '') # Takes a string: "email1@test.com, email2@test.com"
        
        if raw_cc_input:
            # Splitting by comma, stripping whitespace, filtering empty strings
            parsed_cc_list = [email.strip() for email in raw_cc_input.split(',') if email.strip()]
            cc_recipients = [
                {
                    "emailAddress": {
                        "address": email
                    }
                }
                for email in parsed_cc_list
            ]

        token = get_graph_token()
        recipients = [
            {
                "emailAddress": {
                    "address": emp.email
                }
            }
        ]

        email_payload = {
            "message": {
                "subject": subject,
                "body": {
                    "contentType": "HTML",
                    "content": html_body
                },
                "toRecipients": recipients,
                "ccRecipients": cc_recipients,
                "attachments": attachments
            },
            "saveToSentItems": True
        }

        # ── 2. DYNAMIC MICROSOFT GRAPH SEND ENDPOINT USER ACCOUNT MAP ──
        graph_send_url = f"https://graph.microsoft.com/v1.0/users/{config.sender_email}/sendMail"

        response = requests.post(
            graph_send_url,
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json"
            },
            json=email_payload
        )

        if response.status_code != 202:
            raise Exception(response.text)

        # Update status
        if email_type in ['offer', 'both']:
            emp.offer_sent = True
        if email_type in ['nda', 'both']:
            emp.nda_sent = True
        db.session.commit()

        return jsonify({'success': True, 'message': f'Email sent to {emp.email}'})

    except Exception as e:
        return jsonify({'success': False, 'message': str(e)})


# ─────────────── SETTINGS ───────────────

@app.route('/settings', methods=['GET', 'POST'])
@login_required
def settings():
    config = EmailConfig.query.filter_by(hr_id=current_user.id).first()
    company = CompanySettings.query.first()
    if not company:
        company = CompanySettings()
        db.session.add(company)
        db.session.commit()
    return render_template('settings.html', config=config, company=company)

@app.route('/settings/email', methods=['POST'])
@login_required
def save_email_config():

    config = EmailConfig.query.filter_by(
        hr_id=current_user.id
    ).first()

    if not config:

        config = EmailConfig(
            hr_id=current_user.id
        )

        db.session.add(config)

    config.sender_email = request.form.get(
        'sender_email'
    )

    config.tenant_id = request.form.get(
        'tenant_id'
    )

    config.client_id = request.form.get(
        'client_id'
    )

    if request.form.get('client_secret'):

        config.client_secret = request.form.get(
            'client_secret'
        )

    db.session.commit()

    flash(
        'Graph API settings saved!',
        'success'
    )

    return redirect(
        url_for('settings')
    )

@app.route('/settings/company', methods=['POST'])
@login_required
def save_company_settings():
    company = CompanySettings.query.first()
    if not company:
        company = CompanySettings()
        db.session.add(company)
        db.session.commit()
    company.company_name = request.form.get('company_name') or company.company_name
    company.company_address = request.form.get('company_address') or company.company_address
    company.company_email = request.form.get('company_email') or company.company_email
    company.company_phone = request.form.get('company_phone') or company.company_phone

    # Letterhead upload (stored in DB so it survives restarts)
    if 'letterhead_file' in request.files:
        file = request.files['letterhead_file']
        if file and file.filename and allowed_file(file.filename):
            company.letterhead_data = file.read()
            company.letterhead_mime = file.filename.rsplit('.', 1)[-1].lower()

    # NDA upload (stored in DB so it survives restarts)
    if 'nda_file' in request.files:
        file = request.files['nda_file']
        if file and file.filename:
            company.nda_data = file.read()
            company.nda_filename = secure_filename(file.filename)

    db.session.commit()
    flash('Company settings saved!', 'success')
    return redirect(url_for('settings'))

@app.route('/profile', methods=['GET', 'POST'])
@login_required
def profile():
    if request.method == 'POST':
        current_user.name = request.form.get('name', current_user.name)
        current_user.phone = request.form.get('phone', current_user.phone)
        current_user.designation = request.form.get('designation', current_user.designation)

        if 'signature' in request.files:
            file = request.files['signature']
            if file and file.filename and allowed_file(file.filename):
                current_user.signature_data = file.read()

        if request.form.get('new_password'):
            current_user.set_password(request.form.get('new_password'))

        db.session.commit()
        flash('Profile updated!', 'success')
    return render_template('profile.html')

# ─────────────── API ENDPOINTS ───────────────

@app.route('/api/stats')
@login_required
def api_stats():
    return jsonify({
        'total': Employee.query.count(),
        'active': Employee.query.filter_by(status='Active').count(),
        'inactive': Employee.query.filter_by(status='Inactive').count(),
        'offers_sent': Employee.query.filter_by(offer_sent=True).count(),
    })

@app.route('/api/employee/<int:emp_id>')
@login_required
def api_employee(emp_id):
    emp = Employee.query.get_or_404(emp_id)
    return jsonify({
        'id': emp.id, 'emp_id': emp.emp_id, 'name': emp.name,
        'email': emp.email, 'phone': emp.phone, 'department': emp.department,
        'designation': emp.designation, 'salary': emp.salary,
        'joining_date': emp.joining_date.isoformat() if emp.joining_date else None,
        'status': emp.status, 'offer_sent': emp.offer_sent, 'nda_sent': emp.nda_sent
    })

@app.route('/api/role-info')
@login_required
def api_role_info():
    from pdf_generator import ROLE_DATA
    role = request.args.get('role', '')
    info = ROLE_DATA.get(role, {})
    return jsonify({
        'department': info.get('department', ''),
        'responsibilities': info.get('responsibilities', []),
        'requirements': info.get('requirements', []),
    })

@app.route('/api/employees-list')
@login_required
def api_employees_list():
    emps = Employee.query.order_by(Employee.name).all()
    return jsonify([{'id': e.id, 'name': e.name, 'email': e.email or '', 'emp_id': e.emp_id} for e in emps])

@app.route('/letterhead')
@login_required
def serve_letterhead():
    settings = CompanySettings.query.first()
    if settings and getattr(settings, 'letterhead_data', None):
        mime = settings.letterhead_mime or 'png'
        return send_file(BytesIO(settings.letterhead_data), mimetype=f'image/{mime}')
    if settings and settings.letterhead_path and os.path.exists(settings.letterhead_path):
        return send_file(settings.letterhead_path)
    return '', 404

@app.route('/signature/<int:hr_id>')
@login_required
def serve_signature(hr_id):
    hr = HR.query.get_or_404(hr_id)
    if getattr(hr, 'signature_data', None):
        return send_file(BytesIO(hr.signature_data), mimetype='image/png')
    if hr.signature_path and os.path.exists(hr.signature_path):
        return send_file(hr.signature_path)
    return '', 404

@app.route('/leave-management')
@login_required
def leave_management():

    leaves = LeaveRequest.query\
        .order_by(
            LeaveRequest.applied_on.desc()
        )\
        .all()

    return render_template(
        'leave_management.html',
        leaves=leaves,
        active_page='leave'
    )
@app.route('/leave/<int:leave_id>/approve')
@login_required
def approve_leave(leave_id):

    leave = LeaveRequest.query.get_or_404(
        leave_id
    )

    leave.status = "Approved"

    db.session.commit()

    return redirect(
        url_for('leave_management')
    )


@app.route('/leave/<int:leave_id>/reject')
@login_required
def reject_leave(leave_id):

    leave = LeaveRequest.query.get_or_404(
        leave_id
    )

    leave.status = "Rejected"

    db.session.commit()

    return redirect(
        url_for('leave_management')
    )


@app.route('/api/offer-preview')
@login_required
def api_offer_preview():
    from pdf_generator import ROLE_DATA
    emp_id   = request.args.get('emp_id')
    role_key = request.args.get('role')
    emp      = Employee.query.get_or_404(emp_id)
    role_info = ROLE_DATA.get(role_key, {})

    start_str = emp.joining_date.strftime('%d %B %Y') if emp.joining_date else '___'
    end_str   = emp.end_date.strftime('%d %B %Y') if emp.end_date else '___'

    preview = f"""INTERNSHIP OFFER LETTER

Date: {date.today().strftime('%d-%b-%Y')}

Dear {emp.name},

We are pleased to offer you the position of {role_key} at TimeArrow Pvt. Ltd. (WisBees).

{role_info.get('intro', '')}

Your internship duration will commence from {start_str} to {end_str}, remote, unpaid.

Key Roles & Responsibilities:
""" + '\n'.join(f"• {r}" for r in role_info.get('responsibilities', [])) + f"""

You are required to sign the attached NDA and maintain confidentiality.

Upon successful completion you will receive:
- Internship Completion Certificate
- Experience Letter (based on performance)
- Letter of Recommendation (if applicable)

Warm regards,
{current_user.name}
{current_user.designation}
TimeArrow Pvt. Ltd. (WisBees)"""

    return jsonify({'preview': preview})

#Attendance Routes below:
@app.route('/attendance/checkin')
def checkin():

    if 'employee_id' not in session:
        return redirect(url_for('login'))

    employee_id = session['employee_id']

    today = date.today()

    record = Attendance.query.filter_by(
        employee_id=employee_id,
        date=today
    ).first()

    if not record:

        record = Attendance(
            employee_id=employee_id,
            date=today,
            check_in=datetime.now(),
            status='Present'
        )

        db.session.add(record)
        db.session.commit()

    flash('Check-in successful', 'success')

    return redirect(url_for('employee_dashboard'))

@app.route('/attendance/checkout')
def checkout():

    if 'employee_id' not in session:
        return redirect(url_for('login'))

    record = Attendance.query.filter_by(
        employee_id=session['employee_id'],
        date=date.today()
    ).first()

    if record:

        record.check_out = datetime.now()

        db.session.commit()

    flash('Check-out successful', 'success')

    return redirect(url_for('employee_dashboard'))

@app.route('/attendance')
def attendance():

    if 'employee_id' not in session:
        return redirect(url_for('login'))

    employee = Employee.query.get(
        session['employee_id']
    )

    records = Attendance.query.filter_by(
        employee_id=session['employee_id']
    ).order_by(
        Attendance.date.desc()
    ).all()

    present_days = len([
        r for r in records
        if r.status == "Present"
    ])

    absent_days = len([
        r for r in records
        if r.status == "Absent"
    ])

    total_days = len(records)

    attendance_percentage = round(
        (present_days / total_days * 100),
        2
    ) if total_days else 0

    return render_template(
        'attendance.html',
        records=records,
        employee=employee,
        present_days=present_days,
        absent_days=absent_days,
        attendance_percentage=attendance_percentage
    )



@app.route('/attendance-management')
@login_required
def attendance_management():


    employee_id = request.args.get('employee_id')
    from_date = request.args.get('from_date')
    to_date = request.args.get('to_date')

    query = Attendance.query

    if employee_id:
        query = query.filter(
            Attendance.employee_id == employee_id
        )

    if from_date:
        query = query.filter(
            Attendance.date >= from_date
        )

    if to_date:
        query = query.filter(
            Attendance.date <= to_date
        )

    records = query.order_by(
        Attendance.date.desc(),
        Attendance.check_in.desc()
    ).all()

    employees = Employee.query.order_by(
        Employee.name
    ).all()

    return render_template(
        'attendance_management.html',
        records=records,
        employees=employees
    )


@app.route('/attendance/export')
@login_required
def export_attendance():

    employee_id = request.args.get(
        'employee_id'
    )

    from_date = request.args.get(
        'from_date'
    )

    to_date = request.args.get(
        'to_date'
    )

    query = Attendance.query

    if employee_id:
        query = query.filter(
            Attendance.employee_id == employee_id
        )

    if from_date:
        query = query.filter(
            Attendance.date >= from_date
        )

    if to_date:
        query = query.filter(
            Attendance.date <= to_date
        )

    records = query.all()

    data = []

    for record in records:

        data.append({

            "Date":
            record.date,

            "Employee ID":
            record.employee.emp_id,

            "Name":
            record.employee.name,

            "Department":
            record.employee.department,

            "Check In":
            record.check_in.strftime('%I:%M %p')
            if record.check_in else "",

            "Check Out":
            record.check_out.strftime('%I:%M %p')
            if record.check_out else "",

            "Status":
            record.status

        })

    df = pd.DataFrame(data)

    filename = (
        f"Attendance_Report_"
        f"{date.today()}.xlsx"
    )

    filepath = os.path.join(
        "exports",
        filename
    )

    os.makedirs("exports", exist_ok=True)

    df.to_excel(
        filepath,
        index=False
    )

    return send_file(
        filepath,
        as_attachment=True
    )

@app.route('/apply-leave', methods=['GET','POST'])
def apply_leave():

    if 'employee_id' not in session:
        return redirect(url_for('login'))

    employee = Employee.query.get(
        session['employee_id']
    )

    if request.method == 'POST':

        leave = LeaveRequest(
            employee_id=employee.id,
            leave_type=request.form['leave_type'],
            from_date=datetime.strptime(
                request.form['from_date'],
                '%Y-%m-%d'
            ).date(),
            to_date=datetime.strptime(
                request.form['to_date'],
                '%Y-%m-%d'
            ).date(),
            reason=request.form['reason']
        )

        db.session.add(leave)
        db.session.commit()

        flash(
            "Leave request submitted successfully",
            "success"
        )

        return redirect(
            url_for('employee_dashboard')
        )

    leave_history = LeaveRequest.query\
        .filter_by(
            employee_id=employee.id
        )\
        .order_by(
            LeaveRequest.applied_on.desc()
        )\
        .all()

    return render_template(
        'apply_leave.html',
        employee=employee,
        leave_history=leave_history
    )

@app.route('/announcements', methods=['GET', 'POST'])
@login_required
def announcements():

    if request.method == 'POST':

        announcement = Announcement(
            title=request.form.get('title'),
            message=request.form.get('message'),
            audience=request.form.get('audience'),
            priority=request.form.get('priority'),
            posted_by=current_user.name,
            expires_at=datetime.utcnow() + timedelta(days=2)
        )

        db.session.add(announcement)
        db.session.commit()

        flash("Announcement published successfully!", "success")

        return redirect(url_for('announcements'))

    # Active announcements
    active_announcements = Announcement.query.filter(
        Announcement.is_active == True,
        Announcement.expires_at > datetime.utcnow()
    ).order_by(
        Announcement.created_at.desc()
    ).all()

    # Expired announcements (History)
    history_announcements = Announcement.query.filter(
        Announcement.expires_at <= datetime.utcnow()
    ).order_by(
        Announcement.created_at.desc()
    ).all()

    return render_template(
        'announcements.html',
        active_announcements=active_announcements,
        history_announcements=history_announcements
    )

@app.route('/announcements/delete/<int:announcement_id>', methods=['POST'])
@login_required
def delete_announcement(announcement_id):

    announcement = Announcement.query.get_or_404(announcement_id)

    db.session.delete(announcement)
    db.session.commit()

    flash("Announcement deleted successfully!", "success")

    return redirect(url_for('announcements'))

@app.route('/employee-announcements')
def employee_announcements():

    if 'employee_id' not in session:
        return redirect(url_for('login'))

    employee = Employee.query.get(session['employee_id'])

    if employee.emp_type == "Intern":

        announcements = Announcement.query.filter(
            Announcement.is_active == True,
            Announcement.expires_at > datetime.utcnow(),
            (Announcement.audience == "Everyone") |
            (Announcement.audience == "Interns")
        ).order_by(
            Announcement.created_at.desc()
        ).all()

    else:

        announcements = Announcement.query.filter(
            Announcement.is_active == True,
            Announcement.expires_at > datetime.utcnow(),
            (Announcement.audience == "Everyone") |
            (Announcement.audience == "Employees")
        ).order_by(
            Announcement.created_at.desc()
        ).all()

    return render_template(
        "employee_announcements.html",
        announcements=announcements,
        employee=employee
    )

# work Routes Below:
@app.route('/work')
@login_required
def work():
    """
    Renders the central Work Hub workspace page.
    Passes current_user as employee to satisfy employee_base.html properties.
    """
    return render_template('work.html', employee=current_user)

@app.route('/newsletter-workspace')
@login_required
def newsletter_workspace():
    # Do the exact same thing here
    return render_template('work.html', employee=current_user)

@app.route('/temp-reset-password-xyz')
def temp_reset():
    # Replace with your boss's actual HR registration email address
    boss_email = "boss_email@wisbees.com" 
    
    boss = HR.query.filter_by(email=boss_email).first()
    if not boss:
        return f"Could not find an HR user with email: {boss_email}", 404
        
    # Set the temporary password
    boss.set_password("Wisbees@2026")
    db.session.commit()
    
    return f"Success! Password for {boss_email} has been reset to: Wisbees@2026"

def init_db():
    # Ensure upload dirs exist before creating DB
    os.makedirs(os.path.join(BASE_DIR, 'uploads', 'signatures'), exist_ok=True)
    os.makedirs(os.path.join(BASE_DIR, 'uploads', 'attachments'), exist_ok=True)
    with app.app_context():
        db.create_all()
        # Create default company settings
        if not CompanySettings.query.first():
            settings = CompanySettings()
            db.session.add(settings)
            db.session.commit()

if __name__ == '__main__':
    init_db()
    port = int(os.environ.get('PORT', 5000))
    debug = os.environ.get('FLASK_DEBUG', '1') == '1'
    app.run(debug=debug, port=port, host='0.0.0.0')
