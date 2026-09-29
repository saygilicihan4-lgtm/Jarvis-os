@echo off
setlocal
title JARVIS UPDATER 4.1
cd /d "%~dp0"
echo [JARVIS] UPDATER 4.1 BOOTSTRAP
echo [JARVIS] Guncel updater core indiriliyor...
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop'; $u='https://raw.githubusercontent.com/saygilicihan4-lgtm/Jarvis-os/main/jarvis-updater-4.1.ps1?bootstrap=42'; $t=Join-Path $env:TEMP 'jarvis-updater-4.1.ps1'; Invoke-WebRequest -UseBasicParsing -Uri $u -OutFile $t -TimeoutSec 20; $x=Get-Content $t -Raw; if(-not $x.Contains('UPDATER CORE 4.1')){throw 'Updater core verification failed'}; Copy-Item $t '%~dp0jarvis-updater-4.1.ps1' -Force; Remove-Item $t -Force"
if errorlevel 1 (
 echo [JARVIS] CORE UPDATE FAILED - mevcut dosyalar korunuyor.
 pause
 exit /b 1
)
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0jarvis-updater-4.1.ps1"
if errorlevel 1 (
 echo [JARVIS] UPDATER 4.1 FAILED - mevcut dosyalar korunuyor.
 pause
 exit /b 1
)
echo [JARVIS] Yeni launcher baslatiliyor...
call "%~dp0start-worker-windows.bat"
