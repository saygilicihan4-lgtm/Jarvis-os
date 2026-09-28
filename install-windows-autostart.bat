@echo off
setlocal
set "STARTUP=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
set "TARGET=%STARTUP%\JARVIS-PC-Worker.cmd"
set "SOURCE=%~dp0start-worker-windows.bat"

if not exist "%SOURCE%" (
  echo JARVIS launcher bulunamadi: %SOURCE%
  pause
  exit /b 1
)

> "%TARGET%" echo @echo off
>>"%TARGET%" echo cd /d "%~dp0"
>>"%TARGET%" echo call "%SOURCE%"

if exist "%TARGET%" (
  echo JARVIS PC Worker Windows baslangicina eklendi.
  echo %TARGET%
) else (
  echo Baslangic kaydi olusturulamadi.
  exit /b 1
)
pause
