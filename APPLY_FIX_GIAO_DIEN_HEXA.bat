@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"
echo ===============================================
echo HEXA - FIX THANH TIM KIEM, NUT, COT BANG
 echo ===============================================
where node >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Can cai Node.js 20 hoac moi hon.
  pause
  exit /b 1
)
if not exist "frontend\src\AssetManagement.jsx" (
  echo [ERROR] Hay copy BAT va CJS vao THU MUC GOC project HEXA
  echo         cung cap frontend va backend.
  pause
  exit /b 1
)
node "%~dp0FIX_HEXA_GIAO_DIEN_HANG_NUT.cjs"
if errorlevel 1 (
  echo [FAILED] Khong the ap dung ban va. File goc khong bi thay doi neu kiem tra that bai.
  pause
  exit /b 1
)
echo.
echo [OK] Kiem tra thay doi: git diff -- frontend/src
 echo [NEXT] Chay npm run build trong frontend va deploy len Vercel.
pause
endlocal
