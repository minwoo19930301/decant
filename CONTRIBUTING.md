# Contributing to Rein

Rein stays small by accepting evidence-backed changes rather than feature
count. Before opening a pull request, describe the user problem, the current
failure or limitation, and the observable acceptance condition.

## Development loop

Requirements: Node 20+ and, for live smoke checks, an authenticated Codex CLI.

```bash
npm install
npm run check
npm run smoke
```

`npm run check` runs the repository tests, syntax checks, and the eight-Skill
Plugin validator. Tests are explicitly scoped to `test/*.test.mjs` so ignored
clean-clone fixtures cannot be discovered as duplicate tests.

## Change expectations

- Preserve unrelated work and keep one coherent concern per pull request.
- Add a regression test for behavior changes, or explain why a deterministic
  test is not appropriate.
- Keep user-controlled command values as literal argv, not shell strings.
- Distinguish command evidence, model review, and Reader-10 clarity results.
- Update support tables when a provider, platform, or app boundary changes.
- Do not claim benchmark, cost, provider, or app support without a reproducible
  task, raw result, environment, and known limits.

## Skill and Plugin contributions

Rein's default pack is intentionally limited. A new Skill must show that an
existing Skill cannot own the job and must include:

- one primary job and explicit non-trigger boundary;
- original clean-room instructions;
- should-trigger and near-miss cases;
- with-Skill versus no-Skill comparison on representative tasks;
- required tools, mutation authority, and failure behavior;
- source URLs, commit identifiers, and file-level license review for any prior art.

Do not copy third-party prompts, scripts, assets, or restrictive source-available
material. Run `npm run validate:skills` before submitting.

## Pull request evidence

Include:

- problem and non-goals;
- files changed;
- commands run with exit status;
- user-visible before and after;
- security, compatibility, and rollback notes;
- unsupported paths that remain.

Publication, release, benchmark, or provider-support changes receive additional
review because inaccurate claims are product defects.
