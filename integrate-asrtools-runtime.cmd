@echo off
setlocal
cd /d "%~dp0"

set "ASRTOOLS_HOME=I:\subtitleplayer"
set "SRC_PY=%ASRTOOLS_HOME%\runtime"
set "SRC_FFMPEG=%ASRTOOLS_HOME%\ffmpeg.exe"
set "SRC_APP=%ASRTOOLS_HOME%\app"

set "DST_RUNTIME=%CD%\asr-service\runtime"
set "DST_PY=%DST_RUNTIME%\python"
set "DST_FFMPEG=%DST_RUNTIME%\ffmpeg"
set "DST_ASRTOOLS=%DST_RUNTIME%\asrtools\app"

if not exist "%SRC_PY%\python.exe" goto missing
if not exist "%SRC_FFMPEG%" goto missing
if not exist "%SRC_APP%\bk_asr" goto missing

echo Integrating AsrTools runtime into this project...
echo Source: %ASRTOOLS_HOME%
echo Target: %DST_RUNTIME%

mkdir "%DST_PY%" 2>nul
mkdir "%DST_FFMPEG%" 2>nul
mkdir "%DST_ASRTOOLS%" 2>nul

robocopy "%SRC_PY%" "%DST_PY%" /E /NFL /NDL /NJH /NJS /NP
if errorlevel 8 goto failed

copy /Y "%SRC_FFMPEG%" "%DST_FFMPEG%\ffmpeg.exe"
if errorlevel 1 goto failed

robocopy "%SRC_APP%" "%DST_ASRTOOLS%" /E /NFL /NDL /NJH /NJS /NP
if errorlevel 8 goto failed

echo.
echo Done.
echo Local Python: %DST_PY%\python.exe
echo Local FFmpeg: %DST_FFMPEG%\ffmpeg.exe
echo Local AsrTools app: %DST_ASRTOOLS%
echo.
echo License note: AsrTools is GPL-3.0. Review GPL obligations before redistribution.
pause
exit /b 0

:missing
echo Missing AsrTools files under %ASRTOOLS_HOME%.
echo Expected:
echo   %SRC_PY%\python.exe
echo   %SRC_FFMPEG%
echo   %SRC_APP%\bk_asr
pause
exit /b 1

:failed
echo Failed to integrate AsrTools runtime.
pause
exit /b 1
