@echo off
setlocal
title JARVIS PC WORKER
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo [JARVIS] Node.js 18+ bulunamadi.
  echo https://nodejs.org adresinden LTS surumunu kurup tekrar calistir.
  pause
  exit /b 1
)
if "%JARVIS_URL%"=="" set "JARVIS_URL=https://jarvis-os-1iuv.onrender.com"
if "%JARVIS_TOKEN%"=="" (
  set /p "JARVIS_TOKEN=JARVIS ACCESS KEY: "
)
if "%JARVIS_TOKEN%"=="" (
  echo [JARVIS] ACCESS KEY gerekli.
  pause
  exit /b 1
)
if "%JARVIS_WORKSPACE%"=="" set "JARVIS_WORKSPACE=%USERPROFILE%\JARVIS-Workspace"
echo.
echo [JARVIS] Cloud: %JARVIS_URL%
echo [JARVIS] Workspace: %JARVIS_WORKSPACE%
echo [JARVIS] Guncelleme kontrol ediliyor...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$u='https://raw.githubusercontent.com/saygilicihan4-lgtm/Jarvis-os/main/worker.js'; try { $n=Join-Path $env:TEMP 'jarvis-worker.new.js'; Invoke-WebRequest -UseBasicParsing -Uri $u -OutFile $n -TimeoutSec 15; node --check $n ^| Out-Null; $txt=Get-Content $n -Raw; $signed=($txt -match 'const WORKER_VERSION='); if($LASTEXITCODE -eq 0 -and $signed){ if(-not (Test-Path 'worker.js') -or ((Get-FileHash $n).Hash -ne (Get-FileHash 'worker.js').Hash)){ Copy-Item $n 'worker.js' -Force; Write-Host '[JARVIS] Worker guncellendi ve dogrulandi.' } else { Write-Host '[JARVIS] Worker guncel.' } } else { Write-Host '[JARVIS] Guncelleme dogrulanamadi; mevcut Worker korundu.' }; Remove-Item $n -Force -ErrorAction SilentlyContinue } catch { Write-Host '[JARVIS] Guncelleme kontrolu atlandi; mevcut Worker kullaniliyor.' }"
echo [JARVIS] Worker baslatiliyor...
node worker.js
pause
