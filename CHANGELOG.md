# Changelog

## 0.2.0 — 2026-07-31

### Measured, before anything else

Three controlled comparisons now exist and **two of them do not favour this
tool**. Task size decides whether the pipeline pays: on a tight 10-minute spec it
scored 0/100 against vanilla's 70/100; on a small browser game it tied on every
requirement at 3.9× the wall clock; on a larger 40-minute build it scored 100/100
against 90/100, at 5.4× the tokens. Numbers, methodology, and what none of it
establishes: `docs/benchmarks.md`. The short version is in the README: **do not
use the pipeline for small tasks.**

### Added

- **A provider interface.** Model stages go through one contract instead of
  hardcoding a CLI. `codex` and `kiro` ship; `config.provider` selects one.
  Providers declare what they can enforce — `native` versus `prompted` structured
  output, kernel sandbox versus tool allowlist — and that declaration is recorded
  in the run manifest, so a report cannot imply a guarantee the backend never
  made.
- **`decant review`.** The reviewer, alone, pointed at a workspace Decant did not
  produce: one model call, read-only, no pipeline. This is the stage the A/B
  showed earned its place — it caught a defect that broke the task's first
  requirement and that the unharnessed run shipped silently, while the full
  pipeline rated the same defect `low`. Exit code carries the verdict: 0 pass,
  2 rejected or malformed, 3 uncertain.
- **`--contract`.** A person declares the approval criteria before the work, each
  with an id, a requirement, and a risk. Every id must come back with a decision
  and evidence. A rejected critical or high criterion blocks; a critical one with
  no answer or no evidence blocks; anything else unresolved is a visible gap. The
  check is deterministic and ignores the reviewer's own verdict, because a model
  does not get to decide whether it answered the question it was asked.
- **A time-aware fast lane.** `--lane auto|fast|full`,
  `--time-budget-minutes N`, `--first-artifact path`. Five model calls become two:
  the maker goes first, effort caps at `medium`, the summary is deterministic. The
  maker must leave a non-empty content change at the declared artifact inside 30%
  of the budget, or the run stops — which is exactly the failure that scored 0/100
  on the short benchmark. The remaining wall clock caps every later stage instead
  of resetting per stage. `auto` picks the fast lane only for a
  15-minute-or-shorter task that also passes a safety guard, and explicit
  `--lane fast` refuses an unsafe task rather than lowering the guard.
- **A pre-run cost estimate on `route`.** Calibrated from the workspace's own
  recorded runs — every completed stage already stores its duration — falling back
  to a labelled seed table with no history. Predicted 301 s against an actual
  305 s on the one run measured against it. It reports **no** token or currency
  figure, because nothing here can observe one.
- An evidence-gated frontier architect: economy-tier work with no unresolved scout
  questions records a skip instead of spending the call, while always/never
  controls and the artifact contract are unchanged. Advisor decisions, reason
  codes, evidence counts, and invocation budgets are recorded in run events, the
  manifest, and the report.
- `doctor` reports a structured FAIL with PATH guidance when the selected
  backend is missing, instead of crashing on `spawn … ENOENT`, and top-level CLI
  errors for missing executables use the same wording.
- Host skills prefer a runnable source slice over broad test-first work under an
  explicit deadline.

### Changed

- **Product rename to Decant.** Formerly Relay10; `DisciplinedRun` and `Rein`
  were unreleased intermediate names. npm package `decant`, single CLI `decant`.
  The name states the job: pour off what several coding-agent harnesses do well,
  leave the sediment, carry the result into whichever model you already use.
- **Breaking: every identifier moved.** Config `decant.config.json`, run dir
  `.decant/`, skill ids `decant-*`, plugin dir `plugins/decant`,
  plugin/marketplace name `decant`, repository `minwoo19930301/decant`. The
  `disciplinedrun`, `dpr`, `r10`, `relay10`, and `rein` commands and the
  `.relay10/` and `.rein/` paths are **removed**, not deprecated. Nothing was ever
  published to npm under any old name and `v0.1.1` is still the last tagged
  release, so no installed user is affected. Migrate by hand, for example
  `mv .rein .decant && mv rein.config.json decant.config.json`.
- **Report clarity left the verdict entirely.** It no longer contributes to
  `status` and no longer reaches the exit code; it travels in
  `manifest.reportClarity` and prints on its own line. A clarity shortfall used to
  make a run `fail`, and then `warn` sharing exit code 2 — so `decant run && git
  commit` was blocked by the report's prose while the code was correct and the
  tests passed. Critical report issues still fail the run: no body, active external
  embeds, and executable links mean the artifact is broken or unsafe.
- **Exit codes distinguish the two reasons a run is not clean.** `0` pass, `2`
  fail, `3` warn — correctness held but nothing was proven, e.g. no verification
  commands configured. `!= 0` still catches everything.
- Dropped the "Effort Governor" branding. The subsystem is described as what it
  is: a hand-weighted keyword routing score with no calibration behind the
  weights.
- The README is rewritten for a first-time reader and leads with what was
  borrowed from which harness, then practical recipes, then what the tool will not
  do. The long-form caveats moved to `docs/limits.md`.
- Claude Code and Grok Build are documented as **Skill hosts, not stage
  executors**, with dated evidence in `docs/host-surface-verification.md`. Model
  role labels for a backend without vendor metadata are documented as guesses from
  the model's family name.
- `docs/prior-art.md` now records the five sibling projects written alongside this
  one, including the two whose ideas are relevant and still unused, because
  "independent implementation" is a weaker claim when the source is your own
  earlier work.

### Fixed

- **The clarity gate was a Korean-language gate.** Six structural checks were
  Korean-only regexes and one required literally `lang="ko"`, so a well-written
  English report could not clear it at any quality level — measured at 5/10 before
  and 10/10 after. The cue table is now bilingual and any well-formed `lang`
  attribute passes. The report template still renders Korean labels; extracting
  those strings is not done.
- **A prompted schema is not an enforced schema.** A live run died because the
  scout spelled a key `openquestions` where the schema says `open_questions`. The
  adapter now repairs drift from the schema's own vocabulary, renaming a key only
  when its normalised form matches a declared one. Nothing is invented: a missing
  key stays missing and validation still fails.
- **A missing sentinel destroyed a whole stage.** With a JSON schema in play the
  adapter now falls back to the outermost object in the transcript and reports
  `sentinelFallback: true`. For prose it still refuses.
- **Quoted markup was treated as report structure.** On a task that builds HTML,
  the maker's write-up quoted `<img …>` and the gate failed the run for missing
  alt text. Worse, the attribute span crossed newlines, so the prose sentence
  "Grepped index.html for `<img`" consumed a later `>` and became an element.
  Structural checks now skip `<pre>`, `<code>`, fenced blocks, backticks, and
  escaped spans, and a tag's attributes may not contain `<`.
- **The frozen `v0.1.1` evidence was destroyed by its own tooling.**
  `verify:launch`, `report:launch`, and `audit:launch` overwrote the released
  artifacts in place. All three now write to the gitignored `outputs/` through
  `scripts/frozen-evidence.mjs`, which identifies the four released artifacts **by
  inode** rather than by pathname — a symlink, a hardlink, or a path component
  swapped mid-write cannot redirect the bytes onto the archive. Overwriting the
  archive requires `--freeze` and `DECANT_ALLOW_FROZEN_OVERWRITE=1` and is refused
  before any work starts.
- `src/cli.mjs` is committed executable, so `npm link` works from a fresh clone.
- `route` and `inspect` printed "Codex invocations" whichever backend ran.

### Preserved

The `v0.1.1` Relay10 launch evidence keeps its released bytes and its old names on
purpose, so the recorded `reportSha256` binding still verifies.

## Unreleased

Nothing yet.

## 0.1.1 - 2026-07-13

- Include `examples/relay10.config.json` in the Git repository and release tag.
- Mark the initial v0.1.0 tag as superseded after a clean-clone test exposed the omission.

## 0.1.0 - 2026-07-13

- Initial Codex CLI harness with dynamic model-role discovery.
- Risk-aware routing contracts for scout, architect, maker, reviewer, explainer,
  and Reader-10.
- Deterministic and optional live Reader-10 clarity gates.
- Self-contained HTML run reports and frozen run artifacts.
