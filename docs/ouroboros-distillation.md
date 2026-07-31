# Ouroboros pattern distillation

Evidence snapshot: **2026-07-15T14:06:19+09:00**

## Decision

Rein adopts one narrow behavior pattern from
[Q00/ouroboros](https://github.com/Q00/ouroboros): inspect repository facts
first, ask only the human decisions that can change the result, and crystallize
the answer into a confirmed task contract before implementation.

This change extends the existing `rein-spec` Skill. It does not add another
Skill, CLI runtime, model call, database, daemon, or provider adapter.

## Current primary evidence

| Claim | Primary source | Observed value | Confidence |
|---|---|---|---|
| Repository snapshot | [commit `456a1347195038ad0eea2bcfee21efee495d6cb9`](https://github.com/Q00/ouroboros/commit/456a1347195038ad0eea2bcfee21efee495d6cb9) | `main` at 2026-07-14T12:05:57Z | High; exact commit is pinned. |
| License | [LICENSE](https://github.com/Q00/ouroboros/blob/456a1347195038ad0eea2bcfee21efee495d6cb9/LICENSE) | MIT, Copyright 2025 Q00 | High for the repository-level file; dependencies and external services remain separate. |
| Product shape | [README](https://github.com/Q00/ouroboros/blob/456a1347195038ad0eea2bcfee21efee495d6cb9/README.md) | Interview, Seed, execution, evaluation, evolution, runtime adapters, MCP, persistence, and TUI surfaces | High as a first-party description; no independent performance validation was performed. |
| Interview behavior | [interview Skill](https://github.com/Q00/ouroboros/blob/456a1347195038ad0eea2bcfee21efee495d6cb9/skills/interview/SKILL.md) | Questions expose assumptions before a Seed is created | High for documented behavior; no wording was copied. |
| Runtime capability declaration | [adapter contract](https://github.com/Q00/ouroboros/blob/456a1347195038ad0eea2bcfee21efee495d6cb9/src/ouroboros/orchestrator/adapter.py) | Backends declare supported behavior instead of assuming parity | High for the inspected source; Rein does not implement this adapter in this change. |

## What Rein adopts now

The existing `rein-spec` workflow now:

1. reads the repository before asking factual questions;
2. asks one decision-changing question at a time, with a default cap of three;
3. records premises as `user_decision`, `repo_fact`, `safe_assumption`, or
   `blocker`;
4. prevents a build handoff while a material blocker remains;
5. restates goal, non-goals, constraints, allowed mutations, acceptance,
   verification, and rollback as a Confirmed Task Contract;
6. creates a new revision when confirmed intent materially changes instead of
   silently rewriting the earlier contract.

The contract is a Skill-level handoff discipline. It is not cryptographically
immutable and the Rein runtime does not yet enforce it.

## What stays out

- numeric ambiguity scores treated as objective truth;
- an Ouroboros Seed YAML or Python model copied into Rein;
- ontology generation or convergence;
- Ralph or any unbounded evolution loop;
- EventStore, SQLite, checkpoints, or session resume;
- MCP server, TUI, dashboard, plugin OS, or lateral-agent fan-out;
- provider or runtime support inferred from Ouroboros support;
- automatic publication or destructive authority.

These exclusions preserve Rein's current one-CLI, zero-runtime-dependency
core and avoid a second state owner.

## Interaction with the merged advisor and host changes

- The conditional-advisor change operates after evidence collection and decides
  whether technical frontier advice is worth a call. The confirmed contract
  operates earlier and resolves human intent. The two gates are complementary.
- [PR #2](https://github.com/minwoo19930301/rein/pull/2) now exposes the same
  canonical `plugins/rein/skills` directory to Claude Code.
- [PR #3](https://github.com/minwoo19930301/rein/pull/3) was merged through
  PR #2 and records a live Claude plugin check and a Grok Build session that discovered
  all eight Skills through `.agents/skills`. That is Skill-host evidence, not
  an xAI/Grok stage executor. It also does not yet exercise this new confirmed
  contract behavior.
- Repeat the outcome fixtures against the updated canonical Skill in both hosts
  before claiming equivalent behavior.
- Any future xAI/Grok stage executor must declare structured output, tools,
  permission mode, reasoning effort, and session resume as supported,
  translated, ignored, or unavailable, then pass an end-to-end workspace test
  before being advertised as supported.

## Facts, inference, and proposal

- **Fact:** Ouroboros documents a Socratic interview, Seed workflow, evaluation
  loop, persistent runtime, and multi-runtime adapters at the pinned commit.
- **Fact:** this Rein change contains only independently written Skill text,
  a contract reference, provenance, tests, and documentation.
- **Inference:** resolving repository facts before user questions should reduce
  unnecessary interview turns, but Rein has not measured that reduction.
- **Proposal:** capability declarations are a useful acceptance gate for the
  separate Claude and Grok runtime work; they are not implemented here.

## Decision table

| Candidate | Evidence | Adopt | Exclude | Reason | Verification still needed |
|---|---|---:|---|---|---|
| Bounded Socratic clarification | Interview Skill and Seed workflow | Yes | Mandatory long interview | Clarifies human decisions without adding runtime state | Instrumented App·CLI trigger and outcome evaluation; current check is qualitative warning only |
| Confirmed Task Contract | Seed preserves intent through evaluation | Yes, at Skill level | Claim of runtime immutability | Gives build and review one explicit handoff | Real task studies and later hash binding if justified |
| Evaluation-to-evolution loop | Evaluate and evolve workflow | No | Ralph and long autonomous loops | Conflicts with the lightweight and bounded core | None for this change |
| Runtime capability declaration | Adapter source | Proposal | Silent capability degradation | Relevant to future Claude and Grok work | Provider-specific end-to-end tests |
| Ouroboros Agent OS | README and repository tree | No | DB, MCP, TUI, persistence, multi-runtime core | Would replace rather than lighten Rein | None |
