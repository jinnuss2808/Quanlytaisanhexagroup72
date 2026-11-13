@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"
title HEXA - An/hien tab Quan ly tai san
where node >nul 2>&1
if errorlevel 1 (
  echo [FAILED] Chua cai Node.js hoac node chua co trong PATH.
  pause
  exit /b 1
)
node "%~dp0APPLY_AN_HIEN_TAB.cjs"
if errorlevel 1 (
  echo [FAILED] Khong cap nhat duoc. Hay gui lai noi dung loi phia tren.
  pause
  exit /b 1
)
echo.
echo [OK] Hoan tat. Chay npm run dev trong frontend, tai lai trinh duyet bang Ctrl+Shift+R.
echo [INFO] Chi khi da kiem tra local, hay git add -A, commit va push main.
pause
