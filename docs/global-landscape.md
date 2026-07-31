# Global coding-agent harness landscape

Snapshot: **2026-07-13**. Stars are discovery signals, not proof of active users,
quality, or production reliability. Counts and project status change; links point
to the primary repositories or product documentation.

## Projects visible in the global open-source landscape

There is no single dominant "harness" category. Current projects fall into
four distinct groups:

1. wrappers that run existing CLIs in sessions or worktrees;
2. prompt/workflow packs installed into a host agent;
3. independent coding-agent runtimes;
4. organization-scale asynchronous development platforms.

| Project | Category | Stars | What it is good at | Trade-off |
|---|---|---:|---|---|
| [Agent Orchestrator](https://github.com/AgentWrapper/agent-orchestrator) | multi-CLI orchestrator | 8,216 | worktrees, sessions, issue-to-PR and CI retry loops | dashboard and platform surface are much larger than a phase router |
| [Claude Squad](https://github.com/smtg-ai/claude-squad) | multi-CLI runner | 8,102 | simple tmux/worktree parallelism across Claude, Codex, Gemini, and Aider | little automatic task classification or evaluation |
| [Ruflo](https://github.com/ruvnet/ruflo) | swarm harness | 64,206 | roles, topologies, hooks, MCP, memory, and long-lived coordination | broad state and command surface; opposite end of the lightweight spectrum |
| [SuperClaude](https://github.com/SuperClaude-Org/SuperClaude_Framework) | host workflow pack | 23,551 | easy installation of roles, commands, and development workflows | many "agents" are instruction contexts rather than isolated model processes |
| [BMAD Method](https://github.com/bmad-code-org/BMAD-METHOD) | artifact methodology | 50,458 | analysis, product requirements, architecture, stories, and checklists | document-heavy for small or reversible work |
| [OpenDev](https://github.com/opendev-to/opendev) | independent lightweight agent | 747 | separate Normal, Thinking, Compact, Self-Critique, and vision model slots | new project; its self-reported performance needs independent validation |
| [OpenCode](https://github.com/anomalyco/opencode) | provider-neutral terminal agent | 185,162 | rich TUI, LSP, client/server design, local and hosted providers | replaces the host runtime instead of remaining a tiny layer over Codex |
| [Aider](https://github.com/Aider-AI/aider) | git-native coding agent | 47,325 | architect/editor model split, repo map, automatic lint and test | less focused on multi-agent fleets and evidence reports |
| [Continue](https://github.com/continuedev/continue) ([model-role docs](https://docs.continue.dev/customize/model-roles)) | IDE agent platform | 34,839 | distinct chat, autocomplete, edit, apply, embed, and rerank model roles | IDE-centered and sensitive to each model's tool-call quality |
| [mini-SWE-agent](https://github.com/SWE-agent/mini-swe-agent) | minimal research agent | 5,737 | tiny, understandable core and benchmark-friendly trajectories | phase routing and a reviewer panel must be added by the user |
| [OpenHands](https://github.com/OpenHands/OpenHands) | full development platform | 80,596 | web UI, SDK, sandbox, plugins, and end-to-end agent work | Python, React, and sandbox infrastructure are heavy for a personal wrapper |
| [Open SWE](https://github.com/langchain-ai/open-swe) | organization async agent | 10,277 | Slack/Linear/GitHub triggers, sandboxes, subagents, and automatic PRs | cloud and GitHub App operations; validation is still largely prompt-driven |

## The closest prior art

Rein does not claim that phase-specific model routing is new.

- [OpenDev](https://github.com/opendev-to/opendev) is the closest direct
  competitor: it already separates thinking, compacting, and self-critique
  model slots.
- [Continue model roles](https://docs.continue.dev/customize/model-roles)
  demonstrate that chat, editing, application, embeddings, and reranking can
  profitably use different models.
- [Aider](https://github.com/Aider-AI/aider) pairs an architect with an editor
  and follows edits with deterministic lint/test feedback.

Rein's proposed contribution is narrower: reuse the installed Codex CLI,
route by risk and verifiability, keep hashed inspectable artifacts, record
explicit command checks separately from a model reviewer, and only then send a
standalone HTML report through Reader-10. These are signals, not proof of truth.

## Important status changes

- [Roo Code](https://github.com/RooCodeInc/Roo-Code) is archived. GitHub marks
  it archived and its last push was 2026-05-15, so it should not be presented
  as the default active IDE recommendation. [Cline](https://github.com/cline/cline)
  remains active.
- The [SWE-agent](https://github.com/SWE-agent/SWE-agent) maintainers direct most
  new work toward mini-SWE-agent, which is the more relevant minimal baseline.
- [AutoGen](https://github.com/microsoft/autogen) is no longer the clean default
  for new Microsoft-stack orchestration; the active successor is
  [Microsoft Agent Framework](https://github.com/microsoft/agent-framework).
- [Goose](https://github.com/aaif-goose/goose) is an active, extensible agent
  under the Agentic AI Foundation, but it is an independent runtime rather than
  a minimal phase router.

## Reusable overseas patterns

The strongest recurring design choices are:

- isolate jobs with sandboxes or worktrees;
- keep the tool set curated rather than exposing everything;
- validate with local tests, then CI, then bounded retries, then human review;
- use GitHub issues and draft pull requests as organizational handoff points;
- prefer deterministic middleware and explicit failure states over an
  unbounded "agent council";
- select models per role only when the quality, latency, and cost difference is
  measured on representative tasks.

Rein adopts the small-tool, deterministic-gate, bounded-retry pattern. It
does not attempt to reproduce a hosted issue-to-PR platform in version 0.1.
