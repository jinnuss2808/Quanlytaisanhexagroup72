@echo off
setlocal
cd /d "%~dp0"
title HEXA - Cai dat Thu vien IT va Driver may in
where node >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Node.js chua san sang. Kiem tra node -v.
  pause
  exit /b 1
)
node "%~dp0APPLY_HEXA_IT_LIBRARY.cjs"
if errorlevel 1 (
  echo [FAILED] Ban va chua ap dung. Xem thong bao o tren.
  pause
  exit /b 1
)
echo.
echo [INFO] Da ap dung code. Backend can khoi dong lai de co API moi.
echo [INFO] Frontend dang chay thi nhan Ctrl+Shift+R.
echo [INFO] Tham khao README-THU-VIEN-IT.md neu muon upload file that.
pause
exit /b 0
