@echo off
setlocal
cd /d "%~dp0"
if not exist ".env" copy ".env.example" ".env" >nul
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is needed to run the private local AI connection.
  echo Install Node.js, then click this file again.
  pause
  exit /b 1
)
start "Medora BP Guide" /min "%~dp0Run Medora BP Server.bat"
timeout /t 2 /nobreak >nul
start "" "http://127.0.0.1:4173/"
endlocal
