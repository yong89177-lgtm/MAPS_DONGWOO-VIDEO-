@echo off
chcp 65001 >nul
setlocal EnableExtensions

cd /d "%~dp0"

set "VM_IP=10.34.220.251"
set "VM_PORT=3000"

echo ================================================
echo  AI Agent Market - VM Server Install
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

if not exist ".env" (
  echo Creating .env from .env.example with default values...
  copy .env.example .env >nul
  echo.
  echo [IMPORTANT] Open .env with Notepad and change ADMIN_KEY to a real secret
  echo             before exposing this server to other people.
  echo.
)

if exist "node_modules" (
  echo node_modules already present, skipping npm install.
  echo ^(If this VM has no internet access, copy the node_modules folder here
  echo  from a PC that ran "npm install" on this same project.^)
) else (
  echo Installing dependencies (this can take a few minutes on first run)...
  call npm install
  if errorlevel 1 (
    echo.
    echo [ERROR] npm install failed. See the messages above for details.
    echo If this VM has no internet access to registry.npmjs.org, run
    echo "npm install" on a PC that does have internet access instead,
    echo then copy the resulting node_modules folder into this vm-deploy
    echo folder and run this file again.
    pause
    exit /b 1
  )
)

echo.
echo Adding a Windows Firewall rule to allow inbound traffic on port %VM_PORT%...
netsh advfirewall firewall show rule name="AI Agent Market (%VM_PORT%)" >nul 2>nul
if errorlevel 1 (
  netsh advfirewall firewall add rule name="AI Agent Market (%VM_PORT%)" dir=in action=allow protocol=TCP localport=%VM_PORT% >nul 2>nul
  if errorlevel 1 (
    echo [WARNING] Could not add the firewall rule automatically.
    echo           Re-run this file "as Administrator", or add the rule manually:
    echo           netsh advfirewall firewall add rule name="AI Agent Market (%VM_PORT%)" dir=in action=allow protocol=TCP localport=%VM_PORT%
  ) else (
    echo Firewall rule added.
  )
) else (
  echo Firewall rule already exists.
)

echo.
echo ================================================
echo  Install complete.
echo  Run vm-start.bat to start the server.
echo  It will be reachable at http://%VM_IP%:%VM_PORT%
echo ================================================
echo.
pause
