# JARVIS OS Windows global F8 wake helper
$HELPER_VERSION='3.4'
$created=$false
$mutex=New-Object System.Threading.Mutex($true,'Local\JARVIS_F8_WAKE_V34',[ref]$created)
if(-not $created){ Write-Host '[JARVIS] GLOBAL WAKE: existing helper active'; $mutex.Dispose(); exit 0 }

Add-Type @"
using System;
using System.Runtime.InteropServices;
public static class JarvisHotKeyV34 {
  [DllImport("user32.dll")] public static extern bool RegisterHotKey(IntPtr hWnd,int id,uint fsModifiers,uint vk);
  [DllImport("user32.dll")] public static extern bool UnregisterHotKey(IntPtr hWnd,int id);
  [DllImport("user32.dll")] public static extern int GetMessage(out MSG msg,IntPtr hWnd,uint min,uint max);
  public struct POINT { public int x; public int y; }
  public struct MSG { public IntPtr hwnd; public uint message; public UIntPtr wParam; public IntPtr lParam; public uint time; public POINT pt; }
}
"@
$HOTKEY_ID=19026
$WM_HOTKEY=786
$VK_F8=119
if(-not [JarvisHotKeyV34]::RegisterHotKey([IntPtr]::Zero,$HOTKEY_ID,0,$VK_F8)){
  Write-Host '[JARVIS] F8 global wake kaydedilemedi; baska bir uygulama kullaniyor olabilir.'
  if($mutex){$mutex.ReleaseMutex();$mutex.Dispose()}
  exit 2
}
Write-Host ('[JARVIS] GLOBAL WAKE: F8 ARMED v'+$HELPER_VERSION)
$lastWake=0L
try {
  $msg=New-Object JarvisHotKeyV34+MSG
  while([JarvisHotKeyV34]::GetMessage([ref]$msg,[IntPtr]::Zero,0,0) -gt 0){
    if($msg.message -eq $WM_HOTKEY -and $msg.wParam.ToUInt32() -eq $HOTKEY_ID){
      $now=[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
      if(($now-$lastWake) -lt 450){ continue }
      $lastWake=$now
      Write-Host '[JARVIS] F8 WAKE: TRIGGER'
      Start-Process ('https://jarvis-os-1iuv.onrender.com/?wake=f8&t='+$now)
    }
  }
} finally {
  [void][JarvisHotKeyV34]::UnregisterHotKey([IntPtr]::Zero,$HOTKEY_ID)
  if($mutex){$mutex.ReleaseMutex();$mutex.Dispose()}
}
