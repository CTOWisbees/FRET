from django.contrib import admin
from django.urls import path, include
from django.http import JsonResponse

urlpatterns = [
    path('', lambda req: JsonResponse({'status': 'ok', 'service': 'WisBees Operations API'})),
    path('admin/', admin.site.urls),
    path('api/', include('ops_core.urls')),
]
