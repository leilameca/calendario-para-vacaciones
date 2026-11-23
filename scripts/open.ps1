param([switch]$Admin)
$ErrorActionPreference = 'Stop'
$calendarRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $calendarRoot
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw 'Instala Node.js 24 o superior para abrir el calendario.' }
if (-not (Test-Path -LiteralPath (Join-Path $calendarRoot 'node_modules/sharp'))) {
  & npm.cmd ci --no-audit --no-fund
  if ($LASTEXITCODE -ne 0) { throw 'No se pudieron instalar las dependencias.' }
}
$calendarRunning = $false
try { $calendarResponse = Invoke-WebRequest -Uri 'http://127.0.0.1:3100/api/state' -UseBasicParsing -TimeoutSec 2 } catch { if ($_.Exception.Response.StatusCode.value__ -eq 403) { $calendarRunning = $true } }
if (-not $calendarRunning) {
  New-Item -ItemType Directory -Path (Join-Path $calendarRoot '.data') -Force | Out-Null
  Start-Process -FilePath (Get-Command node).Source -ArgumentList 'server.mjs' -WorkingDirectory $calendarRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $calendarRoot '.data/server.log') -RedirectStandardError (Join-Path $calendarRoot '.data/server-error.log')
  for ($calendarAttempt = 0; $calendarAttempt -lt 40; $calendarAttempt++) {
    if (Test-Path -LiteralPath (Join-Path $calendarRoot '.data/accesos.json')) { break }
    Start-Sleep -Milliseconds 250
  }
  Start-Sleep -Milliseconds 500
}
$calendarKeys = Get-Content -LiteralPath (Join-Path $calendarRoot '.data/accesos.json') -Raw | ConvertFrom-Json
$calendarUrl = if ($Admin) { 'http://127.0.0.1:3100/admin/#' + $calendarKeys.adminToken } else { 'http://127.0.0.1:3100/c/' + $calendarKeys.publicToken }
Start-Process -FilePath $calendarUrl -WindowStyle Hidden
