from datetime import datetime
from pdf_generator import ROLE_KEYS

def flask_context(request):
    return {
        'current_user': getattr(request, 'current_user', None),
        'ALL_ROLE_KEYS': ROLE_KEYS,
        'now_hour': datetime.now().hour,
    }
