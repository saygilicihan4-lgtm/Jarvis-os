$ErrorActionPreference='Stop'
$src=@"
using System;
using System.Runtime.InteropServices;
enum EDataFlow { eRender=0,eCapture=1,eAll=2 }
enum ERole { eConsole=0,eMultimedia=1,eCommunications=2 }
[ComImport,Guid("D666063F-1587-4E43-81F1-B948E807363F"),InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IMMDevice { int Activate(ref Guid id,int ctx,IntPtr p,[MarshalAs(UnmanagedType.IUnknown)] out object o); int OpenPropertyStore(int m,out IntPtr p); int GetId([MarshalAs(UnmanagedType.LPWStr)] out string id); int GetState(out int s); }
[ComImport,Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"),InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IMMDeviceEnumerator { int EnumAudioEndpoints(EDataFlow f,int s,out IntPtr d); int GetDefaultAudioEndpoint(EDataFlow f,ERole r,out IMMDevice d); int GetDevice(string id,out IMMDevice d); int RegisterEndpointNotificationCallback(IntPtr c); int UnregisterEndpointNotificationCallback(IntPtr c); }
[ComImport,Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")] class MMDeviceEnumeratorComObject {}
public static class JarvisDefaultAudio {
 public static string Id(int role){var e=(IMMDeviceEnumerator)new MMDeviceEnumeratorComObject();IMMDevice d;int hr=e.GetDefaultAudioEndpoint(EDataFlow.eRender,(ERole)role,out d);if(hr!=0)Marshal.ThrowExceptionForHR(hr);string id;d.GetId(out id);return id;}
}
"@
Add-Type -TypeDefinition $src -Language CSharp
$o=@{console=[JarvisDefaultAudio]::Id(0);multimedia=[JarvisDefaultAudio]::Id(1);communications=[JarvisDefaultAudio]::Id(2)}
$o|ConvertTo-Json -Compress