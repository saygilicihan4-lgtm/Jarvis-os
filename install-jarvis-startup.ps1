param(
  [switch]$StartNow
)

$ErrorActionPreference = "Stop"
$JarvisDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$StartupPs1 = Join-Path $JarvisDir "jarvis-startup.ps1"
$HiddenVbs = Join-Path $JarvisDir "JARVIS-STARTUP-HIDDEN.vbs"
$TaskName = "JARVIS Silent Startup"
$StartupFolder = [Environment]::GetFolderPath("Startup")
$FallbackVbs = Join-Path $StartupFolder "JARVIS-Silent-Startup.vbs"

if (-not (Test-Path $StartupPs1)) { throw "jarvis-startup.ps1 bulunamadi." }
if (-not (Test-Path $HiddenVbs)) { throw "JARVIS-STARTUP-HIDDEN.vbs bulunamadi." }

Write-Host "[JARVIS] Eski gorunur acilis girdileri temizleniyor..." -ForegroundColor Yellow

try {
  Get-ChildItem -Path $StartupFolder -Filter "JARVIS*.cmd" -ErrorAction SilentlyContinue | Remove-Item -Force -ErrorAction SilentlyContinue
  Get-ChildItem -Path $StartupFolder -Filter "JARVIS*.bat" -ErrorAction SilentlyContinue | Remove-Item -Force -ErrorAction SilentlyContinue
  if (Test-Path $FallbackVbs) { Remove-Item $FallbackVbs -Force -ErrorAction SilentlyContinue }
} catch {}

try {
  $legacyTasks = Get-ScheduledTask -ErrorAction SilentlyContinue | Where-Object {
    $_.TaskName -match "(?i)^JARVIS" -and $_.TaskName -ne $TaskName
  }
  foreach ($task in $legacyTasks) {
    try {
      Disable-ScheduledTask -TaskName $task.TaskName -TaskPath $task.TaskPath -ErrorAction SilentlyContinue | Out-Null
      Write-Host ("[JARVIS] Legacy task disabled: " + $task.TaskName) -ForegroundColor DarkGray
    } catch {}
  }
} catch {}

$userId = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
$wscript = Join-Path $env:SystemRoot "System32\wscript.exe"

$action = New-ScheduledTaskAction -Execute $wscript -Argument ('"' + $HiddenVbs + '"')
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $userId
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Hours 0)

$registered = $false
try {
  $principal = New-ScheduledTaskPrincipal -UserId $userId -LogonType Interactive -RunLevel Highest
  Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Force | Out-Null
  $registered = $true
  Write-Host "[JARVIS] Silent startup registered with highest privileges." -ForegroundColor Green
} catch {
  Write-Host "[JARVIS] Highest privileges unavailable; normal user startup deneniyor." -ForegroundColor Yellow
  try {
    $principal = New-ScheduledTaskPrincipal -UserId $userId -LogonType Interactive -RunLevel Limited
    Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Force | Out-Null
    $registered = $true
    Write-Host "[JARVIS] Silent startup registered for current user." -ForegroundColor Green
  } catch {}
}

if (-not $registered) {
  Copy-Item $HiddenVbs $FallbackVbs -Force
  Write-Host "[JARVIS] Task Scheduler kullanilamadi; Startup klasoru fallback hazirlandi." -ForegroundColor Yellow
}

if ($StartNow) {
  try {
    if ($registered) {
      Start-ScheduledTask -TaskName $TaskName
    } else {
      Start-Process -FilePath $wscript -ArgumentList ('"' + $FallbackVbs + '"')
    }
  } catch {}
}

Write-Host ""
Write-Host "[JARVIS] ACILIS MODU HAZIR" -ForegroundColor Cyan
Write-Host "  - Mavi/bos PowerShell pencereleri: gizli"
Write-Host "  - Worker/voice/brain: arka planda"
Write-Host "  - Kullaniciya gorunen tek baslangic: JARVIS cinematic boot"
Write-Host "  - Legacy JARVIS startup tasks: disabled"
