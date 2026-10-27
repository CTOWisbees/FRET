from datetime import date
from django.db import migrations


def seed_jnana_sir_birthday(apps, schema_editor):
    Employee = apps.get_model('hrms', 'Employee')
    emp, created = Employee.objects.get_or_create(
        email='Jnanadhir1@gmail.com',
        defaults={
            'name': 'Jnana Ranjan Mohanty (Jnana Sir)',
            'emp_id': 'DIR-001',
            'department': 'Executive Leadership',
            'designation': 'Founder & Director',
            'emp_type': 'Normal',
            'status': 'Active',
            'is_superadmin': True,
            'is_manager': True,
            'date_of_birth': date(1980, 10, 28),
            'personal_email': 'Jnanadhir1@gmail.com',
        }
    )
    if not created:
        emp.name = 'Jnana Ranjan Mohanty (Jnana Sir)'
        emp.date_of_birth = date(1980, 10, 28)
        emp.personal_email = 'Jnanadhir1@gmail.com'
        emp.is_superadmin = True
        emp.status = 'Active'
        emp.save()


def reverse_func(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('hrms', '0009_employee_date_of_birth_and_more'),
    ]

    operations = [
        migrations.RunPython(seed_jnana_sir_birthday, reverse_func),
    ]
