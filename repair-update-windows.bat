@echo off
setlocal
title JARVIS ONE-TIME UPDATE
cd /d "%~dp0"
echo [JARVIS] Launcher ve Worker guncelleniyor...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop'; $base='https://raw.githubusercontent.com/saygilicihan4-lgtm/Jarvis-os/main/'; $files=@('start-worker-windows.bat','worker.js','jarvis-double-clap.ps1','install-jarvis-startup.bat'); foreach($f in $files){ $tmp=Join-Path $env:TEMP ('jarvis-'+$f+'.new'); Invoke-WebRequest -UseBasicParsing -Uri ($base+$f+'?repair=2') -OutFile $tmp -TimeoutSec 20; if($f -eq 'worker.js'){ node --check $tmp | Out-Null; if($LASTEXITCODE -ne 0){ throw 'worker.js syntax invalid' } }; Copy-Item $tmp $f -Force; Remove-Item $tmp -Force -ErrorAction SilentlyContinue }; $h='https://raw.githubusercontent.com/saygilicihan4-lgtm/Jarvis-os/ad253e1b8b590a35538f7a5160af1e481bd567fb/jarvis-wake-hotkey.ps1?v=3'; $tmp=Join-Path $env:TEMP 'jarvis-wake-hotkey.new.ps1'; Invoke-WebRequest -UseBasicParsing -Uri $h -OutFile $tmp -TimeoutSec 20; $txt=Get-Content $tmp -Raw; if($txt -match '\$mutex' -or $txt -notmatch 'ARMED v3'){ throw 'F8 helper verification failed' }; Copy-Item $tmp 'jarvis-wake-hotkey.ps1' -Force; Remove-Item $tmp -Force -ErrorAction SilentlyContinue; Write-Host '[JARVIS] Dosyalar guncellendi ve dogrulandi.'"
if errorlevel 1 (
 echo [JARVIS] Guncelleme basarisiz. Mevcut dosyalar korunuyor.
 pause
 exit /b 1
)
echo [JARVIS] Yeni launcher aciliyor...
call start-worker-windows.bat
