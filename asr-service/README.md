# SubtitlePlayer ASR Service

This service provides the local ASR backend for SubtitlePlayer-ASR.

The integrated distribution is intended to be distributed under GPL-3.0-only
when it includes AsrTools or other GPL components. The original frontend keeps
its MIT notice as a component-level license.

## Runtime

The integrated path uses AsrTools-compatible runtime files under
`asr-service/runtime`. If they are not present during local development, it can
fall back to the known external AsrTools location `I:\subtitleplayer`.

On Windows run:

```powershell
.\run-asr-service.cmd
```

## Run

```powershell
.\run-asr-service.cmd
```

Then open the player, load a local video, and click `生成字幕`.

Check service health:

```powershell
Invoke-RestMethod http://127.0.0.1:28768/api/health
```

If the player reports a timeout, run:

```powershell
.\check-asr-service.ps1
```

## Engines

The frontend sends `engine=bijian` by default. The standard-library service maps
that to AsrTools' Bcut/B interface. Other accepted values include `jianying` and
`kuaishou` when the corresponding AsrTools modules are available.

## OpenAI Fallback

To use OpenAI Whisper API directly, submit `provider=openai` or `engine=whisper-api` and set:

```powershell
$env:OPENAI_API_KEY="..."
$env:OPENAI_TRANSCRIBE_MODEL="whisper-1"
```

The OpenAI path uses FFmpeg to extract MP3 audio, then requests SRT output.

## License

- Integrated distribution: GPL-3.0-only.
- Original SubtitlePlayer frontend: MIT component license.
- AsrTools: GPL-3.0. Include source or a compliant source-code offer when
  redistributing bundles that include AsrTools.
- FFmpeg: license depends on build configuration. The referenced
  `I:\subtitleplayer\ffmpeg.exe` build reports GPL-enabled configuration.
