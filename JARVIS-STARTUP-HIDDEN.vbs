Option Explicit

Dim shell, files, startupScript, cmd
Set shell = CreateObject("WScript.Shell")
Set files = CreateObject("Scripting.FileSystemObject")

startupScript = files.BuildPath(files.GetParentFolderName(WScript.ScriptFullName), "jarvis-startup.ps1")
cmd = "powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File """ & startupScript & """"

' 0 = hidden window, False = do not block Windows logon.
shell.Run cmd, 0, False
