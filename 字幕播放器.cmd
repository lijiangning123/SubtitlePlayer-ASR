@echo off
setlocal
cd /d "%~dp0"

set "ASR_DIR=%CD%\asr-service"
set "PYTHON_EXE=%ASR_DIR%\runtime\python\python.exe"
set "PLAYER=%CD%\player.html"

if not exist "%PLAYER%" (
  echo Missing player file:
  echo %PLAYER%
  pause
  exit /b 1
)

if not exist "%PYTHON_EXE%" (
  echo Missing bundled Python runtime:
  echo %PYTHON_EXE%
  echo Please include asr-service\runtime\python before publishing/running the integrated package.
  pause
  exit /b 1
)

start "SubtitlePlayer ASR Service" cmd /k ""%PYTHON_EXE%" "%ASR_DIR%\stdlib_asr_server.py" --host 127.0.0.1 --port 28888"

timeout /t 2 /nobreak >nul
start "" "%PLAYER%"

exit /b 0
