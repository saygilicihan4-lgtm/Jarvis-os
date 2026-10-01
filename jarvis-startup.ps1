param([switch]$NoBrowser, [switch]$NoSplash, [switch]$OpenAgain, [switch]$LibraryOnly)
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

function Get-JarvisBootResult($Health, $Brain, $Voice) {
  if (-not $Health -or $Health.ok -ne $true -or -not $Health.version -or -not $Health.capabilities) { return 'offline' }
  if ($Brain.ready -eq $true -and $Brain.installed -eq $true -and $Voice.ok -eq $true) { return 'ready' }
  return 'limited'
}
if ($LibraryOnly) { return }

$JarvisDir = $PSScriptRoot
$Workspace = if ($env:JARVIS_WORKSPACE) { $env:JARVIS_WORKSPACE } else { Join-Path $env:USERPROFILE 'JARVIS-Workspace' }
$MemoryDir = Join-Path $Workspace '.jarvis-memory'
$LogFile = Join-Path $MemoryDir 'startup.log'
$JarvisUrl = if ($env:JARVIS_URL) { $env:JARVIS_URL.TrimEnd('/') } else { 'https://jarvis-os-1iuv.onrender.com' }
New-Item -ItemType Directory -Force -Path $MemoryDir | Out-Null
function Write-StartupLog([string]$Message) {
  Add-Content -Path $LogFile -Value ('[{0}] {1}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $Message) -Encoding UTF8
}
$created = $false
$mutex = New-Object System.Threading.Mutex($true, 'Local\JARVIS_CINEMATIC_STARTUP_V2', [ref]$created)
if (-not $created) { $mutex.Dispose(); exit 0 }
$script:window = $null
$script:timer = $null
$client = $null
$script:checks = @{}
$script:finished = $false
$script:closeAt = $null
$script:browserOpened = $false
$sessionMarker = Join-Path $MemoryDir 'startup-session.txt'
$sessionId = [Diagnostics.Process]::GetCurrentProcess().SessionId
# Explorer start time distinguishes logons even when Windows reuses a session ID.
$explorer = Get-Process explorer -ErrorAction SilentlyContinue | Where-Object { $_.SessionId -eq $sessionId } | Select-Object -First 1
$sessionKey = if ($explorer) { "$sessionId-$($explorer.StartTime.ToUniversalTime().Ticks)" } else { $null }

function Start-JarvisWorker {
  $hostScript = Join-Path $JarvisDir 'start-worker-windows.ps1'
  if (-not (Test-Path $hostScript)) { throw 'Başlatıcı eksik. Açılış onarımını yeniden çalıştırın.' }
  Start-Process -FilePath 'powershell.exe' -ArgumentList ('-NoProfile -NonInteractive -ExecutionPolicy Bypass -WindowStyle Hidden -File "' + $hostScript + '"') -WindowStyle Hidden | Out-Null
}
function Open-JarvisInterface {
  if ($NoBrowser -or $script:browserOpened) { return }
  if (-not $OpenAgain -and $sessionKey -and (Test-Path $sessionMarker) -and (Get-Content $sessionMarker -Raw).Trim() -eq $sessionKey) {
    Write-StartupLog 'Interface already opened for this Windows session.'
    $script:browserOpened = $true
    return
  }
  $url = $JarvisUrl + '/?startup=1'
  $browser = $null
  foreach ($base in @(${env:ProgramFiles(x86)}, $env:ProgramFiles, $env:LOCALAPPDATA)) {
    if (-not $base) { continue }
    foreach ($relative in @('Microsoft\Edge\Application\msedge.exe', 'Google\Chrome\Application\chrome.exe')) {
      $candidate = Join-Path $base $relative
      if (Test-Path $candidate) { $browser = $candidate; break }
    }
    if ($browser) { break }
  }
  if ($browser) { Start-Process $browser -ArgumentList ('--app="' + $url + '"') | Out-Null }
  else { Start-Process $url | Out-Null }
  $script:browserOpened = $true
  if ($sessionKey) { $sessionKey | Set-Content $sessionMarker -Encoding UTF8 }
  Write-StartupLog 'Command interface opened.'
}
function Set-BootMessage([string]$Stage, [string]$Detail) {
  Write-StartupLog "$Stage | $Detail"
  if ($script:window) {
    $script:window.FindName('StageText').Text = $Stage
    $script:window.FindName('DetailText').Text = $Detail
  }
}
function Start-BootChecks {
  foreach ($check in $script:checks.Values) { if ($check.task) { $check.cancel.Cancel(); $check.cancel.Dispose() } }
  $script:checks = @{}
  foreach ($spec in @(@('worker','http://127.0.0.1:8765/health'), @('brain','http://127.0.0.1:8765/brain-status'), @('voice','http://127.0.0.1:8768/health'))) {
    $script:checks[$spec[0]] = @{ url=$spec[1]; task=$null; cancel=$null; value=$null; next=[DateTime]::UtcNow }
  }
  $script:started = [DateTime]::UtcNow
  $script:finished = $false
  $script:closeAt = $null
  if ($script:window) {
    $script:window.FindName('RetryButton').Visibility = 'Collapsed'
    $script:window.FindName('LogButton').Visibility = 'Collapsed'
    $script:window.FindName('BootProgress').IsIndeterminate = $true
  }
  Set-BootMessage 'Başlatılıyor' 'Bilgisayar bağlantısı kontrol ediliyor.'
  Start-JarvisWorker
}
function Update-BootChecks {
  if ($script:finished) {
    if ($script:closeAt -and [DateTime]::UtcNow -ge $script:closeAt -and $script:window) { $script:window.Close() }
    return
  }
  $now = [DateTime]::UtcNow
  foreach ($key in @($script:checks.Keys)) {
    $check = $script:checks[$key]
    if ($check.task -and $check.task.IsCompleted) {
      try {
        $response = $check.task.GetAwaiter().GetResult()
        try {
          if (-not $response.IsSuccessStatusCode) { throw 'Health HTTP error' }
          $check.value = $response.Content.ReadAsStringAsync().GetAwaiter().GetResult() | ConvertFrom-Json
        } finally { $response.Dispose() }
      } catch { $check.value = $null }
      $check.cancel.Dispose()
      $check.cancel = $null
      $check.task = $null
      $check.next = $now.AddSeconds(1)
    }
    if (-not $check.task -and $now -ge $check.next) {
      $check.cancel = New-Object System.Threading.CancellationTokenSource
      $check.cancel.CancelAfter(1600)
      $check.task = $client.GetAsync($check.url, $check.cancel.Token)
    }
  }
  $health = $script:checks.worker.value
  $brain = $script:checks.brain.value
  $voice = $script:checks.voice.value
  $state = Get-JarvisBootResult $health $brain $voice
  $seconds = ($now - $script:started).TotalSeconds
  if ($script:window) {
    $workerLabel = if ($state -ne 'offline') { 'BAĞLI' } else { 'BEKLENİYOR' }
    $brainLabel = if ($brain.ready -and $brain.installed) { 'HAZIR' } else { 'BEKLENİYOR' }
    $voiceLabel = if ($voice.ok) { 'HAZIR' } else { 'BEKLENİYOR' }
    $script:window.FindName('StatusText').Text = "BİLGİSAYAR · $workerLabel     SOHBET · $brainLabel     MİKROFON · $voiceLabel"
  }
  $workerError = Join-Path $MemoryDir 'startup-worker-error.txt'
  $newError = (Test-Path $workerError) -and (Get-Item $workerError).LastWriteTimeUtc -ge $script:started
  if ($state -eq 'ready' -or ($state -eq 'limited' -and $seconds -ge 12)) {
    if ($state -eq 'ready') { Set-BootMessage 'Bilgisayar bağlantısı hazır' 'Yerel sohbet ve mikrofon yanıt veriyor. JARVIS açılıyor.' }
    else { Set-BootMessage 'Bilgisayar bağlı' 'Sohbet veya mikrofon henüz hazır değil. Durumu ana ekrandan takip edebilirsiniz.' }
    Open-JarvisInterface
    $script:finished = $true
    $script:closeAt = $now.AddSeconds(2)
  } elseif ($seconds -ge 25 -or ($newError -and $state -eq 'offline')) {
    $detail = if ($newError) { (Get-Content $workerError -Raw).Trim() } else { 'Bilgisayar bağlantısı 25 saniye içinde kurulamadı. Yeniden deneyebilir veya günlüğü açabilirsiniz.' }
    Set-BootMessage 'Bağlantı kurulamadı' $detail
    $script:finished = $true
    if ($script:window) {
      $script:window.FindName('RetryButton').Visibility = 'Visible'
      $script:window.FindName('LogButton').Visibility = 'Visible'
    }
  }
  if ($script:finished -and $script:window) { $script:window.FindName('BootProgress').IsIndeterminate = $false }
}
try {
  Add-Type -AssemblyName System.Net.Http
  $handler = New-Object System.Net.Http.HttpClientHandler
  $handler.UseProxy = $false
  $client = New-Object System.Net.Http.HttpClient($handler)
  if (-not $NoSplash) {
    Add-Type -AssemblyName PresentationFramework, PresentationCore, WindowsBase
    $reader = New-Object System.Xml.XmlNodeReader ([xml](Get-Content (Join-Path $JarvisDir 'jarvis-boot.xaml') -Raw -Encoding UTF8))
    $script:window = [Windows.Markup.XamlReader]::Load($reader)
    $script:window.FindName('CloseButton').Add_Click({ $script:window.Close() })
    $script:window.Add_KeyDown({ param($sender, $event) if ($event.Key -eq 'Escape') { $sender.Close() } })
    $script:window.FindName('LogButton').Add_Click({ Start-Process explorer.exe -ArgumentList ('"' + $MemoryDir + '"') })
    $script:window.FindName('RetryButton').Add_Click({ try { Start-BootChecks } catch { Set-BootMessage 'Başlatılamadı' $_.Exception.Message } })
    $script:timer = New-Object Windows.Threading.DispatcherTimer
    $script:timer.Interval = [TimeSpan]::FromMilliseconds(100)
    $script:timer.Add_Tick({
      try { Update-BootChecks } catch {
        Set-BootMessage 'Açılış tamamlanamadı' $_.Exception.Message
        $script:finished = $true
        $script:window.FindName('BootProgress').IsIndeterminate = $false
        $script:window.FindName('RetryButton').Visibility = 'Visible'
        $script:window.FindName('LogButton').Visibility = 'Visible'
      }
    })
    $script:window.Add_ContentRendered({
      try { Start-BootChecks; $script:timer.Start() } catch {
        Set-BootMessage 'Başlatılamadı' $_.Exception.Message
        $script:window.FindName('BootProgress').IsIndeterminate = $false
        $script:window.FindName('LogButton').Visibility = 'Visible'
      }
    })
    $script:window.ShowDialog() | Out-Null
  } else {
    Start-BootChecks
    while (-not $script:finished) { Update-BootChecks; Start-Sleep -Milliseconds 100 }
  }
} catch {
  Write-StartupLog ('Startup failure: ' + $_.Exception.Message)
  if (-not $NoSplash) {
    Add-Type -AssemblyName PresentationFramework
    [System.Windows.MessageBox]::Show('JARVIS açılışı tamamlanamadı. Ayrıntılar: ' + $LogFile, 'JARVIS') | Out-Null
  }
  exit 1
} finally {
  if ($script:timer) { $script:timer.Stop() }
  foreach ($check in $script:checks.Values) { if ($check.cancel) { $check.cancel.Cancel(); $check.cancel.Dispose() } }
  if ($client) { $client.Dispose() }
  $mutex.ReleaseMutex()
  $mutex.Dispose()
}
