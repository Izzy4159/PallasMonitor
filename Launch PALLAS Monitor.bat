@echo off
:: Launch PALLAS Monitor as a desktop app (pywebview window)
cd /d "%~dp0"

set PYTHON=
for %%P in (py python python3) do (
    where %%P >nul 2>&1
    if errorlevel 1 (goto :next_%%P)
    set PYTHON=%%P
    goto :found
    :next_%%P
)
echo Python not found. Please install Python 3.10+ and add it to PATH.
pause
exit /b 1

:found
start "" /B %PYTHON% "%~dp0app.py"
