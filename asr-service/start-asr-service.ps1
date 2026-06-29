$Here = Split-Path -Parent $MyInvocation.MyCommand.Path
& (Join-Path $Here "run-asr-service.cmd")
