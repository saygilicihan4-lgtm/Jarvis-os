@echo off
setlocal EnableExtensions
set "LAUNCHER_VERSION=5.0"
cd /d "%~dp0"
for %%A in (%*) do (
  if /I "%%~A"=="--install-autostart" goto install
  if /I "%%~A"=="--silent" goto worker
)
rem Interactive launch uses the same welcome screen as Windows logon.
wscript.exe "%~dp0JARVIS-STARTUP-HIDDEN.vbs" --open
exit /b %ERRORLEVEL%
:worker
powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -WindowStyle Hidden -File "%~dp0start-worker-windows.ps1"
exit /b %ERRORLEVEL%
:install
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0install-jarvis-startup.ps1"
exit /b %ERRORLEVEL%
