# Host surface verification

Verification date: **2026-07-15**

> Product display name: **Rein**. The commands, plugin namespace,
> Skill ids, and outputs below retain the `rein` compatibility identifiers
> that were actually verified on this date.

## Rein rename check (2026-07-17)

The rename branch preserves the verified technical ids and paths while changing
the product display name. On the branch, `npm test` passed 95/95 tests,
`npm run lint` passed, `npm run validate:skills` passed all eight skills, and
`npm run verify:package` installed the packed artifact and exercised the four
CLI help entry points that existed at the time (`disciplinedrun`, `dpr`, `r10`,
`relay10`). Those aliases were removed in the `0.2.0` Rein rename, which
exposes only `rein`.

The Claude CLI was not available on `PATH` in this isolated verifier, so the
2026-07-15 Claude host check below remains the latest live Claude-plugin
evidence. The 2026-07-17 rename check used the repository's static manifest and
Skill validators; it must not be presented as a fresh Claude marketplace
installation test.

This note records evidence for **Skill and Plugin host surfaces**. It does not
claim stage-executor support. Every Rein model stage still launches
Codex CLI subprocesses (`codex exec` / `codex debug models`).

## Scope

| Surface | What was verified | What was not verified |
|---|---|---|
| Claude Code Skill + Plugin | Manifest validation, local marketplace install, eight skills listed | Claude as a stage executor, MCP, custom UI, GitHub marketplace shorthand on unmerged `main` |
| Grok Build / Grok CLI Skill host | Repo skills loaded from `.agents/skills` (and Claude-compat paths) in a live session | Grok as a stage executor, xAI custom-provider E2E, Reader-10 through Grok |
| Codex CLI runtime | `npm run check`, skill-pack validator | Live Codex model stages in this verifier environment (Codex CLI was not on PATH) |

## Claude Code (re-check)

Commands and results on branch with the Claude Code plugin preview:

```text
claude plugin validate plugins/rein   → Validation passed
claude plugin validate .                 → Validation passed
claude plugin details rein@rein    → Skills (8): rein-build … rein-spec
npm run check                            → 85+ tests pass; skill pack validation: pass (8 skills)
```

Install surface observed earlier and still present:

- Marketplace source: local clone (`claude plugin marketplace` lists `rein`)
- Plugin: `rein@rein` version `0.1.1`, scope user, status enabled
- Component inventory: 8 skills, 0 agents/hooks/MCP/LSP
- Project clone surface: `.claude/skills` → `../plugins/rein/skills` resolves to the canonical pack

Boundary reminder: Claude Code loads skills and can shell out to `rein`. It does
**not** replace Codex as the stage executor.

## Grok Build / Grok CLI (first host-surface check)

Grok discovers repository skills from `.agents/skills` (and walks Claude-compat
skill roots). The open-sourced Grok Build source (pinned in
[grokbuild-distillation.md](grokbuild-distillation.md)) adds precision to that
claim: `.grok/skills` and `.agents/skills` are always scanned, in that order,
while the Claude-compat root is gated on a `[compat]` toggle that defaults on
but can be disabled — a user who turns it off still loads this pack via
`.agents/skills`. In a live Grok Build session opened in this repository:

- All eight `rein-*` skills appeared as available skills (paths under
  `plugins/rein/skills` and the `.agents/skills` symlink)
- Skill instructions were loadable (`rein-review`, `rein-research`, and
  related pack entries)
- Symlink integrity:

```text
.agents/skills  → ../plugins/rein/skills  (resolves)
.claude/skills  → ../plugins/rein/skills  (resolves)
skills: rein-build, rein-debug, rein-orchestrate, rein-release,
        rein-research, rein-review, rein-skill-lab, rein-spec
```

Boundary reminder:

- **Skill host (verified):** Grok can load and follow the pack when working
  inside a clone that exposes `.agents/skills`.
- **Stage executor (not verified):** Grok / xAI is still only an experimental
  Codex custom-provider candidate. Do not advertise “Grok-supported stages”.

## Runtime dependency observed during verification

On this machine (2026-07-15):

```text
node src/cli.mjs doctor
# before doctor UX fix: rein: spawn codex ENOENT
# after doctor UX fix:  FAIL Codex codex not found on PATH …
```

`rein doctor` and catalog discovery require an authenticated Codex CLI on PATH.
Skill-host verification does not require Codex; end-to-end `rein run` does.

## How to re-run

```bash
# Pack integrity
npm run check
npm run validate:skills

# Claude Code
claude plugin validate plugins/rein
claude plugin validate .
claude plugin details rein@rein   # when installed

# Grok Build / Grok CLI
# open a session in the repo root and confirm the eight rein-* skills load
# from .agents/skills (or installed Claude-compat skill paths)

# Runtime
rein doctor
```

## Claim language

| Allowed | Not allowed |
|---|---|
| “Claude Code can install/load the eight-skill pack (preview)” | “Claude runs Rein stages natively” |
| “Grok Build can load the eight skills from `.agents/skills`” | “Grok is a supported stage provider” |
| “Codex CLI remains the verified stage runtime” | “Multi-provider stage mixing works” |

See also [`lineage-and-portability.md`](./lineage-and-portability.md).
