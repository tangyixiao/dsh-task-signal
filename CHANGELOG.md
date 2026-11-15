# Changelog

## 0.1.0 — 2026-11-15

- Completion, question, approval and error sounds with independent controls; completion only by default.
- Codex style by default, ZCode style, six original tones and custom PCM WAV. Optional personal imports stay outside release artifacts.
- Windows native background playback, optional browser playback, duration threshold, quiet hours, foreground suppression and subagent controls.
- Host-persisted settings, owner-authenticated local routes, per-turn deduplication, burst cooldown and browser delivery claims.
- Optional system notifications and speech with editable transcript; temporary mute.
- Playback-file isolation during hot reload and browser audio resource cleanup.

Windows native playback and desktop installation were tested locally. Automated CI covers Node 22/24 on Linux, Windows, macOS ARM64 and macOS Intel; native audio on macOS/Linux still requires device validation.
