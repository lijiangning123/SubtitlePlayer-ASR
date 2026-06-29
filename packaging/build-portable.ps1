param(
  [Parameter(Mandatory=$true)]
  [string]$PythonRuntime,

  [Parameter(Mandatory=$true)]
  [string]$FfmpegRuntime,

  [string]$OutputDir = ".\dist\SubtitlePlayer-ASR-portable"
)

$ErrorActionPreference = "Stop"

$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$Output = Join-Path $RepoRoot $OutputDir

if (Test-Path $Output) {
  Remove-Item -LiteralPath $Output -Recurse -Force
}

New-Item -ItemType Directory -Force -Path $Output | Out-Null

$items = @(
  "字幕播放器.html",
  "README.md",
  "LICENSE",
  "start-player.cmd",
  "css",
  "js",
  "asr-service"
)

foreach ($item in $items) {
  $src = Join-Path $RepoRoot $item
  $dst = Join-Path $Output $item
  if (Test-Path $src -PathType Container) {
    Copy-Item -LiteralPath $src -Destination $dst -Recurse
  } else {
    Copy-Item -LiteralPath $src -Destination $dst
  }
}

$runtimeDir = Join-Path $Output "asr-service\runtime"
$pythonDst = Join-Path $runtimeDir "python"
$ffmpegDst = Join-Path $runtimeDir "ffmpeg"

if (Test-Path $pythonDst) {
  Remove-Item -LiteralPath $pythonDst -Recurse -Force
}
if (Test-Path $ffmpegDst) {
  Remove-Item -LiteralPath $ffmpegDst -Recurse -Force
}

Copy-Item -LiteralPath $PythonRuntime -Destination $pythonDst -Recurse
Copy-Item -LiteralPath $FfmpegRuntime -Destination $ffmpegDst -Recurse

Write-Host "Portable package created:"
Write-Host $Output
Write-Host ""
Write-Host "Run start-player.cmd from that folder."
Write-Host "Review licenses before distributing bundled ASR engines."
