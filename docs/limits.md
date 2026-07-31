# Limits

The short version lives in the README. This is the long version — every claim
Decant does *not* make, so nobody has to discover it the hard way.

## Routing

- The five task dimensions (complexity, risk, blast radius, verifiability,
  reversibility) are scored with hand-written keyword patterns and hand-picked
  weights, against two hand-picked thresholds. See `src/router.mjs`.
- Nothing in this repository calibrates those numbers against outcomes.
- There is no published comparison between running a task through Decant and
  simply prompting the same model directly. Until there is, "risk-aware routing"
  is a design intention, not a measured result.
- `reversibility` defaults to a safe value when the caller does not say
  otherwise; it does not inspect whether a repository or backup actually exists.
- A task whose wording avoids the risk vocabulary will not escalate, however
  dangerous it actually is. Pass explicit dimensions to override the guess.

## Cost and budget

- `--budget-calls` caps **agent launches** — one per model stage, plus one per
  live reader call. See `consumeInvocation` in `src/pipeline.mjs`.
- It does not cap tokens, provider-internal turns, wall-clock time, or money.
- Verification commands are not counted against it.
- Exhausting the budget mid-run stops the run. There is no rollback, so a
  partially applied change can remain.

## The Reader-10 clarity gate

- Deterministic mode is ten *named personas that share one rule engine*, checking
  the generated report for structure, heading order, jargon density, unexplained
  acronyms, vague references, and accessibility signals. It is a linter.
- Live mode makes ten model invocations per round. Those may all be the same
  model, so they are ten correlated samples, not ten independent judgments. There
  is no calibration set and no blinded comparison.
- Either way it judges the **report**, not the code. A report can be perfectly
  clear about a change that is wrong.
- The gate became language-neutral in `0.2`: the structural cues accept Korean
  and English, and any well-formed `lang` attribute passes. Before that, an
  English report could not clear the gate at any quality level.
- The report template still renders Korean labels. Extracting those strings is
  not done.

## Evidence and replay

- Artifacts are hashed into `run.json`, and `replay --frozen` re-verifies those
  hashes. That detects local file drift.
- It is not an external notary, a signed attestation, or a tamper-proof ledger.
- `run.json` itself is a normal file. Somebody who can edit the artifacts can
  edit the manifest.
- The frozen run records the artifacts, not the machine: not the toolchain,
  credentials, network, or the remote model service's behaviour. Replaying does
  not reproduce a model.

## Model labels

- `frontier` / `balanced` / `economy` come from provider metadata, your explicit
  overrides, or — for a backend that publishes no metadata — a guess derived from
  the model's family name, which says so in its own description text.
- They are not prices, benchmarks, or a claim that a role received the objectively
  best or cheapest model available.

## Backends

- Two ship: `codex` and `kiro`. They are not interchangeable.
  - Codex enforces a JSON schema (`--output-schema`) and a kernel sandbox.
  - The Kiro adapter asks for the schema in the prompt and extracts the answer
    from the transcript; it cannot refuse malformed output. Isolation is a tool
    allowlist, which is weaker than a sandbox.
  - `doctor` prints which you have; `run.json` records it.
- Providers cannot be mixed within one run.
- Direct HTTP adapters for Anthropic, OpenAI, xAI, or Gemini are not included.
  The contract assumes a CLI that already supplies file tools, shell execution,
  approval behaviour, search, and a tool-call loop.
- The provider set is closed in code. Config selects one by id but cannot name an
  executable, so a checked-in project file cannot decide which binary runs.

## Execution

- A failed stage ends the run. No retry, no resume, no checkpoint, no rollback.
- There is no automatic escalation after a failure.
- The only evidence-time decision point is the architect check after the scout.
- The workspace lock is per-repository and best-effort by design; see
  `acquireWorkspaceLock` in `src/pipeline.mjs` for what it does and does not
  guarantee.
- Verification commands are explicit configuration, run without a shell. No
  project command is ever inferred.

## Surfaces that do not exist

- No MCP server, no Apps SDK UI, no standalone GUI, no IDE extension.
- No scheduler, no daemon, no database, no vector memory.
- The scout is a general read-and-search agent stage, not a crawler or a
  site-specific extraction engine.

## Release status

- The last tagged release is `v0.1.1`, made under the project's first name
  **Relay10**. `DisciplinedRun` and `Rein` were unreleased intermediate names.
- Nothing has been published to npm under any of those names.
- The `v0.1.1` evidence under `docs/launch-*` deliberately keeps the old names so
  its recorded hashes still verify. `verify:launch`, `report:launch`, and
  `audit:launch` write to `outputs/` and refuse to overwrite it.
- Every pipeline test injects a fake backend. There is no repository-contained
  proof of a live end-to-end run against a real agent CLI.
