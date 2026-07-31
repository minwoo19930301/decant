# Changelog

## Unreleased

- **Product rename: Rein** (formerly Relay10, briefly DisciplinedRun in an
  unreleased branch). npm package `rein-cli@0.2.0`, single CLI **`rein`**.
  Identity: keep a coding-agent run on a short rein — explicit scope,
  risk-aware effort, an invocation ceiling, inspectable file evidence, and
  hash-frozen replay.
- **Breaking rename of every identifier.** Config `rein.config.json`, run dir
  `.rein/`, skill ids `rein-*`, plugin dir `plugins/rein`, plugin/marketplace
  name `rein`, GitHub path `minwoo19930301/rein`. The `disciplinedrun`, `dpr`,
  `r10`, and `relay10` CLI aliases and the legacy `.relay10/` /
  `relay10.config.json` paths are **removed**, not deprecated. Nothing was ever
  published to npm under the old names, and `v0.1.1` remains the last tagged
  release, so no installed user is affected. Rename an existing working
  directory by hand: `mv .relay10 .rein && mv relay10.config.json
  rein.config.json`.
- Drop the "Effort Governor" branding. The subsystem is described as what it
  is: a hand-weighted keyword routing score plus an invocation ceiling, with no
  calibration data behind the weights.
- Document two limits the README previously left implicit: model stages run
  through the Codex CLI only (there is no executor abstraction), and generated
  reports plus the Reader-10 clarity heuristics are Korean-language.
- Preserve the `v0.1.1` Relay10 launch evidence verbatim:
  `docs/launch-report.html`, `docs/launch-verification.json`,
  `docs/launch-reader-*.json`, and their generator/auditor scripts keep the
  Relay10 names so their recorded `reportSha256` bindings still verify.

- Gate the frontier architect after scout evidence for economy-tier work while
  preserving always/never controls and the existing artifact contract.
- Record advisor decisions, reason codes, evidence counts, and invocation
  budgets in run events, manifests, and HTML reports.
- Document the Fable/Sonnet role correction, source limitations, Artificial
  Analysis graph caveats, and a forward evaluation protocol without claiming
  unmeasured token or currency savings.
- Document Claude Code and Grok Build as **Skill hosts** (not stage executors),
  with dated evidence in `docs/host-surface-verification.md`.
- Make `r10 doctor` report a structured FAIL with PATH guidance when the Codex
  CLI is missing, instead of crashing on `spawn codex ENOENT`.
- Format top-level CLI errors for missing executables with the same guidance.

## 0.1.1 - 2026-07-13

- Include `examples/relay10.config.json` in the Git repository and release tag.
- Mark the initial v0.1.0 tag as superseded after a clean-clone test exposed the omission.

## 0.1.0 - 2026-07-13

- Initial Codex CLI harness with dynamic model-role discovery.
- Risk-aware routing contracts for scout, architect, maker, reviewer, explainer,
  and Reader-10.
- Deterministic and optional live Reader-10 clarity gates.
- Self-contained HTML run reports and frozen run artifacts.
