@echo off
:: Launch PALLAS Monitor as a frameless Electron desktop window
cd /d "%~dp0"

where npm >nul 2>&1
if errorlevel 1 (
    echo Node.js not found. Please install from https://nodejs.org
    pause
    exit /b 1
)

if not exist "%~dp0node_modules\" (
    echo Installing dependencies...
    npm install
)

start "" /B npm start
