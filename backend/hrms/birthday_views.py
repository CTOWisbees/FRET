"""
WisBees — Birthday API Views
Endpoints to check upcoming birthdays, preview assets, and manually trigger birthday wishes.
"""

from datetime import datetime, date
from django.http import JsonResponse, HttpResponse
from django.views.decorators.csrf import csrf_exempt
from django.conf import settings
from pathlib import Path
from hrms.birthday_service import find_birthday_recipients_for_date, send_birthday_wish
from hrms.birthday_pdf import generate_birthday_wishes_pdf
from hrms.birthday_banner import create_birthday_banner


def api_birthdays_today(request):
    """
    Returns list of employees/interns/HRs/admins with birthdays today or on target date.
    Query params: ?date=YYYY-MM-DD&force=1
    """
    date_str = request.GET.get('date')
    force = request.GET.get('force') in ('1', 'true', 'True')
    if date_str:
        try:
            target_date = datetime.strptime(date_str, '%Y-%m-%d').date()
        except ValueError:
            return JsonResponse({'error': 'Invalid date format. Use YYYY-MM-DD'}, status=400)
    else:
        target_date = date.today()

    recipients = find_birthday_recipients_for_date(target_date=target_date, force=force)
    return JsonResponse({
        'success': True,
        'date': target_date.strftime('%Y-%m-%d'),
        'total': len(recipients),
        'recipients': recipients
    })


@csrf_exempt
def api_birthdays_send(request):
    """
    Triggers birthday wishes delivery.
    Query / body params:
      - date: YYYY-MM-DD (defaults to today)
      - email: optional target email filter
      - force: boolean
    """
    if request.method not in ('POST', 'GET'):
        return JsonResponse({'error': 'Method not allowed'}, status=405)

    date_str = request.POST.get('date') or request.GET.get('date')
    email_filter = request.POST.get('email') or request.GET.get('email')
    force = (request.POST.get('force') or request.GET.get('force')) in ('1', 'true', 'True')

    if date_str:
        try:
            target_date = datetime.strptime(date_str, '%Y-%m-%d').date()
        except ValueError:
            return JsonResponse({'error': 'Invalid date format. Use YYYY-MM-DD'}, status=400)
    else:
        target_date = date.today()

    recipients = find_birthday_recipients_for_date(target_date=target_date, force=force)
    if email_filter:
        recipients = [r for r in recipients if r['email'].lower() == email_filter.lower()]

    if not recipients:
        return JsonResponse({
            'success': False,
            'message': f'No eligible birthday recipients found for {target_date}'
        })

    results = []
    for r in recipients:
        try:
            res = send_birthday_wish(r, force=force)
            results.append(res)
        except Exception as e:
            results.append({
                'success': False,
                'email': r['email'],
                'name': r['name'],
                'error': str(e)
            })

    return JsonResponse({
        'success': True,
        'date': target_date.strftime('%Y-%m-%d'),
        'dispatched_count': sum(1 for x in results if x.get('success')),
        'results': results
    })


def api_birthdays_preview_pdf(request):
    """
    Previews or downloads the generated birthday letter PDF.
    ?name=...&designation=...
    """
    name = request.GET.get('name', 'Jnana Ranjan Mohanty (Jnana Sir)')
    designation = request.GET.get('designation', 'Founder & Director')
    department = request.GET.get('department', 'Management')

    pdf_bytes = generate_birthday_wishes_pdf(name=name, designation=designation, department=department)
    response = HttpResponse(pdf_bytes, content_type='application/pdf')
    response['Content-Disposition'] = f'inline; filename="WisBees_Birthday_Wishes_{name}.pdf"'
    return response


def api_birthdays_preview_banner(request):
    """
    Previews the generated birthday banner PNG.
    ?name=...
    """
    name = request.GET.get('name', 'Jnana Sir')
    import io
    img = create_birthday_banner(name=name)
    buf = io.BytesIO()
    img.save(buf, format='PNG')
    return HttpResponse(buf.getvalue(), content_type='image/png')
