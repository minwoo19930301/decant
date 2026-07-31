---
name: decant-skill-lab
description: Create or tune a focused Decant skill using clean-room prompts, trigger tests, and with-skill versus baseline evaluation. Use when adding a skill or changing its description or workflow; do not use merely to run an existing skill.
---

# Decant Skill Lab

Add a skill only when it improves a repeated job enough to justify context and maintenance cost.

## Design

1. Define one job, its expected output, and its non-goals.
2. Write a front-loaded description covering what it does, when it triggers, and an important non-trigger boundary.
3. Keep `SKILL.md` short. Move only substantial optional detail into directly linked `references/`; add deterministic scripts only for work the model should not improvise.
4. Write all prompt text and scripts independently. Record third-party behavior patterns and licenses in provenance instead of copying text.
5. Avoid absolute user paths, hidden network calls, interactive scripts, and unbounded retry loops.

## Evaluate

Create at least:

- ten should-trigger prompts;
- ten near-miss should-not-trigger prompts;
- three representative outcome tasks;
- one adversarial or failure case.

Split trigger examples into tuning and validation sets. Compare `with_skill` against `without_skill` on output quality, correctness, token use, time, and failure type. Forward-test in a clean task or subagent so the authoring context does not leak into the result.

Recommended promotion gate: validation recall at least 90%, near-miss false triggers at most 10%, all deterministic assertions passing, and no material quality regression.

## Validate the pack

Check:

- valid YAML frontmatter and matching folder/name;
- concise `agents/openai.yaml` with a literal `$skill-name` starter prompt when the pack targets Codex distribution; Claude Code ignores this file;
- no TODOs, broken relative links, or machine-specific absolute paths;
- deterministic scripts support `--help`, non-interactive execution, clear exit codes, and structured output;
- plugin manifest points only to files that exist;
- total metadata remains small enough for progressive disclosure.

Reject a skill whose baseline is already as good or whose maintenance cost outweighs its measured benefit.
