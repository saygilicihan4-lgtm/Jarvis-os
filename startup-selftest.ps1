$ErrorActionPreference = "Stop"

function Assert-Contains([string]$Text,[string]$Needle,[string]$Message) {
  if (-not $Text.Contains($Needle)) { throw $Message }
}

$startup = Get-Content ./jarvis-startup.ps1 -Raw
$vbs = Get-Content ./JARVIS-STARTUP-HIDDEN.vbs -Raw
$bat = Get-Content ./start-worker-windows.bat -Raw
$installer = Get-Content ./install-jarvis-startup.ps1 -Raw
$oneclick = Get-Content ./JARVIS-ZERO-COST-ONECLICK.ps1 -Raw

Assert-Contains $startup 'WindowStyle="None"' "Cinematic startup must be borderless."
Assert-Contains $startup 'WindowState="Maximized"' "Cinematic startup must own the boot screen."
Assert-Contains $startup '--autostart --silent' "Startup must launch Worker silently."
Assert-Contains $startup 'http://127.0.0.1:8765/health' "Startup must verify Worker health."
Assert-Contains $startup 'http://127.0.0.1:8768/health' "Startup must verify voice health."
Assert-Contains $startup 'JARVIS ONLINE' "Startup must expose a final online stage."

Assert-Contains $vbs 'shell.Run cmd, 0, False' "VBS bootstrap must hide the PowerShell host."
Assert-Contains $bat 'LAUNCHER_VERSION=4.1' "Launcher 4.1 is required."
Assert-Contains $bat '--silent' "Launcher must support silent startup."
Assert-Contains $bat 'node worker.js >>"%JARVIS_WORKER_LOG%" 2>&1' "Silent Worker output must go to a log instead of a console."

Assert-Contains $installer '$TaskName = "JARVIS Silent Startup"' "Canonical startup task is missing."
Assert-Contains $installer 'Disable-ScheduledTask' "Legacy visible JARVIS tasks must be disabled."
Assert-Contains $installer 'wscript.exe' "Canonical startup must use the hidden VBS host."

Assert-Contains $oneclick '"jarvis-startup.ps1"' "One-click installer must download startup orchestrator."
Assert-Contains $oneclick '"JARVIS-STARTUP-HIDDEN.vbs"' "One-click installer must download hidden bootstrap."
Assert-Contains $oneclick '"install-jarvis-startup.ps1"' "One-click installer must download startup installer."
Assert-Contains $oneclick 'Sessiz cinematic acilis kuruluyor' "One-click installer must install cinematic startup."

Write-Host "STARTUP SELFTEST PASS"
