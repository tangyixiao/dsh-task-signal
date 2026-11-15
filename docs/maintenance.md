# Maintenance, releases and resources

Task Signal adopts the applicable [Tangyixiao Open Source Standard](https://github.com/tangyixiao/.github/blob/main/docs/standard.md), with project-specific intent in [.github/toss.json](../.github/toss.json).

- Keep runtime code, client bundle and package version aligned. Build without downloading tools. Use fixed Action SHAs and explicit read permissions for untrusted CI; publishing stays separate from PR execution.
- Weekly grouped Dependabot updates cover GitHub Actions only; this package has no third-party runtime dependencies. No automatic merge or stale-issue closure is configured.
- Settings, custom WAV and personal application-audio imports are user data. An npm version rollback does not roll them back. See the [Chinese](guide.zh-CN.md) and [English](guide.en.md) update/uninstall instructions.
- Verify the exact npm metadata/archive, GitHub tag/asset, market indexes, installed bytes and activation independently. A submission receipt or repository directory row does not prove native market admission.
- No fake percentages, artificial commits, stars or compatibility claims. Native Windows audio was tested; macOS/Linux audio devices remain unverified even when their CI jobs pass.
- `.github/toss.json` records intended features; it does not prove Discussions, private reporting, labels or branch settings are live. Record actual platform verification in the release PR.
- No standalone project board or Wiki is populated merely to fill a tab. Backlog stays in Issues/PRs; versioned guides are authoritative. No release credentials or new trusted publisher are provisioned by the source baseline.

Use existing checkouts/runtimes and one owned scratch namespace. Reserve 10 GiB free, review growth at 1 GiB, budget 2 GiB optional growth, keep normal logs below 20 MiB and run one heavy job at a time. Keep compact artifact/hash and rollback evidence for up to 14 days or until the review/recovery window ends. Active local package archives and personal audio remain needed for normal use.

Stop unneeded servers and browser tabs. Check boundaries, links, consumers and recovery before cleanup; never bypass an approval rejection. A prior cleanup rejection remains in force for its paths.
