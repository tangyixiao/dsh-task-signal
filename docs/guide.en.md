# Task Signal guide

[Home](../README.en.md) · [中文](guide.zh-CN.md) · [Support](../SUPPORT.md)

## Install and preview

Install `dsh-task-signal@0.1.1` through DSH Desktop's plugin manager. Open Plugins → dsh-task-signal and find Task Signal. For a CLI-managed web profile:

```sh
dsh plugin --profile web add dsh-task-signal@0.1.1
```

Only main-task completion is enabled by default, using the Codex style. Windows defaults to host-system playback. Preview once. For sound on the computer displaying a remote page, choose browser playback and preview to unlock audio.

## Sound choices

Codex and ZCode styles are independently synthesized approximations unless personal presets are imported. Imported choices are marked “local audio”. Six original tones and one custom WAV are also available per event. The release does not distribute original Codex/ZCode recordings or imply affiliation.

The source-only `tools/import-local-sounds.mjs` helper accepts `--codex WAV`, `--zcode-asar ASAR`, `--ffmpeg EXE` and optional `--home DSH_HOME`. It uses an existing converter without downloading or installing one. Imports remain personal local data. Custom audio must be 16-bit PCM WAV, mono/stereo, 8–48 kHz, up to 2 MiB and 8 seconds; deleting it resets affected events to Codex.

## Alert rules

- Completion, question, approval and error have separate switches and sounds. Cancelled turns stay silent.
- Only new durable events after activation are consumed; refresh and history do not replay alerts.
- Subagents are silent unless enabled. The completion-duration threshold defaults to zero and affects completion only.
- Per-turn deduplication, a default 900ms cooldown and host browser-delivery claims suppress repetition.
- Background-only uses page-focus heartbeats expiring after 15 seconds. No page or an expired heartbeat counts as background.
- Quiet hours use host local time, support midnight crossing and impose no restriction when start equals end.
- An active whale widget can own the matching sound. Other third-party alert plugins need their matching events disabled separately.
- Temporary mute resets on host restart. Optional notifications need permission; speech and notifications need an open page. The editable speech transcript defaults to “任务完成了” (“Task completed”).

## Playback and troubleshooting

Windows uses a hidden system player while the DSH host remains running. macOS `afplay` and Linux `aplay` are implemented but audio-device behavior is unverified; missing players produce an error and browser playback is an alternative. Browser mode needs an open page and an initial gesture; background throttling can apply. System notifications are silent to avoid a second sound.

If nothing is heard, preview first; check plugin enable/mute/volume, the system default output and master volume, then the chosen host/browser location. A successful player exit is not proof of physical audibility. Browser audio needs an initial preview and an unmuted tab. If preview works but a turn stays silent, inspect event, duration, subagent, foreground and quiet-hour filters. Do not run paid inference just to preview sound. See [Support](../SUPPORT.md).

## Data, update and removal

Data lives in `$DSH_HOME/dsh-task-signal/`, normally `~/.dsh/dsh-task-signal/`: settings, optional custom WAV and personal Codex/ZCode presets. Temporary `playback-*.wav` files are removed after playback. The in-memory queue is capped at 64 events; no chat body is stored. Routes require a local authenticated DSH owner. No runtime telemetry or external audio upload is implemented.

Update through the same plugin manager. Reverting package versions does not revert personal settings/audio. Disable and remove the plugin before optionally removing its own data folder; never delete the entire DSH home. Build with `npm run check`, `node tools/check-repository.mjs` and `npm pack`, without dependency installation. See [maintenance](maintenance.md), [software license](../LICENSE) and [artwork notice](../assets/NOTICE.md).
