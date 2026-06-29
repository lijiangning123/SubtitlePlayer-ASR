@echo off
setlocal
cd /d "%~dp0"

set "BUNDLED_PYTHON=%CD%\runtime\python\python.exe"
set "ASRTOOLS_PYTHON=I:\subtitleplayer\runtime\python.exe"
set "ASRTOOLS_HOME=I:\subtitleplayer"
set "FFMPEG_EXE=I:\subtitleplayer\ffmpeg.exe"
set "PYTHON_EXE=%CD%\.venv\Scripts\python.exe"

if exist "%BUNDLED_PYTHON%" (
  set "PYTHON_EXE=%BUNDLED_PYTHON%"
  goto run_service
)

if exist "%ASRTOOLS_PYTHON%" (
  set "PYTHON_EXE=%ASRTOOLS_PYTHON%"
  goto run_service
)

if exist "%PYTHON_EXE%" goto run_service

where python >nul 2>nul
if errorlevel 1 goto no_python

echo No bundled Python runtime found. Falling back to system python.
set "PYTHON_EXE=python"

:run_service
echo Starting ASR service: http://127.0.0.1:28768
"%PYTHON_EXE%" stdlib_asr_server.py --host 127.0.0.1 --port 28768
pause
exit /b 0

:no_python
echo Python runtime was not found.
echo For release builds, include asr-service\runtime\python.
echo For local development, install Python or provide I:\subtitleplayer\runtime\python.exe.
pause
exit /b 1

:failed
echo ASR service startup failed.
pause
exit /b 1
