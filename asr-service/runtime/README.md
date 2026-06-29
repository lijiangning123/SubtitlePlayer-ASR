# Bundled Runtime

Put portable runtime files here when building a no-install distribution:

```text
asr-service/runtime/
  python/
    python.exe
    Lib/
    Scripts/
      uvicorn.exe
      videocaptioner.exe
  ffmpeg/
    bin/
      ffmpeg.exe
```

When `runtime/python/python.exe` exists, `run-asr-service.cmd` uses it directly and does not require the user to install Python.

When `runtime/ffmpeg/bin/ffmpeg.exe` exists, `server.py` uses it before checking the system PATH.

If you bundle VideoCaptioner or AsrTools code/binaries, the integrated package
should be distributed under GPL-3.0-compatible terms. This repository's
integrated distribution is documented as GPL-3.0-only.

Before publishing a release artifact, include license texts and source-code
availability information for:

- AsrTools
- FFmpeg
- Python
- bundled Python packages
