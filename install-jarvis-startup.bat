@echo off
setlocal
cd /d "%~dp0"
set "STARTUP=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
set "TARGET=%STARTUP%\JARVIS-Startup.cmd"
> "%TARGET%" echo @echo off
>>"%TARGET%" echo cd /d "%~dp0"
>>"%TARGET%" echo start "JARVIS PC WORKER" /min cmd /c start-worker-windows.bat
>>"%TARGET%" echo start "JARVIS DOUBLE CLAP" /min powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0jarvis-double-clap.ps1"
echo [JARVIS] Windows baslangici kuruldu:
echo %TARGET%
echo [JARVIS] Worker ve yerel double-clap dinleyici kullanici girisinde baslayacak.
pause
