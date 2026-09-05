from django.apps import AppConfig
from django.db.backends.signals import connection_created

def configure_sqlite(sender, connection, **kwargs):
    if connection.vendor == 'sqlite':
        try:
            cursor = connection.cursor()
            cursor.execute('PRAGMA journal_mode = WAL;')
            cursor.execute('PRAGMA synchronous = NORMAL;')
            cursor.execute('PRAGMA cache_size = -64000;')
            cursor.execute('PRAGMA temp_store = MEMORY;')
            cursor.execute('PRAGMA mmap_size = 268435456;')
        except Exception:
            pass

class HrmsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'hrms'

    def ready(self):
        connection_created.connect(configure_sqlite)
