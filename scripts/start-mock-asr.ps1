$Here = Split-Path -Parent $MyInvocation.MyCommand.Path
$Root = Split-Path -Parent $Here
Set-Location $Root
& "..\node-v22.16.0-win-x64\node.exe" ".\scripts\mock-asr-server.js"
