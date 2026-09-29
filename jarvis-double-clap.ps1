# JARVIS OS - local double-clap wake, Windows 10/11, zero external dependencies.
# Captures PCM via winmm waveIn. No recording is saved and no audio is sent to cloud.
$ErrorActionPreference='Stop'
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public static class JarvisMic {
 [StructLayout(LayoutKind.Sequential)] public struct WAVEFORMATEX { public ushort wFormatTag,nChannels; public uint nSamplesPerSec,nAvgBytesPerSec; public ushort nBlockAlign,wBitsPerSample,cbSize; }
 [StructLayout(LayoutKind.Sequential)] public struct WAVEHDR { public IntPtr lpData; public uint dwBufferLength,dwBytesRecorded; public UIntPtr dwUser; public uint dwFlags,dwLoops; public IntPtr lpNext,reserved; }
 [DllImport("winmm.dll")] public static extern int waveInOpen(out IntPtr h,uint id,ref WAVEFORMATEX f,IntPtr cb,IntPtr inst,uint flags);
 [DllImport("winmm.dll")] public static extern int waveInPrepareHeader(IntPtr h,ref WAVEHDR hdr,uint sz);
 [DllImport("winmm.dll")] public static extern int waveInAddBuffer(IntPtr h,ref WAVEHDR hdr,uint sz);
 [DllImport("winmm.dll")] public static extern int waveInStart(IntPtr h);
 [DllImport("winmm.dll")] public static extern int waveInReset(IntPtr h);
 [DllImport("winmm.dll")] public static extern int waveInUnprepareHeader(IntPtr h,ref WAVEHDR hdr,uint sz);
 [DllImport("winmm.dll")] public static extern int waveInClose(IntPtr h);
}
"@
$fmt=New-Object JarvisMic+WAVEFORMATEX
$fmt.wFormatTag=1;$fmt.nChannels=1;$fmt.nSamplesPerSec=16000;$fmt.wBitsPerSample=16;$fmt.nBlockAlign=2;$fmt.nAvgBytesPerSec=32000;$fmt.cbSize=0
$h=[IntPtr]::Zero
$rc=[JarvisMic]::waveInOpen([ref]$h,0xffffffff,[ref]$fmt,[IntPtr]::Zero,[IntPtr]::Zero,0)
if($rc -ne 0){Write-Host "[JARVIS] DOUBLE CLAP: MIC OPEN FAILED ($rc)";exit 3}
$size=3200;$ptr=[Runtime.InteropServices.Marshal]::AllocHGlobal($size)
$hdr=New-Object JarvisMic+WAVEHDR;$hdr.lpData=$ptr;$hdr.dwBufferLength=$size
$hs=[Runtime.InteropServices.Marshal]::SizeOf([type][JarvisMic+WAVEHDR])
[void][JarvisMic]::waveInPrepareHeader($h,[ref]$hdr,$hs)
Write-Host '[JARVIS] DOUBLE CLAP: ARMED (LOCAL WINMM)'
$last=0L;$cool=0L;$baseline=700.0
try{
 while($true){
  $hdr.dwBytesRecorded=0
  [void][JarvisMic]::waveInAddBuffer($h,[ref]$hdr,$hs);[void][JarvisMic]::waveInStart($h)
  while(($hdr.dwFlags -band 1) -eq 0){Start-Sleep -Milliseconds 8}
  $n=[int]($hdr.dwBytesRecorded/2);if($n -le 0){continue}
  $peak=0;$sum=0.0
  for($i=0;$i -lt $n;$i++){ $v=[Math]::Abs([Runtime.InteropServices.Marshal]::ReadInt16($ptr,$i*2));if($v -gt $peak){$peak=$v};$sum+=$v }
  $avg=$sum/$n;$baseline=($baseline*.94)+($avg*.06);$threshold=[Math]::Max(5000,$baseline*6.5)
  $now=[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
  if($peak -gt $threshold -and $now -gt $cool){
   if($last -gt 0 -and ($now-$last) -ge 120 -and ($now-$last) -le 850){
    $last=0;$cool=$now+2200
    Start-Process 'https://jarvis-os-1iuv.onrender.com/?wake=clap'
    Write-Host '[JARVIS] DOUBLE CLAP: WAKE'
   } else {$last=$now}
  }
  if($last -gt 0 -and ($now-$last) -gt 900){$last=0}
 }
} finally {
 [void][JarvisMic]::waveInReset($h);[void][JarvisMic]::waveInUnprepareHeader($h,[ref]$hdr,$hs);[void][JarvisMic]::waveInClose($h);[Runtime.InteropServices.Marshal]::FreeHGlobal($ptr)
}