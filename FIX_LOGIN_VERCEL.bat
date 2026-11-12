@echo off
setlocal
cd /d "%~dp0"
echo HEXA - Firebase sign-in diagnostics + Vercel Production resync
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0FIX_LOGIN_VERCEL.ps1"
set "RESULT=%ERRORLEVEL%"
echo.
if not "%RESULT%"=="0" echo [FAILED] Review the error above.
pause
exit /b %RESULT%
