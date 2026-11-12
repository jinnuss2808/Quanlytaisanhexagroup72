@echo off
setlocal EnableExtensions DisableDelayedExpansion
chcp 65001 >nul
title HEXA - FIX WHITE SCREEN AND DEPLOY
set "TOOL_DIR=%~dp0"
set "PROJECT_DIR=%~dp0"

if exist "%PROJECT_DIR%frontend\package.json" if exist "%PROJECT_DIR%backend\package.json" goto FOUND

echo.
echo ===============================================================
echo  HEXA: KHONG TIM THAY THU MUC frontend / backend CANH FILE BAT
echo ===============================================================
echo Ban co the keo THU MUC GOC HEXA vao cua so CMD hoac paste duong dan.
echo.
set /p "PROJECT_DIR=Thu muc HEXA: "
set "PROJECT_DIR=%PROJECT_DIR:"=%"

:FOUND
for %%I in ("%PROJECT_DIR%") do set "PROJECT_DIR=%%~fI\"
if not exist "%PROJECT_DIR%frontend\src\App.jsx" (
  echo [ERROR] Khong tim thay frontend\src\App.jsx
  pause
  exit /b 1
)
if not exist "%PROJECT_DIR%backend\src\app.js" (
  echo [ERROR] Khong tim thay backend\src\app.js
  pause
  exit /b 1
)
if not exist "%TOOL_DIR%REPAIR_DEPLOY_HEXA.ps1" (
  echo [ERROR] Thieu REPAIR_DEPLOY_HEXA.ps1
  pause
  exit /b 1
)
if not exist "%TOOL_DIR%PATCH_HEXA_SAFE.cjs" (
  echo [ERROR] Thieu PATCH_HEXA_SAFE.cjs
  pause
  exit /b 1
)

echo.
echo ================================================================
echo  HEXA REPAIR + DEPLOY: ticket-asset-hexa
echo  - Sua crash Firebase equalTo undefined
echo  - Kiem tra local build va backend tests
echo  - GitHub PRIVATE + Vercel frontend/backend
echo  - Khong xoa Firebase data hoac upload private key len Git
echo ================================================================
echo.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%TOOL_DIR%REPAIR_DEPLOY_HEXA.ps1" -ProjectRoot "%PROJECT_DIR%"
set "RESULT=%ERRORLEVEL%"
echo.
if "%RESULT%"=="0" (
  echo [OK] Da hoan thanh cac buoc kiem tra va deploy.
) else (
  echo [ERROR] Quy trinh dung lai. Xem thong bao LOI ngay phia tren.
  echo Khong xoa du lieu tren Firebase.
)
pause
exit /b %RESULT%
