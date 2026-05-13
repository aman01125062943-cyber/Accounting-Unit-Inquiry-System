@echo off
title HK System Offline
cd /d "%~dp0"
powershell -ExecutionPolicy Bypass -File "%~dp0run-app.ps1"
