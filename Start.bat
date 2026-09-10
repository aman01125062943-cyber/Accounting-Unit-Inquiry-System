@echo off
chcp 65001 > nul
title تشغيل منظومة البنوك
cd /d "%~dp0التطبيق"
dotnet HKServer.dll
