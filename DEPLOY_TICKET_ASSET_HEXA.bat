@echo off
setlocal EnableExtensions
chcp 65001 >nul
set "SCRIPT_DIR=%~dp0"
set "PROJECT_DIR=%SCRIPT_DIR%"

rem This .BAT and its .ps1 companion can be placed in the project root.
if exist "%PROJECT_DIR%\frontend\package.json" if exist "%PROJECT_DIR%\backend\package.json" goto RUN

if not "%~1"=="" (
  set "PROJECT_DIR=%~1"
) else (
  echo.
  echo Khong tim thay frontend va backend canh file BAT.
  echo Hay nhap duong dan thu muc goc project HEXA, hoac keo thu muc vao file BAT.
  set /p "PROJECT_DIR=Thu muc project: "
)

:RUN
if not exist "%PROJECT_DIR%\frontend\package.json" (
  echo [LOI] Thieu frontend\package.json o: %PROJECT_DIR%
  pause
  exit /b 1
)
if not exist "%PROJECT_DIR%\backend\package.json" (
  echo [LOI] Thieu backend\package.json o: %PROJECT_DIR%
  pause
  exit /b 1
)
if not exist "%SCRIPT_DIR%DEPLOY_TICKET_ASSET_HEXA.ps1" (
  echo [LOI] Thieu file DEPLOY_TICKET_ASSET_HEXA.ps1 ben canh file BAT.
  pause
  exit /b 1
)

echo.
echo ==================================================
echo   HEXA - GIT + VERCEL AUTO DEPLOY
ECHO   Website: ticket-asset-hexa
ECHO   API:     ticket-asset-hexa-api
echo ==================================================
echo.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_DIR%DEPLOY_TICKET_ASSET_HEXA.ps1" -ProjectRoot "%PROJECT_DIR%"
set "EXITCODE=%ERRORLEVEL%"
echo.
if not "%EXITCODE%"=="0" (
  echo [LOI] Deploy chua hoan tat. Xem thong bao phia tren.
) else (
  echo [OK] Quy trinh deploy da ket thuc.
)
pause
exit /b %EXITCODE%
