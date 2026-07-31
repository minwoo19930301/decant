# Prior art, provenance, and clean-room record

This file records what Decant's authors inspected, what abstract ideas were
retained, and what was not copied. It is an engineering provenance note, not a
legal opinion or a claim that the underlying workflow ideas are novel.

## Clean-room boundary

Decant is an independently implemented MIT-licensed wrapper. The repository
does **not** vendor source code, prompt text, skill instructions, scripts,
templates, assets, model weights, or datasets from the compared projects.
Public repository metadata, READMEs, documentation, and behavior descriptions
were used to identify patterns and trade-offs. Those patterns were rewritten
as Decant requirements and implemented against Decant's own architecture.

The boundary is especially strict for repositories or paths whose GitHub API
license is `NOASSERTION`, whose license is component-specific, or whose content
is source-available rather than open source. A repository being public—or
popular—does not grant permission to copy it.

## Research snapshots

| Date | Source set | What was recorded | Durable output |
|---|---|---|---|
| 2026-07-13 | OMO, OMP, OMC, OMX, GJC, LazyCodex and adjacent Korean discussions/projects | Product shape, role routing, workflow stages, diagnostics, wrapper boundaries, onboarding, and trade-offs. | [`korea-landscape.md`](./korea-landscape.md), [`lineage-and-portability.md`](./lineage-and-portability.md) |
| 2026-07-13 | Global wrappers, workflow packs, independent runtimes, and asynchronous agent platforms | Category boundaries, closest routing prior art, portability, activity status, and reusable overseas patterns. | [`global-landscape.md`](./global-landscape.md) |
| 2026-07-14 | 12 current core/harness references plus 12 skill/workflow repositories and adjacent historical cases | GitHub API stars, `pushed_at`, archive state, repository-level license signal, strengths, weaknesses, adopted patterns, and exclusions. | [`global-top-repos.md`](./global-top-repos.md) |
| 2026-07-14 | Anthropic advisor/orchestrator experiments, OpenAI BrowseComp and Parameter Golf, and Artificial Analysis Coding Agent Index v1.1 | Role correction, task-dependent coordination overhead, checkpoint timing, benchmark limits, and a measurable conditional-advisor policy. | [`conditional-advisor-routing.md`](./conditional-advisor-routing.md) |

The 2026-07-14 metadata came from GitHub REST repository responses and the
linked repositories' current READMEs. Counts are intentionally frozen in the
dated document. Stars were used to find visible projects, never as proof of
quality, users, safety, or production reliability.

## Primary repositories consulted on 2026-07-14

Core/runtime/spec references:

- [anomalyco/opencode](https://github.com/anomalyco/opencode)
- [anthropics/claude-code](https://github.com/anthropics/claude-code)
- [github/spec-kit](https://github.com/github/spec-kit)
- [google-gemini/gemini-cli](https://github.com/google-gemini/gemini-cli)
- [openai/codex](https://github.com/openai/codex)
- [OpenHands/OpenHands](https://github.com/OpenHands/OpenHands)
- [cline/cline](https://github.com/cline/cline)
- [ruvnet/ruflo](https://github.com/ruvnet/ruflo)
- [aaif-goose/goose](https://github.com/aaif-goose/goose)
- [Aider-AI/aider](https://github.com/Aider-AI/aider)
- [SWE-agent/mini-swe-agent](https://github.com/SWE-agent/mini-swe-agent)
- [AgentWrapper/agent-orchestrator](https://github.com/AgentWrapper/agent-orchestrator)

Skill/format/workflow references:

- [obra/superpowers](https://github.com/obra/superpowers)
- [mattpocock/skills](https://github.com/mattpocock/skills)
- [anthropics/skills](https://github.com/anthropics/skills)
- [garrytan/gstack](https://github.com/garrytan/gstack)
- [addyosmani/agent-skills](https://github.com/addyosmani/agent-skills)
- [github/awesome-copilot](https://github.com/github/awesome-copilot)
- [vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills)
- [OthmanAdi/planning-with-files](https://github.com/OthmanAdi/planning-with-files)
- [openai/skills](https://github.com/openai/skills), whose README marked it
  deprecated and redirected current examples to `openai/plugins`
- [agentskills/agentskills](https://github.com/agentskills/agentskills)
- [openai/plugins](https://github.com/openai/plugins)
- [microsoft/skills](https://github.com/microsoft/skills)

Adjacent comparisons included [SWE-agent](https://github.com/SWE-agent/SWE-agent),
[OpenSpec](https://github.com/Fission-AI/OpenSpec), [BMAD Method](https://github.com/bmad-code-org/BMAD-METHOD),
inactive/read-only [Continue](https://github.com/continuedev/continue), [Claude
Squad](https://github.com/smtg-ai/claude-squad), archived [Roo
Code](https://github.com/RooCodeInc/Roo-Code), and lower-currentness
[Plandex](https://github.com/plandex-ai/plandex). They informed category or
status notes but were not copied.

## Pattern-to-implementation ledger

The entries below identify conceptual lineage. “Retained” means the project
implemented its own narrow version; it does not mean the upstream project was
the first or only source of the idea.

| Abstract pattern observed in the ecosystem | Decant's independent expression | Excluded upstream shape |
|---|---|---|
| Use different roles or models for planning and editing. | `scout`, `architect`, `maker`, `reviewer`, and `explainer` have explicit roles; model labels are mapped from local Codex catalog metadata with user overrides. | Provider/runtime internals, universal quality rankings, and claims that a label is objectively cheapest or smartest. |
| Separate planning from consequential execution. | Read-only planning stages and a workspace-write maker; skill instructions preserve diagnosis/plan-only boundaries. | Full plan-mode runtimes, hidden permission escalation, or automatic publication. |
| Specifications should preserve intent through implementation. | `decant-spec` records outcome, non-goals, constraints, acceptance checks, risk, and rollback without requiring a large artifact hierarchy. | Mandatory constitutions, PRDs, stories, or personas for every task. |
| Small slices and tests reduce implementation risk. | `decant-build` favors bounded vertical slices and appropriate tests; verification commands are explicit literal argv entries. | Universal TDD mandates, inferred shell commands, automatic commits, and autonomous retry loops. |
| Debugging should reproduce and localize before changing code. | `decant-debug` separates diagnosis from fix authority and requires reassessment after repeated failed attempts. | Repeated speculative edits and endless self-healing loops. |
| Spec compliance and code quality are different review questions. | `decant-review` uses a fixed baseline, evidence, severity, and distinct correctness/risk/test concerns; the runtime reviewer remains separate from command results. | Reviewer councils, fabricated consensus, and model judgment presented as proof. |
| Completion requires observable evidence. | Explicit verification results, artifact hashes, frozen replay checks, release proof, and Reader-10 presentation results are recorded separately. | Benchmark inheritance, hidden CI claims, and clarity scores presented as factual correctness. |
| Skill systems benefit from focused triggers and progressive disclosure. | Eight one-job `decant-*` skill folders plus a current Codex plugin manifest; only relevant instructions should load. | Hundreds of default skills, copied vendor rules, unknown hooks, telemetry, and context-heavy global injection. |
| Portability needs an adapter contract rather than an endpoint claim. | The documented target separates workflow, catalog/provider, workspace executor, result/artifact, and UI surfaces. | Claiming Grok, Claude, Gemini, or app-native support before end-to-end tool and schema tests. |
| Durable handoffs help inspection and replay. | Per-run files, events, hashes, model-free report regeneration, and a hash-checked frozen report copy. | A hidden memory database, full machine snapshot claims, or an unimplemented resume scheduler. |
| Premium judgment can be wasteful before simple work and useful after evidence exposes a direction choice. | The default architect is an evidence-gated advisor: economy/no-question runs record a skip, while non-economy or unresolved-question runs invoke it and record the budget. | Hard-coded provider pairings, universal percentage-savings claims, automatic fan-out, and an unimplemented mid-maker resume loop. |

## Locally authored implementation evidence

The following files are the primary Decant implementation surfaces and are
not derived copies of any compared repository:

- `src/router.mjs`: five-dimensional initial routing using complexity, risk,
  blast radius, verifiability, and reversibility;
- `src/catalog.mjs`: local Codex catalog discovery and candid capability labels;
- `src/executor.mjs` and `src/pipeline.mjs`: subprocess and stage contracts;
- `src/reader10.mjs` and `src/report.mjs`: clarity checks and standalone report;
- `test/*.test.mjs`: behavior and regression tests written for Decant;
- `plugins/decant/skills/decant-*/SKILL.md`: locally written, focused skill
  procedures;
- `plugins/decant/.codex-plugin/plugin.json`: Decant's own plugin metadata;
- `plugins/decant/.claude-plugin/plugin.json` and `.claude-plugin/marketplace.json`:
  Decant's own Claude Code plugin and marketplace metadata.
- `docs/host-surface-verification.md`: dated evidence for Claude Code and Grok
  Build skill-host loading; not stage-executor proof.

Decant-specific combinations include the risk/verifiability/reversibility
router, correctness-versus-clarity separation, literal-argv verification,
hash-bound frozen replay, and the bounded Reader-10 report gate. Similar
individual ideas may exist elsewhere; the claim is independent implementation,
not invention of every component concept.

## License handling decisions

- No third-party repository license is used as a dependency of Decant's
  implementation because no third-party code or skill content is vendored.
- GitHub API `NOASSERTION` is treated as unresolved, not permissive.
- The Anthropic `docx`, `pdf`, `pptx`, and `xlsx` skill directories are treated
  as source-available reference material and were not copied.
- Vercel and OpenAI skill/plugin content is treated as component-licensed; no
  file is reused without a future path-level review.
- `openai/skills` is retained only as a historical research source; new Codex
  packaging follows the current plugin structure described by
  [openai/plugins](https://github.com/openai/plugins).
- Claude Code packaging follows the plugin and marketplace structure described
  in Anthropic's official Claude Code documentation; no Anthropic-owned skill
  or plugin text is copied.
- MIT and Apache-2.0 projects are still credited as conceptual prior art here.
  Their license status is not used to justify copying.

## Reproduction and update rule

To refresh this record, query each linked repository again, preserve the new
date, re-check `archived`, `pushed_at`, the exact license files, README status,
and releases, then document any changed decision. Do not silently overwrite a
dated star count or turn a popularity change into a quality conclusion.

## Sibling projects by the same author

These were written alongside this one in July 2026 and were not consulted until
2026-07-31. Recording them here because "independent implementation" is a weaker
claim when the source is your own earlier work.

| Project | What it does | What Decant took |
|---|---|---|
| [proofline](https://github.com/minwoo19930301/proofline) | Browser-only review workspace: declare approval conditions, attach evidence per condition, record explicit reviewer decisions, export a review pack | The **declared approval contract**. Its three-step workflow — define the contract, record supplied evidence, decide per check — is the direct source of `decant review --contract`, and its gate policy (a rejected high/critical check blocks; a critical check with no decision or evidence blocks; other omissions stay visible gaps) is reproduced in `src/contract.mjs`. |
| [swarmscope](https://github.com/minwoo19930301/swarmscope) | Deterministic multi-agent orchestration simulator: decide how many agents a job needs *before* the real run spends tokens | Nothing yet. Its premise is directly relevant — Decant's `route` previews stages but estimates no time or tokens, and the benchmarks show a 5.4× token gap that a preview could have surfaced. |
| [context-forge](https://github.com/minwoo19930301/context-forge) | Browser-local dependency-aware context packer: select source under a token budget with the file choices visible and editable | Nothing yet. Decant's scout is a model call that reads the repository; deterministic dependency-aware selection would be cheaper and is the obvious replacement, especially in the fast lane where the scout is skipped entirely. |
| [grok-build](https://github.com/minwoo19930301/grok-build) | Fork of a coding-agent harness with a TUI | Already distilled — see [grokbuild-distillation.md](grokbuild-distillation.md). |
| [diffsentinel-*](https://github.com/minwoo19930301/diffsentinel-disciplinedrun), [forgesignal-*](https://github.com/minwoo19930301/forgesignal-disciplinedrun) | Controlled harness-versus-vanilla benchmarks | The results and the methodology — see [benchmarks.md](benchmarks.md). The vertical-slice gate in the fast lane exists because DiffSentinel's result document prescribed it. |

Checked and **not** adopted: Proofline's own deterministic gate rules were already
matched by `assessReviewer`. Six boundary cases were run against it — a `pass`
verdict beside a critical finding, a failed acceptance check, an accepted check
with no evidence, and so on — and all six were already blocked. That comparison
is the reason no gate logic was rewritten.
