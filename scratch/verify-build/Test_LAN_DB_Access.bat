@echo off
title Test LAN Database Access
setlocal

set "DB_PATH=\\128.30.200.225\esth_share\فرع الاعمال الحسابية\قسم البنوك\منظومة الجديدة\hk.db"
set "DB_DIR=\\128.30.200.225\esth_share\فرع الاعمال الحسابية\قسم البنوك\منظومة الجديدة"

echo.
echo ==================================================
echo        TEST LAN DATABASE ACCESS
echo ==================================================
echo.
echo Database:
echo %DB_PATH%
echo.

echo [1/3] Testing server/share access...
net view \\128.30.200.225
if errorlevel 1 (
    echo.
    echo FAILED: Windows cannot access \\128.30.200.225.
    echo If you see "Access is denied", login to the network share first.
    echo Example:
    echo net use \\128.30.200.225\esth_share /user:USERNAME PASSWORD
    echo.
    exit /b 1
)

echo.
echo [2/3] Testing database folder...
if not exist "%DB_DIR%\" (
    echo FAILED: Database folder is not accessible:
    echo %DB_DIR%
    exit /b 2
)

echo.
echo [3/3] Testing database file...
if not exist "%DB_PATH%" (
    echo FAILED: hk.db was not found or cannot be read:
    echo %DB_PATH%
    exit /b 3
)

echo.
echo SUCCESS: LAN database file is visible to this Windows user.
echo You can now run Start_Offline.bat.
echo.
