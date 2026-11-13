@echo off
setlocal
cd /d "%~dp0"
title HEXA - Fix IT Library large file upload
where node >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Node.js chua co trong PATH.
  pause
  exit /b 1
)
node "%~dp0FIX_ITLIB_UPLOAD.cjs"
if errorlevel 1 (
  echo [FAILED] Khong thay doi file. Kiem tra thong bao tren.
  pause
  exit /b 1
)
node --check "%~dp0backend\src\it-library-api.js"
if errorlevel 1 (
  echo [ERROR] Backend syntax error. Khoi phuc tu thu muc backup o tren.
  pause
  exit /b 1
)
echo [OK] Da sua. Khoi dong lai backend Node.js va tai lai frontend.
echo [GIT] git add backend/src/it-library-api.js frontend/src/ITLibrary.jsx
echo [GIT] git commit -m "Improve IT library upload diagnostics"
echo [GIT] git push origin main
pause
