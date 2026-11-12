@echo off
setlocal
cd /d "%~dp0"
title HEXA - Fresh GitHub and Vercel Deployment
chcp 65001 >nul
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0DEPLOY_TICKET_ASSET_HEXA.ps1"
set "CODE=%ERRORLEVEL%"
echo.
if not "%CODE%"=="0" (
  echo [LOI] Trien khai chua hoan tat. Hay xem dong [DEPLOY FAILED] o tren.
) else (
  echo [OK] Trien khai da chay qua tat ca cac buoc kiem tra.
)
echo.
pause
exit /b %CODE%
