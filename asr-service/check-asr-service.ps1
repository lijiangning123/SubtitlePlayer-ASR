$ErrorActionPreference = "Continue"

$Here = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $Here

Write-Host "== Python =="
$Python = Join-Path $Here ".venv\Scripts\python.exe"
if (Test-Path $Python) {
  & $Python --version
} else {
  Write-Host ".venv\Scripts\python.exe not found"
  $cmd = Get-Command python -ErrorAction SilentlyContinue
  if ($cmd) {
    Write-Host "PATH python: $($cmd.Source)"
  } else {
    Write-Host "PATH python: not found"
  }
}

Write-Host "`n== Python packages =="
if (Test-Path $Python) {
  & $Python -c "import importlib.util; [print(f'{name}: {''ok'' if importlib.util.find_spec(name) else ''missing''}') for name in ['fastapi','uvicorn','multipart','videocaptioner','openai']]"
}

Write-Host "`n== CLI tools =="
Get-Command videocaptioner -ErrorAction SilentlyContinue | Select-Object Source
Get-Command ffmpeg -ErrorAction SilentlyContinue | Select-Object Source

Write-Host "`n== Port 28768 =="
Get-NetTCPConnection -LocalPort 28768 -ErrorAction SilentlyContinue | Select-Object LocalAddress,LocalPort,State,OwningProcess

Write-Host "`n== Health =="
try {
  Invoke-RestMethod -Uri "http://127.0.0.1:28768/api/health" -TimeoutSec 5 | ConvertTo-Json -Depth 4
} catch {
  Write-Host $_.Exception.Message
}
