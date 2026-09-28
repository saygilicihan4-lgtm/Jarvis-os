@echo off
setlocal
title JARVIS NEW PC SETUP
cd /d "%~dp0"

echo [JARVIS] Yeni bilgisayar kurulumu
where node >nul 2>nul
if errorlevel 1 (
  echo [JARVIS] Node.js 18+ gerekli. Kurulum durduruldu.
  pause
  exit /b 1
)

call "%~dp0install-windows-autostart.bat"
if errorlevel 1 exit /b 1

echo.
echo [JARVIS] Worker ilk kez baslatiliyor.
echo [JARVIS] Bu bilgisayar Cloud'da PENDING olarak gorunecek.
echo [JARVIS] Ana JARVIS oturumundan cihaz onayi verilmeden gorev alamaz.
call "%~dp0start-worker-windows.bat"
