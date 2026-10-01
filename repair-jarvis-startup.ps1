param([string]$Revision = 'main')
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$root = Join-Path $env:USERPROFILE 'JARVIS-OS'
if (-not (Test-Path (Join-Path $root 'worker.js'))) { throw 'Mevcut JARVIS kurulumu bulunamadı: %USERPROFILE%\JARVIS-OS' }
if ($Revision -notmatch '^(main|[a-f0-9]{40})$') { throw 'Geçersiz sürüm.' }
$headers = @{ 'User-Agent'='Jarvis-Startup-Repair'; 'Cache-Control'='no-cache' }
# Resolve once, so every downloaded file comes from the same reviewed revision.
if ($Revision -eq 'main') {
  $revisionInfo = Invoke-RestMethod 'https://api.github.com/repos/saygilicihan4-lgtm/Jarvis-os/commits/main' -Headers $headers -TimeoutSec 20
  $Revision = $revisionInfo.sha
  if ($Revision -notmatch '^[a-f0-9]{40}$') { throw 'Sürüm doğrulanamadı.' }
}
$stage = Join-Path $env:TEMP ('jarvis-startup-' + [guid]::NewGuid().ToString('N'))
$backup = Join-Path $root ('startup-backups\files-' + (Get-Date -Format 'yyyyMMdd-HHmmss-fff'))
$files = @('jarvis-startup.ps1','jarvis-boot.xaml','start-worker-windows.ps1','start-worker-windows.bat','JARVIS-STARTUP-HIDDEN.vbs','install-jarvis-startup.ps1','install-jarvis-startup.bat','install-windows-autostart.bat')
$changed = @()
New-Item -ItemType Directory -Path $stage -Force | Out-Null
try {
  Write-Host '[JARVIS] Acilis onarimi indiriliyor. Ses ayarlari korunuyor.'
  foreach ($name in $files) {
    Invoke-WebRequest -UseBasicParsing -Uri "https://raw.githubusercontent.com/saygilicihan4-lgtm/Jarvis-os/$Revision/$name" -Headers $headers -OutFile (Join-Path $stage $name) -TimeoutSec 25
    if ((Get-Item (Join-Path $stage $name)).Length -lt 60) { throw "Eksik dosya: $name" }
  }
  Copy-Item (Join-Path $root 'worker.js') (Join-Path $stage 'worker.js')
  & (Join-Path $stage 'install-jarvis-startup.ps1') -ValidateOnly
  New-Item -ItemType Directory -Path $backup -Force | Out-Null
  foreach ($name in $files) {
    $destination = Join-Path $root $name
    if (Test-Path $destination) { Copy-Item $destination (Join-Path $backup $name) }
    $changed += $name
    Copy-Item (Join-Path $stage $name) $destination -Force
  }
  & (Join-Path $root 'install-jarvis-startup.ps1') -StartNow
  Write-Host '[JARVIS] Acilis kurulumu tamamlandi. Karsilama ekrani baglantiyi simdi kontrol ediyor.' -ForegroundColor Green
} catch {
  foreach ($name in $changed) {
    $old = Join-Path $backup $name
    if (Test-Path $old) { Copy-Item $old (Join-Path $root $name) -Force }
    else { Remove-Item (Join-Path $root $name) -Force -ErrorAction SilentlyContinue }
  }
  throw
} finally {
  Remove-Item $stage -Recurse -Force -ErrorAction SilentlyContinue
}
