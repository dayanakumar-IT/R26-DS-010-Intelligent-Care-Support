@echo off
title SENTRY — Viva Day Startup
color 0A

echo.
echo ============================================================
echo   SENTRY — VIVA DAY STARTUP
echo ============================================================
echo.

echo [1/3] Getting your laptop IP address...
echo       (Use this IP in api_config.dart if not already done)
echo.
ipconfig | findstr /i "IPv4"
echo.

echo [2/3] Starting SENTRY Backend...
echo       Access at: http://localhost:8000
echo       API docs:  http://localhost:8000/docs
echo.

cd /d "%~dp0backend_services\fall-detection"
call venv\Scripts\activate.bat
start "SENTRY Backend" cmd /k "uvicorn api.server:app --host 0.0.0.0 --port 8000"

echo [3/3] Backend starting in new window...
echo.
echo ============================================================
echo   CHECKLIST:
echo   [ ] Camera plugged into USB
echo   [ ] Phone hotspot ON, laptop connected to it
echo   [ ] IP in api_config.dart matches IP shown above
echo   [ ] APK already installed on phone
echo   [ ] Open http://localhost:8000/api/health in browser
echo ============================================================
echo.
pause
