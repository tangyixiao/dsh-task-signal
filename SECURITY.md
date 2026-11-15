# Security policy

Report vulnerabilities through [private vulnerability reporting](https://github.com/tangyixiao/dsh-task-signal/security/advisories/new). Do not post credentials, private audio, account files or exploitable details in public issues. Describe the affected version, redacted reproduction and impact.

The plugin's routes require an owner-authenticated loopback request. Audio upload is restricted to a bounded PCM WAV file; imported presets are local user data. Fixed player commands receive file paths through arguments/environment data, not executable user text. No runtime telemetry or external audio upload is implemented. These are implementation boundaries, not a security certification.

Compatibility follows the released manifest. The project does not operate Codex, ZCode, DSH, their accounts or upstream services. 软件与角色美术使用不同许可证；安全报告不要附带个人音频或完整 DSH 配置。
