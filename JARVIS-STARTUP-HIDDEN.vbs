Option Explicit
Dim shell, fso, startupScript, cmd
Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
startupScript = fso.BuildPath(fso.GetParentFolderName(WScript.ScriptFullName), "jarvis-startup.ps1")
cmd = "powershell.exe -NoProfile -NonInteractive -STA -ExecutionPolicy Bypass -WindowStyle Hidden -File """ & startupScript & """"
If WScript.Arguments.Count > 0 Then
  If WScript.Arguments(0) = "--open" Then cmd = cmd & " -OpenAgain"
End If
shell.Run cmd, 0, False
