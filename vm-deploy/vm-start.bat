@echo off
chcp 65001 >nul
setlocal EnableExtensions

cd /d "%~dp0"

set "VM_IP=10.94.25.177"
set "VM_PORT=3000"

echo ================================================
echo  AI Agent Market - VM Server Start
echo ================================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js is not installed on this VM.
  echo Install it from https://nodejs.org and run this file again.
  pause
  exit /b 1
)

if not exist "package.json" (
  echo [ERROR] package.json was not found in:
  echo   %CD%
  echo Make sure this vm-deploy folder was copied correctly to the VM.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo [ERROR] Dependencies are not installed yet.
  echo Run vm-install.bat first, then try again.
  pause
  exit /b 1
)

if not exist ".env" (
  echo [ERROR] .env file not found.
  echo Run vm-install.bat first to create it, then edit ADMIN_KEY.
  pause
  exit /b 1
)

echo Starting the server. Open this address from any PC on the network:
echo.
echo    http://%VM_IP%:%VM_PORT%
echo.
echo Closing this window or pressing Ctrl+C will stop the server.
echo To apply code changes, stop the server (Ctrl+C) and run this file again.
echo ================================================
echo.

call npm start

pause
