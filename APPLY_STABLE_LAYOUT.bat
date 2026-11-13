@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"
echo ==============================================
echo   HEXA - Cap nhat giao dien tab co dinh
 echo ==============================================
where node >nul 2>&1
if errorlevel 1 (
  echo [FAILED] Chua co Node.js. Cai Node.js 22+ roi chay lai.
  goto :END
)
node "%~dp0APPLY_STABLE_LAYOUT.cjs"
if errorlevel 1 (
  echo [FAILED] Da dung an toan. Khong thay doi Firebase.
  goto :END
)
echo.
echo [NEXT] Khoi dong lai Vite neu can, nhan Ctrl+Shift+R tren trinh duyet.
echo [NEXT] Neu OK: git add -A ^&^& git commit -m "Stable asset tab layout" ^&^& git push origin main
:END
pause
