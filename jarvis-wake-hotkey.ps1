# JARVIS OS Windows global F8 wake helper
$HELPER_VERSION='3.5'
$created=$false
$mutex=New-Object System.Threading.Mutex($true,'Local\JARVIS_F8_WAKE_V35',[ref]$created)
if(-not $created){ Write-Host '[JARVIS] GLOBAL WAKE: existing helper active'; $mutex.Dispose(); exit 0 }

Add-Type @"
using System;
using System.Runtime.InteropServices;
public static class JarvisHotKeyV35 {
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
$VK_MEDIA_NEXT=176
$f8Ok=[JarvisHotKeyV35]::RegisterHotKey([IntPtr]::Zero,$HOTKEY_ID,0,$VK_F8)
$MEDIA_ID=19027
$mediaOk=[JarvisHotKeyV35]::RegisterHotKey([IntPtr]::Zero,$MEDIA_ID,0,$VK_MEDIA_NEXT)
if(-not $f8Ok -and -not $mediaOk){
  Write-Host '[JARVIS] F8 global wake kaydedilemedi; baska bir uygulama kullaniyor olabilir.'
  if($mutex){$mutex.ReleaseMutex();$mutex.Dispose()}
  exit 2
}
Write-Host ('[JARVIS] GLOBAL WAKE: F8 ARMED v'+$HELPER_VERSION)
$lastWake=0L
try {
  $msg=New-Object JarvisHotKeyV35+MSG
  while([JarvisHotKeyV35]::GetMessage([ref]$msg,[IntPtr]::Zero,0,0) -gt 0){
    if($msg.message -eq $WM_HOTKEY -and ($msg.wParam.ToUInt32() -eq $HOTKEY_ID -or $msg.wParam.ToUInt32() -eq $MEDIA_ID)){
      $now=[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
      if(($now-$lastWake) -lt 450){ continue }
      $lastWake=$now
      Write-Host '[JARVIS] F8 WAKE: TRIGGER'
      Start-Process ('https://jarvis-os-1iuv.onrender.com/?wake=f8&t='+$now)
    }
  }
} finally {
  [void][JarvisHotKeyV35]::UnregisterHotKey([IntPtr]::Zero,$HOTKEY_ID)
  [void][JarvisHotKeyV35]::UnregisterHotKey([IntPtr]::Zero,$MEDIA_ID)
  if($mutex){$mutex.ReleaseMutex();$mutex.Dispose()}
}
