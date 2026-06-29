@echo off
setlocal
cd /d "%~dp0"

set "GIT=..\MinGit\cmd\git.exe"
if not exist "%GIT%" set "GIT=git"

set /p REPO_URL=Enter your GitHub repository URL:
if "%REPO_URL%"=="" (
  echo Repository URL is required.
  pause
  exit /b 1
)

"%GIT%" status --short
if errorlevel 1 goto failed

"%GIT%" add -A
if errorlevel 1 goto failed

"%GIT%" commit -m "Integrate local ASR subtitle generation"
if errorlevel 1 goto failed

"%GIT%" remote remove github 2>nul
"%GIT%" remote add github "%REPO_URL%"
if errorlevel 1 goto failed

"%GIT%" push -u github HEAD:main
if errorlevel 1 goto failed

echo.
echo Published to GitHub:
echo %REPO_URL%
pause
exit /b 0

:failed
echo.
echo Publish failed. Check the error above.
pause
exit /b 1
