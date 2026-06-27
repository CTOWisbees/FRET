#!/usr/bin/env python3
"""
Just run: python run.py
"""
import os
import sys

# Change to the app's directory so relative paths work
os.chdir(os.path.dirname(os.path.abspath(__file__)))

from app import app, init_db

print("=" * 50)
print("  WisbeesHr — Human Resource Management System")
print("=" * 50)

init_db()

app.run(debug=True, port=5000, host='0.0.0.0')
