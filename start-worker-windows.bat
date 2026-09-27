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
echo [JARVIS] Worker baslatiliyor...
node worker.js
pause
