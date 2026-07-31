# Decant

> Pour off what coding-agent harnesses do well. Leave the sediment.

Decant runs a coding task through the agent CLI you already have, and leaves you
a folder of plain files showing what happened.

It is not a model and not a replacement for your agent. It is a thin layer that
adds four things your agent does not give you on its own:

- a **cheap look before the expensive work** — a read-only pass reads the repo
  first, and what it finds decides whether the big model is worth calling
- **files instead of a wall of text** — every step lands in
  `.decant/runs/<id>/`, so you can open it, diff it, keep it
- **signals that stay separate** — your tests, the reviewer model, and the
  readability check are three different answers, never merged into one
- **a hard cap** — `--budget-calls` limits how many times the agent launches, so
  a run can't quietly become thirty

**The name.** To decant is to pour wine into another vessel so the clear part
comes over and the sediment stays behind. Two ideas in one word: keep only the
practices worth keeping from the harnesses that already exist, and carry them
into whatever model you happen to run underneath.

---

## What we took, and from where

This is the whole premise, so it goes first. Decant is not new ideas — it is a
short list of other people's good ideas, implemented small.

| Idea | Where we saw it | What Decant does with it |
|---|---|---|
| Split planning from editing, and use a different model for each | aider's architect/editor mode | `scout` → `architect` → `maker` are separate stages with separate models and separate permissions |
| Plan read-only; only one step may touch files | OpenCode's plan/build split | Only `maker` gets write access. Every other stage is read-only, enforced by the backend |
| Write the spec before the code, but don't drown in it | Spec Kit, OpenSpec | `decant-spec` records outcome, non-goals, acceptance, rollback — one page, not a document hierarchy |
| Ask the human a few pointed questions before starting | Ouroboros | `decant-spec` asks at most three, one at a time, and skips them for small clear changes |
| Small vertical slices with tests | Superpowers | `decant-build` prefers bounded slices; test commands are yours, listed literally, never guessed |
| Reproduce and localise before fixing | systematic-debugging practice | `decant-debug` separates diagnosis from permission to fix, and forces a rethink after three failures |
| Review a frozen baseline, not a moving target | separate spec/quality review | `decant-review` is read-only and reports findings with evidence and severity |
| Skills that load only when relevant | Claude Code Agent Skills | Eight one-job skills instead of a catalog of hundreds |
| Keep the transcript out of the loop; pass files | mini-swe-agent's statelessness | Stages hand off through files, not a growing conversation |
| Completion needs evidence you can check | verification-before-completion practice | Command results, artifact hashes, and a frozen replay check — recorded separately from any model's opinion |

And what we deliberately left in the bottle: agent swarms, background daemons,
retry-until-done loops, vector memory, a scheduler, a database, a TUI, telemetry.

Full lineage with links and licence notes: [docs/prior-art.md](docs/prior-art.md).

---

## Start here

You need Node 20+ and one agent CLI on your `PATH` — `codex` or `kiro-cli`.

```bash
git clone https://github.com/minwoo19930301/decant.git
cd decant && npm link
decant doctor
```

`doctor` tells you which backend it found and, more usefully, what that backend
can actually enforce:

```text
PASS Node v26.5.0
INFO provider kiro (Kiro CLI); available: codex, kiro
INFO sandbox=tool-allowlist outputSchema=prompted
PASS kiro-cli kiro-cli 2.15.1
PASS frontier: claude-opus-5/max
PASS balanced: claude-sonnet-5/medium
PASS economy: claude-haiku-4.5/low
```

## How do I…

**…create a config file to edit?**

```bash
decant init          # writes decant.config.json with the defaults filled in
```

Everything below is a change to that file. You can also delete it — defaults
work without one.

**…see what it would do, without it doing anything?**

```bash
decant route "add pagination to the users endpoint"
decant run  "add pagination to the users endpoint" --dry-run
```

`route` prints the plan: which stages, which model, which effort, and why.
`--dry-run` validates the whole run and writes nothing.

**…actually run it?**

```bash
decant run "add pagination to the users endpoint"
```

Files appear under `.decant/runs/<id>/`. Open `report.html`.

**…use a different agent CLI?**

Put this in `decant.config.json`:

```json
{ "version": 1, "provider": "kiro" }
```

`codex` is the default. `decant doctor` confirms the switch.

**…pin which model each role uses?**

```json
{
  "version": 1,
  "catalog": {
    "overrides": {
      "frontier": "claude-opus-5",
      "balanced": { "model": "claude-sonnet-5", "effort": "high" },
      "economy":  "claude-haiku-4.5"
    }
  }
}
```

**…run my tests as part of the run?**

Nothing is inferred or run by default. List commands literally, then opt in on
the command line:

```json
{
  "version": 1,
  "verification": {
    "commands": [
      { "command": "npm", "args": ["test"] },
      { "command": "npm", "args": ["run", "lint"] }
    ]
  }
}
```

```bash
decant run "fix the failing pagination test" --allow-verification-commands
```

Two safeguards: there is no shell, so `&&` and `$(…)` are not interpreted; and
if commands are configured but you forget the flag, the run stops instead of
silently skipping verification.

**…stop it from getting expensive?**

```bash
decant run "small typo fix" --budget-calls 3
```

That caps **agent launches**. It does not cap tokens or money — see the limits
below.

**…look at an old run?**

```bash
decant inspect                 # the most recent run
decant report <run-id>         # re-render the page, no model calls
decant replay <run-id> --frozen  # re-check every artifact hash
```

**…add support for another agent CLI?**

Write one file in `src/providers/`. You implement two functions —
`discoverCatalog()` and `runStage()` — and the pipeline never learns your CLI's
name. `src/providers/kiro.mjs` is a worked example, including how to
cope with a CLI that has no structured-output flag.

---

## What a run leaves behind

```text
.decant/runs/20260731T044012123Z-8f3a91c2/
├── run.json          # manifest: task, plan, which backend ran, budget used,
│                     #   and a sha256 for every file below
├── events.jsonl      # one line per stage start / finish / decision
├── scout.json        # the cheap look: what it found, what it's unsure about
├── architect.md      # the plan — or a record of why it was skipped
├── maker.md          # what the implementing stage says it changed
├── verification.json # exit code and output of YOUR commands
├── reviewer.json     # the reviewer model's verdict, with cited evidence
├── summary.md        # a plain summary for someone who wasn't watching
└── report.html       # all of it as one standalone page
```

`verification.json`, `reviewer.json`, and the readability result are three
separate records. The report shows them side by side and never collapses them
into a single pass/fail, because "the tests passed" and "a model thinks it looks
right" are not the same claim.

If a stage fails the run stops. You keep the files produced so far, and nothing
is rolled back.

---

## What it will not do

Read this before installing. Being straight about it is the point.

- **Routing is a guess, not a measurement.** Five task dimensions are scored
  with hand-written keyword patterns and hand-picked weights. Nothing here
  calibrates those numbers, and there is no published comparison against simply
  prompting your model directly.
- **`--budget-calls` counts launches, not money.** Not tokens, not
  provider-internal turns, not currency.
- **The readability check is a linter, not a jury.** "Reader-10" is ten named
  personas sharing one rule engine, checking the *report* — structure, headings,
  jargon, alt text. Live mode makes ten model calls that may all be the same
  model. Neither tells you the code is correct.
- **Hash-frozen replay detects drift, it does not notarise.** It tells you a
  local file changed. It is not an external notary or a tamper-proof ledger.
- **`frontier` / `balanced` / `economy` are labels.** From provider metadata,
  your overrides, or — for a backend that publishes no metadata — a guess from
  the model's family name. Not prices, not benchmarks.
- **No retry, no resume, no rollback.** A failed stage ends the run.
- **The report renders Korean labels.** The clarity gate itself is
  language-neutral as of `0.2`, but the template strings have not been extracted
  yet, so output text is still Korean.
- **The two backends are not equivalent.** Codex enforces a JSON schema and a
  kernel sandbox. The Kiro adapter asks for the schema in the prompt and grants a
  tool allowlist, which is weaker. `doctor` and `run.json` both say which you
  got.

Last tagged release is `v0.1.1`, made under the project's first name **Relay10**.
Nothing has been published to npm. The `v0.1.1` evidence under `docs/launch-*`
keeps the old names on purpose so its recorded hashes still verify.

<a id="decant-skill-pack"></a>

## The skill pack

Eight skills, one job each. They work in Codex, Claude Code, and Grok Build by
being files in the repo — clone it and they are there, via `.agents/skills` and
`.claude/skills`.

| Skill | Job | Where it stops |
|---|---|---|
| `decant-orchestrate` | pick the smallest workflow that fits | does not change your agent's model |
| `decant-research` | gather read-only evidence | does not modify the repo |
| `decant-spec` | outcome, non-goals, acceptance, rollback | does not implement plan-only requests |
| `decant-build` | implement in small slices | does not publish |
| `decant-debug` | reproduce, then localise | diagnosis is not permission to fix |
| `decant-review` | review a fixed baseline | read-only |
| `decant-release` | prove package, hash, and support claims | needs explicit release authority |
| `decant-skill-lab` | test whether a skill actually helps | rejects skills with no measured benefit |

Skills guide the host agent. They do not swap out its model. The `decant run`
pipeline is a separate thing that uses whichever provider your config selects.

In Claude Code:

```text
/plugin marketplace add minwoo19930301/decant
/plugin install decant@decant
```

---

## More detail

- [Architecture](docs/architecture.md) — stage contracts, the provider
  interface, and what is deliberately missing
- [Prior art](docs/prior-art.md) — full lineage, sources, licence notes
- [Lineage and portability](docs/lineage-and-portability.md) — why the split
  between skills and pipeline
- [Conditional advisor routing](docs/conditional-advisor-routing.md) — when the
  expensive stage is skipped, and how that is recorded
- [Host verification](docs/host-surface-verification.md) — dated evidence for
  skill-host loading
- [Config schema](schema/config.schema.json) — every option, validated

## Contributing

Issues and PRs welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) and
[SECURITY.md](SECURITY.md). Claims in this repo are expected to come with
evidence; if you add a capability, add the check that proves it.

## License

MIT — see [LICENSE](LICENSE).
