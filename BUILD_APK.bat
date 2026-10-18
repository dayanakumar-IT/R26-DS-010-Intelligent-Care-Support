@echo off
title SENTRY — Build APK for Phone
color 0B

echo.
echo ============================================================
echo   SENTRY — BUILD APK (Run TONIGHT before viva)
echo ============================================================
echo.
echo BEFORE RUNNING THIS:
echo   1. Turn on phone hotspot
echo   2. Connect laptop to phone hotspot
echo   3. Run ipconfig - copy the IPv4 address (192.168.43.x)
echo   4. Open: caresense_mobile\frontend\lib\core\config\api_config.dart
echo   5. Update baseUrl to: http://YOUR_IP:8000
echo   6. Then run this script
echo.
pause

cd /d "%~dp0caresense_mobile\frontend"

echo.
echo [1/2] Building Release APK...
call flutter build apk --release

echo.
echo [2/2] Done! APK location:
echo.
echo   %~dp0caresense_mobile\frontend\build\app\outputs\flutter-apk\app-release.apk
echo.
echo ============================================================
echo   NEXT STEPS:
echo   - Copy app-release.apk to phone via WhatsApp / Google Drive
echo   - Install it on phone (allow unknown sources if asked)
echo   - Open app and verify it connects to backend
echo ============================================================
echo.
pause
