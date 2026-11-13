@echo off
setlocal
cd /d "%~dp0"
title HEXA - Chuyen mau giao dien sang #004F44
where node >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Chua cai Node.js hoac node khong co trong PATH.
  pause
  exit /b 1
)
node "%~dp0APPLY_HEXA_TEAL.cjs"
if errorlevel 1 (
  echo [FAILED] Khong cap nhat duoc CSS. Xem thong bao ben tren.
  pause
  exit /b 1
)
echo.
echo [OK] Hoan tat. Mo lai frontend, nhan Ctrl+Shift+R.
echo [GIT] git add frontend/src/styles.css frontend/src/asset-management.css frontend/src/printer-management.css
echo [GIT] git commit -m "Apply HEXA teal theme"
echo [GIT] git push origin main
pause
exit /b 0
