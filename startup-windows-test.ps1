$ErrorActionPreference='Stop'
$root=$PSScriptRoot
$temp=Join-Path $env:TEMP ('jarvis-boot-test-'+[guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $temp | Out-Null
$oldWorkspace=$env:JARVIS_WORKSPACE
$oldToken=$env:JARVIS_TOKEN
$env:JARVIS_WORKSPACE=Join-Path $temp 'workspace'
$env:JARVIS_TOKEN='isolated-startup-test'
$node=(Get-Command node.exe).Source
$server=$null
$hosts=@()
try {
  # Exercise the real host with a fake Worker: two hosts must start exactly one child.
  Copy-Item (Join-Path $root 'start-worker-windows.ps1') $temp
  @'
const fs=require('fs'),path=require('path'),http=require('http');
fs.appendFileSync(path.join(__dirname,'launches.txt'),'started\n');
const s=http.createServer((req,res)=>res.end(JSON.stringify({ok:true,version:'test',capabilities:['local_memory']})));
s.listen(8765,'127.0.0.1'); setTimeout(()=>s.close(()=>process.exit(0)),6500);
'@ | Set-Content (Join-Path $temp 'worker.js') -Encoding UTF8
  $hostArgs='-NoProfile -NonInteractive -ExecutionPolicy Bypass -File "'+(Join-Path $temp 'start-worker-windows.ps1')+'"'
  $hosts+=Start-Process powershell.exe -ArgumentList $hostArgs -WindowStyle Hidden -PassThru
  $hosts+=Start-Process powershell.exe -ArgumentList $hostArgs -WindowStyle Hidden -PassThru
  foreach($hostProcess in $hosts){if(-not $hostProcess.WaitForExit(15000)){throw 'Hidden Worker host hung'}}
  if(@(Get-Content (Join-Path $temp 'launches.txt')).Count -ne 1){throw 'Duplicate Worker started'}
  if(-not (Test-Path (Join-Path $env:JARVIS_WORKSPACE '.jarvis-memory\worker.log'))){throw 'Worker log missing'}

  Copy-Item (Join-Path $root 'jarvis-startup.ps1') $temp
  # The coordinator gets a no-op host. Health services below are entirely local fixtures.
  '# Test fixture: service startup managed by the test' | Set-Content (Join-Path $temp 'start-worker-windows.ps1')
  @'
const fs=require('fs'),path=require('path'),http=require('http');
const mode=()=>fs.readFileSync(path.join(__dirname,'mode.txt'),'utf8').replace(/^\uFEFF/,'').trim();
for(const port of [8765,8768])http.createServer((req,res)=>{
 const m=mode(); if(m==='hanging')return;
 const payload=req.url==='/brain-status'?{ready:m==='ready',installed:m==='ready'}:
 port===8768?{ok:m==='ready'}:{ok:true,version:'test',capabilities:['local_memory']};
 res.end(JSON.stringify(payload));
}).listen(port,'127.0.0.1');
'@ | Set-Content (Join-Path $temp 'mock.js') -Encoding UTF8
  'ready' | Set-Content (Join-Path $temp 'mode.txt')
  $server=Start-Process $node -ArgumentList ('"'+(Join-Path $temp 'mock.js')+'"') -WindowStyle Hidden -PassThru
  Start-Sleep -Milliseconds 700
  foreach($mode in @('ready','limited','hanging')) {
    $mode | Set-Content (Join-Path $temp 'mode.txt')
    $log=Join-Path $env:JARVIS_WORKSPACE '.jarvis-memory\startup.log'
    Remove-Item $log -ErrorAction SilentlyContinue
    $watch=[Diagnostics.Stopwatch]::StartNew()
    $p=Start-Process powershell.exe -ArgumentList ('-NoProfile -STA -ExecutionPolicy Bypass -File "'+(Join-Path $temp 'jarvis-startup.ps1')+'" -NoSplash -NoBrowser') -WindowStyle Hidden -PassThru
    if(-not $p.WaitForExit(35000)){Stop-Process $p.Id -Force;throw "Startup did not finish: $mode"}
    $watch.Stop()
    if($p.ExitCode -ne 0){throw "Startup process failed: $mode; $(Get-Content $log -Raw)"}
    $content=Get-Content $log -Raw -Encoding UTF8
    if($mode -eq 'ready' -and ($watch.Elapsed.TotalSeconds -gt 10 -or $content -notmatch 'Yerel sohbet ve mikrofon')){throw 'Ready path failed'}
    if($mode -eq 'limited' -and $content -notmatch 'henüz hazır değil'){throw 'Limited readiness incorrectly reported'}
    if($mode -eq 'hanging' -and ($watch.Elapsed.TotalSeconds -gt 32 -or $content -notmatch '25 saniye')){throw 'Bounded timeout failed'}
    Write-Host "PASS $mode in $([math]::Round($watch.Elapsed.TotalSeconds,1))s"
  }
}finally{
  if($server -and -not $server.HasExited){Stop-Process $server.Id -Force}
  foreach($hostProcess in $hosts){if(-not $hostProcess.HasExited){Stop-Process $hostProcess.Id -Force}}
  $env:JARVIS_WORKSPACE=$oldWorkspace
  $env:JARVIS_TOKEN=$oldToken
  Remove-Item $temp -Recurse -Force -ErrorAction SilentlyContinue
}
Write-Host 'WINDOWS STARTUP INTEGRATION PASS'
