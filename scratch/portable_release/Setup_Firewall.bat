@echo off
:: =============================================
:: HK Server - Network Setup (Run ONCE as Admin)
:: =============================================
:: Right-click this file > Run as Administrator
:: This only needs to be done ONE TIME
:: =============================================

echo.
echo ==========================================
echo   HK Server - Firewall Setup
echo   Run this ONCE as Administrator
echo ==========================================
echo.

netsh advfirewall firewall add rule name="HKServer-TCP-5001" dir=in action=allow protocol=TCP localport=5001
IF %ERRORLEVEL% EQU 0 (
    color 0A
    echo.
    echo [SUCCESS] Port 5001 TCP is now OPEN!
    echo All devices can access: http://10.95.32.202:5001
    echo.
) ELSE (
    color 4F
    echo.
    echo [FAILED] Run as Administrator!
    echo.
)
pause
