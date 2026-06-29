@echo off
setlocal
cd /d "%~dp0"

set "ASR_DIR=%CD%\asr-service"
set "PYTHON_EXE=%ASR_DIR%\runtime\python\python.exe"
set "PLAYER="

for %%F in (*.html) do (
  set "PLAYER=%%~fF"
  goto found_player
)

:found_player
if "%PLAYER%"=="" (
  echo Missing player html file.
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

start "SubtitlePlayer ASR Service" cmd /k ""%PYTHON_EXE%" "%ASR_DIR%\stdlib_asr_server.py" --host 127.0.0.1 --port 28768"

timeout /t 2 /nobreak >nul
start "" "%PLAYER%"

exit /b 0
