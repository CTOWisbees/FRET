"""
Production entry point used by gunicorn:  gunicorn wsgi:app

Importing this module creates the database tables (and default settings)
before the first request is served.
"""
from app import app, init_db

# Create tables on startup. Safe to call repeatedly (db.create_all is idempotent).
init_db()

if __name__ == '__main__':
    app.run()
