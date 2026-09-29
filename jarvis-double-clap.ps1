# JARVIS local double-clap wake helper for Windows 10
# Uses Windows audio capture locally; no speech recognition and no cloud audio.
Add-Type -AssemblyName System.Windows.Forms
$ErrorActionPreference='Stop'
$jarvis='https://jarvis-os-1iuv.onrender.com/?wake=clap'
# Prefer bundled ffmpeg only if explicitly present; otherwise Windows browser clap wake remains fallback.
$ff=Join-Path $PSScriptRoot 'ffmpeg.exe'
if(-not (Test-Path $ff)){
  Write-Host '[JARVIS] DOUBLE CLAP: LOCAL CAPTURE ENGINE NOT INSTALLED'
  exit 3
}
Write-Host '[JARVIS] DOUBLE CLAP: ARMED'
# ffmpeg astats emits RMS/peak locally. Two short high peaks in 120-850 ms trigger wake.
$psi=New-Object Diagnostics.ProcessStartInfo
$psi.FileName=$ff
$psi.Arguments='-hide_banner -loglevel info -f dshow -i audio="default" -af astats=metadata=1:reset=1 -f null -'
$psi.UseShellExecute=$false;$psi.RedirectStandardError=$true;$psi.CreateNoWindow=$true
$p=[Diagnostics.Process]::Start($psi)
$last=0L;$cool=0L
while(-not $p.HasExited){
  $line=$p.StandardError.ReadLine()
  if($null -eq $line){continue}
  if($line -match 'Peak level dB:\s*(-?[0-9.]+)'){
    $db=[double]$Matches[1];$now=[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
    if($db -gt -8 -and $now -gt $cool){
      if($last -gt 0 -and ($now-$last) -ge 120 -and ($now-$last) -le 850){
        $last=0;$cool=$now+1800
        Start-Process $jarvis
      } else {$last=$now}
    }
    if($last -gt 0 -and ($now-$last) -gt 900){$last=0}
  }
}