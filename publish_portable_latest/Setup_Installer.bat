@echo off
echo ==================================================
echo      INSTALLING HK RETURNS SYSTEM (SETUP)
echo ==================================================
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0Install_System.ps1"
echo.
echo Setup Complete! Check your Desktop for the app icon.
pause
