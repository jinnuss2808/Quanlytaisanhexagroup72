@echo off
setlocal EnableExtensions DisableDelayedExpansion
cd /d "%~dp0"
if not exist "%~dp0tools\deploy-hexa.mjs" (
  echo [STOP] Missing tools\deploy-hexa.mjs. Extract all patch files to the HEXA project root.
  pause
  exit /b 2
)
where node.exe >nul 2>nul
if errorlevel 1 (
  echo [STOP] Node.js 22+ is required.
  pause
  exit /b 2
)
echo ==================================================
echo   HEXA - VERCEL DEPLOY FROM EXISTING PROJECT
 echo   Uses original backend + frontend, no Firebase deletion
 echo ==================================================
node "%~dp0tools\deploy-hexa.mjs"
set "RESULT=%ERRORLEVEL%"
echo.
if not "%RESULT%"=="0" echo [STOP] Check error above and log in TEMP.
if "%RESULT%"=="0" echo [OK] Deployment finished and API passed checks.
pause
exit /b %RESULT%
