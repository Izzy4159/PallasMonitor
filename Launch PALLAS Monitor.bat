@echo off
cd /d "%~dp0"

pip install pywebview --quiet 2>nul

where pythonw >nul 2>&1
if not errorlevel 1 (
    start "" /B pythonw app.py
    exit /b 0
)

where python >nul 2>&1
if not errorlevel 1 (
    python app.py
    exit /b 0
)

echo Python not found. Please install from https://www.python.org
pause
exit /b 1
