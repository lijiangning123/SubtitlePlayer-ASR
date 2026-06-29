@echo off
setlocal
cd /d "%~dp0"

set "ASR_DIR=%CD%\asr-service"
set "ASR_CMD=%ASR_DIR%\run-asr-service.cmd"
set "PLAYER="

for %%F in (*.html) do (
  set "PLAYER=%%~fF"
  goto found_player
)

:found_player
if "%PLAYER%"=="" (
  echo Missing player html file in %CD%
  pause
  exit /b 1
)

if not exist "%ASR_CMD%" (
  echo Missing ASR launcher: %ASR_CMD%
  pause
  exit /b 1
)

start "SubtitlePlayer ASR Service" cmd /k ""%ASR_CMD%""

timeout /t 3 /nobreak >nul
start "" "%PLAYER%"

echo Player opened. Keep the ASR service window running while generating subtitles.
exit /b 0
