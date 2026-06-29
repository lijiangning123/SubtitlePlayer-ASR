# Packaging Notes

Goal: create a no-install Windows folder or installer where users run `start-player.cmd` only.

Recommended layout:

```text
SubtitlePlayer-ASR/
  start-player.cmd
  字幕播放器.html
  js/
  css/
  asr-service/
    server.py
    run-asr-service.cmd
    runtime/
      python/
      ffmpeg/
```

Build options:

1. Portable runtime folder
   - Bundle Python into `asr-service/runtime/python`.
   - Install `requirements.txt` and the selected ASR CLI into that Python runtime.
   - Bundle FFmpeg into `asr-service/runtime/ffmpeg/bin/ffmpeg.exe`.
   - Ship the whole folder.

   Use the helper after preparing those two runtime folders:

   ```powershell
   cd packaging
   powershell -ExecutionPolicy Bypass -File .\build-portable.ps1 `
     -PythonRuntime "D:\runtime\python" `
     -FfmpegRuntime "D:\runtime\ffmpeg"
   ```

2. Frozen ASR executable
   - Build `server.py` into an exe with PyInstaller or Nuitka.
   - Bundle FFmpeg beside the exe.
   - Update `run-asr-service.cmd` to run the exe instead of Python.

License note:

- Bundling VideoCaptioner or AsrTools makes the integrated distribution
  GPL-3.0-only for release purposes.
- Include GPL-3.0 text, AsrTools source or source offer, FFmpeg license/source
  information, Python license files, and bundled Python package license files.
- The original SubtitlePlayer frontend MIT notice is preserved as a component
  notice in `LICENSES/MIT-SubtitlePlayer.txt`.
