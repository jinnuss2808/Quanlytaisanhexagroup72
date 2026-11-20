@echo off
setlocal EnableExtensions
chcp 65001 >nul
title HEXA - Cap nhat logo local, khong can tai Internet
cd /d "%~dp0"
echo.
echo ================================================
echo  HEXA - CAP NHAT LOGO OFFLINE
echo  Anh PNG da duoc kem theo, khong tai 1Office.
echo ================================================
echo.
where node.exe >nul 2>nul
if errorlevel 1 (
  echo [STOP] Chua cai Node.js, hoac chua co node.exe trong PATH.
  goto :fail
)
if not exist "%~dp0CAP_NHAT_LOGO_LOCAL.cjs" (
  echo [STOP] Thieu file CAP_NHAT_LOGO_LOCAL.cjs trong thu muc BAT.
  goto :fail
)
if not exist "%~dp0hexa-sidebar-logo.png" (
  echo [STOP] Thieu anh hexa-sidebar-logo.png trong thu muc BAT.
  goto :fail
)
node "%~dp0CAP_NHAT_LOGO_LOCAL.cjs" --check
if errorlevel 1 goto :fail
node "%~dp0CAP_NHAT_LOGO_LOCAL.cjs"
if errorlevel 1 goto :fail
echo.
echo [DONE] Da cap nhat. Mo frontend bang npm run dev va Ctrl+Shift+R.
echo [INFO] Dung git add, git commit, git push sau khi kiem tra local.
goto :end
:fail
echo.
echo [FAILED] Khong hoan tat. Kiem tra thong bao [STOP] phia tren.
:end
echo.
pause
endlocal
