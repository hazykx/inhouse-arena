@echo off
chcp 65001 >nul
title Inhouse Arena - ukazkova data
cd /d "%~dp0"
if not exist node_modules ( echo   Nejdriv spust start.bat & pause & exit /b 1 )
call npm run db:seed
echo.
echo   Hotovo. Obnov stranku v prohlizeci (F5).
pause
