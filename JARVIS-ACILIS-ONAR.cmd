@echo off
setlocal
 title JARVIS Acilis Onarimi
set "JARVIS_REPAIR_FILE=%TEMP%\jarvis-startup-repair-%RANDOM%-%RANDOM%.ps1"
echo JARVIS acilis onarimi hazirlaniyor...
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop'; [Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -UseBasicParsing 'https://raw.githubusercontent.com/saygilicihan4-lgtm/Jarvis-os/main/repair-jarvis-startup.ps1' -OutFile $env:JARVIS_REPAIR_FILE -TimeoutSec 25"
if errorlevel 1 goto failed
powershell.exe -NoProfile -STA -ExecutionPolicy Bypass -File "%JARVIS_REPAIR_FILE%"
if errorlevel 1 goto failed
del "%JARVIS_REPAIR_FILE%" >nul 2>nul
exit /b 0
:failed
echo.
echo Onarim tamamlanamadi. Yukaridaki hata mesajini paylasin.
pause
exit /b 1
