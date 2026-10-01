param([switch]$StartNow, [switch]$ValidateOnly)
$ErrorActionPreference = 'Stop'
$JarvisDir = $PSScriptRoot
$HiddenVbs = Join-Path $JarvisDir 'JARVIS-STARTUP-HIDDEN.vbs'
$required = @('worker.js','jarvis-startup.ps1','jarvis-boot.xaml','start-worker-windows.ps1','JARVIS-STARTUP-HIDDEN.vbs')
foreach ($file in $required) {
  if (-not (Test-Path (Join-Path $JarvisDir $file))) { throw "Kurulum eksik: $file" }
}
foreach ($file in @('jarvis-startup.ps1','start-worker-windows.ps1')) {
  $tokens = $null; $errors = $null
  [System.Management.Automation.Language.Parser]::ParseFile((Join-Path $JarvisDir $file), [ref]$tokens, [ref]$errors) | Out-Null
  if ($errors.Count) { throw ($errors | Out-String) }
}
Add-Type -AssemblyName PresentationFramework, PresentationCore, WindowsBase
$reader = New-Object System.Xml.XmlNodeReader ([xml](Get-Content (Join-Path $JarvisDir 'jarvis-boot.xaml') -Raw -Encoding UTF8))
$preview = [Windows.Markup.XamlReader]::Load($reader)
$preview.Close()
if ($ValidateOnly) { Write-Host 'STARTUP VALIDATION PASS'; return }

$startupFolder = [Environment]::GetFolderPath('Startup')
$target = Join-Path $startupFolder 'JARVIS-Silent-Startup.vbs'
$backup = Join-Path $JarvisDir ('startup-backups\' + (Get-Date -Format 'yyyyMMdd-HHmmss-fff'))
New-Item -ItemType Directory -Force -Path $backup | Out-Null
$user = [System.Security.Principal.WindowsIdentity]::GetCurrent()
$taskFailures = @()
# Only retire this installation's startup tasks, never unrelated JARVIS jobs.
$legacyTasks = Get-ScheduledTask -ErrorAction SilentlyContinue | Where-Object {
  $task = $_
  $ownUser = $task.Principal.UserId -in @($user.Name, $user.User.Value, $env:USERNAME)
  $ownAction = @($task.Actions | Where-Object {
    $command = [string]$_.Execute + ' ' + [string]$_.Arguments
    $command.IndexOf($JarvisDir, [StringComparison]::OrdinalIgnoreCase) -ge 0 -and
    $command -match '(?i)(jarvis-startup\.ps1|JARVIS-STARTUP-HIDDEN\.vbs|start-worker-windows\.bat|jarvis-double-clap\.ps1)'
  }).Count -gt 0
  $ownUser -and $ownAction -and $task.TaskName -match '(?i)^JARVIS' -and $task.State -ne 'Disabled'
}
foreach ($task in $legacyTasks) {
  try {
    Export-ScheduledTask -TaskName $task.TaskName -TaskPath $task.TaskPath | Set-Content (Join-Path $backup (($task.TaskName -replace '[^A-Za-z0-9_-]','_') + '.xml')) -Encoding UTF8
    Disable-ScheduledTask -TaskName $task.TaskName -TaskPath $task.TaskPath -ErrorAction Stop | Out-Null
  } catch { $taskFailures += $task.TaskName }
}
if ($taskFailures.Count) {
  throw ('Eski başlangıç görevi kapatılamadı: ' + ($taskFailures -join ', ') + '. Bu kurucuyu bir kez yönetici olarak çalıştırın. Tamamlandı sayılmadı.')
}
# Install the replacement before moving the two known legacy entries.
if (Test-Path $target) { Copy-Item $target (Join-Path $backup 'JARVIS-Silent-Startup.vbs') -Force }
$vbsCommand = 'CreateObject("WScript.Shell").Run "wscript.exe ""' + $HiddenVbs.Replace('"','""') + '""", 0, False'
[IO.File]::WriteAllText($target, $vbsCommand + "`r`n", [Text.Encoding]::Unicode)
foreach ($name in @('JARVIS-PC-Worker.cmd','JARVIS-Startup.cmd')) {
  $legacy = Join-Path $startupFolder $name
  if (Test-Path $legacy) { Move-Item $legacy (Join-Path $backup $name) -Force }
}
Write-Host '[JARVIS] Tek ve sessiz Windows açılışı kuruldu.' -ForegroundColor Green
Write-Host ('[JARVIS] Önceki başlangıç kayıtlarının yedeği: ' + $backup)
if ($StartNow) { Start-Process wscript.exe -ArgumentList ('"' + $HiddenVbs + '" --open') }
