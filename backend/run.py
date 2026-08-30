#!/usr/bin/env python3
"""
Run server: python run.py
"""
import os
import sys

# Ensure backend directory is in sys.path
BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

os.chdir(BACKEND_DIR)
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'fret_project.settings')

import django
django.setup()

from django.core.management import execute_from_command_line

print("=" * 50)
print("  WisbeesHr — Human Resource Management System (Django)")
print("=" * 50)

if __name__ == '__main__':
    execute_from_command_line(['manage.py', 'runserver', '0.0.0.0:5000'])
