# Changelog

## Unreleased

- **Product rename: Decant.** Formerly Relay10; `DisciplinedRun` and `Decant`
  were unreleased intermediate names. npm package `decant@0.2.0`, single CLI
  **`decant`**. The name states the job: pour off what several coding-agent
  harnesses do well, leave the sediment, and carry the result into whichever
  model you already use.
- **Pluggable model backend.** Model stages now go through a provider
  interface instead of hardcoding one CLI. `codex` and `kiro` ship as
  implementations; `config.provider` selects one. Providers declare what they
  can enforce (`native` vs `prompted` structured output, `native` sandbox vs
  `tool-allowlist`) and that declaration is recorded in the run manifest, so a
  report cannot imply a guarantee the backend never made.
- **Breaking rename of every identifier.** Config `decant.config.json`, run dir
  `.decant/`, skill ids `decant-*`, plugin dir `plugins/decant`,
  plugin/marketplace name `decant`, GitHub path `minwoo19930301/decant`. The
  `disciplinedrun`, `dpr`, `r10`, `relay10`, and `decant` CLI names and the
  legacy `.relay10/` / `.decant/` paths are **removed**, not deprecated. Nothing
  was ever published to npm under any old name and `v0.1.1` remains the last
  tagged release, so no installed user is affected. Rename an existing working
  directory by hand, for example
  `mv .rein .decant && mv rein.config.json decant.config.json`.
- Drop the "Effort Governor" branding. The subsystem is described as what it
  is: a hand-weighted keyword routing score plus an invocation ceiling, with no
  calibration data behind the weights.
- Document two limits the README previously left implicit: generated reports
  plus the Reader-10 clarity heuristics are Korean-language, and role labels for
  a provider without vendor metadata are guessed from model family names.
- Preserve the `v0.1.1` Relay10 launch evidence verbatim:
  `docs/launch-report.html`, `docs/launch-verification.json`, and
  `docs/launch-reader-*.json` keep their released bytes, and the generator and
  auditor scripts keep the Relay10 strings they embed, so the recorded
  `reportSha256` binding still verifies.
- Protect that evidence from its own tooling. `verify:launch`,
  `report:launch`, and `audit:launch` used to overwrite the released artifacts
  in place, which silently replaced them with a fresh — and, without Codex on
  `PATH`, failing — log. All three now write to the gitignored `outputs/`
  directory through `scripts/frozen-evidence.mjs`. That guard checks the opened
  file descriptor's inode against the four released artifacts, not just the
  pathname, so a symlink, a hardlink, or a path component swapped mid-write
  cannot redirect the bytes onto the archive. Overwriting an artifact requires
  `--freeze`, `DECANT_ALLOW_FROZEN_OVERWRITE=1`, and naming that artifact
  directly; it is refused before any work starts and is covered by tests.

- Gate the frontier architect after scout evidence for economy-tier work while
  preserving always/never controls and the existing artifact contract.
- Record advisor decisions, reason codes, evidence counts, and invocation
  budgets in run events, manifests, and HTML reports.
- Document the Fable/Sonnet role correction, source limitations, Artificial
  Analysis graph caveats, and a forward evaluation protocol without claiming
  unmeasured token or currency savings.
- Document Claude Code and Grok Build as **Skill hosts** (not stage executors),
  with dated evidence in `docs/host-surface-verification.md`.
- Make `decant doctor` report a structured FAIL with PATH guidance when the Codex
  CLI is missing, instead of crashing on `spawn codex ENOENT`.
- Format top-level CLI errors for missing executables with the same guidance.
- Add an opt-in/automatic short-task fast lane with an overall time budget,
  maker-first execution, medium effort caps, a declared primary-artifact
  content gate, deterministic reporting, and safety fallback to the full lane.
- Teach the host skills to prefer a runnable source slice over broad test-first
  work under an explicit deadline, with a lower-effort fast lane for 15-minute-or-shorter work.

## 0.1.1 - 2026-07-13

- Include `examples/relay10.config.json` in the Git repository and release tag.
- Mark the initial v0.1.0 tag as superseded after a clean-clone test exposed the omission.

## 0.1.0 - 2026-07-13

- Initial Codex CLI harness with dynamic model-role discovery.
- Risk-aware routing contracts for scout, architect, maker, reviewer, explainer,
  and Reader-10.
- Deterministic and optional live Reader-10 clarity gates.
- Self-contained HTML run reports and frozen run artifacts.
