# Confirmed Task Contract

Use this compact contract after any necessary clarification. Keep it in the
conversation unless the user or repository workflow requests a file artifact.

```yaml
status: confirmed | unresolved
revision: 1
supersedes: null
goal: one observable user outcome
non_goals:
  - behavior intentionally outside this change
constraints:
  - technical, provider, platform, policy, or licensing boundary
allowed_mutations:
  - files, systems, or external actions the request authorizes
forbidden_actions:
  - publication, destructive work, or scope expansion not authorized
acceptance_checks:
  - observable pass condition and its evidence
verification:
  - exact deterministic check or review method
rollback: smallest safe revert path
decisions:
  - statement: material premise used by the plan
    source: user_decision | repo_fact | safe_assumption | blocker
    evidence: answer, file, command result, or named owner
unresolved:
  - remaining blocker; empty only when status is confirmed
```

## Confirmation rules

- A specific original request may confirm revision 1 without a redundant
  question when evidence does not expose a material choice.
- If user input selected scope, authority, or an irreversible trade-off,
  restate the contract and obtain confirmation before implementation.
- `status: unresolved`, a `blocker` decision, or a non-empty material
  `unresolved` list prevents a build handoff.
- A material change creates revision N+1 and sets `supersedes` to the prior
  revision. Preserve the earlier contract instead of rewriting its history.
- The contract records intent; it is not proof that implementation or
  verification succeeded.
