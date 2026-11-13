@echo off
setlocal
cd /d "%~dp0"
title HEXA - Cap nhat bat tat Ticket
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0APPLY_TICKET_TOGGLE.ps1"
set "RC=%ERRORLEVEL%"
if not "%RC%"=="0" (
  echo.
  echo [FAILED] Khong cap nhat duoc. Xem thong bao loi o tren.
) else (
  echo.
  echo [OK] Da hoan tat. Hay kiem tra tren localhost truoc khi git push.
)
echo.
pause
exit /b %RC%
