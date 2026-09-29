@echo off
echo ========================================================
echo Starting WisBees Operations Portal Backend (Port 8001)...
echo ========================================================
cd backend
python manage.py migrate
python manage.py runserver 8001
pause
