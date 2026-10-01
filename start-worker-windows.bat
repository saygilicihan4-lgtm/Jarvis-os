@echo off
setlocal
title JARVIS PC WORKER
set "LAUNCHER_VERSION=3.4"
echo [JARVIS] LAUNCHER 3.4
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo [JARVIS] Node.js 18+ bulunamadi.
  echo https://nodejs.org adresinden LTS surumunu kurup tekrar calistir.
  pause
  exit /b 1
)
if "%JARVIS_URL%"=="" set "JARVIS_URL=https://jarvis-os-1iuv.onrender.com"
if "%JARVIS_PAIR_CODE%"=="" if not exist "%USERPROFILE%\.jarvis-device-token" (
  set /p "JARVIS_PAIR_CODE=JARVIS PAIR CODE: "
)
if "%JARVIS_PAIR_CODE%"=="" if not exist "%USERPROFILE%\.jarvis-device-token" (
  echo [JARVIS] PAIR CODE gerekli.
  pause
  exit /b 1
)
if "%JARVIS_WORKSPACE%"=="" set "JARVIS_WORKSPACE=%USERPROFILE%\JARVIS-Workspace"
if /I "%~1"=="--install-autostart" (
  echo [JARVIS] Windows oturum acilisinda otomatik baslatma ayarlaniyor...
  powershell -NoProfile -ExecutionPolicy Bypass -Command "$a=[Environment]::GetFolderPath('Startup'); $p=(Resolve-Path '%~f0').Path; $w=Join-Path $a 'JARVIS-PC-Worker.cmd'; ('@echo off'+[Environment]::NewLine+'start "" /min "'+$p+'" --autostart') | Set-Content -Encoding ASCII $w; Write-Host ('[JARVIS] AUTOSTART READY: '+$w)"
  if errorlevel 1 (
    echo [JARVIS] AUTOSTART kurulumu basarisiz.
    exit /b 1
  )
  echo [JARVIS] AUTOSTART hazir. Bir sonraki Windows oturum acilisinda Worker otomatik baslayacak.
  exit /b 0
)
echo.
echo [JARVIS] Cloud: %JARVIS_URL%
echo [JARVIS] Workspace: %JARVIS_WORKSPACE%
echo [JARVIS] Guncelleme kontrol ediliyor...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$u='https://raw.githubusercontent.com/saygilicihan4-lgtm/Jarvis-os/main/worker.js?cb=' + [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds(); try { $n=Join-Path $env:TEMP 'jarvis-worker.new.js'; Invoke-WebRequest -UseBasicParsing -Headers @{'Cache-Control'='no-cache';'Pragma'='no-cache'} -Uri $u -OutFile $n -TimeoutSec 20; node --check $n ^| Out-Null; $txt=Get-Content $n -Raw; $signed=($txt -match 'const WORKER_VERSION='); if($LASTEXITCODE -eq 0 -and $signed){ $ver=([regex]::Match($txt,\"const WORKER_VERSION='([^']+)'\")).Groups[1].Value; if(-not (Test-Path 'worker.js') -or ((Get-FileHash $n).Hash -ne (Get-FileHash 'worker.js').Hash)){ Copy-Item $n 'worker.js' -Force; Write-Host ('[JARVIS] Worker guncellendi ve dogrulandi: v'+$ver) } else { Write-Host ('[JARVIS] Worker guncel: v'+$ver) } } else { Write-Host '[JARVIS] Guncelleme dogrulanamadi; mevcut Worker korundu.' }; Remove-Item $n -Force -ErrorAction SilentlyContinue } catch { Write-Host ('[JARVIS] Guncelleme kontrolu atlandi: '+$_.Exception.Message); Write-Host '[JARVIS] Mevcut Worker kullaniliyor.' }"
echo [JARVIS] F8 helper yerel dosyadan baslatilacak.
echo [JARVIS] Worker baslatiliyor...
node worker.js
pause
