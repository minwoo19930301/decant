---
name: decant-review
description: Review a fixed change set for specification compliance, correctness, security, regression risk, and evidence quality. Use for code or release review; remain read-only unless the user separately requests fixes.
---

# Decant Review

Review the requested baseline, not a moving or assumed diff.

## Establish the baseline

1. Identify the exact commit, branch diff, patch, or working-tree changes in scope.
2. Read the specification and acceptance criteria.
3. Inspect relevant tests, runtime paths, configuration, and failure handling.

## Two passes

First check specification compliance: missing behavior, scope drift, unsupported claims, and unmet acceptance criteria.

Then check code quality: correctness, security, data loss, concurrency, compatibility, dependency risk, observability, and test adequacy. Increase depth with risk; do not manufacture low-value comments to fill a quota.

## Finding contract

Each actionable finding includes:

- severity and concise title;
- exact file and line or reproducible location;
- evidence and failure scenario;
- impact;
- smallest safe remediation.

Separate findings from optional improvements. If no actionable findings exist, say so and name any residual testing gaps.

## Boundaries

- Do not edit during a review-only request.
- Do not call tests passing if they were not executed.
- Do not treat the maker's self-review as independent evidence.
- Do not conflate clarity review with correctness or security review.
