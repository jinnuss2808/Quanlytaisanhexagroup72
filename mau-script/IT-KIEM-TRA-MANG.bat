@echo off
setlocal
title HEXA - Network information (read only)
echo =========== HEXA NETWORK DIAGNOSTICS ===========
echo.
echo [1] IP CONFIGURATION
ipconfig /all
echo.
echo [2] ROUTING TABLE
route print -4
echo.
echo [3] DNS TEST
nslookup example.com
echo.
echo [4] CONNECTIVITY TEST (optional external network)
ping -n 2 1.1.1.1
echo.
echo [INFO] This script only reads diagnostics. It does not change network settings.
pause
endlocal
