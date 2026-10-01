param(
  [switch]$NoBrowser,
  [switch]$NoSplash
)

$ErrorActionPreference = "SilentlyContinue"
$ProgressPreference = "SilentlyContinue"

$JarvisDir = Join-Path $env:USERPROFILE "JARVIS-OS"
$Workspace = Join-Path $env:USERPROFILE "JARVIS-Workspace"
$MemoryDir = Join-Path $Workspace ".jarvis-memory"
$LogFile = Join-Path $MemoryDir "startup.log"
$JarvisUrl = if ($env:JARVIS_URL) { $env:JARVIS_URL.TrimEnd("/") } else { "https://jarvis-os-1iuv.onrender.com" }
New-Item -ItemType Directory -Force -Path $MemoryDir | Out-Null

function Write-StartupLog([string]$Message) {
  try {
    $line = ("[{0}] {1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss.fff"), $Message)
    Add-Content -Path $LogFile -Value $line -Encoding UTF8
  } catch {}
}

$created = $false
$mutex = New-Object System.Threading.Mutex($true, "Local\JARVIS_CINEMATIC_STARTUP_V1", [ref]$created)
if (-not $created) {
  Write-StartupLog "Startup already active; duplicate ignored."
  try { $mutex.Dispose() } catch {}
  exit 0
}

$window = $null
$stageText = $null
$detailText = $null
$progress = $null
$bootCode = $null
$closedByUser = $false

function Pump-Ui {
  if ($null -eq $window -or $closedByUser) { return }
  try {
    $window.Dispatcher.Invoke([Action]{}, [System.Windows.Threading.DispatcherPriority]::Render)
  } catch {}
}

function Set-BootStage(
  [string]$Stage,
  [string]$Detail,
  [double]$Percent
) {
  Write-StartupLog ("{0} | {1} | {2}%" -f $Stage, $Detail, [math]::Round($Percent))
  if ($null -eq $window -or $closedByUser) { return }
  try {
    $stageText.Text = $Stage
    $detailText.Text = $Detail
    $progress.Value = [math]::Max(0, [math]::Min(100, $Percent))
    Pump-Ui
  } catch {}
}

function Close-Splash {
  if ($null -ne $window -and -not $closedByUser) {
    try {
      $closedByUser = $true
      $window.Close()
    } catch {}
  }
}

if (-not $NoSplash) {
  try {
    Add-Type -AssemblyName PresentationFramework, PresentationCore, WindowsBase

    $xaml = @"
<Window xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        WindowStyle="None"
        ResizeMode="NoResize"
        WindowState="Maximized"
        Topmost="True"
        ShowInTaskbar="False"
        Background="#02050D"
        AllowsTransparency="False">
  <Grid>
    <Grid.Background>
      <RadialGradientBrush Center="0.50,0.48" GradientOrigin="0.50,0.48" RadiusX="0.72" RadiusY="0.72">
        <GradientStop Color="#11255C" Offset="0"/>
        <GradientStop Color="#06152F" Offset="0.38"/>
        <GradientStop Color="#02050D" Offset="1"/>
      </RadialGradientBrush>
    </Grid.Background>

    <Canvas IsHitTestVisible="False" Opacity="0.42">
      <Ellipse Width="540" Height="540" Canvas.Left="690" Canvas.Top="225"
               Stroke="#2B7CFF" StrokeThickness="1"/>
      <Ellipse Width="430" Height="430" Canvas.Left="745" Canvas.Top="280"
               Stroke="#38D9FF" StrokeThickness="2"/>
      <Ellipse Width="320" Height="320" Canvas.Left="800" Canvas.Top="335"
               Stroke="#715CFF" StrokeThickness="1"/>
      <Ellipse Width="210" Height="210" Canvas.Left="855" Canvas.Top="390"
               Fill="#071B42" Stroke="#52E7FF" StrokeThickness="2"/>
    </Canvas>

    <Grid Margin="80">
      <Grid.RowDefinitions>
        <RowDefinition Height="*"/>
        <RowDefinition Height="Auto"/>
        <RowDefinition Height="Auto"/>
      </Grid.RowDefinitions>

      <StackPanel Grid.Row="0" VerticalAlignment="Center" HorizontalAlignment="Center">
        <TextBlock Text="J A R V I S"
                   Foreground="#EAF8FF"
                   FontFamily="Segoe UI Semibold"
                   FontSize="68"
                   FontWeight="SemiBold"
                   HorizontalAlignment="Center"
                   CharacterSpacing="160"/>
        <TextBlock Text="PERSONAL AUTONOMOUS SYSTEM"
                   Margin="0,10,0,0"
                   Foreground="#64CFFF"
                   FontFamily="Consolas"
                   FontSize="16"
                   HorizontalAlignment="Center"/>
        <Border Width="132" Height="132" Margin="0,42,0,34"
                CornerRadius="66"
                Background="#071B42"
                BorderBrush="#43E9FF"
                BorderThickness="2">
          <Grid>
            <Ellipse Margin="16" Stroke="#367CFF" StrokeThickness="1"/>
            <Ellipse Margin="31" Stroke="#3FE7FF" StrokeThickness="2"/>
            <Ellipse Margin="48" Fill="#69F4FF"/>
          </Grid>
        </Border>
        <TextBlock x:Name="StageText"
                   Text="INITIALIZING"
                   Foreground="#F7FBFF"
                   FontFamily="Consolas"
                   FontSize="20"
                   FontWeight="Bold"
                   HorizontalAlignment="Center"/>
        <TextBlock x:Name="DetailText"
                   Text="Secure local systems are coming online."
                   Margin="0,10,0,0"
                   Foreground="#8CB7D8"
                   FontFamily="Segoe UI"
                   FontSize="14"
                   HorizontalAlignment="Center"/>
      </StackPanel>

      <StackPanel Grid.Row="1" Width="620" HorizontalAlignment="Center" Margin="0,0,0,28">
        <ProgressBar x:Name="BootProgress"
                     Height="7"
                     Minimum="0"
                     Maximum="100"
                     Value="4"
                     Foreground="#36D9FF"
                     Background="#10233B"
                     BorderThickness="0"/>
        <DockPanel Margin="0,10,0,0">
          <TextBlock Text="CORE" Foreground="#5E88A7" FontFamily="Consolas" FontSize="11"/>
          <TextBlock Text="LOCAL AI" Foreground="#5E88A7" FontFamily="Consolas" FontSize="11" Margin="100,0,0,0"/>
          <TextBlock Text="VOICE" Foreground="#5E88A7" FontFamily="Consolas" FontSize="11" Margin="100,0,0,0"/>
          <TextBlock Text="LINK" Foreground="#5E88A7" FontFamily="Consolas" FontSize="11" Margin="100,0,0,0"/>
        </DockPanel>
      </StackPanel>

      <DockPanel Grid.Row="2" LastChildFill="False">
        <TextBlock x:Name="BootCode"
                   Text="ZERO-COST LOCAL MODE"
                   Foreground="#3FE7FF"
                   FontFamily="Consolas"
                   FontSize="11"
                   DockPanel.Dock="Left"/>
        <TextBlock Text="ESC = HIDE"
                   Foreground="#47647A"
                   FontFamily="Consolas"
                   FontSize="11"
                   DockPanel.Dock="Right"/>
      </DockPanel>
    </Grid>
  </Grid>
</Window>
"@

    $reader = New-Object System.Xml.XmlNodeReader ([xml]$xaml)
    $window = [Windows.Markup.XamlReader]::Load($reader)
    $stageText = $window.FindName("StageText")
    $detailText = $window.FindName("DetailText")
    $progress = $window.FindName("BootProgress")
    $bootCode = $window.FindName("BootCode")
    $window.Add_KeyDown({
      param($sender, $e)
      if ($e.Key -eq [System.Windows.Input.Key]::Escape) {
        $script:closedByUser = $true
        try { $sender.Close() } catch {}
      }
    })
    $window.Show()
    Pump-Ui
  } catch {
    Write-StartupLog ("Splash unavailable: " + $_.Exception.Message)
    $window = $null
  }
}

try {
  Set-BootStage "CORE START" "JARVIS background services are starting silently." 10

  $health = $null
  try {
    $health = Invoke-RestMethod -Uri "http://127.0.0.1:8765/health" -TimeoutSec 1
  } catch {}

  if (-not $health -or -not $health.ok) {
    $launcher = Join-Path $JarvisDir "start-worker-windows.bat"
    if (-not (Test-Path $launcher)) {
      throw "start-worker-windows.bat not found"
    }

    $cmdLine = '""' + $launcher + '" --autostart --silent"'
    Start-Process -FilePath $env:ComSpec -ArgumentList @("/d","/s","/c",$cmdLine) -WindowStyle Hidden
  }

  Set-BootStage "CORE LINK" "Waiting for the local Worker bridge." 24
  $health = $null
  for ($i=0; $i -lt 80; $i++) {
    try {
      $health = Invoke-RestMethod -Uri "http://127.0.0.1:8765/health" -TimeoutSec 1
      if ($health.ok) { break }
    } catch {}
    if (($i % 8) -eq 0) {
      Set-BootStage "CORE LINK" ("Worker handshake " + ([math]::Min(99, $i + 1)) + "/80") (24 + [math]::Min(24, $i * 0.30))
    }
    Start-Sleep -Milliseconds 350
    Pump-Ui
  }
  if (-not $health -or -not $health.ok) {
    throw "Worker bridge did not become ready."
  }

  $workerVersion = [string]$health.version
  if ($bootCode) { $bootCode.Text = "WORKER " + $workerVersion + "  ·  ZERO-COST LOCAL MODE" }
  Set-BootStage "LOCAL AI" ("Worker " + $workerVersion + " online. Local brain warm-up.") 54

  $brain = $null
  try {
    $brain = Invoke-RestMethod -Uri "http://127.0.0.1:8765/brain-status" -TimeoutSec 3
  } catch {}

  if ($brain -and $brain.ready -and $brain.installed) {
    Set-BootStage "LOCAL AI" (([string]$brain.model) + " ready.") 66
  } else {
    Set-BootStage "LOCAL AI" "Brain is warming in the background; startup will continue." 62
  }

  Set-BootStage "VOICE" "Loading local Turkish speech recognition." 72
  $stt = $null
  for ($i=0; $i -lt 24; $i++) {
    try {
      $stt = Invoke-RestMethod -Uri "http://127.0.0.1:8768/health" -TimeoutSec 1
      if ($stt.ok) { break }
    } catch {}
    Start-Sleep -Milliseconds 250
    Pump-Ui
  }

  if ($stt -and $stt.ok) {
    $micName = [string]$stt.microphone
    if ($micName.Length -gt 54) { $micName = $micName.Substring(0,54) + "…" }
    Set-BootStage "VOICE" ("Microphone linked: " + $micName) 84
  } else {
    Set-BootStage "VOICE" "Speech engine continues warming in the background." 80
  }

  Set-BootStage "SECURE LINK" "Opening JARVIS command interface." 91

  if (-not $NoBrowser) {
    $startupUrl = $JarvisUrl + "/?startup=1&t=" + [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
    try { Start-Process $startupUrl } catch { Write-StartupLog ("Browser launch failed: " + $_.Exception.Message) }
  }

  Start-Sleep -Milliseconds 1500
  Pump-Ui
  Set-BootStage "JARVIS ONLINE" "All available local systems are ready." 100
  Start-Sleep -Milliseconds 1250
  Pump-Ui
  Write-StartupLog "Startup sequence complete."
} catch {
  Write-StartupLog ("Startup failure: " + $_.Exception.Message)
  Set-BootStage "DEGRADED MODE" ("Background startup issue: " + $_.Exception.Message) 100
  Start-Sleep -Seconds 3
} finally {
  Close-Splash
  try {
    if ($created) { $mutex.ReleaseMutex() }
    $mutex.Dispose()
  } catch {}
}
