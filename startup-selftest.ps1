$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$files = @('jarvis-startup.ps1','start-worker-windows.ps1','install-jarvis-startup.ps1','repair-jarvis-startup.ps1')
foreach ($name in $files) {
  $tokens=$null; $errors=$null
  [System.Management.Automation.Language.Parser]::ParseFile((Join-Path $root $name),[ref]$tokens,[ref]$errors) | Out-Null
  if ($errors.Count) { throw "$name : $($errors | Out-String)" }
}
. (Join-Path $root 'jarvis-startup.ps1') -LibraryOnly
function Assert-Equal($Actual,$Expected) { if ($Actual -ne $Expected) { throw "Expected $Expected, got $Actual" } }
$health=@{ok=$true;version='2.73.0';capabilities=@('local_memory')}
$brain=@{ready=$true;installed=$true}
$voice=@{ok=$true}
Assert-Equal (Get-JarvisBootResult $null $brain $voice) 'offline'
Assert-Equal (Get-JarvisBootResult @{ok=$true} $brain $voice) 'offline'
Assert-Equal (Get-JarvisBootResult $health $null $null) 'limited'
Assert-Equal (Get-JarvisBootResult $health @{ready=$true;installed=$false} $voice) 'limited'
Assert-Equal (Get-JarvisBootResult $health $brain @{ok=$false}) 'limited'
Assert-Equal (Get-JarvisBootResult $health $brain $voice) 'ready'
if ($env:OS -eq 'Windows_NT') {
  Add-Type -AssemblyName PresentationFramework, PresentationCore, WindowsBase
  $reader=New-Object System.Xml.XmlNodeReader ([xml](Get-Content (Join-Path $root 'jarvis-boot.xaml') -Raw -Encoding UTF8))
  # This actually constructs WPF controls, catching unsupported XAML properties.
  $window=[Windows.Markup.XamlReader]::Load($reader)
  foreach($name in @('StageText','DetailText','StatusText','RetryButton','LogButton','CloseButton','BootProgress')) {
    if(-not $window.FindName($name)){throw "Missing functional boot control: $name"}
  }
  $window.WindowState='Normal'; $window.Width=1366; $window.Height=768
  $window.Show(); $window.UpdateLayout()
  $window.Dispatcher.Invoke([Action]{},[Windows.Threading.DispatcherPriority]::Render)
  $bitmap=New-Object Windows.Media.Imaging.RenderTargetBitmap(1366,768,96,96,[Windows.Media.PixelFormats]::Pbgra32)
  $bitmap.Render($window)
  $encoder=New-Object Windows.Media.Imaging.PngBitmapEncoder
  $encoder.Frames.Add([Windows.Media.Imaging.BitmapFrame]::Create($bitmap))
  $output=Join-Path $env:RUNNER_TEMP 'jarvis-boot-windows.png'
  if(-not $env:RUNNER_TEMP){$output=Join-Path $env:TEMP 'jarvis-boot-windows.png'}
  $stream=[IO.File]::Create($output)
  try{$encoder.Save($stream)}finally{$stream.Dispose();$window.Close()}
  & (Join-Path $root 'install-jarvis-startup.ps1') -ValidateOnly
}
Write-Host 'STARTUP SELFTEST PASS: parser, honest readiness states, Windows WPF when available'
