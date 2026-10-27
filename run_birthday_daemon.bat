@echo off
title WisBees Midnight Birthday Dispatcher Daemon
cd /d "%~dp0backend"
echo ========================================================
echo Starting WisBees Midnight Birthday Dispatcher Daemon...
echo ========================================================
"E:\Django\operations_portal\backend\venv\Scripts\python.exe" run_midnight_birthday_daemon.py
pause
