Option Explicit

Dim shell, startupScript, cmd
Set shell = CreateObject("WScript.Shell")

startupScript = shell.ExpandEnvironmentStrings("%USERPROFILE%\JARVIS-OS\jarvis-startup.ps1")
cmd = "powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File """ & startupScript & """"

' 0 = hidden window, False = do not block Windows logon.
shell.Run cmd, 0, False
