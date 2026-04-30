@echo off
title HK System - Offline Portable
setlocal enabledelayedexpansion
color 0A

cd /d "%~dp0"

echo.
echo ==================================================
echo        HK SYSTEM - OFFLINE PORTABLE VERSION
echo ==================================================
echo.

if not exist "HKServer.exe" (
    color 4F
    echo HKServer.exe was not found in this folder.
    echo Make sure you are running this file from the published portable folder.
    echo.
    pause
    exit /b 1
)

if not exist "hk.db" (
    color 4F
    echo hk.db was not found in this folder.
    echo Copy the database file beside HKServer.exe, then run again.
    echo.
    pause
    exit /b 1
)

echo Closing any previous HKServer instance...
taskkill /F /IM HKServer.exe >nul 2>&1
for /f "tokens=5" %%p in ('netstat -ano ^| findstr /R /C:":5001 .*LISTENING"') do (
    echo Closing process PID %%p using port 5001...
    taskkill /F /PID %%p >nul 2>&1
)
timeout /t 1 /nobreak >nul

echo Starting local server on port 5001...
start "" /B "%~dp0HKServer.exe" --urls "http://0.0.0.0:5001"

echo Waiting for startup...
timeout /t 4 /nobreak >nul

echo Opening browser...
start "" "http://localhost:5001"

echo.
echo ==================================================
echo        SYSTEM IS RUNNING - KEEP THIS WINDOW OPEN
echo ==================================================
echo.
echo Local address:   http://localhost:5001
echo Network address: use this computer IP with port 5001
echo.
echo To stop the system, close this window and end HKServer.exe from Task Manager if needed.
echo.
pause
