@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Study needs Node.js 22.12 or newer installed on this computer.
  echo Install Node.js, then open this file again.
  pause
  exit /b 1
)
echo Keep Anki open. Once Study is ready, open http://127.0.0.1:4173 in your browser.
call npm run launch
if errorlevel 1 pause
