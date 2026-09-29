@echo off
setlocal
title JARVIS UPDATER 4.0
cd /d "%~dp0"
echo [JARVIS] UPDATER 4.0
echo [JARVIS] Kimlik dogrulamali guncelleme basliyor...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop'; $base='https://raw.githubusercontent.com/saygilicihan4-lgtm/Jarvis-os/9fd404e042c31e8e84720c46de0bdba044c149fd/'; $pairs=@(@('worker.js','WORKER_VERSION=''2.13.0'''),@('start-worker-windows.bat','LAUNCHER_VERSION=3.1')); foreach($p in $pairs){$f=$p[0];$sig=$p[1];$tmp=Join-Path $env:TEMP ('jarvis40-'+$f); Invoke-WebRequest -UseBasicParsing -Uri ($base+$f+'?u=40') -OutFile $tmp -TimeoutSec 20; $txt=Get-Content $tmp -Raw; if($txt -notmatch [regex]::Escape($sig)){throw ($f+' imza dogrulamasi basarisiz')}; if($f -eq 'worker.js'){node --check $tmp | Out-Null;if($LASTEXITCODE -ne 0){throw 'worker syntax invalid'}}; Copy-Item $tmp $f -Force; Remove-Item $tmp -Force -ErrorAction SilentlyContinue}; $h='https://raw.githubusercontent.com/saygilicihan4-lgtm/Jarvis-os/b5d26f871b500cbb293736ab0996ffffcc292049/jarvis-wake-hotkey.ps1?u=40'; $tmp=Join-Path $env:TEMP 'jarvis40-hotkey.ps1'; Invoke-WebRequest -UseBasicParsing -Uri $h -OutFile $tmp -TimeoutSec 20; $txt=Get-Content $tmp -Raw; if($txt -notmatch [regex]::Escape("HELPER_VERSION='3.1'")){throw 'hotkey 3.1 imza dogrulamasi basarisiz'}; Copy-Item $tmp 'jarvis-wake-hotkey.ps1' -Force; Remove-Item $tmp -Force -ErrorAction SilentlyContinue; Write-Host '[JARVIS] UPDATER 4.0 VERIFIED: launcher 3.1 + worker 2.13.0 + F8 3.1'"
if errorlevel 1 (
 echo [JARVIS] UPDATER 4.0 FAILED - mevcut dosyalar korunuyor.
 pause
 exit /b 1
)
echo [JARVIS] Yeni launcher baslatiliyor...
call start-worker-windows.bat
