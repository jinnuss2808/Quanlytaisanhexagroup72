@echo off
setlocal
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0CAP_NHAT_SAP_XEP_COT.ps1"
if errorlevel 1 (
  echo.
  echo [FAILED] Update stopped. Existing Firebase data is untouched.
) else (
  echo.
  echo [OK] Update completed.
)
pause
