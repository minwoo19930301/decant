---
name: decant-build
description: Implement an authorized repository change in small, verifiable slices. Use after scope and acceptance criteria are clear; do not use for diagnosis-only, review-only, or publication-only requests.
---

# Decant Build

Apply the approved change while keeping evidence and rollback obvious.

## Before editing

1. Reconfirm the requested outcome, allowed mutations, and acceptance checks.
2. Inspect the worktree and preserve unrelated user changes.
3. Identify the smallest vertical slice that demonstrates progress.
4. Add or update a failing test first when the behavior is testable and the test adds useful protection.

Do not force test-first mechanics for generated artifacts, trivial text edits, or behavior that is better verified by a deterministic validator. Record why when no test is appropriate.

## Hard-deadline progress gate

Use this gate for explicitly time-boxed, low-risk work. For a budget of 15 minutes or less, treat it as a fast lane and recommend medium-or-lower host effort before starting. This skill cannot change the host model or effort and cannot enforce a wall-clock timer.

1. Produce a runnable primary implementation vertical slice by 30% of the budget, capped at five minutes.
2. Smoke-check that slice, then run the core tests.
3. Expand behavior and documentation only after the slice works.
4. Stop expansion at the final 20% and spend the remainder on verification and an honest handoff.

Test-only, plan-only, and documentation-only output does not pass the first progress gate. Under a hard deadline, the runnable-slice sequence takes precedence over the general test-first preference above. Never apply this shortcut to security-sensitive, deployment, destructive, irreversible, or otherwise high-risk work, and do not weaken any applicable safety gate.

## Implementation loop

1. Make one coherent change.
2. Run the narrowest relevant check.
3. Inspect the diff and unintended file changes.
4. Continue only when the slice is understood.
5. Run the broader regression set in proportion to risk.

Use structured argv and safe APIs rather than shell interpolation for untrusted values. Keep optional adapters and surfaces outside the core when possible.

## Completion evidence

Report:

- files changed and why;
- tests or validators run with actual exit status;
- user-visible result;
- remaining risks or unsupported paths;
- rollback or revert point.

Do not claim completion from code inspection alone when executable verification is available. Do not commit, push, publish, tag, deploy, or send external messages unless the user authorized that action.
