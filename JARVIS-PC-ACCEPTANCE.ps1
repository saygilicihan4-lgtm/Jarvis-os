param(
  [switch]$Json
)

# JARVIS PC ACCEPTANCE V1
# Read-only acceptance check. It never publishes, uploads, creates products,
# changes account settings, or reads JARVIS secrets.

$ErrorActionPreference = "Stop"
$Endpoint = "http://127.0.0.1:8765/acceptance-snapshot"

function Wait-Jarvis([int]$Seconds=20) {
  $deadline = (Get-Date).AddSeconds($Seconds)
  do {
    try {
      $h = Invoke-RestMethod -Uri "http://127.0.0.1:8765/health" -TimeoutSec 2
      if ($h.ok) { return $true }
    } catch {}
    Start-Sleep -Milliseconds 500
  } while ((Get-Date) -lt $deadline)
  return $false
}

if (-not (Wait-Jarvis 20)) {
  if ($Json) {
    @{ok=$false;error="JARVIS local Worker bridge is not ready."} | ConvertTo-Json -Depth 5
  } else {
    Write-Host "[FAIL] JARVIS Worker bridge is not ready." -ForegroundColor Red
  }
  exit 2
}

try {
  $snapshot = Invoke-RestMethod -Uri $Endpoint -TimeoutSec 20
} catch {
  if ($Json) {
    @{ok=$false;error=$_.Exception.Message} | ConvertTo-Json -Depth 5
  } else {
    Write-Host ("[FAIL] Acceptance snapshot unavailable: " + $_.Exception.Message) -ForegroundColor Red
  }
  exit 3
}

if ($Json) {
  $snapshot | ConvertTo-Json -Depth 12
  if ($snapshot.corePass -eq $true) { exit 0 } else { exit 1 }
}

Write-Host ""
Write-Host "==============================================" -ForegroundColor Cyan
Write-Host " JARVIS PC ACCEPTANCE - READ ONLY" -ForegroundColor Cyan
Write-Host "==============================================" -ForegroundColor Cyan
Write-Host ("Worker        : " + $snapshot.worker.version)
Write-Host ("Core          : " + $(if($snapshot.corePass){"PASS"}else{"CHECK"}))
Write-Host ("Mission engine: " + $snapshot.checks.missionRuntime)
Write-Host ("Creator       : engine=" + $snapshot.checks.creatorEngineLoaded + " ready=" + $snapshot.creator.ready)
Write-Host ("Browser       : engine=" + $snapshot.checks.browserOperatorLoaded + " running=" + $snapshot.browser.running)

if ($snapshot.startup.windows) {
  Write-Host ("Silent startup: " + $snapshot.startup.silentOk)
  Write-Host ("Startup task  : registered=" + $snapshot.startup.taskRegistered + " hiddenAction=" + $snapshot.startup.hiddenTaskAction + " fallback=" + $snapshot.startup.fallbackRegistered)
  Write-Host ("Visible shells: " + @($snapshot.startup.visibleJarvisShells).Count)
} else {
  Write-Host "Silent startup: Windows physical test required"
}

Write-Host ("Shopify       : " + $(if($snapshot.accountSetup.shopifyConnected){"READY"}else{"SETUP REQUIRED"}))
Write-Host ("YouTube       : " + $(if($snapshot.accountSetup.youtubeLoggedIn){"READY"}else{"LOGIN REQUIRED"}))
Write-Host ("Open missions : " + $snapshot.missions.openCount)
if ($snapshot.report) { Write-Host ("Evidence file : " + $snapshot.report) }

Write-Host ""
if ($snapshot.corePass -eq $true) {
  Write-Host "[PASS] JARVIS core acceptance checks passed." -ForegroundColor Green
  if (-not $snapshot.accountSetup.shopifyConnected -or -not $snapshot.accountSetup.youtubeLoggedIn) {
    Write-Host "[INFO] Account setup is still separate from core health." -ForegroundColor Yellow
  }
  exit 0
}

Write-Host "[CHECK] One or more core acceptance checks need attention." -ForegroundColor Yellow
exit 1
