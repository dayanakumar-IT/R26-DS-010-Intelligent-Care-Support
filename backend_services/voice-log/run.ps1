# SCRIBE backend - use this venv (short path avoids Windows PyTorch install errors)
$VenvPython = "$env:USERPROFILE\.venvs\scribe-voice-log\Scripts\python.exe"
$VenvUvicorn = "$env:USERPROFILE\.venvs\scribe-voice-log\Scripts\uvicorn.exe"
$Port = 8004

Set-Location $PSScriptRoot

if (-not (Test-Path $VenvPython)) {
    Write-Error "Venv not found at $env:USERPROFILE\.venvs\scribe-voice-log - run setup from the guide first."
    exit 1
}

$portInUse = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
if ($portInUse) {
    $blockingPid = $portInUse.OwningProcess | Select-Object -First 1
    Write-Host ""
    Write-Host "Port $Port is already in use (process ID $blockingPid)." -ForegroundColor Yellow
    Write-Host "Another SCRIBE backend is probably still running." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Fix - run this in PowerShell, then run .\run.ps1 again:" -ForegroundColor Cyan
    Write-Host "  Stop-Process -Id $blockingPid -Force" -ForegroundColor White
    Write-Host ""
    exit 1
}

& $VenvUvicorn app.main:app --host 127.0.0.1 --port $Port --reload
