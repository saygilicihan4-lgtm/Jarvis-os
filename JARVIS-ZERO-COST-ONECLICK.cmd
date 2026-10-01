@echo off
setlocal
title JARVIS ZERO-COST LOCAL AI SETUP
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0JARVIS-ZERO-COST-ONECLICK.ps1"
if errorlevel 1 (
  echo.
  echo [JARVIS] Kurulum dogrulamadan gecemedi. Yukaridaki hatayi kaydedin.
  pause
  exit /b 1
)
echo.
echo [JARVIS] Kurulum ve dogrulama tamamlandi.
pause
