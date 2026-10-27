"""
WisBees — Midnight Birthday Wishes Daemon
Precision-scheduled runner designed to dispatch birthday greetings at 12:00:00 AM sharp (00:00:00 IST).

Usage:
  python run_midnight_birthday_daemon.py             # Runs countdown to 12:00 AM tonight, then loops daily
  python run_midnight_birthday_daemon.py --test-now   # Dispatches immediately for testing
"""

import os
import sys
import time
import argparse
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
from pathlib import Path

# Fix Windows console UTF-8 encoding
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')

# Setup Django environment
BASE_DIR = Path(__file__).resolve().parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'fret_project.settings')
import django
django.setup()

from django.core.management import call_command
from hrms.birthday_service import find_birthday_recipients_for_date, send_birthday_wish

IST = ZoneInfo("Asia/Kolkata")


def log_print(msg):
    print(msg, flush=True)


def get_next_midnight_ist(now_ist=None):
    """Calculates the exact datetime of the upcoming 00:00:00 IST."""
    if now_ist is None:
        now_ist = datetime.now(IST)
    tomorrow = now_ist.date() + timedelta(days=1)
    next_midnight = datetime(tomorrow.year, tomorrow.month, tomorrow.day, 0, 0, 0, tzinfo=IST)
    return next_midnight


def run_countdown_and_dispatch():
    now_ist = datetime.now(IST)
    target_midnight = get_next_midnight_ist(now_ist)
    diff = (target_midnight - now_ist).total_seconds()

    log_print("=" * 65)
    log_print("  [WISBEES] MIDNIGHT BIRTHDAY DISPATCHER DAEMON")
    log_print(f"  Current Time (IST) : {now_ist.strftime('%Y-%m-%d %H:%M:%S %Z')}")
    log_print(f"  Target Midnight    : {target_midnight.strftime('%Y-%m-%d %H:%M:%S %Z')}")
    log_print(f"  Time Remaining     : {int(diff // 3600)}h {int((diff % 3600) // 60)}m {int(diff % 60)}s ({diff:.1f} seconds)")
    log_print("=" * 65)

    # Pre-check candidates for target date
    target_date = target_midnight.date()
    candidates = find_birthday_recipients_for_date(target_date=target_date, force=True)
    log_print(f"[*] Pre-flight check: {len(candidates)} recipient(s) queued for {target_date}:")
    for c in candidates:
        log_print(f"    -> {c['name']} <{c['email']}> ({c['designation']})")
    log_print("=" * 65)

    # Loop countdown
    while True:
        now_ist = datetime.now(IST)
        rem = (target_midnight - now_ist).total_seconds()

        if rem <= 0.1:
            break

        if rem > 60:
            minutes_left = int(rem // 60)
            seconds_part = int(rem % 60)
            log_print(f"[{datetime.now(IST).strftime('%H:%M:%S')}] Countdown: {minutes_left}m {seconds_part}s until 12:00 AM dispatch...")
            # Sleep in intervals of 30 seconds
            sleep_chunk = min(30.0, rem - 10.0)
            time.sleep(sleep_chunk)
        elif rem > 5:
            time.sleep(1.0)
        else:
            time.sleep(0.05)

    # 12:00:00 AM Sharp!
    dispatch_time = datetime.now(IST)
    log_print(f"\n[{dispatch_time.strftime('%Y-%m-%d %H:%M:%S.%f')}] [TARGET HIT] 12:00 AM SHARP! Executing birthday dispatches...")
    
    try:
        call_command('send_birthday_wishes', date=target_date.strftime('%Y-%m-%d'), force=True)
        log_print(f"[{datetime.now(IST).strftime('%H:%M:%S')}] [SUCCESS] All midnight birthday wishes dispatched successfully!")
    except Exception as e:
        log_print(f"[!] Error during midnight dispatch: {e}")

    # Once tonight's midnight is handled, continue recurring daily loop
    log_print("\n[*] Entering continuous daily 24h midnight scheduler loop...")
    while True:
        now_ist = datetime.now(IST)
        next_target = get_next_midnight_ist(now_ist)
        diff_secs = (next_target - now_ist).total_seconds()
        log_print(f"[*] Sleeping until next midnight: {next_target.strftime('%Y-%m-%d %H:%M:%S')} ({int(diff_secs // 3600)}h {int((diff_secs % 3600) // 60)}m)...")
        time.sleep(max(1.0, diff_secs - 2.0))
        # Precise sleep for final seconds
        while datetime.now(IST) < next_target:
            time.sleep(0.05)
        today = datetime.now(IST).date()
        log_print(f"\n[{datetime.now(IST).strftime('%H:%M:%S')}] [MIDNIGHT] 12:00 AM reached for {today}! Scanning birthdays...")
        try:
            call_command('send_birthday_wishes', date=today.strftime('%Y-%m-%d'))
        except Exception as err:
            log_print(f"[!] Error during daily dispatch: {err}")
        time.sleep(5)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description="WisBees Midnight Birthday Dispatcher")
    parser.add_argument('--test-now', action='store_true', help='Dispatch immediately for testing')
    parser.add_argument('--target-email', type=str, help='Target email for test')
    args = parser.parse_args()

    if args.test_now:
        log_print("[*] Running immediate test dispatch...")
        email_filter = args.target_email or 'Jnanadhir1@gmail.com'
        call_command('send_birthday_wishes', date='2026-10-28', email=email_filter, force=True)
    else:
        run_countdown_and_dispatch()
