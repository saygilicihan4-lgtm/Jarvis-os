param([Parameter(Mandatory=$true)][string]$DeviceId)
$ErrorActionPreference='Stop'
$src=@"
using System;
using System.Runtime.InteropServices;
[ComImport,Guid("f8679f50-850a-41cf-9c72-430f290290c8"),InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IPolicyConfig {
 int GetMixFormat(string a,IntPtr b); int GetDeviceFormat(string a,int b,IntPtr c); int ResetDeviceFormat(string a);
 int SetDeviceFormat(string a,IntPtr b,IntPtr c); int GetProcessingPeriod(string a,int b,IntPtr c,IntPtr d);
 int SetProcessingPeriod(string a,IntPtr b); int GetShareMode(string a,IntPtr b); int SetShareMode(string a,IntPtr b);
 int GetPropertyValue(string a,IntPtr b,IntPtr c); int SetPropertyValue(string a,IntPtr b,IntPtr c);
 int SetDefaultEndpoint([MarshalAs(UnmanagedType.LPWStr)] string deviceId,int role); int SetEndpointVisibility(string a,int b);
}
[ComImport,Guid("870af99c-171d-4f9e-af0d-e63df40c2bc9")] class PolicyConfigClient {}
public static class JarvisAudio {
 public static void SetDefault(string id){
  var c=(IPolicyConfig)new PolicyConfigClient();
  for(int role=0;role<3;role++){int hr=c.SetDefaultEndpoint(id,role);if(hr!=0)Marshal.ThrowExceptionForHR(hr);}
 }
}
"@
Add-Type -TypeDefinition $src -Language CSharp
[JarvisAudio]::SetDefault($DeviceId)
Write-Output "JARVIS_AUDIO_ENDPOINT_SET"