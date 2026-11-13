@echo off
setlocal
cd /d "%~dp0"
title HEXA - Fix Printer Modal and Repair History
where node >nul 2>&1
if errorlevel 1 (
 echo [ERROR] Khong tim thay Node.js. Can Node.js 22 tro len.
 pause
 exit /b 1
)
node "%~dp0APPLY_PRINTER_HISTORY.cjs"
if errorlevel 1 (
 echo [ERROR] Ban va dung an toan. Vui long gui thong bao loi va file PrinterManagement.jsx hien tai.
 pause
 exit /b 1
)
echo.
echo [OK] Hoan thanh. Mo lai localhost, bam Ctrl + Shift + R.
echo De len GitHub sau khi kiem tra: git add frontend/src/PrinterManagement.jsx frontend/src/printer-management.css frontend/src/printer-history-utils.js
pause
endlocal
