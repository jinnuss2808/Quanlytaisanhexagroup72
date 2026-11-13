@echo off
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo [LOI] Khong tim thay Node.js, hay cai Node.js truoc khi chay.
  pause
  exit /b 1
)
node "%~dp0PATCH_HEXA_PRINTER_LIBRARY.cjs" hide
if errorlevel 1 (
 echo.
 echo [THAT BAI] Ma nguon khong dung phien ban hoac sai thu muc. Chua thay doi du lieu Firebase.
 pause
 exit /b 1
)
echo.
echo [OK] Mo rong bang may in va AN Thu vien IT khoi giao dien.
echo [NEXT] Build + deploy frontend Vercel, sau do Ctrl+Shift+R.
pause
