# A single hidden host owns the Worker for its entire lifetime. No network update at logon.
$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$workspace = if ($env:JARVIS_WORKSPACE) { $env:JARVIS_WORKSPACE } else { Join-Path $env:USERPROFILE 'JARVIS-Workspace' }
$env:JARVIS_WORKSPACE = $workspace
if (-not $env:JARVIS_URL) { $env:JARVIS_URL = 'https://jarvis-os-1iuv.onrender.com' }
$logs = Join-Path $workspace '.jarvis-memory'
New-Item -ItemType Directory -Force -Path $logs | Out-Null
$errorFile = Join-Path $logs 'startup-worker-error.txt'
$created = $false
$mutex = New-Object System.Threading.Mutex($true, 'Local\JARVIS_WORKER_HOST_V2', [ref]$created)
if (-not $created) { $mutex.Dispose(); exit 0 }
try {
  try {
    $health = Invoke-RestMethod 'http://127.0.0.1:8765/health' -TimeoutSec 1
    if ($health.ok -and $health.version -and $health.capabilities) { exit 0 }
  } catch {}
  Remove-Item $errorFile -Force -ErrorAction SilentlyContinue
  $node = (Get-Command node.exe -ErrorAction Stop).Source
  $worker = Join-Path $root 'worker.js'
  if (-not (Test-Path $worker)) { throw 'Worker dosyası bulunamadı. JARVIS kurulumu eksik.' }
  $deviceToken = Join-Path $env:USERPROFILE '.jarvis-device-token'
  $paired = (Test-Path $deviceToken) -and -not [string]::IsNullOrWhiteSpace((Get-Content $deviceToken -Raw))
  if (-not $paired -and -not $env:JARVIS_TOKEN -and -not $env:JARVIS_PAIR_CODE) {
    throw 'Bu bilgisayar henüz eşleştirilmemiş. JARVIS cihaz eşleştirmesi gerekiyor.'
  }
  $process = Start-Process -FilePath $node -ArgumentList ('"' + $worker + '"') -WorkingDirectory $root -WindowStyle Hidden -RedirectStandardOutput (Join-Path $logs 'worker.log') -RedirectStandardError (Join-Path $logs 'worker-error.log') -PassThru
  $process.WaitForExit()
  if ($process.ExitCode -ne 0) { throw ('Worker kapandı (kod ' + $process.ExitCode + '). Ayrıntılar: worker-error.log') }
} catch {
  $_.Exception.Message | Set-Content $errorFile -Encoding UTF8
  exit 1
} finally {
  $mutex.ReleaseMutex()
  $mutex.Dispose()
}
