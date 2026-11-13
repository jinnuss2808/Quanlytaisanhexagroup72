@echo off
setlocal
cd /d "%~dp0"
title HEXA - Doi giao dien nen trang xanh diu mat
where node >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Chua cai Node.js hoac node khong nam trong PATH.
  pause
  exit /b 1
)
node "%~dp0HEXA_THEME_SOFT_GREEN_APPLY.cjs"
if errorlevel 1 (
  echo [FAILED] Khong cap nhat duoc giao dien. Xem loi ben tren.
  pause
  exit /b 1
)
echo.
echo [OK] Hoan tat. Hay mo lai frontend hoac Ctrl+Shift+R de tai lai giao dien.
pause
exit /b 0
