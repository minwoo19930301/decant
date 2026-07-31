# Grok Build pattern distillation

Evidence snapshot: **2026-07-17T17:30:00+09:00**

## Decision

Rein adopts a small set of narrow findings from the newly
open-sourced [xai-org/grok-build](https://github.com/xai-org/grok-build)
(Rust; first-party code Apache-2.0): two documentation corrections that keep existing host
claims exactly matched to source, one distilled lockfile-reclaim behavior,
and one pinned design note that constrains a future Grok stage-executor
adapter. It does not import Grok Build code, add a dependency, or change
what Rein claims to support.

SpaceXAI's [2026-07-15 announcement](https://x.ai/news/grok-build-open-source)
makes the Grok Build CLI/TUI source public. A separate
[SpaceXAI privacy statement](https://x.com/spacexai/status/2077494536788664782)
says early-beta retention was enabled by default for non-ZDR users and that
default retention was disabled starting 2026-07-12. This document does not
independently verify past repository-upload behavior or current server-side
policy. The privacy finding below therefore distinguishes a pinned client
fallback from effective account behavior.

## Current primary evidence

All code references below are pinned to commit
[`c68e39f`](https://github.com/xai-org/grok-build/commit/c68e39f60462f28d9be5e683d9cbe2c57b1a5027).
Paths are relative to `crates/codegen/`.

| Claim | Primary source | Observed value | Confidence |
|---|---|---|---|
| Skill discovery order | [`xai-grok-tools/src/types/compat.rs`](https://github.com/xai-org/grok-build/blob/c68e39f60462f28d9be5e683d9cbe2c57b1a5027/crates/codegen/xai-grok-tools/src/types/compat.rs#L367-L376), [`.../skills/discovery.rs`](https://github.com/xai-org/grok-build/blob/c68e39f60462f28d9be5e683d9cbe2c57b1a5027/crates/codegen/xai-grok-tools/src/implementations/skills/discovery.rs#L852-L857) | `.grok` and `.agents` skill roots are always scanned, in that order; `.claude` is gated on a `[compat]` cell that defaults **on** but is user-disableable; the file-path discovery walk excludes `.cursor` by design | High; read directly from source. |
| Client retention-setting fallback | [`xai-grok-pager/src/settings/defs.rs`](https://github.com/xai-org/grok-build/blob/c68e39f60462f28d9be5e683d9cbe2c57b1a5027/crates/codegen/xai-grok-pager/src/settings/defs.rs#L1107-L1132) | The client setting metadata contains an `opt-in` fallback for "Coding data sharing" and says the value is persisted in auth metadata, not `config.toml`; effective account or server policy can override that fallback | High only for the pinned client fallback; effective server behavior was not independently verified. |
| Headless output channel | [`xai-grok-pager/src/headless.rs`](https://github.com/xai-org/grok-build/blob/c68e39f60462f28d9be5e683d9cbe2c57b1a5027/crates/codegen/xai-grok-pager/src/headless.rs#L459-L465), [`docs/user-guide/14-headless-mode.md`](https://github.com/xai-org/grok-build/blob/c68e39f60462f28d9be5e683d9cbe2c57b1a5027/crates/codegen/xai-grok-pager/docs/user-guide/14-headless-mode.md#L9-L41) | Headless mode (`grok -p`) emits one terminal JSON blob on stdout under `--output-format json`; there is no `--output-last-message`-style file side channel, and prompts are selected through CLI arguments (`-p`, `--prompt-json`, or `--prompt-file`), not stdin | High for the inspected paths. |
| Sandbox failure behavior | [`xai-grok-sandbox/src/lib.rs`](https://github.com/xai-org/grok-build/blob/c68e39f60462f28d9be5e683d9cbe2c57b1a5027/crates/codegen/xai-grok-sandbox/src/lib.rs#L144-L193) | Sandbox application is **fail-open**: unsupported platform or apply error logs a warning and continues without a sandbox; a stub applies when the `enforce` feature is compiled out | High; both fallback paths read directly. |
| Stale-lock source pattern | [`xai-grok-memory/src/dream_lock.rs`](https://github.com/xai-org/grok-build/blob/c68e39f60462f28d9be5e683d9cbe2c57b1a5027/crates/codegen/xai-grok-memory/src/dream_lock.rs#L53-L149) | The source combines PID-liveness checks with a source-specific staleness policy and write-then-verify coordination; Rein distills only the provably-dead-holder signal, not age-based eviction | High for the pinned source behavior; the separate implementation PR defines a stricter local policy. |

## What Rein adopts now

1. **Doc precision on Grok skill discovery**
   ([host-surface-verification.md](host-surface-verification.md)): the
   existing verified claim gains the source-level precedence facts — `.grok`
   before `.agents`, Claude-compat gated by a default-on toggle a user can
   turn off.
2. **Data-retention caveat in the provider table** ([README](../README.md)):
   users who host the skill pack in Grok Build are told that the pinned client
   contains an `opt-in` fallback while effective account or server policy may
   override it. Rein never launches Grok and cannot see or change
   that setting.
3. **Stale-lock reclaim for `workspace.lock`** (separate PR): on `EEXIST`,
   read the recorded `{runId, pid, createdAt}` and reclaim only when the holder
   PID is provably dead. The replacement must run under a separate atomic
   reclaim guard before the workspace lock is replaced; age alone never makes
   a live or unidentifiable holder reclaimable. Today a crashed mutating run
   leaves the lock stuck until a human deletes it.
4. **Pinned executor-adapter constraints**
   ([lineage-and-portability.md](lineage-and-portability.md)): a future
   `GrokExecutorAdapter` must consume one stdout JSON blob instead of an
   output file, select the prompt through `-p`, `--prompt-json`, or
   `--prompt-file` instead of stdin, and must not
   present Grok's fail-open sandbox as an enforced read-only guarantee.

## Deferred (real, not yet scheduled)

- **Artifact redaction module** (`src/redact.mjs`): zero-dependency secret
  and home-path redaction at the events/manifest/report write seams,
  following the tripwire-test discipline in `xai-grok-secrets`. Deferred to
  its own PR with tests.
- **Golden wire-contract tests** for persisted JSON surfaces, following the
  golden/negative-test pattern in `xai-prompt-queue`.
- **Effort-key normalization breadth** in `catalog.mjs` (camelCase
  `reasoningEfforts`, object-menu `value`/`id`/`label` keys) — pointless
  until a non-Codex adapter exists.

## What stays out

- the full `GrokExecutorAdapter` implementation (two structural contract
  changes; premature before v0.3);
- ACP client integration for model metadata;
- vendoring any sandbox enforcement (Landlock/Seatbelt) — Rein
  never runs privileged enforcement code;
- per-file hunk attribution actors, worktree pooling, embeddings memory,
  background consolidation loops, codebase-graph indexing — each is a
  resident state owner or daemon shape the Ouroboros exclusions already
  forbid;
- all telemetry/Sentry/Mixpanel scaffolding — directly opposite the
  zero-telemetry core;
- a `.grok-plugin/` manifest mirror — Grok Build recognizes the existing
  `.claude-plugin` files as fallback locations; exact precedence differs among
  [manifest](https://github.com/xai-org/grok-build/blob/c68e39f60462f28d9be5e683d9cbe2c57b1a5027/crates/codegen/xai-grok-agent/src/plugins/manifest.rs#L3-L10),
  [marketplace-index](https://github.com/xai-org/grok-build/blob/c68e39f60462f28d9be5e683d9cbe2c57b1a5027/crates/codegen/xai-grok-plugin-marketplace/src/index.rs#L1-L8),
  and [component-catalog](https://github.com/xai-org/grok-build/blob/c68e39f60462f28d9be5e683d9cbe2c57b1a5027/crates/codegen/xai-grok-plugin-marketplace/src/catalog.rs#L1-L10)
  lookups.

## License note

Grok Build's first-party code is Apache-2.0; vendored and third-party material
retains its own licenses, as its
[repository README](https://github.com/xai-org/grok-build/blob/c68e39f60462f28d9be5e683d9cbe2c57b1a5027/README.md#license)
explains. Rein imports no Grok Build source code or assets. This
document quotes short source phrases and links their pinned locations for
provenance; it makes no conclusion about attribution obligations.

This document is a technical comparison, not legal advice.
