@echo off
setlocal
cd /d "%~dp0"
echo ==============================================
echo HEXA - FIX TRANG TRANG VERCEL /it
 echo ==============================================
where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Chua cai Node.js hoac Node.js chua co trong PATH.
  pause
  exit /b 1
)
node FIX_WHITE_SCREEN.cjs
if errorlevel 1 (
  echo [ERROR] Vui long xem log phia tren.
  pause
  exit /b 1
)
echo.
echo Hoan tat. Nhan Ctrl+Shift+R tai trang Vercel.
pause
