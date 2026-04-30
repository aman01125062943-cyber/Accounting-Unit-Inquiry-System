@echo off
title Stop Port 5001
setlocal enabledelayedexpansion
color 0E

echo.
echo ==================================================
echo        STOP ANY APPLICATION ON PORT 5001
echo ==================================================
echo.

set "FOUND=0"

for /f "tokens=5" %%p in ('netstat -ano ^| findstr /R /C:":5001 .*LISTENING"') do (
    set "FOUND=1"
    echo Closing process PID %%p using port 5001...
    taskkill /F /PID %%p >nul 2>&1
    if errorlevel 1 (
        echo Failed to close PID %%p. Try running this file as Administrator.
    ) else (
        echo Closed PID %%p.
    )
)

if "%FOUND%"=="0" (
    echo No application is currently using port 5001.
)

echo.
echo Done.
echo.
