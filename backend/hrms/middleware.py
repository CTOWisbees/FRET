from hrms.models import HR, EmployeeAccount, Employee

class AnonymousUser:
    is_authenticated = False
    is_active = False
    is_anonymous = True
    id = None
    name = ''
    email = ''
    designation = ''
    department = ''

class AuthMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        user = AnonymousUser()

        hr_id = request.session.get('hr_id')
        account_id = request.session.get('account_id')

        if hr_id:
            try:
                user = HR.objects.get(id=hr_id)
            except HR.DoesNotExist:
                request.session.pop('hr_id', None)
        elif account_id:
            try:
                account = EmployeeAccount.objects.get(id=account_id)
                emp = Employee.objects.filter(id=account.employee_id).first()
                if emp:
                    account.designation = emp.designation
                    account.department = emp.department
                    account.name = emp.name
                    account.emp_type = emp.emp_type
                user = account
            except EmployeeAccount.DoesNotExist:
                request.session.pop('account_id', None)

        request.current_user = user
        # Also alias to request.user for Django built-in templates if needed
        if not hasattr(request, 'user') or not request.user.is_authenticated:
            request.user = user

        response = self.get_response(request)
        return response
