@echo off
setlocal EnableExtensions
title JARVIS PC WORKER
set "LAUNCHER_VERSION=4.1"
set "AUTOSTART=0"
set "SILENT=0"
set "INSTALL_AUTOSTART=0"
set "REPAIR_PAIRING=0"

for %%A in (%*) do (
  if /I "%%~A"=="--autostart" set "AUTOSTART=1"
  if /I "%%~A"=="--silent" set "SILENT=1"
  if /I "%%~A"=="--install-autostart" set "INSTALL_AUTOSTART=1"
  if /I "%%~A"=="--repair-pairing" set "REPAIR_PAIRING=1"
)

cd /d "%~dp0"
if "%JARVIS_WORKSPACE%"=="" set "JARVIS_WORKSPACE=%USERPROFILE%\JARVIS-Workspace"
if "%JARVIS_URL%"=="" set "JARVIS_URL=https://jarvis-os-1iuv.onrender.com"
set "JARVIS_LOG_DIR=%JARVIS_WORKSPACE%\.jarvis-memory"
set "JARVIS_WORKER_LOG=%JARVIS_LOG_DIR%\worker.log"
if not exist "%JARVIS_LOG_DIR%" mkdir "%JARVIS_LOG_DIR%" >nul 2>nul

rem Promote a previously validated updater only before the updater is running.
if exist "%~dp0jarvis-self-update.next.ps1" (
  move /Y "%~dp0jarvis-self-update.next.ps1" "%~dp0jarvis-self-update.ps1" >nul 2>nul
)

set "UNIFIED_UPDATE_OK=0"
if exist "%~dp0jarvis-self-update.ps1" (
  if "%SILENT%"=="1" (
    powershell -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File "%~dp0jarvis-self-update.ps1" -Silent >>"%JARVIS_WORKER_LOG%" 2>&1
  ) else (
    echo [JARVIS] Tum yerel bilesenler guvenli sekilde guncelleniyor...
    powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0jarvis-self-update.ps1"
  )
  if not errorlevel 1 set "UNIFIED_UPDATE_OK=1"
)

if "%INSTALL_AUTOSTART%"=="1" (
  echo [JARVIS] Cinematic silent startup kuruluyor...
  if not exist "%~dp0install-jarvis-startup.ps1" (
    echo [JARVIS] install-jarvis-startup.ps1 bulunamadi.
    exit /b 1
  )
  powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0install-jarvis-startup.ps1"
  exit /b %ERRORLEVEL%
)

if "%SILENT%"=="0" (
  echo [JARVIS] LAUNCHER %LAUNCHER_VERSION%
)

where node >nul 2>nul
if errorlevel 1 (
  if "%SILENT%"=="1" (
    echo [%date% %time%] [JARVIS] Node.js 18+ bulunamadi.>>"%JARVIS_WORKER_LOG%"
    exit /b 1
  )
  echo [JARVIS] Node.js 18+ bulunamadi.
  echo https://nodejs.org adresinden LTS surumunu kurup tekrar calistir.
  pause
  exit /b 1
)

if "%REPAIR_PAIRING%"=="1" if "%JARVIS_PAIR_CODE%"=="" (
  if "%SILENT%"=="1" (
    echo [JARVIS] Repair requires an explicit pairing code; silent repair cancelled.>>"%JARVIS_WORKER_LOG%"
    exit /b 1
  )
  echo [JARVIS] Yeni tek kullanimlik eslestirme kodunu girin. Eski anahtar silinmez.
  set /p "JARVIS_PAIR_CODE=JARVIS PAIR CODE: "
)
if "%REPAIR_PAIRING%"=="1" if "%JARVIS_PAIR_CODE%"=="" exit /b 1

if "%JARVIS_PAIR_CODE%"=="" if not exist "%USERPROFILE%\.jarvis-device-token" (
  if "%SILENT%"=="1" (
    echo [%date% %time%] [JARVIS] Pair token yok; hidden startup iptal edildi.>>"%JARVIS_WORKER_LOG%"
    exit /b 1
  )
  set /p "JARVIS_PAIR_CODE=JARVIS PAIR CODE: "
)

if "%JARVIS_PAIR_CODE%"=="" if not exist "%USERPROFILE%\.jarvis-device-token" (
  echo [JARVIS] PAIR CODE gerekli.
  if "%SILENT%"=="0" pause
  exit /b 1
)

if "%SILENT%"=="0" (
  echo.
  echo [JARVIS] Cloud: %JARVIS_URL%
  echo [JARVIS] Workspace: %JARVIS_WORKSPACE%
  echo [JARVIS] Guncelleme kontrol ediliyor...
)

if "%UNIFIED_UPDATE_OK%"=="0" (
  rem Do not partially replace only worker.js; the verified manifest owns the full dependency set.
  if "%SILENT%"=="1" (
    echo [%date% %time%] [JARVIS] Verified update unavailable; existing runtime preserved.>>"%JARVIS_WORKER_LOG%"
  ) else (
    echo [JARVIS] Dogrulanmis guncelleme kullanilamadi; mevcut dosyalar korunuyor.
  )
)

if "%SILENT%"=="0" (
  echo [JARVIS] F8 helper yerel dosyadan baslatilacak.
  echo [JARVIS] Worker baslatiliyor...
  node worker.js
  pause
) else (
  echo [%date% %time%] [JARVIS] Worker starting...>>"%JARVIS_WORKER_LOG%"
  node worker.js >>"%JARVIS_WORKER_LOG%" 2>&1
)
