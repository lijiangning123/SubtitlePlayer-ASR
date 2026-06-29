# Source Code Offer

This integrated distribution is intended for open-source distribution.

If a release artifact includes GPL-covered components such as AsrTools or
GPL-enabled FFmpeg binaries, the corresponding source code must be made
available according to the GPL-3.0 license terms.

## Included / Referenced Source Locations

- SubtitlePlayer-ASR integration code: this repository.
- Original SubtitlePlayer frontend: `Overfloating0/SubtitlePlayer`.
- AsrTools: https://github.com/WEIFENG2333/AsrTools
- FFmpeg: https://ffmpeg.org/download.html

## Release Maintainer Checklist

Before publishing a binary or bundled runtime release:

- Include full GPL-3.0 license text.
- Include `THIRD_PARTY_NOTICES.md`.
- Include `LICENSES/MIT-SubtitlePlayer.txt`.
- Include AsrTools source code in the release, or provide a GPL-compliant source
  offer and a stable upstream reference.
- Include FFmpeg license/source information matching the exact binary build.
- Include Python license files.
- Include license files for Python packages in the bundled runtime.

This file is not legal advice. It is a project-maintenance checklist for GPL
source-code availability.
