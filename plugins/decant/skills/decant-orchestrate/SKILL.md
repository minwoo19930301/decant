---
name: decant-orchestrate
description: Route a multi-stage repository task through the smallest useful Decant workflow. Use for work that mixes research, planning, implementation, review, or release; do not use for a single obvious read or edit.
---

# Decant Orchestrate

Coordinate the other Decant skills without turning every request into a large process.

## Preflight

1. Restate the requested outcome, constraints, and forbidden actions.
2. Inspect the repository and current git state before proposing edits.
3. If the CLI is available, run `decant doctor` and preview routing with `decant route "<task>" --json`.
4. Treat `decant run "<task>" --dry-run` as a preview. Run a mutating pipeline only when the user authorized implementation.

This skill helps choose a workflow. It does not change the model of the host agent's current task, whether that host is Codex or Claude Code, and does not make unsupported providers available.

## Hard-deadline progress gate

Use this gate whenever the user gives an explicit deadline and the work is low risk. For a budget of 15 minutes or less, treat it as a fast lane and recommend medium-or-lower host effort before starting. This skill cannot change the host model or effort and cannot enforce a wall-clock timer.

1. Deliver a runnable primary implementation slice by 30% of the budget, capped at five minutes.
2. Run a narrow smoke check, then core tests.
3. Expand behavior and documentation only with the remaining time.
4. Stop expansion when the final 20% begins; use that time to verify and report honestly.

Tests, plans, or documentation alone do not satisfy the first progress gate. Security-sensitive, deployment, destructive, irreversible, or otherwise high-risk work never qualifies for this shortcut; use the normal risk-proportionate workflow without weakening its safety gates.

## Choose the smallest path

- Read-only evidence gathering: use `decant-research` only.
- Ambiguous or high-impact change: use `decant-spec`, then `decant-build`.
- Approved, well-specified edit: use `decant-build` directly.
- Failure or regression: use `decant-debug`; edit only when a fix is authorized.
- Review request: use `decant-review` without editing.
- Publication or handoff: use `decant-release` after implementation checks pass.
- Skill creation or trigger tuning: use `decant-skill-lab`.

Skip stages whose output cannot change the decision. Add review depth as risk, blast radius, irreversibility, or verification difficulty rises.

## Handoff contract

For every active stage, record:

- goal and non-goals;
- inputs and evidence locations;
- allowed mutations;
- result and unresolved risks;
- deterministic checks and semantic review;
- next owner or next action.

Separate observed facts, inferences, and proposals. Never call a stage complete from intention alone.

## Safety boundaries

- Preserve unrelated work in a dirty worktree.
- Do not broaden authorization from diagnosis to repair, or from local changes to publication.
- Do not hide destructive actions behind a recipe, subagent, hook, or retry loop.
- Stop repeated repair attempts after three materially similar failures and reassess the hypothesis.
- Keep databases, daemons, worktrees, swarms, and GUIs optional rather than core requirements.
