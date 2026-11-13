@echo off
setlocal
cd /d "%~dp0"
title HEXA - Hide warehouse summary in device stock
where node >nul 2>&1
if errorlevel 1 (
 echo [ERROR] Khong tim thay Node.js. Cai Node.js va thu lai.
 pause
 exit /b 1
)
node "%~dp0APPLY_HEXA_HIDE_WAREHOUSE_SUMMARY.cjs"
if errorlevel 1 (
 echo [FAILED] Khong the cap nhat. Khong sua Firebase.
 pause
 exit /b 1
)
echo.
echo [OK] Hoan tat. Tai lai giao dien bang Ctrl+Shift+R.
pause
exit /b 0
