# SubtitlePlayer ASR Service

This service provides the local ASR backend for SubtitlePlayer-ASR.

The integrated distribution is intended to be distributed under GPL-3.0-only
when it includes AsrTools or other GPL components. The original frontend keeps
its MIT notice as a component-level license.

## Runtime

The integrated path uses AsrTools-compatible runtime files under
`asr-service/runtime`.

## Run

Use the root `字幕播放器.cmd` launcher. It starts this service and then opens the
player.

Check service health:

```powershell
Invoke-RestMethod http://127.0.0.1:28888/api/health
```

## Engines

The frontend sends `engine=bijian` by default. The standard-library service maps
that to AsrTools' Bcut/B interface. Other accepted values include `jianying` and
`kuaishou` when the corresponding AsrTools modules are available.

## Model Summary

The player can summarize loaded subtitles through this local service. The browser
posts subtitles to `/api/summarize`; this service calls the configured model
provider and returns the summary.

Supported built-in providers:

- `openai`: ChatGPT/OpenAI Responses API.
- `qwen`: Alibaba DashScope OpenAI-compatible API.
- `doubao`: Volcengine Ark OpenAI-compatible API.
- `custom`: Any OpenAI-compatible chat completions endpoint.

Recommended configuration:

1. Run the root `字幕播放器.cmd` launcher.
2. Click `⚙ 模型` in the transcript panel.
3. Select OpenAI, Qwen, Doubao, or custom provider.
4. Fill API Key, model, and Base URL.
5. Click save and use.

Each provider keeps its own saved configuration. The provider selected when
saving becomes the active summary provider.

`summary-config.json` is ignored by Git. Do not commit API keys.

Environment variable alternatives:

```powershell
$env:SUMMARY_PROVIDER="openai"
$env:OPENAI_API_KEY="..."
$env:OPENAI_SUMMARY_MODEL="gpt-5.2"

$env:SUMMARY_PROVIDER="qwen"
$env:QWEN_API_KEY="..."
$env:QWEN_SUMMARY_MODEL="qwen-plus"

$env:SUMMARY_PROVIDER="doubao"
$env:DOUBAO_API_KEY="..."
$env:DOUBAO_SUMMARY_MODEL="your-doubao-or-ark-model-id"
```

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
- FFmpeg: license depends on build configuration. Include license/source
  information matching the bundled FFmpeg binary.
