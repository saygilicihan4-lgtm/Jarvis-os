$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

Write-Host ""
Write-Host "==============================================" -ForegroundColor Cyan
Write-Host " JARVIS ZERO-COST LOCAL AI - ONE CLICK SETUP" -ForegroundColor Cyan
Write-Host "==============================================" -ForegroundColor Cyan
Write-Host ""

$JarvisDir = Join-Path $env:USERPROFILE "JARVIS-OS"
$Workspace = Join-Path $env:USERPROFILE "JARVIS-Workspace"
$RawBase = "https://raw.githubusercontent.com/saygilicihan4-lgtm/Jarvis-os/main"
New-Item -ItemType Directory -Force -Path $JarvisDir | Out-Null
New-Item -ItemType Directory -Force -Path $Workspace | Out-Null

[Environment]::SetEnvironmentVariable("JARVIS_ZERO_COST_ONLY","1","User")
$env:JARVIS_ZERO_COST_ONLY = "1"

function Download-RepoFile([string]$Name) {
  $url = "$RawBase/$Name?cb=$([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())"
  $dst = Join-Path $JarvisDir $Name
  if (Test-Path $dst) {
    Copy-Item $dst ($dst + ".bak") -Force -ErrorAction SilentlyContinue
  }
  Invoke-WebRequest -UseBasicParsing -Headers @{"Cache-Control"="no-cache";"Pragma"="no-cache"} -Uri $url -OutFile $dst -TimeoutSec 45
  return $dst
}

Write-Host "[1/8] JARVIS dosyalari guncelleniyor..." -ForegroundColor Yellow
$files = @(
  "worker.js",
  "start-worker-windows.bat",
  "jarvis-wake-hotkey.ps1",
  "jarvis-double-clap-v9.py",
  "jarvis-local-stt-v1.py"
)
foreach ($f in $files) { Download-RepoFile $f | Out-Null }

Push-Location $JarvisDir
try {
  node --check worker.js | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "worker.js syntax check failed" }
} finally { Pop-Location }

Write-Host "[2/8] Sistem kapasitesi olculuyor..." -ForegroundColor Yellow
$ramGb = [math]::Round((Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory / 1GB, 1)
if ($ramGb -ge 14) { $BrainModel = "qwen2.5:3b" }
elseif ($ramGb -ge 7) { $BrainModel = "qwen2.5:1.5b" }
else { $BrainModel = "qwen2.5:0.5b" }
$SttModel = "base"
[Environment]::SetEnvironmentVariable("JARVIS_LOCAL_BRAIN_MODEL",$BrainModel,"User")
[Environment]::SetEnvironmentVariable("JARVIS_STT_MODEL",$SttModel,"User")
$env:JARVIS_LOCAL_BRAIN_MODEL = $BrainModel
$env:JARVIS_STT_MODEL = $SttModel
Write-Host ("[JARVIS] RAM: {0} GB -> Local Brain: {1}" -f $ramGb,$BrainModel)

Write-Host "[3/8] Ollama kontrol ediliyor..." -ForegroundColor Yellow
$ollama = Get-Command ollama -ErrorAction SilentlyContinue
if (-not $ollama) {
  $candidates = @(
    (Join-Path $env:LOCALAPPDATA "Programs\Ollama\ollama.exe"),
    (Join-Path $env:ProgramFiles "Ollama\ollama.exe")
  )
  foreach ($c in $candidates) { if (Test-Path $c) { $ollama = Get-Item $c; break } }
}
if (-not $ollama) {
  if (-not (Get-Command winget -ErrorAction SilentlyContinue)) { throw "winget bulunamadi; Ollama otomatik kurulamadi." }
  winget install --id Ollama.Ollama -e --accept-package-agreements --accept-source-agreements --silent
  Start-Sleep -Seconds 3
  $c = Join-Path $env:LOCALAPPDATA "Programs\Ollama\ollama.exe"
  if (Test-Path $c) { $ollama = Get-Item $c }
}
if (-not $ollama) { throw "Ollama kurulumu dogrulanamadi." }
$OllamaExe = $ollama.Source
if (-not $OllamaExe) { $OllamaExe = $ollama.FullName }

$ollamaReady = $false
try { Invoke-RestMethod -Uri "http://127.0.0.1:11434/api/tags" -TimeoutSec 2 | Out-Null; $ollamaReady = $true } catch {}
if (-not $ollamaReady) {
  Start-Process -FilePath $OllamaExe -ArgumentList "serve" -WindowStyle Hidden
  1..30 | ForEach-Object {
    try { Invoke-RestMethod -Uri "http://127.0.0.1:11434/api/tags" -TimeoutSec 2 | Out-Null; $ollamaReady = $true; break }
    catch { Start-Sleep -Seconds 1 }
  }
}
if (-not $ollamaReady) { throw "Ollama local API baslatilamadi." }

Write-Host "[4/8] Ucretsiz yerel beyin modeli hazirlaniyor: $BrainModel" -ForegroundColor Yellow
& $OllamaExe pull $BrainModel
if ($LASTEXITCODE -ne 0) { throw "Ollama model pull failed" }

Write-Host "[5/8] Yerel Turkce STT kuruluyor..." -ForegroundColor Yellow
if (-not (Get-Command py -ErrorAction SilentlyContinue)) { throw "Python py launcher bulunamadi." }
py -m pip install --user --disable-pip-version-check --upgrade faster-whisper sounddevice numpy edge-tts
if ($LASTEXITCODE -ne 0) { throw "Python STT dependencies failed" }

$tempPy = Join-Path $env:TEMP "jarvis-stt-preload.py"
@"
from faster_whisper import WhisperModel
import sounddevice as sd
print("[JARVIS] microphone:", sd.query_devices(kind="input")["name"])
WhisperModel("$SttModel", device="cpu", compute_type="int8")
print("[JARVIS] faster-whisper model ready: $SttModel")
"@ | Set-Content -Encoding UTF8 $tempPy
py $tempPy
if ($LASTEXITCODE -ne 0) { throw "STT model/microphone verification failed" }
Remove-Item $tempPy -Force -ErrorAction SilentlyContinue

Write-Host "[6/8] Eski JARVIS islemleri temizleniyor..." -ForegroundColor Yellow
Get-CimInstance Win32_Process |
  Where-Object {
    ($_.Name -eq "node.exe" -and $_.CommandLine -match "worker\.js") -or
    ($_.Name -match "python|py.exe" -and $_.CommandLine -match "jarvis-local-stt-v1\.py")
  } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
Start-Sleep -Seconds 2

Write-Host "[7/8] JARVIS Worker baslatiliyor..." -ForegroundColor Yellow
Start-Process (Join-Path $JarvisDir "start-worker-windows.bat")

$bridge = $null
1..30 | ForEach-Object {
  try {
    $bridge = Invoke-RestMethod -Uri "http://127.0.0.1:8765/health" -TimeoutSec 2
    if ($bridge.ok) { break }
  } catch {}
  Start-Sleep -Seconds 1
}
if (-not $bridge -or -not $bridge.ok) { throw "JARVIS local bridge health failed" }

$stt = $null
1..45 | ForEach-Object {
  try {
    $stt = Invoke-RestMethod -Uri "http://127.0.0.1:8768/health" -TimeoutSec 2
    if ($stt.ok) { break }
  } catch {}
  Start-Sleep -Seconds 1
}
if (-not $stt -or -not $stt.ok) { throw "JARVIS local STT health failed" }

Write-Host "[8/8] Gercek Local Brain smoke testi..." -ForegroundColor Yellow
$brainBody = @{ message = "Merhaba Jarvis. Kisa, dogal ve hafif esprili bir selam ver." } | ConvertTo-Json -Compress
$brain = Invoke-RestMethod -Uri "http://127.0.0.1:8765/brain" -Method Post -ContentType "application/json" -Body $brainBody -TimeoutSec 90
if (-not $brain.ok -or -not $brain.reply) { throw "Local Brain smoke test failed" }

Write-Host ""
Write-Host "==============================================" -ForegroundColor Green
Write-Host " JARVIS LOCAL AI DOGRULANDI" -ForegroundColor Green
Write-Host "==============================================" -ForegroundColor Green
Write-Host ("Worker : v{0}" -f $bridge.version)
Write-Host ("Brain  : {0} / ZERO COST" -f $brain.model)
Write-Host ("STT    : {0} / {1}" -f $stt.engine,$stt.model)
Write-Host ("Mic    : READY")
Write-Host ("Reply  : {0}" -f $brain.reply)
Write-Host ""
Write-Host "Ucretli AI API: KAPALI" -ForegroundColor Green
Write-Host "Kurulum ancak bu dogrulamalar gectikten sonra basarili sayildi."
