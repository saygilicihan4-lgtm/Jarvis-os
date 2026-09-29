@echo off
setlocal
title JARVIS UPDATER 4.1
cd /d "%~dp0"
echo [JARVIS] UPDATER 4.1
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0jarvis-updater-4.1.ps1"
if errorlevel 1 (
 echo [JARVIS] UPDATER 4.1 FAILED - mevcut dosyalar korunuyor.
 pause
 exit /b 1
)
echo [JARVIS] Yeni launcher baslatiliyor...
call "%~dp0start-worker-windows.bat"
