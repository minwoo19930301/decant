---
name: rein-spec
description: Turn an ambiguous or high-impact change request into a small executable specification using bounded Socratic clarification and a confirmed task contract. Use when scope, authority, acceptance checks, or rollback are unclear; do not use for a narrow reversible edit or a question the repository can answer.
---

# Rein Spec

Design the smallest change that can prove the requested outcome. Resolve facts
from evidence, and ask the user only for decisions that evidence cannot make.

## Clarify only what matters

1. Inspect the repository before asking about filenames, commands, existing
   behavior, or other facts that local evidence can answer.
2. Ask only when the answer would materially change the outcome, authority,
   risk, acceptance criteria, or irreversible action.
3. Ask one question at a time and default to at most three questions. If a
   blocking decision remains after three, stop with an unresolved contract
   instead of guessing or starting implementation.
4. Record each material premise as `user_decision`, `repo_fact`,
   `safe_assumption`, or `blocker`, with its evidence or owner.
5. Do not treat "알아서 해", "use your judgment", silence, or a broad goal as
   authorization for destructive changes, publication, spending, credentials,
   or production operations.

Skip the interview when the request is already specific, reversible, and
verifiable. State a safe assumption and continue when the assumption is inside
the user's authority and cannot materially change the result.

## Build the specification

1. Inspect the existing behavior, conventions, tests, and user-owned changes.
2. State the user outcome in one sentence.
3. List non-goals and constraints, including provider, app, platform, and licensing boundaries.
4. Describe two alternatives only when the choice materially affects scope or risk.
5. Select one approach and explain the rejected alternative briefly.
6. Define observable acceptance criteria before listing implementation files.
7. Add a verification plan, rollback path, and unresolved questions.

Before handing work to `rein-build`, restate the result as a Confirmed Task
Contract using [the contract fields](./references/task-contract.md). A clear
original request can confirm revision 1 without another ceremonial question.
When clarification changed or selected the scope, ask the user to confirm the
restatement. A contract with a blocker or unresolved material decision cannot
authorize implementation.

After confirmation, do not silently rewrite intent. A material requirement
change creates a new revision that names the prior revision and repeats only
the confirmation needed for the changed decision.

## Risk routing

Assess each dimension from low to high:

- complexity;
- blast radius;
- security or data sensitivity;
- verification difficulty;
- irreversibility.

Use stronger planning and review only where these dimensions justify it. A small, reversible, well-tested edit should stay small.

## Output contract

Produce:

- contract status, revision, and decision provenance;
- outcome and user-visible behavior;
- current-state evidence;
- non-goals and constraints;
- allowed mutations and forbidden actions;
- chosen design and key interfaces;
- file-level implementation map;
- acceptance tests;
- risks, rollback, and follow-ups.

For plan-only requests, stop after the specification. Do not implement or publish.

This is a lightweight confirmation contract, not an immutable runtime Seed,
numeric ambiguity score, ontology, resume engine, or autonomous evolution loop.
