# One-click launcher: starts the dev server (if it isn't already running),
# opens Biographer in its own app-style window (no tabs / address bar), and
# stops the server again when that window is closed. Paths are relative to
# this script, so it keeps working if the project folder is ever moved.

$root = Split-Path -Parent $PSScriptRoot
$url = "http://localhost:3000"
$log = Join-Path $env:TEMP "biographer-launch.log"

function Write-Log($message) {
  "$(Get-Date -Format s) $message" | Add-Content -Path $log
}

function Test-Server {
  try {
    Invoke-WebRequest $url -UseBasicParsing -TimeoutSec 2 | Out-Null
    return $true
  } catch {
    # An error page still means the server is up.
    return [bool]$_.Exception.Response
  }
}

$edge = @(
  "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
  "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe"
) | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $edge) {
  Write-Log "Edge not found"
  exit 1
}

$server = $null
if (-not (Test-Server)) {
  Write-Log "Starting dev server from $root"
  $npm = (Get-Command npm.cmd).Source
  $server = Start-Process -FilePath $npm -ArgumentList "run", "dev" -WorkingDirectory $root `
    -WindowStyle Hidden -PassThru
  $deadline = (Get-Date).AddSeconds(90)
  while (-not (Test-Server) -and (Get-Date) -lt $deadline) {
    Start-Sleep -Milliseconds 500
  }
  if (-not (Test-Server)) {
    Write-Log "Server did not come up in time"
    taskkill /PID $server.Id /T /F | Out-Null
    exit 1
  }
}

# Dedicated profile keeps this window separate from your everyday Edge
# (Google sign-in and the mic permission are remembered here).
$profileDir = Join-Path $env:LOCALAPPDATA "Biographer\edge-profile"
Write-Log "Opening window"
Start-Process -FilePath $edge -Wait -ArgumentList `
  "--app=$url", "--user-data-dir=`"$profileDir`"", "--no-first-run", "--no-default-browser-check"

Write-Log "Window closed"
if ($server) {
  taskkill /PID $server.Id /T /F | Out-Null
  Write-Log "Server stopped"
}
