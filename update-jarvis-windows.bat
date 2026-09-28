@echo off
setlocal
title JARVIS SAFE UPDATE
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo [JARVIS] Node.js bulunamadi.
  pause
  exit /b 1
)
echo [JARVIS] Guvenli guncelleme indiriliyor...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop'; $base='https://raw.githubusercontent.com/saygilicihan4-lgtm/Jarvis-os/main/'; Invoke-WebRequest -UseBasicParsing ($base+'worker.js') -OutFile 'worker.new.js'; node --check 'worker.new.js' | Out-Null; if($LASTEXITCODE -ne 0){throw 'worker syntax invalid'}; Invoke-WebRequest -UseBasicParsing ($base+'start-worker-windows.bat') -OutFile 'start-worker-windows.new.bat'; Move-Item 'worker.new.js' 'worker.js' -Force; Move-Item 'start-worker-windows.new.bat' 'start-worker-windows.bat' -Force"
if errorlevel 1 (
  echo [JARVIS] Guncelleme basarisiz; mevcut dosyalar korundu.
  pause
  exit /b 1
)
echo [JARVIS] Guncelleme tamamlandi.
call start-worker-windows.bat
