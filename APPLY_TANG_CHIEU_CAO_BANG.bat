@echo off
setlocal
cd /d "%~dp0"
title HEXA - Tang chieu cao bang Tai san va May in
where node >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Chua cai Node.js hoac Node khong co trong PATH.
  pause
  exit /b 1
)
node "%~dp0APPLY_TANG_CHIEU_CAO_BANG.cjs"
if errorlevel 1 (
  echo [FAILED] Ban va khong duoc ap dung. Kiem tra thong bao tren.
  pause
  exit /b 1
)
echo.
echo [OK] Xong. Nhan Ctrl+Shift+R tren trinh duyet.
pause
exit /b 0
