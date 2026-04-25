@echo off
setlocal EnableDelayedExpansion
title PALLAS Monitor

echo.
echo    P  A  L  L  A  S   M  O  N  I  T  O  R
echo    ==========================================
echo    System Intelligence Interface
echo.

:: Locate Python
set PYTHON=
for %%P in (py python python3) do (
    where %%P >nul 2>&1
    if !errorlevel! equ 0 (
        set PYTHON=%%P
        goto :found_python
    )
)
echo    ERROR: Python 3.10+ not found in PATH.
echo    Please install from https://www.python.org/downloads/
echo.
pause
exit /b 1

:found_python
for /f "tokens=*" %%V in ('!PYTHON! --version 2^>^&1') do echo    Runtime : %%V
echo.
echo    Installing / verifying dependencies...
echo.

!PYTHON! -m pip install -r "%~dp0requirements.txt" --quiet --disable-pip-version-check
if !errorlevel! neq 0 (
    echo    WARNING: Some packages may not have installed correctly.
    echo    The app will still run; GPU/fan data may be limited.
    echo.
)

echo    Launching PALLAS Monitor desktop window...
echo    ==========================================
echo.

!PYTHON! "%~dp0app.py"

echo.
echo    PALLAS Monitor closed.
pause
