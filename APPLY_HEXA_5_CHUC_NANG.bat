@echo off
setlocal
cd /d "%~dp0"
title HEXA - Cap nhat 5 tinh nang quan ly tai san
where node >nul 2>nul
if errorlevel 1 (
 echo [ERROR] Chua co Node.js 22+ trong PATH.
 pause
 exit /b 1
)
node "%~dp0APPLY_HEXA_5_CHUC_NANG.cjs"
if errorlevel 1 (
 echo [FAILED] Khong cap nhat duoc. Khong xoa du lieu Firebase.
 pause
 exit /b 1
)
echo [DONE] Hoan thanh. Xem huong dan trong README.txt.
pause
