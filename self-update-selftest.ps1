$ErrorActionPreference='Stop'

$root=Split-Path -Parent $MyInvocation.MyCommand.Path
$updater=Join-Path $root 'jarvis-self-update.ps1'
$manifestPath=Join-Path $root 'jarvis-update-manifest.json'
$launcher=Join-Path $root 'start-worker-windows.bat'

if(-not (Test-Path $updater)){ throw 'jarvis-self-update.ps1 missing' }
if(-not (Test-Path $manifestPath)){ throw 'jarvis-update-manifest.json missing' }

$updaterText=Get-Content $updater -Raw
[scriptblock]::Create($updaterText) | Out-Null
if(-not $updaterText.Contains("UPDATER_VERSION='5.0'")){ throw 'Updater v5 signature missing' }
if(-not $updaterText.Contains('update-backups')){ throw 'Rollback backup support missing' }
if(-not $updaterText.Contains('Post-copy hash verification failed')){ throw 'Post-copy hash verification missing' }
if(-not $updaterText.Contains('jarvis-self-update.next.ps1')){ throw 'Deferred updater handoff missing' }

$manifest=Get-Content $manifestPath -Raw | ConvertFrom-Json
if([int]$manifest.schema -ne 1){ throw 'Manifest schema mismatch' }
$paths=@($manifest.files | ForEach-Object { [string]$_.path })
$required=@(
  'worker.js',
  'jarvis-commerce-engine.js',
  'jarvis-shopify-connect.ps1',
  'jarvis-youtube-studio.js',
  'jarvis-mission-engine.js',
  'jarvis-startup.ps1',
  'JARVIS-STARTUP-HIDDEN.vbs',
  'install-jarvis-startup.ps1',
  'jarvis-local-stt-v4.py',
  'jarvis-double-clap-v9.py',
  'jarvis-wake-hotkey.ps1',
  'jarvis-self-update.ps1'
)
foreach($name in $required){
  if($paths -notcontains $name){ throw ('Manifest missing: '+$name) }
}

$launcherText=Get-Content $launcher -Raw
if(-not $launcherText.Contains('jarvis-self-update.ps1')){ throw 'Launcher does not invoke unified updater' }
if(-not $launcherText.Contains('jarvis-self-update.next.ps1')){ throw 'Launcher does not promote pending updater' }
if(-not $launcherText.Contains('UNIFIED_UPDATE_OK')){ throw 'Launcher unified updater fallback flag missing' }

Write-Host '[JARVIS] SELF UPDATE SELFTEST: PASS'
