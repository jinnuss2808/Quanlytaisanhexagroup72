@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title HEXA - GitHub + Vercel Setup (One-time)
echo.
echo =======================================================
echo  HEXA Ticket + Asset - GitHub / Vercel deploy
 echo =======================================================
echo  Source: %CD%
echo  GitHub repository: ticket-asset-hexa
 echo  Vercel: ticket-asset-hexa / ticket-asset-hexa-api
echo.
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0DEPLOY_HEXA.ps1"
set "RESULT=%ERRORLEVEL%"
echo.
if not "%RESULT%"=="0" (
  echo [FAILED] Deployment did not finish. Review the FIRST red error above.
) else (
  echo [SUCCESS] Deployment flow completed.
)
echo.
pause
exit /b %RESULT%
