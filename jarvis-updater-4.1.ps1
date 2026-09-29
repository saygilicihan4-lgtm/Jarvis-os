$ErrorActionPreference='Stop'
Write-Host '[JARVIS] UPDATER CORE 4.1'
$root=Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root
function Get-VerifiedFile([string]$Url,[string]$Name,[string]$Signature,[bool]$NodeCheck=$false){
  $tmp=Join-Path $env:TEMP ('jarvis41-'+$Name)
  Invoke-WebRequest -UseBasicParsing -Uri $Url -OutFile $tmp -TimeoutSec 20
  $txt=Get-Content $tmp -Raw
  if(-not $txt.Contains($Signature)){ Remove-Item $tmp -Force -ErrorAction SilentlyContinue; throw "$Name imza dogrulamasi basarisiz" }
  if($NodeCheck){ & node --check $tmp | Out-Null; if($LASTEXITCODE -ne 0){Remove-Item $tmp -Force -ErrorAction SilentlyContinue;throw "$Name syntax invalid"} }
  Copy-Item $tmp (Join-Path $root $Name) -Force
  Remove-Item $tmp -Force -ErrorAction SilentlyContinue
  Write-Host "[JARVIS] VERIFIED: $Name"
}
Get-VerifiedFile 'https://raw.githubusercontent.com/saygilicihan4-lgtm/Jarvis-os/main/worker.js?u=41' 'worker.js' "WORKER_VERSION='2.13.0'" $true
Get-VerifiedFile 'https://raw.githubusercontent.com/saygilicihan4-lgtm/Jarvis-os/main/start-worker-windows.bat?u=41' 'start-worker-windows.bat' 'LAUNCHER_VERSION=3.2' $false
Get-VerifiedFile 'https://raw.githubusercontent.com/saygilicihan4-lgtm/Jarvis-os/main/jarvis-wake-hotkey.ps1?u=4134' 'jarvis-wake-hotkey.ps1' "HELPER_VERSION='3.4'" $false
Write-Host '[JARVIS] UPDATER 4.1 VERIFIED: launcher 3.2 + worker 2.13.0 + F8 3.4'
