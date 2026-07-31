# Decant

> Pour off what coding-agent harnesses do well. Leave the sediment.

`0.2.0` preview · MIT · Node 20+ · no third-party runtime dependencies · last
tagged release `v0.1.1` (under the project's original name, Relay10) · not on npm

## Five words you will meet below

| Term | What it means here |
|---|---|
| **stage** | one launch of the agent with a fixed job: `scout`, `architect`, `maker`, `reviewer`, `explainer` |
| **scout** | the cheap read-only stage that looks before anything is built |
| **maker** | the only stage allowed to change your files |
| **frontier / balanced / economy** | labels for which of your models a stage should use. They come from provider metadata, your overrides, or a guess from the model's family name — **not** from prices or benchmarks |
| **Reader-10** | a check on whether the *run report* is readable. Ten named personas share one rule engine. It says nothing about whether the code is correct |

## What this is, in plain terms

When you hand a real task to a coding agent, you usually get one long answer and
no way to check how it got there. There are plenty of harnesses that try to fix
that, and most of them are big: their own runtime, their own agent teams, their
own UI.

**Decant is the small version.** It keeps four habits that earn their weight and
throws the rest away:

1. **Look before you build.** A cheap read-only pass inspects the repository
   first. What it finds decides whether the expensive model is worth calling at
   all.
2. **Write every step to a file.** Each stage's output lands in
   `.decant/runs/<id>/` as an ordinary file you can open, diff, and keep. No
   hidden state.
3. **Don't blend the signals.** Your test commands, the reviewer model's
   opinion, and the readability check are reported *separately*. One of them
   passing is not the others passing.
4. **Put a ceiling on it.** `--budget-calls` is a hard cap on how many times the
   agent gets launched, so a run cannot quietly turn into thirty.

And it does that **on top of the agent you already use** — it is not another
model. Today it drives the Codex CLI or the Kiro CLI; adding another is one
adapter file, not a rewrite.

## Why the name

To decant is to pour a liquid carefully into another vessel so the clear part
comes over and the sediment stays behind. That is both halves of the idea: keep
the few practices worth keeping from the harnesses that already exist, and carry
them into whatever model you happen to run underneath.

It promises subtraction and transfer. It does not promise proof — see the limits
below.

## 한국어 요약

여러 코딩 에이전트 하네스에서 **값어치 하는 습관만 따라내고 나머지는 버린** 얇은
도구입니다. 새 모델이 아니라, 지금 쓰는 에이전트 위에 얹는 층입니다.

- **먼저 보고 나서 만든다** — 값싼 읽기 전용 정찰이 저장소를 먼저 훑고, 그 결과로
  비싼 모델을 부를 가치가 있는지 판단합니다.
- **모든 단계를 파일로 남긴다** — `.decant/runs/<id>/`에 평범한 파일로 쌓입니다.
  숨은 상태가 없어서 열어보고 비교하고 보관할 수 있습니다.
- **신호를 섞지 않는다** — 내가 지정한 테스트 명령, 리뷰어 모델의 의견, 가독성
  검사를 **따로** 보고합니다. 하나가 통과한 것은 나머지가 통과한 것이 아닙니다.
- **호출 상한을 둔다** — `--budget-calls`로 에이전트 실행 횟수를 하드 캡합니다.

이름은 "디캔트"입니다. 침전물은 남기고 맑은 부분만 다른 그릇에 따라 옮기는 일.
기존 하네스에서 쓸 만한 것만 골라내고(뺄셈), 그걸 어떤 모델 위로든 옮긴다(이동)는
뜻입니다. 증명을 약속하는 이름이 아닙니다.

**보고서와 가독성 검사는 현재 한국어 전용입니다.** 영어로만 쓴 보고서는 자기
품질 게이트를 통과하지 못합니다.

## Try it in 30 seconds

Node 20+ and one agent CLI on your `PATH` (`codex` or `kiro-cli`).

```bash
git clone https://github.com/minwoo19930301/decant.git
cd decant && npm link

decant doctor                      # is the backend reachable? which models?
decant route "add pagination to the users endpoint"   # what would it do, and why
decant run "add pagination to the users endpoint" --dry-run   # plan only, nothing runs
```

`doctor` tells you which provider is selected and, importantly, what that
provider can and cannot enforce. Real output from a machine running Node 26
(anything from 20 up is fine):

```text
PASS Node v26.5.0
INFO provider kiro (Kiro CLI); available: codex, kiro
INFO sandbox=tool-allowlist outputSchema=prompted
PASS kiro-cli kiro-cli 2.15.1
PASS frontier: claude-opus-5/max
PASS balanced: claude-sonnet-5/medium
PASS economy: claude-haiku-4.5/low
```

To switch backends, put this in `decant.config.json`:

```json
{ "version": 1, "provider": "kiro" }
```

## What it will not do — read this before installing

Being honest about this is the point of the tool, so it belongs above the
feature list, not in a footnote.

- **Routing is a keyword score, not a measured policy.** Five task dimensions
  are scored with hand-picked regexes, weights, and two thresholds. Nothing in
  this repository calibrates those numbers, and there is no published comparison
  against just prompting the model directly.
- **Reports are Korean.** `report.html` is emitted with `lang="ko"`, Korean
  labels, and clarity heuristics that match Korean tokens.
- **Reader-10 is a linter, not a jury.** The default mode is ten *named
  personas sharing one rule engine* — a structural and accessibility check over
  the report. Live mode makes ten model calls that may all be the same model.
  Neither establishes that the code is correct.
- **Hash-frozen replay detects drift, it does not notarise.** Artifacts are
  hashed into the run manifest and `report` never overwrites `report.html`, so
  you can tell if local files changed. That is not an external notary or a
  tamper-proof ledger.
- **Model role labels are labels.** `frontier` / `balanced` / `economy` come
  from provider metadata, your overrides, or — for a provider that exposes no
  metadata — a guess based on the model's family name. They are not price
  measurements or benchmark results.
- **A failed stage stops the run.** There is no retry, no resume, and no
  rollback. If the budget runs out mid-run you are left with a partial change.
- **Providers are not interchangeable.** Codex enforces a JSON schema and a
  kernel sandbox. The Kiro adapter asks for the schema in the prompt and grants
  a tool allowlist, which is weaker. `doctor` and the run manifest both say
  which one you got.

`--budget-calls` caps **agent launches**, not tokens, provider-internal turns,
or money.

The last tagged release is `v0.1.1`, made under the project's original name
**Relay10**. The `v0.1.1` evidence under `docs/launch-*` deliberately keeps the
old names so its recorded hashes still verify; `verify:launch`, `report:launch`,
and `audit:launch` write to `outputs/` rather than overwriting it. Nothing has
been published to npm under any name yet.

## What a run leaves behind

This is the part that matters, so here is the shape of it. A completed run is a
directory of plain files — no database, no daemon, nothing to query:

```text
.decant/runs/20260731T044012123Z-8f3a91c2/
├── run.json          # manifest: task, assessment, routing, which provider ran,
│                     #   invocations used vs budget, sha256 of every file below
├── events.jsonl      # one line per stage.started / stage.completed / decision
├── scout.json        # cheap read-only pass: what it found, open questions
├── architect.md      # the plan — only present if scout evidence justified it
├── maker.md          # what the implementing stage says it changed
├── verification.json # exit code and output of YOUR commands, run verbatim
├── reviewer.json     # the reviewer model's verdict and cited evidence
├── summary.md        # the explainer stage: a newcomer-facing summary of the run
└── report.html       # all of the above rendered as one standalone page (Korean)
```

Three things to notice:

- `verification.json`, `reviewer.json`, and the Reader-10 result in `run.json`
  are **three separate records**. The report shows them side by side and never
  collapses them into one pass/fail.
- `run.json` stores a sha256 for each artifact. `decant replay <id> --frozen`
  re-checks them, so you can tell whether anything changed since the run.
- `decant report` re-renders the page from these files with **no model calls**,
  and writes `report.regenerated.html` rather than touching `report.html`.

If a stage fails, the run stops and the manifest records the failure. You get
the files produced up to that point and nothing is rolled back.

## What it does

- **Risk-aware routing:** five keyword-scored task dimensions select stage
  profiles, then scout evidence decides whether an economy task needs the
  frontier architect.
- **Pluggable backend:** one provider contract covers model discovery and stage
  execution. `codex` and `kiro` ship today; each declares its own capabilities
  rather than pretending to be equivalent.
- **Host-first skills:** eight repo skills for Codex, Claude Code, and Grok
  Build, plus one Node CLI that uses only Node builtins — no third-party runtime
  dependencies.
- **Inspectable handoffs:** every completed stage records a role, effort,
  sandbox, output path, and event.
- **Separate signals:** configured commands, the model reviewer, and Reader-10
  are presented as three different things.
- **Hash-frozen replay:** `replay --frozen` re-verifies the stored hashes and
  never mutates the frozen run.

## Why this instead of a batteries-included harness

Choose Decant when you want controlled, inspectable work:

- **Explicit scope first.** The optional `decant-spec` Skill records outcome,
  non-goals, acceptance evidence, and a rollback plan. That is guidance for the
  host agent; `decant run` does not ingest or enforce it.
- **Risk-aware effort.** Under the default conditional policy the task score
  tunes maker and reviewer effort, and after the scout an evidence checkpoint
  decides whether economy work needs frontier advice. A hand-tuned heuristic,
  not calibrated routing.
- **A hard ceiling on launches.** `--budget-calls` bounds stage launches.
- **Ordinary files.** Handoffs and events stay readable under
  `.decant/runs/<id>/`.

Choose a bigger harness instead when you need agent teams or swarms, background
agents, retry-until-done loops, durable checkpoint and resume, or a built-in UI.
Decant deliberately leaves those out.

## Current provider and app support

The Decant 0.2.0 preview is **host-first**. The skill pack runs on the
coding agent you already use. The optional CLI pipeline is a separate
controlled-run surface.

| Target | Current status | What that means |
|---|---|---|
| Claude Code as a Skill and Plugin host | Preview; host path verified 2026-07-15, renamed manifests statically validated 2026-07-17 | Marketplace / `.claude/skills` load all eight skills. This is Skill-host guidance, not native stage execution. |
| Grok Build / Grok CLI as a Skill host | Preview, verified 2026-07-15 | `.agents/skills` loads the same pack. This is Skill-host guidance, not xAI stage execution. Note: the pinned Grok Build client source contains an `opt-in` fallback for "Coding data sharing," but effective account or server policy can override it. Decant never launches Grok or sees that setting—confirm the current policy in your own session; see the [pinned evidence note](docs/grokbuild-distillation.md). |
| Codex as a Skill host | Repository surface, statically validated | Same pack via `.agents/skills` / plugin layout. |
| Codex CLI as a `decant run` stage backend | Supported | `provider: "codex"` (the default). Native `--output-schema` and a kernel sandbox. Discovers models via `codex debug models`. |
| Kiro CLI as a `decant run` stage backend | Supported; `doctor` verified 2026-07-31 | `provider: "kiro"`. No native final-message or schema channel, so the adapter fences the answer with sentinels and carries the schema in the prompt; isolation is a tool allowlist, not a sandbox. |
| Any other CLI as a stage backend | Not included, but no longer a rewrite | Implement the `runStage` + `discoverCatalog` contract in `src/providers/`. The provider set is closed in code on purpose, so a checked-in config cannot choose which binary runs. |
| Direct Anthropic / OpenAI / Gemini HTTP APIs | Unsupported | The contract assumes a CLI subprocess that writes a final answer. An HTTP provider would need its own adapter. |
| Mixed providers in one run | Unsupported | Stage config holds a model; the provider is chosen per run. |
| Codex desktop app or IDE | Indirect shell use only | Can invoke `decant`; no native progress UI. |
| ChatGPT app/web or a standalone GUI | Not implemented | Needs MCP/Apps SDK or a local sidecar. |

Skills guide the host agent; they do not silently replace that host’s model for
every tool call. Evidence for host checks lives in
[host-surface-verification.md](https://github.com/minwoo19930301/decant/blob/main/docs/host-surface-verification.md).
See also the full
[lineage and portability decision](https://github.com/minwoo19930301/decant/blob/main/docs/lineage-and-portability.md).

<a id="decant-skill-pack"></a>

## Skill pack

Decant distills recurring patterns from current global coding agents and
Agent Skill collections into eight on-demand skills instead of installing a
large catalog. Skill ids were renamed from `relay10-*` to **`decant-*`** in
`0.2.0`; a host that installed the `v0.1.1` pack must reinstall it:

| Skill | Job | Important boundary |
|---|---|---|
| `decant-orchestrate` | choose the smallest useful workflow | does not switch the host agent's current task model |
| `decant-research` | collect current read-only evidence | does not mutate a repository |
| `decant-spec` | define outcome, non-goals, acceptance, and rollback | does not implement plan-only requests |
| `decant-build` | implement an authorized change in small slices | does not publish |
| `decant-debug` | reproduce and isolate root cause | diagnosis alone does not authorize repair |
| `decant-review` | review a fixed baseline and report findings | remains read-only |
| `decant-release` | prove package, artifact, hash, and support claims | requires explicit publication authority |
| `decant-skill-lab` | tune triggers and compare against no-skill baseline | rejects skills without measured benefit |

A **Confirmed Task Contract** is the optional written output of the
`decant-spec` Skill: the outcome, the non-goals, what evidence counts as
acceptance, and how to roll back. `decant run` does not read, cryptographically
bind, or enforce it. The same boundary applies to all Skill guidance: a host
agent follows it; the CLI does not turn instructions into runtime invariants.

The canonical pack lives under `plugins/decant/skills`. `.agents/skills` and
`.claude/skills` are relative symlinks to that directory so a cloned repository
exposes the same skills to Codex, Claude Code, and Grok Build surfaces that
scan those roots. The plugin manifests are at
`plugins/decant/.codex-plugin/plugin.json` and
`plugins/decant/.claude-plugin/plugin.json`, and the repository root
`.claude-plugin/marketplace.json` makes this repository installable as a Claude
Code marketplace; all three pass their local validators but have not been
published to a curated marketplace. To install the pack in Claude Code:

```text
/plugin marketplace add minwoo19930301/decant
/plugin install decant@decant
```

Installed Claude Code plugin skills appear namespaced as `decant:<skill-name>`;
a session opened inside a clone of this repository loads the same skills through
`.claude/skills` or `.agents/skills` without installing anything. Grok Build
discovers the pack via `.agents/skills` (and optional Claude-compat skill
paths). Skills guide the host agent on Claude Code, Grok Build, or Codex. The
`decant run` pipeline is a separate surface and uses whichever provider your
config selects.
The pack follows progressive disclosure and contains original clean-room text.
The Skill-ecosystem
source subset and license cautions are recorded in
`plugins/decant/provenance/sources.json`; the complete agent, harness,
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

The default `conditional` policy calls the expensive architect stage only when
it looks necessary. It is skipped when both are true: the task scored as
`economy`, and the scout came back with no open questions. Even when skipped,
`architect.md` is still written — recording *that it was skipped and why* — so
every run has the same six files whether or not the architect ran.

For `balanced` or `frontier` work the architect always runs. An `economy` run
whose scout did raise questions will call the architect, and if there is no
invocation budget left for that call the run stops **before** anything is
modified rather than proceeding without a plan.

## Commands

```text
decant init [--force]
decant doctor
decant route <task> [--json]
decant run <task> [--dry-run] [--live-readers] [--budget-calls N] [--allow-verification-commands]
decant inspect [run-id] [--json]
decant report [run-id] [--output file]
decant replay [run-id] --frozen [--output file]
```

Single binary: `decant`. There are no aliases.

Configured verification commands are **skipped unless you pass
`--allow-verification-commands`**. Without it a run that has commands configured
stops and tells you to rerun with the flag, so verification is never executed by
surprise — but it also means a run can finish `warn` with nothing verified.

The inherited v0.1 `replay --frozen` contract verifies the recorded hashes and
either reports the saved `report.html` path or copies that exact file outside
the run directory. `report` is the separate model-free re-render command and
writes a new file. A frozen replay is not a full environment snapshot, resume
facility, or proof that remote model behavior can be reproduced.

## Configuration

`decant init` writes `decant.config.json`, which is the only name the CLI reads.
Model roles are derived from
`codex debug models`; explicit model overrides take precedence. See the
[example configuration](https://github.com/minwoo19930301/decant/blob/main/examples/decant.config.json)
and [configuration schema](https://github.com/minwoo19930301/decant/blob/main/schema/config.schema.json).

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
and `never` disables the architect checkpoint. Decant
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

## Detailed scope boundaries

The short list of deal-breakers is [above](#what-it-will-not-do--read-this-before-installing).
This is the long-form version: the specific things people ask for that `0.2`
does not do.

- Two stage backends ship: `codex` and `kiro`. They are not equivalent — see the
  capability row in `doctor` and the `provider` block in the run manifest. Direct
  Anthropic, OpenAI, xAI, and Gemini HTTP adapters are not included, and
  providers cannot be mixed within one run.
- There is no MCP server, Apps SDK UI, or standalone GUI. Skill/Plugin surfaces
  cover Codex and Claude Code; Grok discovers skills via `.agents/skills`.
- The scout is a general read/search agent stage, not a dedicated crawler,
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

- [Architecture](https://github.com/minwoo19930301/decant/blob/main/docs/architecture.md)
- [Harness trade-offs, selected patterns, provider and app portability](https://github.com/minwoo19930301/decant/blob/main/docs/lineage-and-portability.md)
- [Korean harness landscape](https://github.com/minwoo19930301/decant/blob/main/docs/korea-landscape.md)
- [Global harness landscape](https://github.com/minwoo19930301/decant/blob/main/docs/global-landscape.md)
- [Top global repositories and distilled patterns](https://github.com/minwoo19930301/decant/blob/main/docs/global-top-repos.md)
- [Conditional advisor evidence and routing decision](https://github.com/minwoo19930301/decant/blob/main/docs/conditional-advisor-routing.md)
- [Clean-room prior art ledger](https://github.com/minwoo19930301/decant/blob/main/docs/prior-art.md)
- [30/60/90 development and promotion playbook](https://github.com/minwoo19930301/decant/blob/main/docs/growth-playbook.md)
- [Relay10 v0.1.1 historical launch report](https://github.com/minwoo19930301/decant/blob/main/docs/launch-report.html)

The latest research snapshot is dated 2026-07-14. Stars and project status change;
follow the linked primary sources before making adoption or licensing choices.

## Contributing and feedback

Use the repository issue forms for reproducible bugs, bounded use cases, and
Skill proposals. Each proposal asks for observable acceptance evidence and
clean-room provenance so the core does not grow from feature count alone. See
[CONTRIBUTING.md](https://github.com/minwoo19930301/decant/blob/main/CONTRIBUTING.md)
for the development and review gates.

## License

Decant (formerly Relay10) is MIT licensed and was implemented as a
clean-room wrapper with zero third-party npm runtime dependencies. No source
code from the compared harnesses is included.

The design selection is intentionally narrow. From the Korean projects it keeps
role-specific model tiers, plan/build/review separation, doctor and inspectable
evidence, an external wrapper boundary, and short onboarding. From global
projects it keeps on-demand skills, read-only plan roles, checkpoint and success
gates, architect/editor separation, stateless transcripts, provider/worker
ports, and independent review. It excludes swarms, nested completion loops,
always-on daemons, databases, vector memory, schedulers, native TUI/GUI stacks,
global injection, and telemetry from the core. Decant's
risk/verifiability/reversibility router, separation of
correctness from clarity, hash-bound frozen replay, and Reader-10 gate are its
own additions.
