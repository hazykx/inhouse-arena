@echo off
chcp 65001 >nul
title Inhouse Arena
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo   Chybi Node.js. Otviram stranku ke stazeni - nainstaluj verzi LTS
  echo   a pak spust start.bat znovu.
  echo.
  start "" "https://nodejs.org"
  pause
  exit /b 1
)

if not exist node_modules (
  echo.
  echo   Instaluji balicky, poprve to trva par minut...
  echo.
  call npm install
  if errorlevel 1 ( echo   Instalace selhala. & pause & exit /b 1 )
)

call node scripts/setup.mjs
if errorlevel 1 ( pause & exit /b 1 )

echo   Spoustim web na http://localhost:3000
echo   Vypnuti: zavri toto okno nebo stiskni Ctrl+C
echo.
start "" /b cmd /c "timeout /t 8 >nul & start http://localhost:3000"
call npm run dev
pause
