# Rein

> Keep a coding-agent run on a short rein.
> Explicit scope. Risk-aware effort. Inspectable evidence. Separate verdicts.

**Rein** is a small agent-run harness with zero third-party npm runtime
dependencies. It combines a portable eight-skill workflow pack with an optional
CLI pipeline. The pack loads on **Codex, Claude Code, and Grok Build**. The CLI
maps a local model catalog into `frontier` / `balanced` / `economy` labels,
records stage handoffs as files, keeps command and reviewer results separate
from report-clarity checks, and renders a standalone HTML run report whose
artifacts can be re-verified by hash.

Read these three limits before deciding whether to install it:

1. **Model stages run through the Codex CLI only.** There is no executor or
   provider abstraction: every model stage shells out to `codex exec`, and the
   model catalog comes from `codex debug models`. The Skill pack is portable to
   other hosts; the CLI pipeline is not.
2. **Generated reports are Korean.** `report.html` is emitted with
   `lang="ko"`, Korean section labels, and the Reader-10 clarity heuristics
   match Korean tokens. An English-only report will not pass the clarity gate.
3. **Routing is a hand-weighted keyword score, not a measured policy.** Five
   task dimensions are scored from regex patterns with hand-picked weights and
   two thresholds. No calibration data backs those numbers, and there is no
   published comparison against running Codex directly.

`--budget-calls` is a hard ceiling on **pipeline stage launches** (Codex
subprocesses), not on tokens, provider-internal turns, or currency. The
`frontier` / `balanced` / `economy` labels come from catalog metadata and user
overrides; they are not live price measurements, benchmarks, or guarantees that
Rein picked the cheapest, weakest, or strongest available model.

This branch prepares the `0.2.0` rename release. The latest tagged release
remains `v0.1.1` under the former **Relay10** name; `v0.1.1` launch evidence
under `docs/launch-*` deliberately keeps the old names so its recorded hashes
still verify. Nothing was published to npm under `relay10` or `disciplinedrun`.

Single CLI: **`rein`**. Config `rein.config.json`, run dir `.rein/`, skill ids
`rein-*`. The old `relay10` / `r10` / `dpr` / `disciplinedrun` commands and the
`.relay10/` path are removed in `0.2.0`.

## What it does

- **Risk-aware routing:** five keyword-scored task dimensions select stage
  profiles, then scout evidence decides whether an economy task needs the
  frontier architect. `0.2` still does not escalate after a failed stage, and
  has no retry or resume.
- **Host-first skills:** repo skills for Codex, Claude Code, and Grok Build,
  plus one Node CLI on builtins only.
- **Inspectable handoffs:** each completed stage has a declared role, effort,
  sandbox, output path, and event record.
- **Separate signals:** explicitly configured commands, a model reviewer, and
  Reader-10 results are shown separately instead of being presented as one
  proof of correctness.
- **Hash-frozen replay:** artifacts are hashed into the run manifest, `report`
  never overwrites `report.html`, and `replay --frozen` re-verifies the stored
  hashes. This detects drift in local files; it is not an external notary or a
  tamper-proof ledger.
- **Two Reader-10 modes:** the default deterministic mode is a structural and
  accessibility linter over the report — ten named personas that share one rule
  engine, not ten independent readers. Live mode makes ten reader-model
  invocations per round, which may all be the same model; neither mode
  establishes factual correctness.


## Why Rein instead of a batteries-included harness

Rein favors controlled, inspectable work over maximum built-in
autonomy. Choose it when you want:

- **Explicit scope before implementation.** The optional `rein-spec` Skill
  can record the outcome, non-goals, acceptance evidence, and rollback plan.
  This is host-agent workflow guidance; `rein run` does not automatically ingest
  or enforce that contract.
- **Risk-aware effort and advice.** Under the default conditional policy, five
  keyword-scored task dimensions tune maker and reviewer effort. After the
  scout, an evidence checkpoint decides whether economy-tier work needs frontier
  architect advice. Stage model roles remain declared contracts; this is a
  hand-tuned heuristic, not live-price, measured-spend, or calibrated routing.
- **A hard ceiling on CLI stage launches.** For `rein run`, `--budget-calls`
  limits Rein pipeline stage launches (Codex subprocesses in 0.2).
  It does not count provider-internal turns, tokens, or currency.
- **Inspectable artifacts and separate verdicts.** Stage handoffs and events
  remain ordinary files under `.rein/runs/<id>/`. Configured command results,
  the model reviewer, and Reader-10 clarity results are reported separately.
  These artifacts support inspection; they are not a complete audit trail or
  proof of correctness.

Choose a batteries-included harness instead when you need native teams or
swarms, background agents, retry-until-done loops, durable checkpoint/resume,
or a broader built-in runtime or UI. Rein deliberately keeps those
features out of its core.

## Quick start

**Skill hosts (Codex, Claude Code, Grok Build):** clone the repo (or install
the Claude marketplace plugin). Skills appear via `.agents/skills` /
`.claude/skills`. No separate Codex install is required just to load skills.

**Optional controlled CLI pipeline:** Node 20+ and, for live
`rein run` model stages, an authenticated Codex CLI on `PATH`.

```bash
git clone https://github.com/minwoo19930301/rein.git
cd rein
npm link

# single CLI: rein
rein doctor
rein init
rein route "research the API and build a small CLI"
rein run "research the API and build a small CLI" --dry-run
rein run "research the API and build a small CLI"
```

To request live Reader-10, which schedules ten separate reader invocations per
round:

```bash
rein run "your task" --live-readers --budget-calls 30
```

Different reader roles may use the same model or models from the same family;
ten invocations do not guarantee ten independent judgments. The invocation
budget counts Rein pipeline stage launches (Codex subprocesses in
0.2), not provider-internal model turns, tokens, or currency cost.

The report is written under `.rein/runs/<run-id>/report.html`.

## Current provider and app support

The Rein 0.2.0 preview is **host-first**. The skill pack runs on the
coding agent you already use. The optional CLI pipeline is a separate
controlled-run surface.

| Target | Current status | What that means |
|---|---|---|
| Claude Code as a Skill and Plugin host | Preview; host path verified 2026-07-15, renamed manifests statically validated 2026-07-17 | Marketplace / `.claude/skills` load all eight skills. This is Skill-host guidance, not native stage execution. |
| Grok Build / Grok CLI as a Skill host | Preview, verified 2026-07-15 | `.agents/skills` loads the same pack. This is Skill-host guidance, not xAI stage execution. Note: the pinned Grok Build client source contains an `opt-in` fallback for "Coding data sharing," but effective account or server policy can override it. Rein never launches Grok or sees that setting—confirm the current policy in your own session; see the [pinned evidence note](docs/grokbuild-distillation.md). |
| Codex as a Skill host | Repository surface, statically validated | Same pack via `.agents/skills` / plugin layout. |
| Codex CLI as optional `rein run` stage runtime | Supported and tested | Live model stages still launch `codex exec` and discover models via `codex debug models` in 0.2. Skill-host use does not require this. |
| Codex with an xAI/Grok custom provider as a **stage executor** | Experimental candidate, untested | Not the same as Grok skill-host support. |
| Anthropic/Claude or Google Gemini APIs as CLI stage executors | Unsupported in 0.2 | Skill-host support for Claude Code is separate and already works. |
| Mixed providers in one CLI run | Unsupported | Stage config holds a model, not a provider switch. |
| Codex desktop app or IDE | Indirect shell use only | Can invoke `rein` / `rein` / `rein`; no native progress UI. |
| ChatGPT app/web or a standalone GUI | Not implemented | Needs MCP/Apps SDK or a local sidecar. |

Skills guide the host agent; they do not silently replace that host’s model for
every tool call. Evidence for host checks lives in
[host-surface-verification.md](https://github.com/minwoo19930301/rein/blob/main/docs/host-surface-verification.md).
See also the full
[lineage and portability decision](https://github.com/minwoo19930301/rein/blob/main/docs/lineage-and-portability.md).

<a id="rein-skill-pack"></a>

## Skill pack

Rein distills recurring patterns from current global coding agents and
Agent Skill collections into eight on-demand skills instead of installing a
large catalog. Skill **ids remain `rein-*`** in this release for host
compatibility:

| Skill | Job | Important boundary |
|---|---|---|
| `rein-orchestrate` | choose the smallest useful workflow | does not switch the host agent's current task model |
| `rein-research` | collect current read-only evidence | does not mutate a repository |
| `rein-spec` | define outcome, non-goals, acceptance, and rollback | does not implement plan-only requests |
| `rein-build` | implement an authorized change in small slices | does not publish |
| `rein-debug` | reproduce and isolate root cause | diagnosis alone does not authorize repair |
| `rein-review` | review a fixed baseline and report findings | remains read-only |
| `rein-release` | prove package, artifact, hash, and support claims | requires explicit publication authority |
| `rein-skill-lab` | tune triggers and compare against no-skill baseline | rejects skills without measured benefit |

The Confirmed Task Contract is an optional output of the `rein-spec` Skill.
`rein run` does not automatically ingest, cryptographically bind, or
enforce that contract. The same boundary applies to other Skill guidance: a
host agent follows it; the CLI does not claim to turn every instruction into a
runtime invariant.

The canonical pack lives under `plugins/rein/skills`. `.agents/skills` and
`.claude/skills` are relative symlinks to that directory so a cloned repository
exposes the same skills to Codex, Claude Code, and Grok Build surfaces that
scan those roots. The plugin manifests are at
`plugins/rein/.codex-plugin/plugin.json` and
`plugins/rein/.claude-plugin/plugin.json`, and the repository root
`.claude-plugin/marketplace.json` makes this repository installable as a Claude
Code marketplace; all three pass their local validators but have not been
published to a curated marketplace. To install the pack in Claude Code:

```text
/plugin marketplace add minwoo19930301/rein
/plugin install rein@rein
```

Installed Claude Code plugin skills appear namespaced as `rein:<skill-name>`;
a session opened inside a clone of this repository loads the same skills through
`.claude/skills` or `.agents/skills` without installing anything. Grok Build
discovers the pack via `.agents/skills` (and optional Claude-compat skill
paths). Skills guide the host agent on Claude Code, Grok Build, or Codex.
Optional `rein run` / `rein run` model stages still use Codex CLI in
0.2.
The pack follows progressive disclosure and contains original clean-room text.
The Skill-ecosystem
source subset and license cautions are recorded in
`plugins/rein/provenance/sources.json`; the complete agent, harness,
workflow, and Skill lineage is recorded in `docs/prior-art.md`.

## Default pipeline

| Stage | Capability label | Effort | Access | Purpose |
|---|---|---:|---|---|
| scout | economy | low | read-only + optional search | inspect sources and collect context |
| architect/advisor | frontier | max | read-only | after scout, advise balanced/frontier work or economy work with unresolved questions |
| maker | balanced | medium | workspace-write | implement the plan |
| verification | no model | n/a | explicit argv commands | record opt-in command results |
| reviewer | frontier | high | read-only | review correctness and risk |
| explainer | balanced | low | read-only | write a newcomer-facing summary |
| Reader-10 | rules or configured model | low | read-only | check report structure or model-reported clarity |

These are role defaults, not a claim that one role always receives the
objectively best or cheapest model. The available catalog metadata and local
overrides determine the concrete model and supported effort.

The default `conditional` policy skips the architect call only when the initial
task is economy-tier and `scout.json` contains no open questions. The run still
keeps `architect.md` as a deterministic skip record, so the six-stage artifact
contract remains stable. Balanced/frontier work keeps the advisor, and an
economy run with unresolved questions stops before mutation if its invocation
budget has no advisor headroom.

## Commands

```text
rein init [--force]
rein doctor
rein route <task> [--json]
rein run <task> [--dry-run] [--live-readers] [--budget-calls N]
rein inspect [run-id] [--json]
rein report [run-id] [--output file]
rein replay [run-id] --frozen [--output file]
```

Full binary: `rein`. Same commands work as `rein`, `rein`, or `rein`.

The inherited v0.1 `replay --frozen` contract verifies the recorded hashes and
either reports the saved `report.html` path or copies that exact file outside
the run directory. `report` is the separate model-free re-render command and
writes a new file. A frozen replay is not a full environment snapshot, resume
facility, or proof that remote model behavior can be reproduced. Short alias `rein` and legacy `rein` /
`rein` accept the same commands.

## Configuration

`rein init` writes the compatibility filename
`rein.config.json`. Model roles are derived from
`codex debug models`; explicit model overrides take precedence. See the
[example configuration](https://github.com/minwoo19930301/rein/blob/main/examples/rein.config.json)
and [configuration schema](https://github.com/minwoo19930301/rein/blob/main/schema/config.schema.json).

Verification commands are intentionally opt-in because project commands can
have side effects. They use an executable plus literal argv array, not a shell
command string:

```json
{
  "verification": {
    "commands": [
      { "command": "npm", "args": ["test"] },
      { "command": "npm", "args": ["run", "build"] }
    ]
  }
}
```

The default configuration runs no verification command. Configure commands
that are appropriate and safe for the current repository.

Advisor routing can be switched for comparison or compatibility:

```json
{
  "routing": {
    "advisorMode": "conditional"
  }
}
```

`conditional` is the default, `always` restores always-on architect invocation,
and `never` disables the architect checkpoint. Rein
records invocation counts but does not currently observe provider tokens or
billed currency, so these modes must not be described as a measured percentage
cost saving without an external evaluation.

Live Reader-10 can use the discovered economy-labelled model or supplied model
slugs:

```json
{
  "readerGate": {
    "mode": "live",
    "models": ["small-model-a", "small-model-b"],
    "minPass": 9,
    "maxRounds": 2,
    "concurrency": 3
  }
}
```

## Version 0.2 preview limits

- The verified stage runtime is Codex CLI. Direct OpenAI, xAI/Grok,
  Anthropic/Claude, and Gemini API adapters are not included, and providers
  cannot be mixed by stage. Grok Build skill-host loading is separate from
  xAI stage execution and does not change this limit.
- There is no MCP server, Apps SDK UI, or standalone GUI. Skill/Plugin surfaces
  cover Codex and Claude Code; Grok discovers skills via `.agents/skills`.
  CLI stage runtime remains Codex-backed in 0.2.
- The scout is a general read/search Codex stage, not a dedicated crawler,
  browser automation system, or site-specific extraction engine.
- Deterministic Reader-10 checks structure, length, terminology, links, and
  accessibility signals. It does not semantically understand the report.
- Live Reader-10 uses ten model invocations per round. Model names do not imply
  independent errors, and live readers check clarity rather than truth.
- There is no resume/checkpoint engine, `/goal` DSL, long-running scheduler, or
  durable workflow database.
- The only evidence-time checkpoint is the architect decision after scout.
  There is no mid-maker pause/resume advisor loop or automatic escalation after
  a failed stage.
- Runtime model routing uses catalog descriptions, priority, supported efforts,
  overrides, and the scout's open-question count; it does not query live prices
  or benchmark model quality.
- Verification commands are explicit opt-in configuration. No project command
  is inferred or run by default.
- Saved artifacts support inspection and model-free report regeneration, but
  they are not a complete frozen ledger of the machine, tools, or model service.

## Design and research

- [Architecture](https://github.com/minwoo19930301/rein/blob/main/docs/architecture.md)
- [Harness trade-offs, selected patterns, provider and app portability](https://github.com/minwoo19930301/rein/blob/main/docs/lineage-and-portability.md)
- [Korean harness landscape](https://github.com/minwoo19930301/rein/blob/main/docs/korea-landscape.md)
- [Global harness landscape](https://github.com/minwoo19930301/rein/blob/main/docs/global-landscape.md)
- [Top global repositories and distilled patterns](https://github.com/minwoo19930301/rein/blob/main/docs/global-top-repos.md)
- [Conditional advisor evidence and routing decision](https://github.com/minwoo19930301/rein/blob/main/docs/conditional-advisor-routing.md)
- [Clean-room prior art ledger](https://github.com/minwoo19930301/rein/blob/main/docs/prior-art.md)
- [30/60/90 development and promotion playbook](https://github.com/minwoo19930301/rein/blob/main/docs/growth-playbook.md)
- [Relay10 v0.1.1 historical launch report](https://github.com/minwoo19930301/rein/blob/main/docs/launch-report.html)

The latest research snapshot is dated 2026-07-14. Stars and project status change;
follow the linked primary sources before making adoption or licensing choices.

## Contributing and feedback

Use the repository issue forms for reproducible bugs, bounded use cases, and
Skill proposals. Each proposal asks for observable acceptance evidence and
clean-room provenance so the core does not grow from feature count alone. See
[CONTRIBUTING.md](https://github.com/minwoo19930301/rein/blob/main/CONTRIBUTING.md)
for the development and review gates.

## License

Rein (formerly Relay10) is MIT licensed and was implemented as a
clean-room wrapper with zero third-party npm runtime dependencies. No source
code from the compared harnesses is included.

The design selection is intentionally narrow. From the Korean projects it keeps
role-specific model tiers, plan/build/review separation, doctor and inspectable
evidence, an external wrapper boundary, and short onboarding. From global
projects it keeps on-demand skills, read-only plan roles, checkpoint and success
gates, architect/editor separation, stateless transcripts, provider/worker
ports, and independent review. It excludes swarms, nested completion loops,
always-on daemons, databases, vector memory, schedulers, native TUI/GUI stacks,
global injection, and telemetry from the core. Rein's
risk/verifiability/reversibility router and Effort Governor, separation of
correctness from clarity, hash-bound frozen replay, and Reader-10 gate are its
own additions.
