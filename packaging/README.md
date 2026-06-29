# Packaging Notes

Goal: create a no-install Windows folder or installer where users run
`字幕播放器.cmd` only.

Recommended layout:

```text
SubtitlePlayer-ASR/
  字幕播放器.cmd
  字幕播放器.html
  js/
  css/
  asr-service/
    stdlib_asr_server.py
    runtime/
      python/
      ffmpeg/
      asrtools/
```

Build options:

1. Portable runtime folder
   - Bundle Python into `asr-service/runtime/python`.
   - Bundle AsrTools into `asr-service/runtime/asrtools/app`.
   - Bundle FFmpeg into `asr-service/runtime/ffmpeg/ffmpeg.exe` or
     `asr-service/runtime/ffmpeg/bin/ffmpeg.exe`.
   - Ship the whole folder.

2. Frozen ASR executable
   - Build `stdlib_asr_server.py` into an exe with PyInstaller or Nuitka.
   - Bundle FFmpeg beside the exe.
   - Update `字幕播放器.cmd` to run the exe instead of Python.

License note:

- Bundling VideoCaptioner or AsrTools makes the integrated distribution
  GPL-3.0-only for release purposes.
- Include GPL-3.0 text, AsrTools source or source offer, FFmpeg license/source
  information, Python license files, and bundled Python package license files.
- The original SubtitlePlayer frontend MIT notice is preserved as a component
  notice in `LICENSES/MIT-SubtitlePlayer.txt`.
