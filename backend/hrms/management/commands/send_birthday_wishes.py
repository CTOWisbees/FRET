"""
Management command to send birthday wishes to employees, interns, HR, and admins.
Usage:
  python manage.py send_birthday_wishes
  python manage.py send_birthday_wishes --date 2026-10-28
  python manage.py send_birthday_wishes --email Jnanadhir1@gmail.com --force
  python manage.py send_birthday_wishes --dry-run
"""

from datetime import datetime, date
from django.core.management.base import BaseCommand
from hrms.birthday_service import find_birthday_recipients_for_date, send_birthday_wish
from hrms.models import Employee, HR


class Command(BaseCommand):
    help = 'Dispatches celebratory birthday wish emails with attached PDF and banner.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--date',
            type=str,
            help='Target date to check birthdays for (format: YYYY-MM-DD). Defaults to today.'
        )
        parser.add_argument(
            '--email',
            type=str,
            help='Send only to a specific email address.'
        )
        parser.add_argument(
            '--force',
            action='store_true',
            help='Force delivery even if already sent this year.'
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Scan and report recipients without transmitting emails.'
        )

    def handle(self, *args, **options):
        date_str = options.get('date')
        if date_str:
            target_date = datetime.strptime(date_str, '%Y-%m-%d').date()
        else:
            target_date = date.today()

        filter_email = options.get('email')
        force = options.get('force', False)
        dry_run = options.get('dry_run', False)

        self.stdout.write(self.style.NOTICE(
            f"[*] Scanning birthdays for date: {target_date} (Month={target_date.month}, Day={target_date.day})"
        ))

        recipients = find_birthday_recipients_for_date(target_date=target_date, force=force)

        if filter_email:
            recipients = [r for r in recipients if r['email'].lower() == filter_email.lower()]

        if not recipients:
            self.stdout.write(self.style.WARNING("[-] No birthday recipients found matching criteria."))
            return

        self.stdout.write(self.style.SUCCESS(f"[+] Found {len(recipients)} recipient(s) to wish:"))
        for r in recipients:
            self.stdout.write(f"    - {r['name']} ({r['email']}) - Role: {r['designation']} [{r['model']}]")

        if dry_run:
            self.stdout.write(self.style.NOTICE("[DRY RUN] Completed without dispatching emails."))
            return

        success_count = 0
        for r in recipients:
            try:
                self.stdout.write(f"[*] Dispatching birthday wishes to: {r['name']} <{r['email']}>...")
                result = send_birthday_wish(r, force=force)
                self.stdout.write(self.style.SUCCESS(
                    f"    [OK] Sent to {result['email']} (Attached: {result['pdf_attached']}, {result['banner_attached']})"
                ))
                success_count += 1
            except Exception as e:
                self.stdout.write(self.style.ERROR(f"    [FAIL] Error sending to {r['email']}: {e}"))

        self.stdout.write(self.style.SUCCESS(
            f"\n[DONE] Dispatched {success_count}/{len(recipients)} birthday email(s) successfully!"
        ))
