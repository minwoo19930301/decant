---
name: decant-research
description: Gather current, read-only evidence about a repository, API, product, or ecosystem. Use before broad changes, comparisons, or claims that may have changed; do not use when the user already supplied sufficient stable evidence.
---

# Decant Research

Build a compact evidence ledger before analysis or implementation.

## Workflow

1. Write the exact questions that evidence must answer.
2. Search local files first for repository behavior and current workspace state.
3. For changing external facts, prefer first-party documentation, official repositories, releases, and APIs.
4. Record retrieval date, URL or file path, and the specific claim each source supports.
5. Cross-check high-impact or surprising claims with a second primary source when practical.
6. Return facts, inferences, unknowns, and recommendations as separate sections.

Use the cheapest reliable read path. A metadata API or focused file search is preferable to a broad crawl when it answers the question.

## Evidence contract

For each material claim include:

- claim;
- source and retrieval time;
- observed value or short paraphrase;
- confidence and any staleness risk;
- whether it is fact, inference, or proposal.

Popularity signals such as GitHub stars are discovery signals, not proof of quality, market share, or production usage.

## Boundaries

- Remain read-only unless the user separately asks for changes.
- Do not quote or copy third-party prompts, scripts, or assets when a behavior-level summary is enough.
- Check file-level licenses before any reuse; treat unclear licensing as inspiration-only.
- Do not silently turn an archived or deprecated project into a current recommendation.
- Do not report a provider, app surface, or integration as supported without an end-to-end test.

## Output

End with a short decision table: `candidate`, `evidence`, `adopt`, `exclude`, `reason`, and `verification still needed`.
