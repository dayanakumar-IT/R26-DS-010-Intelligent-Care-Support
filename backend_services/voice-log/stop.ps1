# Stop whatever is using SCRIBE port 8004 (run before .\run.ps1 if you get a port error)
$Port = 8004

Write-Host "Stopping SCRIBE backend processes..." -ForegroundColor Yellow

# Uvicorn --reload leaves orphan worker processes; kill the whole tree by command line.
$pythonProcs = Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
    Where-Object {
        $_.Name -match '^python' -and
        ($_.CommandLine -match 'uvicorn|app\.main:app|multiprocessing\.spawn|voice-log')
    }

foreach ($proc in $pythonProcs) {
    Write-Host "  Stopping PID $($proc.ProcessId): $($proc.CommandLine)" -ForegroundColor DarkYellow
    Stop-Process -Id $proc.ProcessId -Force -ErrorAction SilentlyContinue
    taskkill /F /PID $proc.ProcessId 2>$null | Out-Null
}

# Also stop anything still listening on the port (by netstat PID).
$connections = netstat -ano | Select-String ":$Port\s+.*LISTENING"
foreach ($line in $connections) {
    if ($line -match '\s+(\d+)\s*$') {
        $blockingPid = [int]$Matches[1]
        Write-Host "  Stopping listener PID $blockingPid on port $Port..." -ForegroundColor DarkYellow
        Stop-Process -Id $blockingPid -Force -ErrorAction SilentlyContinue
        taskkill /F /PID $blockingPid 2>$null | Out-Null
    }
}

Start-Sleep -Seconds 2

$still = netstat -ano | Select-String ":$Port\s+.*LISTENING"
if ($still) {
    Write-Host ""
    Write-Host "Port $Port is still in use." -ForegroundColor Red
    Write-Host "Close any browser tab open to http://127.0.0.1:$Port then run .\stop.ps1 again." -ForegroundColor Red
    Write-Host "If it persists, restart Cursor or your PC." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Port $Port is free. Run .\run.ps1 now." -ForegroundColor Green
