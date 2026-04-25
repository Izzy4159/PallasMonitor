# CreateShortcut.ps1
# Run once to place a PALLAS Monitor shortcut on the Desktop.
# Usage: Right-click -> "Run with PowerShell"  (or: powershell -ExecutionPolicy Bypass -File .\CreateShortcut.ps1)

$projectDir  = Split-Path -Parent $MyInvocation.MyCommand.Definition
$batFile     = Join-Path $projectDir "Launch PALLAS Monitor.bat"
$desktop     = [Environment]::GetFolderPath('Desktop')
$shortcut    = Join-Path $desktop "PALLAS Monitor.lnk"

$shell = New-Object -ComObject WScript.Shell
$lnk   = $shell.CreateShortcut($shortcut)

$lnk.TargetPath       = $batFile
$lnk.WorkingDirectory = $projectDir
$lnk.WindowStyle      = 7          # 7 = minimised console window
$lnk.Description      = "PALLAS System Monitor"

# Use the Python executable icon if available, otherwise cmd
$python = (Get-Command py -ErrorAction SilentlyContinue)?.Source `
        ?? (Get-Command python -ErrorAction SilentlyContinue)?.Source
if ($python) { $lnk.IconLocation = "$python,0" }

$lnk.Save()

Write-Host ""
Write-Host "  Shortcut created: $shortcut" -ForegroundColor Green
Write-Host "  Double-click 'PALLAS Monitor' on your Desktop to launch." -ForegroundColor Cyan
Write-Host ""
