@echo off
setlocal
cd /d "%~dp0"
powershell.exe -NoProfile -STA -ExecutionPolicy Bypass -File "%~dp0install-jarvis-startup.ps1" -StartNow
if errorlevel 1 (
  echo [JARVIS] Kurulum tamamlanamadi. Yukaridaki hata korunuyor.
  pause
  exit /b 1
)
exit /b 0
