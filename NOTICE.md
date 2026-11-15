# Sources and provenance

Task Signal is an independently written synthesis of the following product ideas:

- [SciF-Lin/dsh-notify-sound-plus](https://github.com/SciF-Lin/dsh-notify-sound-plus), manifest 2.1.0: per-event controls, sound previews, optional notifications and avoiding duplicate whale alerts. Host source blob examined: `66dc99854114e92acf62d3c22797fb3bae43c2fe`. Manifest declares MIT; no implementation copied.
- [423324324/dsh-complete-chime](https://github.com/423324324/dsh-complete-chime), 1.0.0, MIT, copyright 2026 423324324: host-side persistence, optional spoken transcript and subagent control. Host source blob examined: `d967447a5e771f99910c3d39a030fd6b5714d68e`. No implementation copied.
- [DearMrChai/dsh-plugin-task-notify](https://github.com/DearMrChai/dsh-plugin-task-notify), manifest 0.3.1, MIT: configurable long-task threshold and separate subagent behavior. No implementation copied.

No Codex/ZCode recordings or third-party audio are distributed in the package. Character artwork has separate attribution and terms in assets/NOTICE.md. The two style approximations and six original melodies are synthesized locally. An optional source-only helper imports sounds from the user's existing Codex/ZCode installations for local personal playback; imported files stay under the user's DSH home and must not be included in releases. Original application sound rights remain with their respective owners. No third-party runtime dependencies are installed or bundled; React is supplied by DSH.

Host/client contracts were checked against the running DSH 0.2.2-rc.3 host and upstream reference:

- https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/agent-lifecycle.md
- https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/subsystems/session.md
- https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/subsystems/client-modules.md
- https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/subsystems/slots.md
- https://developer.mozilla.org/en-US/docs/Web/API/AudioContext/resume
- https://nodejs.org/api/child_process.html#child_processspawncommand-args-options

Upstream master may evolve beyond the tested desktop version; the manifest declares only the version actually targeted. Native Windows playback uses `System.Media.SoundPlayer` with fixed PowerShell source and an environment-passed file path. No user text is executed as code.
