@echo off
setlocal
cd /d "%~dp0"
title HEXA - Fix modal lich su may in va giao dien Sang Toi
where node >nul 2>&1
if errorlevel 1 (
 echo [ERROR] Khong tim thay Node.js trong PATH.
 pause
 exit /b 1
)
node "%~dp0APPLY_HEXA_APPEARANCE.cjs"
if errorlevel 1 (
 echo [FAILED] Khong ap dung duoc. Xem thong bao phia tren.
 pause
 exit /b 1
)
echo.
echo [OK] Neu frontend dang chay, nhan Ctrl+Shift+R de tai lai giao dien.
echo [GIT] git add frontend/src/App.jsx frontend/src/main.jsx frontend/src/hexa-appearance.css
echo [GIT] git commit -m "Fix printer modal and add light dark mode"
echo [GIT] git push origin main
pause
exit /b 0
