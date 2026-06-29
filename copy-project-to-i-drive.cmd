@echo off
setlocal

set "SRC=%~dp0."
set "DST=I:\subtitleplayer\SubtitlePlayer-ASR"

if not exist "I:\subtitleplayer" (
  echo Missing target base directory: I:\subtitleplayer
  pause
  exit /b 1
)

if exist "%DST%" (
  echo Target already exists: %DST%
  echo Please rename or delete it first, or edit this script's DST value.
  pause
  exit /b 1
)

echo Copying project...
echo From: %SRC%
echo To:   %DST%

mkdir "%DST%" 2>nul
robocopy "%SRC%" "%DST%" /E /XD .git /NFL /NDL /NJH /NJS /NP
if errorlevel 8 goto failed

echo.
echo Done.
echo Open:
echo %DST%\start-player.cmd
pause
exit /b 0

:failed
echo Copy failed.
pause
exit /b 1
