@echo off
setlocal
cd /d "%~dp0"
title HEXA - Kiem tra va sua HTTP 404 Thu vien IT
where node >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Chua cai Node.js.
  pause
  exit /b 1
)
node "%~dp0FIX_IT_LIBRARY_404.cjs"
if errorlevel 1 (
  echo [FAILED] Khong sua duoc. KHONG co du lieu Firebase bi xoa.
  pause
  exit /b 1
)
echo.
echo [CHECK] Kiem tra cu phap backend...
node --check "backend\src\app.js"
if errorlevel 1 (pause & exit /b 1)
node --check "backend\src\it-library-api.js"
if errorlevel 1 (pause & exit /b 1)
node --check "backend\src\it-library-core.js"
if errorlevel 1 (pause & exit /b 1)
echo [OK] Cu phap backend hop le.
echo.
echo [IMPORTANT] Khoi dong lai Node.js backend. Neu dung Vercel, git commit/push de backend deploy lai.
pause
exit /b 0
