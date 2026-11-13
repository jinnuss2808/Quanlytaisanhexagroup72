@echo off
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo [LOI] Khong tim thay Node.js.
  pause
  exit /b 1
)
node "%~dp0PATCH_HEXA_PRINTER_LIBRARY.cjs" keep
if errorlevel 1 (
 echo.
 echo [THAT BAI] Kiem tra ban ma nguon va thu muc.
 pause
 exit /b 1
)
echo.
echo [OK] Da mo rong bang may in, GIU nguyen Thu vien IT.
pause
