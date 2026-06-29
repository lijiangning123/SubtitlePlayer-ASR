# Third-Party Notices

This repository is being prepared as an open-source integrated distribution.
The combined distribution should be treated as GPL-3.0-only when it includes
AsrTools or other GPL components.

## Overall Distribution

- License: GPL-3.0-only
- Reason: the bundled/redistributed ASR stack may include GPL-3.0 components.

## SubtitlePlayer Frontend

- Upstream: `Overfloating0/SubtitlePlayer`
- Original license: MIT
- Notes: the original frontend code remains available under MIT, but the
  integrated distribution is GPL-3.0-only when shipped together with GPL ASR
  components.

## AsrTools

- Upstream: `WEIFENG2333/AsrTools`
- License: GPL-3.0
- Source: https://github.com/WEIFENG2333/AsrTools
- Notes: if `asr-service/runtime/asrtools` is included in a release artifact,
  include the AsrTools source or provide a valid written/source offer according
  to GPL-3.0.

## FFmpeg

- Upstream: https://ffmpeg.org/
- License: depends on build configuration. The `I:\subtitleplayer\ffmpeg.exe`
  build reports GPL-enabled configuration.
- Notes: include FFmpeg license notices and source-code availability
  information when redistributing binaries.

## Python Runtime

- Upstream: https://www.python.org/
- License: Python Software Foundation License
- Notes: include Python license files when redistributing a bundled Python
  runtime.

## Python Packages In AsrTools Runtime

The AsrTools runtime may include packages such as `requests`, `PyQt5`,
`qfluentwidgets`, and their dependencies. Include their license files from the
runtime's `Lib/site-packages/*dist-info` directories when preparing a release.

## Release Checklist

- Include this notice file.
- Include GPL-3.0 license text.
- Include SOURCE_CODE_OFFER.md or equivalent source-code availability notice.
- Include the original MIT notice for SubtitlePlayer.
- Include AsrTools source or a compliant source-code offer.
- Include FFmpeg license/source information.
- Include bundled Python and Python package license texts.
