@echo off
setlocal
cd /d "%~dp0"
title HEXA - Fix IT Library Upload + Printer Toolbar
where node >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Node.js is required. Install Node.js 22 or newer.
  pause
  exit /b 1
)
if not exist "backend\package.json" (
  echo [ERROR] Copy the BAT and 2 CJS files to the project ROOT next to backend and frontend.
  pause
  exit /b 1
)
echo [1/4] Fix library upload diagnostics...
node "%~dp0FIX_ITLIB_UPLOAD.cjs"
if errorlevel 1 goto failed
echo [2/4] Fix visible errors + printer layout...
node "%~dp0FIX_HEXA_PRINTER_UPLOAD.cjs"
if errorlevel 1 goto failed
echo [3/4] Verify backend JavaScript syntax...
node --check "backend\src\app.js"
if errorlevel 1 goto failed
node --check "backend\src\it-library-api.js"
if errorlevel 1 goto failed
node --check "backend\src\it-library-core.js"
if errorlevel 1 goto failed
echo [4/4] Done. Changes are LOCAL only.
echo Next: deploy BOTH projects to Vercel after testing.
echo Backend: ticket-asset-hexa-api / Frontend: ticket-asset-hexa
echo git add backend/src/app.js backend/src/it-library-core.js backend/src/it-library-api.js frontend/src/ITLibrary.jsx frontend/src/PrinterManagement.jsx frontend/src/printer-management.css
echo git commit -m "Fix IT Library errors and printer toolbar"
echo git push origin main
pause
exit /b 0
:failed
echo [FAILED] See message above. Backup is stored in HEXA_SOURCE_BACKUPS in your user profile.
pause
exit /b 1
