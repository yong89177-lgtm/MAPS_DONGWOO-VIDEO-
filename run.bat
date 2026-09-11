@echo off
chcp 65001 >nul
setlocal EnableExtensions

cd /d "%~dp0"

set "REPO_URL=https://github.com/yong89177-lgtm/MAPS_DONGWOO-VIDEO-.git"
set "BRANCH=main"
set "FOLDER=MAPS_DONGWOO-VIDEO-"

echo ================================================
echo  Automation Tool Market - Local Run Script
echo ================================================
echo.

where git >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Git is not installed.
  echo Install it from https://git-scm.com/downloads and run this file again.
  pause
  exit /b 1
)

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js is not installed.
  echo Install it from https://nodejs.org and run this file again.
  pause
  exit /b 1
)

if exist "%FOLDER%\.git" (
  echo Existing folder found. Updating to the latest version...
  cd /d "%FOLDER%"
  git fetch origin %BRANCH%
  git checkout %BRANCH%
  git pull origin %BRANCH%
) else (
  echo Cloning repository, please wait...
  git clone -b %BRANCH% "%REPO_URL%" "%FOLDER%"
  if errorlevel 1 (
    echo [ERROR] Failed to clone the repository. Check your internet connection and try again.
    pause
    exit /b 1
  )
  cd /d "%FOLDER%"
)

if not exist "package.json" (
  echo [ERROR] package.json was not found in:
  echo   %CD%
  echo Something went wrong while getting the project. Please contact support.
  pause
  exit /b 1
)

if not exist ".env" (
  echo Creating .env from .env.example with default values...
  copy .env.example .env >nul
  echo   Default admin accounts: admin / admin2
  echo   Open the .env file with Notepad if you want to check or change the passwords.
)

echo.
echo Installing dependencies ^(this can take a few minutes on first run^)...
call npm install
if errorlevel 1 (
  echo [ERROR] npm install failed. See the messages above for details.
  pause
  exit /b 1
)

echo.
echo ================================================
echo  Starting the server. Open this address in your browser:
echo.
echo    http://localhost:3000
echo.
echo  From other devices on the same network, use this PC's IP address instead:
for /f "tokens=2 delims=:" %%A in ('ipconfig ^| findstr /c:"IPv4"') do echo    http://%%A:3000 ^(remove any leading space^)
echo.
echo  Closing this window or pressing Ctrl+C will stop the server.
echo ================================================
echo.

call npm start

pause
