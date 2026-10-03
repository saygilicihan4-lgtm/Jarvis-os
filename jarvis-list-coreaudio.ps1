$ErrorActionPreference='Stop'
$src=@"
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
enum EDataFlow { eRender=0,eCapture=1,eAll=2 }
[StructLayout(LayoutKind.Sequential)] struct PROPERTYKEY { public Guid fmtid; public uint pid; }
[StructLayout(LayoutKind.Explicit)] struct PROPVARIANT { [FieldOffset(0)] public ushort vt; [FieldOffset(8)] public IntPtr pointerValue; }
[ComImport,Guid("D666063F-1587-4E43-81F1-B948E807363F"),InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IMMDevice { int Activate(ref Guid id,int ctx,IntPtr p,[MarshalAs(UnmanagedType.IUnknown)] out object o); int OpenPropertyStore(int m,out IPropertyStore p); int GetId([MarshalAs(UnmanagedType.LPWStr)] out string id); int GetState(out int s); }
[ComImport,Guid("0BD7A1BE-7A1A-44DB-8397-C0A6A5A2EAD4"),InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IMMDeviceCollection { int GetCount(out uint c); int Item(uint n,out IMMDevice d); }
[ComImport,Guid("886d8eeb-8cf2-4446-8d02-cdba1dbdcf99"),InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IPropertyStore { int GetCount(out uint c); int GetAt(uint i,out PROPERTYKEY k); int GetValue(ref PROPERTYKEY k,out PROPVARIANT v); int SetValue(ref PROPERTYKEY k,ref PROPVARIANT v); int Commit(); }
[ComImport,Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"),InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IMMDeviceEnumerator { int EnumAudioEndpoints(EDataFlow f,int s,out IMMDeviceCollection d); int GetDefaultAudioEndpoint(EDataFlow f,int r,out IMMDevice d); int GetDevice(string id,out IMMDevice d); int RegisterEndpointNotificationCallback(IntPtr c); int UnregisterEndpointNotificationCallback(IntPtr c); }
[ComImport,Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")] class MMDeviceEnumeratorComObject {}
public class AudioEndpoint { public string Id; public string Name; public int State; }
public static class JarvisAudioEndpoints {
 public static AudioEndpoint[] List(){var e=(IMMDeviceEnumerator)new MMDeviceEnumeratorComObject();IMMDeviceCollection c;Marshal.ThrowExceptionForHR(e.EnumAudioEndpoints(EDataFlow.eRender,1,out c));uint n;Marshal.ThrowExceptionForHR(c.GetCount(out n));var r=new List<AudioEndpoint>();var key=new PROPERTYKEY{fmtid=new Guid("a45c254e-df1c-4efd-8020-67d146a850e0"),pid=14};for(uint i=0;i<n;i++){IMMDevice d;c.Item(i,out d);string id;d.GetId(out id);int state;d.GetState(out state);IPropertyStore p;d.OpenPropertyStore(0,out p);PROPVARIANT v;p.GetValue(ref key,out v);string name=v.pointerValue==IntPtr.Zero?"":Marshal.PtrToStringUni(v.pointerValue);r.Add(new AudioEndpoint{Id=id,Name=name,State=state});}return r.ToArray();}
}
"@
Add-Type -TypeDefinition $src -Language CSharp
[JarvisAudioEndpoints]::List() | ConvertTo-Json -Compress