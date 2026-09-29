# JARVIS OS Windows global F8 wake helper
# Zero dependency: Win32 RegisterHotKey + opens the trusted JARVIS HUD.
Add-Type @"
using System;
using System.Runtime.InteropServices;
public static class JarvisHotKey {
  [DllImport("user32.dll")] public static extern bool RegisterHotKey(IntPtr hWnd,int id,uint fsModifiers,uint vk);
  [DllImport("user32.dll")] public static extern bool UnregisterHotKey(IntPtr hWnd,int id);
  [DllImport("user32.dll")] public static extern int GetMessage(out MSG msg,IntPtr hWnd,uint min,uint max);
  public struct POINT { public int x; public int y; }
  public struct MSG { public IntPtr hwnd; public uint message; public UIntPtr wParam; public IntPtr lParam; public uint time; public POINT pt; }
}
"@
$HOTKEY_ID=0x4A52
$WM_HOTKEY=0x0312
$VK_F8=0x77
if(-not [JarvisHotKey]::RegisterHotKey([IntPtr]::Zero,$HOTKEY_ID,0,$VK_F8)){
  Write-Host "[JARVIS] F8 global wake kaydedilemedi; baska bir uygulama kullaniyor olabilir."
  exit 2
}
Write-Host "[JARVIS] GLOBAL WAKE: F8 ARMED"
try {
  $msg=New-Object JarvisHotKey+MSG
  while([JarvisHotKey]::GetMessage([ref]$msg,[IntPtr]::Zero,0,0) -gt 0){
    if($msg.message -eq $WM_HOTKEY -and $msg.wParam.ToUInt32() -eq $HOTKEY_ID){
      Start-Process "https://jarvis-os-1iuv.onrender.com/?wake=f8"
    }
  }
} finally {
  [void][JarvisHotKey]::UnregisterHotKey([IntPtr]::Zero,$HOTKEY_ID)
}