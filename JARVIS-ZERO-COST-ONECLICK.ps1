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
  "jarvis-local-stt-v2.py",
  "JARVIS-LIVE-ACCEPTANCE.ps1"
)
foreach ($f in $files) { Download-RepoFile $f | Out-Null }

Push-Location $JarvisDir
try {
  node --check worker.js | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "worker.js syntax check failed" }
} finally { Pop-Location }

Write-Host "[2/8] Sistem kapasitesi olculuyor..." -ForegroundColor Yellow
$ramGb = [math]::Round((Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory / 1GB, 1)
if ($ramGb -ge 14) { $BrainModel = "qwen3.5:4b" }
elseif ($ramGb -ge 7) { $BrainModel = "qwen3.5:2b" }
else { $BrainModel = "qwen3.5:0.8b" }
$cpuCores = [Environment]::ProcessorCount
if ($ramGb -ge 12 -and $cpuCores -ge 4) { $SttModel = "small" }
elseif ($ramGb -ge 6) { $SttModel = "base" }
else { $SttModel = "tiny" }
[Environment]::SetEnvironmentVariable("JARVIS_LOCAL_BRAIN_MODEL",$BrainModel,"User")
[Environment]::SetEnvironmentVariable("JARVIS_LOCAL_BRAIN_KEEP_ALIVE","30m","User")
[Environment]::SetEnvironmentVariable("JARVIS_STT_MODEL",$SttModel,"User")
$env:JARVIS_LOCAL_BRAIN_MODEL = $BrainModel
$env:JARVIS_LOCAL_BRAIN_KEEP_ALIVE = "30m"
$env:JARVIS_STT_MODEL = $SttModel
Write-Host ("[JARVIS] RAM: {0} GB / CPU: {1} logical -> Brain: {2} / STT: {3}" -f $ramGb,$cpuCores,$BrainModel,$SttModel)

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

if (Get-Command winget -ErrorAction SilentlyContinue) {
  try {
    winget upgrade --id Ollama.Ollama -e --accept-package-agreements --accept-source-agreements --silent | Out-Null
  } catch {}
}

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

function Set-JarvisBrainModel([string]$Model) {
  $script:BrainModel = $Model
  [Environment]::SetEnvironmentVariable("JARVIS_LOCAL_BRAIN_MODEL",$Model,"User")
  $env:JARVIS_LOCAL_BRAIN_MODEL = $Model
}
function Invoke-OllamaBench([string]$Model,[bool]$Measure=$true) {
  $body=@{
    model=$Model
    stream=$false
    think=$false
    keep_alive="30m"
    options=@{temperature=0.1;num_ctx=1024;num_predict=28}
    messages=@(
      @{role="system";content="Turkce, dogal ve cok kisa cevap ver."},
      @{role="user";content="Naber Jarvis? Tek cumle cevap ver."}
    )
  }
  $sw=[Diagnostics.Stopwatch]::StartNew()
  $null=Invoke-RestMethod -Uri "http://127.0.0.1:11434/api/chat" -Method Post -ContentType "application/json" -Body ($body|ConvertTo-Json -Depth 6 -Compress) -TimeoutSec 90
  $sw.Stop()
  if($Measure){ return [math]::Round($sw.Elapsed.TotalMilliseconds,0) }
  return 0
}
function Prepare-BrainModel([string]$Model) {
  Write-Host ("[JARVIS] Model hazirlaniyor: {0}" -f $Model) -ForegroundColor Yellow
  & $OllamaExe pull $Model
  if ($LASTEXITCODE -ne 0) { throw ("Ollama model pull failed: "+$Model) }
  # First call loads the model into RAM; second call measures conversational latency.
  $null=Invoke-OllamaBench $Model $false
  return (Invoke-OllamaBench $Model $true)
}

Write-Host "[4/8] Ucretsiz yerel beyin modeli hazirlaniyor: $BrainModel" -ForegroundColor Yellow
try {
  $BrainLatencyMs=Prepare-BrainModel $BrainModel
} catch {
  Write-Host ("[JARVIS] Qwen3.5 hazirlanamadi: {0}" -f $_.Exception.Message) -ForegroundColor Yellow
  $fallback = if($ramGb -ge 14){"qwen3:4b"} elseif($ramGb -ge 7){"qwen3:1.7b"} else {"qwen3:0.6b"}
  Write-Host ("[JARVIS] Konusma icin Qwen3 fallback: {0}" -f $fallback) -ForegroundColor Yellow
  Set-JarvisBrainModel $fallback
  $BrainLatencyMs=Prepare-BrainModel $BrainModel
}
Write-Host ("[JARVIS] {0} sicak yanit testi: {1} ms" -f $BrainModel,$BrainLatencyMs)

if($BrainModel -eq "qwen3.5:4b" -and $BrainLatencyMs -gt 9000) {
  Write-Host "[JARVIS] Qwen3.5 4B kaliteli ama bu PC'de sohbet icin yavas. 2B'ye geciliyor..." -ForegroundColor Yellow
  Set-JarvisBrainModel "qwen3.5:2b"
  $BrainLatencyMs=Prepare-BrainModel $BrainModel
}
if($BrainModel -eq "qwen3.5:2b" -and $BrainLatencyMs -gt 13000) {
  Write-Host "[JARVIS] Qwen3.5 2B bu PC'de gecikmeli. Akicilik icin 0.8B'ye geciliyor..." -ForegroundColor Yellow
  Set-JarvisBrainModel "qwen3.5:0.8b"
  $BrainLatencyMs=Prepare-BrainModel $BrainModel
}
if($BrainModel -eq "qwen3:4b" -and $BrainLatencyMs -gt 9000) {
  Set-JarvisBrainModel "qwen3:1.7b"
  $BrainLatencyMs=Prepare-BrainModel $BrainModel
}
if($BrainModel -eq "qwen3:1.7b" -and $BrainLatencyMs -gt 13000) {
  Set-JarvisBrainModel "qwen3:0.6b"
  $BrainLatencyMs=Prepare-BrainModel $BrainModel
}

[Environment]::SetEnvironmentVariable("JARVIS_LOCAL_BRAIN_BENCHMARK_MS",[string]$BrainLatencyMs,"User")
$env:JARVIS_LOCAL_BRAIN_BENCHMARK_MS=[string]$BrainLatencyMs
Write-Host ("[JARVIS] Secilen Brain: {0} · sicak yanit: {1} ms" -f $BrainModel,$BrainLatencyMs) -ForegroundColor Green

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

Write-Host "[8/8] JARVIS canli kabul testleri calistiriliyor..." -ForegroundColor Yellow
$acceptance = Join-Path $JarvisDir "JARVIS-LIVE-ACCEPTANCE.ps1"
& powershell -NoProfile -ExecutionPolicy Bypass -File $acceptance
if ($LASTEXITCODE -ne 0) {
  throw "JARVIS live acceptance suite failed. Sistem tamamlandi sayilmadi."
}

Write-Host ""
Write-Host "==============================================" -ForegroundColor Green
Write-Host " JARVIS ZERO-COST LOCAL AI KABUL TESTLERINDEN GECTI" -ForegroundColor Green
Write-Host "==============================================" -ForegroundColor Green
Write-Host ("Worker : v{0}" -f $bridge.version)
Write-Host ("Brain  : {0} / ZERO COST" -f $env:JARVIS_LOCAL_BRAIN_MODEL)
Write-Host ("STT    : {0} / {1}" -f $stt.engine,$stt.model)
Write-Host ("Mic    : {0}" -f $stt.microphone)
Write-Host ""
Write-Host "Ucretli AI API: KAPALI" -ForegroundColor Green
Write-Host "Kurulum ancak tum canli kabul testleri gectigi icin basarili sayildi."

