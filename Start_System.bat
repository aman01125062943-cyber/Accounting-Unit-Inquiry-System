@echo off
title Returns Management System
setlocal enabledelayedexpansion
color 0A

echo.
echo ==================================================
echo      STARTING RETURNS MANAGEMENT SYSTEM
echo ==================================================
echo.

:: Kill any existing instances
taskkill /F /IM HKServer.exe 2>nul
taskkill /F /IM dotnet.exe 2>nul
timeout /t 1 /nobreak >nul

:: Start Server (Background)
if exist "HKServer.exe" (
    echo [1/3] Launching Published System...
    goto launch
)

echo [1/3] Building System...
dotnet build
IF %ERRORLEVEL% NEQ 0 (
    COLOR 4F
    echo.
    echo ==================================================
    echo        BUILD FAILED - ERROR IN CODE
    echo ==================================================
    echo.
    pause
    exit
)

:launch
echo.
echo [2/3] Launching Server on Port 5001 (Network Accessible)...
if exist "HKServer.exe" (
    start /B HKServer.exe --urls "http://0.0.0.0:5001" >nul 2>&1
) else (
    start /B dotnet run --urls "http://0.0.0.0:5001" >nul 2>&1
)

:: Wait for server
echo [3/3] Waiting for initialization...
timeout /t 5 /nobreak >nul

:: Open Browser
echo.
echo SUCCESS! Opening system in your browser...
start http://localhost:5001

echo.
echo ==================================================
echo      SYSTEM IS RUNNING - DO NOT CLOSE WINDOW
echo ==================================================
echo.
echo Local Address: http://localhost:5001
echo.
echo Network Access:
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4 Address" /c:"IPv4"') do (
    set "ip=%%a"
    echo http://!ip:~1!:5001
)
echo.
echo [!] To access from other devices, run Setup_Firewall.bat as Administrator ONCE.
echo.
pause
