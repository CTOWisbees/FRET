"""
Production entry point used by gunicorn:  gunicorn wsgi:app
Exports 'app' as the WSGI application alias for Gunicorn / Render.
"""
import os
import sys

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.join(BASE_DIR, 'backend')
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'fret_project.settings')

import django
django.setup()

from django.core.wsgi import get_wsgi_application

application = get_wsgi_application()
app = application

if __name__ == '__main__':
    from django.core.management import execute_from_command_line
    execute_from_command_line(['backend/manage.py', 'runserver', '5000'])
