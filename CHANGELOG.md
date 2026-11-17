# 0.1.2 — HTTP admission hardening

All registered HTTP routes first call the Host's synchronous `connection.requestRejection(request)` policy, then require the authenticated owner. Missing methods, thrown checks, invalid results and asynchronous results fail closed before reading request bodies or performing route work. Existing local request restrictions and per-action keys remain in place.

The installed DSH 0.2.2-rc.3 implementation already applies its Host/Origin policy inside `admit`; this change makes the published route contract explicit and hardens broken-service handling. It does not claim a demonstrated authentication bypass in that runtime.

No live model calls or local profile changes are needed for this source change.

# Changelog

## 0.1.1 — 2026-11-15

- Complete bilingual README identity: selected character logo, linked banners, theme-aware feature cards, real settings screenshot and live badges.
- Add usage/troubleshooting/update/removal guides, contribution/support/security entry points and repository-source checks.
- Preserve local sound preferences and separate artwork attribution from the MIT software license.

## 0.1.0 — 2026-11-15

- Completion, question, approval and error sounds with independent controls; completion only by default.
- Codex style by default, ZCode style, six original tones and custom PCM WAV. Optional personal imports stay outside release artifacts.
- Windows native background playback, optional browser playback, duration threshold, quiet hours, foreground suppression and subagent controls.
- Host-persisted settings, owner-authenticated local routes, per-turn deduplication, burst cooldown and browser delivery claims.
- Optional system notifications and speech with editable transcript; temporary mute.
- Playback-file isolation during hot reload and browser audio resource cleanup.

Windows native playback and desktop installation were tested locally. Automated CI covers Node 22/24 on Linux, Windows, macOS ARM64 and macOS Intel; native audio on macOS/Linux still requires device validation.
