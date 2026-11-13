@echo off
setlocal
cd /d "%~dp0"
title HEXA - Cap nhat bat tat Ticket (an toan)
where node >nul 2>&1
if errorlevel 1 (
  echo [FAILED] Chua co Node.js trong PATH.
  pause
  exit /b 1
)
node "%~dp0APPLY_TICKET_TOGGLE_SAFE.cjs"
set "EXITCODE=%ERRORLEVEL%"
if not "%EXITCODE%"=="0" (
  echo [FAILED] Khong ap dung duoc. Xem thong bao phia tren.
) else (
  echo [OK] Hoan tat. Chay git status de xem cac file moi.
)
pause
exit /b %EXITCODE%
