---
name: decant-debug
description: Diagnose a failure from reproducible evidence and isolate its root cause. Use for regressions, flaky behavior, stuck automation, or failed checks; edit only when the user also asked for a fix.
---

# Decant Debug

Prefer one falsifiable hypothesis over a sequence of speculative patches.

## Diagnostic loop

1. Capture the exact symptom, environment, expected behavior, and first known failure.
2. Reproduce with the smallest safe command or fixture.
3. Locate the failing boundary: input, configuration, process, network, storage, adapter, or output.
4. Collect evidence on both sides of that boundary.
5. State one hypothesis and the observation that would falsify it.
6. Run the smallest experiment that distinguishes competing causes.
7. If a fix is authorized, apply the minimal repair and add a regression check.

After three materially similar failed repair attempts, stop patching. Revisit the reproduction, boundary, and assumptions.

## Authorization boundary

A request to diagnose does not authorize code changes. A request to fix does not automatically authorize data deletion, credential changes, deployment, or publication. Use backup-first procedures for stateful repair.

## Output contract

Return:

- reproduced symptom and command;
- root cause with evidence, or ranked remaining hypotheses;
- affected and unaffected boundaries;
- fix and regression test, if authorized;
- operational risks and rollback.

Distinguish a health label such as `connected` or `configured` from proof that useful work completed.
