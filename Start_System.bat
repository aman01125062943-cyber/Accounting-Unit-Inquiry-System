@echo off
title HK System
cd /d "%~dp0"
powershell -ExecutionPolicy Bypass -File "%~dp0run-app.ps1"
