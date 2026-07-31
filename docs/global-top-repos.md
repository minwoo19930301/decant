# Global top repositories: a Rein distillation

Snapshot: **2026-07-14 (Asia/Seoul)**. Repository metadata was read from the
GitHub REST API (`GET /repos/{owner}/{repo}`); workflow descriptions were
checked against each repository's README. Star counts are frozen below so the
analysis can be reproduced as a dated snapshot.

This is a relevance-weighted top-tier sample, not a universal league table.
The shortlist favors active repositories that expose a coding-agent runtime,
an engineering harness, a spec workflow, or a reusable skill system. GitHub
stars are a **discovery and popularity signal only**. They do not establish
active users, code quality, security, benchmark validity, production fitness,
or compatibility with Rein. A recent `pushed_at` timestamp is also only an
activity hint; it may be a documentation or automated commit.

## Core agents and harnesses: high-signal current references

The current references returned `archived: false` in the snapshot, but that
flag alone does not mean active maintenance: Continue's README now says the
repository is no longer actively maintained and is read-only. The license
column combines the repository's own license notice with GitHub's SPDX signal;
it is not a legal conclusion about every file, dependency, model, or service.

| Repository | Stars | Last push | Repository license / API signal | Strongest idea | Cost or limitation | Rein decision |
|---|---:|---|---|---|---|---|
| [OpenCode](https://github.com/anomalyco/opencode) | 185,367 | 2026-07-13 | MIT | Provider-aware terminal agent with a client/server shape and simple build-versus-plan role boundaries. | It is a full runtime, TUI, and desktop product; adopting it would replace rather than lighten the host. | **Take:** explicit read-only planning versus execution roles and a future adapter boundary. **Leave:** a second TUI, provider runtime, and app stack. |
| [Claude Code](https://github.com/anthropics/claude-code) | 137,686 | 2026-07-11 | Commercial Terms; all rights reserved (API: `NOASSERTION`) | A coherent terminal, IDE, GitHub, plugin, and skill experience around one agent runtime. | Host-specific behavior and non-open-source terms make internals unsuitable for clean-room reuse. | **Take:** skills as a discoverable workflow surface and consistent CLI/app vocabulary. **Leave:** host internals, prompt text, and Claude-only assumptions. |
| [Spec Kit](https://github.com/github/spec-kit) | 120,376 | 2026-07-13 | MIT | Turns principles, scenarios, specifications, plans, tasks, and implementation into explicit artifacts across many coding agents. | The complete ceremony is larger than a reversible bug fix or a small personal task needs. | **Take:** outcome, non-goal, acceptance-test, and implementation-boundary sections in `rein-spec`. **Leave:** mandatory constitutions and a full artifact tree for every run. |
| [Gemini CLI](https://github.com/google-gemini/gemini-cli) | 105,958 | 2026-07-13 | Apache-2.0 | Exposes CLI, MCP, structured output, GitHub automation, and checkpoint/restore before file-changing tool calls. | It remains a full Gemini-centered agent runtime with its own authentication, tools, and release channels. | **Take:** checkpoint-before-write and machine-readable event streams. **Leave:** a second CLI runtime, provider authentication stack, and Gemini-only assumptions. |
| [Codex](https://github.com/openai/codex) | 97,656 | 2026-07-13 | Apache-2.0 | Lightweight local coding agent with terminal, app, and IDE surfaces; it is the verified execution host Rein already uses. | It is the host runtime, not a provider-neutral workflow contract; local configuration can change tools and safety behavior. | **Take:** reuse the installed runtime and its model catalog instead of rebuilding an agent. **Leave:** forking Codex or depending on undocumented internals. |
| [OpenHands](https://github.com/OpenHands/OpenHands) | 80,656 | 2026-07-13 | Core MIT; `enterprise/` separate (API: `NOASSERTION`) | End-to-end platform with a web UI, SDK, sandboxing, integrations, and long-running development work. | Its Python/React/service/sandbox surface is far beyond a zero-runtime-dependency phase router. | **Take:** explicit sandbox and artifact contracts. **Leave:** hosted control plane, web platform, and durable orchestration service. |
| [Cline](https://github.com/cline/cline) | 64,613 | 2026-07-13 | Apache-2.0 | IDE, SDK, and CLI agent surfaces with visible tool use and user control over consequential actions. | An IDE-native runtime and extension ecosystem are much broader than Rein's subprocess wrapper. | **Take:** make permissions, commands, results, and failure states inspectable. **Leave:** building another editor extension or SDK runtime now. |
| [Ruflo](https://github.com/ruvnet/ruflo) | 64,278 | 2026-07-13 | MIT | Broad swarm orchestration: roles, topologies, hooks, MCP, memory, and long-lived coordination. | Large state and command surfaces raise setup, debugging, context, and trust costs. | **Take:** only the general lesson that roles need explicit contracts. **Leave:** swarms, topology DSLs, hidden memory, and unbounded completion loops. |
| [Goose](https://github.com/aaif-goose/goose) | 51,159 | 2026-07-13 | Apache-2.0 | Extensible agent runtime that can connect models and tools beyond code suggestion. | Provider breadth still requires capability and tool-loop validation; it is an independent runtime, not a thin router. | **Take:** future adapters must negotiate model, effort, schema, search, and workspace-tool capabilities. **Leave:** claiming multi-provider support from endpoint compatibility alone. |
| [Aider](https://github.com/Aider-AI/aider) | 47,341 | 2026-05-22 | Apache-2.0 | Git-native work with an architect/editor split, repository context, and deterministic lint/test feedback. | Its git and repository-map behavior is a product-level opinion, and the snapshot's last push is older than the other shortlisted projects. | **Take:** plan/build separation and tests as a signal distinct from model judgment. **Leave:** implicit git mutation and a second repository-context engine. |
| [Agent Orchestrator](https://github.com/AgentWrapper/agent-orchestrator) | 8,224 | 2026-07-13 | Apache-2.0 | Separates agent/worker, runtime, workspace, source-control adapters, and a distinct reviewer adapter. | Electron, a daemon, SQLite, change-data capture, pull-request watching, and telemetry create a large operating surface. | **Take:** a worker adapter boundary and independent reviewer. **Leave:** daemon, Electron, database, and continuous polling. |
| [mini-SWE-agent](https://github.com/SWE-agent/mini-swe-agent) | 5,757 | 2026-07-06 | MIT | Small core, stateless subprocesses, and a linear transcript make the execution path understandable. | A bash-centered action surface concentrates safety and prompt burden, and the product UX is intentionally limited. | **Take:** a small readable core and append-only evidence. **Leave:** a custom tool zoo and inherited benchmark claims. |

Important adjacent baselines did not displace the 12 above: [SWE-agent](https://github.com/SWE-agent/SWE-agent)
(19,792 stars, MIT) remains useful for issue-to-patch benchmark trajectories;
[OpenSpec](https://github.com/Fission-AI/OpenSpec) and [BMAD Method](https://github.com/bmad-code-org/BMAD-METHOD)
are rich workflow references but add more artifact or persona ceremony than the
default Rein path. [Continue](https://github.com/continuedev/continue)
(34,850 stars) is historical role-routing prior art because its README now says
the repository is no longer actively maintained and read-only. [Claude
Squad](https://github.com/smtg-ai/claude-squad) (8,107 stars, AGPL-3.0) remains
a useful worktree/session comparison. Rein does not inherit benchmark claims,
tmux, or AGPL implementation. [Roo Code](https://github.com/RooCodeInc/Roo-Code) was omitted
because GitHub returned `archived: true`; [Plandex](https://github.com/plandex-ai/plandex)
was not treated as a current top reference because its snapshot `pushed_at`
was 2025-10-03. Neither omission is a judgment on past usefulness.

## Skill and workflow repositories

Skills are the most portable part of the current ecosystem, but they are also
easy to over-install. The useful unit is a focused procedure with a precise
trigger, progressive disclosure, bounded authority, and an observable exit
condition—not a large pile of prompts loaded into every task.

| Repository | Stars | Last push | License | Strongest skill pattern | Cost or limitation | Rein decision |
|---|---:|---|---|---|---|---|
| [obra/superpowers](https://github.com/obra/superpowers) | 253,638 | 2026-07-10 | MIT | Composable skills connect design, planning, small tasks, red-green-refactor, two-stage review, and verification-before-completion. | The full method is intentionally strict, subagent-heavy, and includes optional telemetry; universal TDD is not appropriate for every artifact. | **Take:** spec-before-risky-build, small slices, separate spec/quality review, and proof before completion. **Leave:** forced TDD, fresh-agent churn, and telemetry. |
| [mattpocock/skills](https://github.com/mattpocock/skills) | 167,991 | 2026-07-13 | MIT | Clean distinction between user-invoked orchestrators and model-invoked disciplines, plus focused research, spec, TDD, debugging, and review skills. | A fast-moving personal workflow can encode tracker and tool assumptions that do not transfer to every repository. | **Take:** keep `rein-orchestrate` thin and let focused skills own reusable discipline. **Leave:** nested orchestrators and automatic issue-tracker publication. |
| [anthropics/skills](https://github.com/anthropics/skills) | 160,810 | 2026-07-01 | NOASSERTION / mixed | Self-contained `SKILL.md` examples spanning technical, creative, enterprise, and production document workflows. | Licensing is path-specific: many skills are Apache-2.0, while `docx`, `pdf`, `pptx`, and `xlsx` are source-available rather than open source. Behavior is Claude-oriented and must be tested per host. | **Take:** self-contained folders and progressive disclosure as a pattern. **Leave:** all wording, scripts, assets, and especially the restricted document-skill implementations. |
| [garrytan/gstack](https://github.com/garrytan/gstack) | 121,627 | 2026-07-10 | MIT | A legible Think → Plan → Build → Review → Test → Ship → Reflect lifecycle with specialist review, browser QA, release, and retrospective skills. | Twenty-three opinionated tools, Claude-specific setup, automatic shipping options, and self-reported productivity claims are too broad for a light harness. | **Take:** targeted QA/release checklists and lifecycle handoffs. **Leave:** persona sprawl, auto-deploy, growth claims, and an all-in-one team simulation. |
| [addyosmani/agent-skills](https://github.com/addyosmani/agent-skills) | 77,810 | 2026-07-12 | MIT | Lifecycle skills use vertical slices, test evidence, debugging gates, review, and progressive disclosure. | A 24-skill pack plus extensive rule tables can consume context and become a second process framework. | **Take:** evidence gates, safe slices, and stop/reassess behavior in build and debug skills. **Leave:** bulk loading and generic rules unrelated to Rein. |
| [github/awesome-copilot](https://github.com/github/awesome-copilot) | 36,519 | 2026-07-13 | MIT / contributed content | Broad community catalog of instructions, agents, skills, hooks, workflows, and plugins, including a machine-readable index. | Community breadth means uneven quality, provenance, permissions, and host specificity; repository license metadata does not remove the need to inspect each contribution. | **Take:** discoverability and catalog hygiene as reference ideas. **Leave:** vendoring community prompts or enabling unknown hooks/tools. |
| [vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills) | 29,014 | 2026-07-07 | NOASSERTION / per-skill | Narrow domain skills front-load when-to-use guidance and rank findings by impact or measured evidence. | The content is Vercel/web-domain specific and licenses are declared per skill rather than as one reusable repository grant. | **Take:** one job per skill, clear triggers, and evidence-first ranking. **Leave:** domain rules and text outside Rein's scope. |
| [planning-with-files](https://github.com/OthmanAdi/planning-with-files) | 25,269 | 2026-07-13 | MIT | Persistent file plans, completion gates, and shared state survive compaction and long-running multi-agent work. | Always-on plan files can clutter small tasks, and broad cross-agent compatibility is a project claim that still requires local validation. | **Take:** inspectable handoffs and explicit completion criteria. **Leave for later:** durable resume/shared-plan machinery until Rein has a tested checkpoint contract. |
| [openai/skills](https://github.com/openai/skills) | 23,630 | 2026-07-09 | NOASSERTION / per-skill | Historical Codex skill catalog with per-skill resources and licenses. | Its README now marks the repository **deprecated** and directs current work to `openai/plugins`; each skill has its own license. | **Do not target it as the current distribution path.** Keep only format lessons already confirmed by current documentation. |
| [agentskills/agentskills](https://github.com/agentskills/agentskills) | 22,984 | 2026-07-10 | Apache-2.0 | Defines the portable `SKILL.md` folder model and progressive disclosure from metadata to instructions to optional resources. | It is a format/specification, not evidence that a particular workflow is correct or that every agent implements it identically. | **Take:** minimal frontmatter, focused folders, optional scripts/references/assets, and host validation. **Leave:** assumptions of behavioral parity across hosts. |
| [openai/plugins](https://github.com/openai/plugins) | 4,537 | 2026-07-10 | NOASSERTION / component-specific | Current official Codex examples bundle a required `.codex-plugin/plugin.json` with optional skills, apps, MCP, agents, commands, hooks, and assets. | It is newer and smaller by stars; optional surfaces add authority and maintenance burden, and licensing must be checked per component. | **Take now:** a skill-only Rein plugin manifest and focused skills. **Leave until implemented and tested:** MCP, app UI, hooks, and remote services. |
| [microsoft/skills](https://github.com/microsoft/skills) | 2,738 | 2026-07-13 | MIT | Large SDK-grounding catalog explicitly warns that loading every skill causes context rot and recommends selective use. | Most content is Microsoft/Azure specific; a very large catalog can dilute routing and waste context. | **Take:** selective activation and a small default set. **Leave:** cloning a vendor catalog or loading all skills globally. |

## The distilled Rein skill pack

Rein therefore keeps eight clean-room skills, each with one primary job.
The names and instructions are local Rein work; the table records abstract
influences, not copied text or code.

| Rein skill | Job | Patterns retained | Deliberate boundary |
|---|---|---|---|
| `rein-orchestrate` | Choose the smallest appropriate workflow and CLI action. | Thin orchestrator; plan/build authority split; explicit preflight. | It does not become another autonomous swarm or silently run/publish work. |
| `rein-research` | Collect current, primary evidence and separate fact, inference, and proposal. | Evidence-first investigation and narrow source loading. | It does not turn simple repository reads into broad crawling. |
| `rein-spec` | State outcome, non-goals, constraints, acceptance tests, risks, and rollback. | Spec-driven intent-to-test traceability. | It skips heavyweight constitutions and asks only scope-blocking questions. |
| `rein-build` | Implement approved work in small, verifiable slices. | Vertical slices, tests when appropriate, bounded authority, visible evidence. | TDD is not forced onto prose/config-only work, and publication remains separate. |
| `rein-debug` | Reproduce, reduce, hypothesize, instrument, fix when authorized, and guard. | Systematic debugging plus a stop-and-reassess rule. | Diagnosis does not imply permission to edit, and repeated guesses are not a loop strategy. |
| `rein-review` | Review a fixed baseline for spec compliance, quality, risk, and test gaps. | Separate compliance and quality axes; severity plus evidence. | It remains read-only and does not manufacture issues to justify a review. |
| `rein-release` | Verify version, package, artifacts, documentation, hashes, and release notes. | Proof-before-completion and targeted release/reader QA. | It never tags, pushes, deploys, or publishes without authorization. |
| `rein-skill-lab` | Design, validate, and forward-test a focused skill or plugin change. | Progressive disclosure, precise triggers, selective loading, before/after evaluation. | It rejects unlicensed copying and “more skills is better” expansion. |

These skills improve how a Codex or Claude Code task finds and operates
Rein. They do not
change the runtime support matrix: the verified execution engine remains Codex
CLI, and a skill or manifest alone does not add Grok, Claude, Gemini, mixed
providers, native app progress, or in-task model switching.

## What was deliberately not cherry-picked

- a second coding-agent runtime, TUI, IDE extension, or hosted control plane;
- swarm topologies, nested completion loops, global memory, or agent councils;
- mandatory product constitutions and large artifact trees for every task;
- automatic issue creation, commits, pushes, releases, merges, or deployments;
- telemetry, remote assets, or unannounced hooks;
- benchmark, cost, intelligence, or productivity claims inferred from labels or stars;
- third-party prompt wording, source code, scripts, templates, or assets.

Rein's differentiator remains the combination already present in its own
architecture: five-dimensional deterministic initial routing, Codex catalog
labels with explicit caveats, inspectable stage artifacts, literal-argv
verification, model review separated from command evidence, hash-bound frozen
replay, and Reader-10 as a clarity gate rather than a truth claim.

## License and currentness rules for adopters

1. Treat `NOASSERTION` as “no single SPDX conclusion from this API response,”
   never as permission to copy.
2. Inspect the exact file or subdirectory license before reusing any material.
   Anthropic document skills, Vercel skills, OpenAI skills, and plugin
   components explicitly require path-level attention.
3. An MIT or Apache-2.0 repository still carries attribution and notice duties
   if code is copied. Rein avoids that branch of work by implementing only
   abstract ideas independently.
4. Re-check archive state, releases, security notices, and host documentation
   before adopting a project. This table is a dated research artifact.
5. Validate skills in the real host and repository. A portable folder format
   does not guarantee identical tools, sandboxing, model behavior, or results.

See [`prior-art.md`](./prior-art.md) for the clean-room and provenance record.
