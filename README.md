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
comes over and the sediment stays behind. Keep only the practices worth keeping
from the harnesses that already exist; carry them into whatever model you run.

## See it decide

Real output, same machine, two tasks. Nothing ran — this is `route`, the preview:

```console
$ decant route "fix a typo in the README"
Assessment: economy (score 4)
Dimensions: complexity=0, risk=1, blast=0, verifiability=2, reversibility=3
- scout      run         economy/low     -> claude-haiku-4.5
- architect  conditional frontier/max    -> claude-opus-5
- maker      run         balanced/medium -> claude-sonnet-5
- reviewer   run         frontier/high   -> claude-opus-5
Agent invocations: 4..5

$ decant route "delete the users table and migrate production data to the new schema"
Assessment: frontier (score 24)
Dimensions: complexity=2, risk=3, blast=2, verifiability=2, reversibility=0
- scout      run         economy/low     -> claude-haiku-4.5
- architect  run         frontier/max    -> claude-opus-5
- maker      run         balanced/medium -> claude-sonnet-5
- reviewer   run         frontier/high   -> claude-opus-5
Agent invocations: 5..5
```

The typo gets `architect: conditional` — the expensive model is **skipped** if
the cheap scout comes back with no open questions. The production migration gets
`architect: run`, because `reversibility=0` and `risk=3` mean you do not want to
find out mid-edit. That decision is the product.

When you run it for real, you get a folder of files and a `report.html`.

## What one real run costs

A throwaway repo: a `listUsers()` that returns all 57 users, and one test.
Task: *"add limit and offset pagination to listUsers, and cover it with a test."*
Backend: Kiro CLI, Sonnet for the working stages, Haiku for the cheap ones.

```console
$ decant run "add limit and offset pagination to listUsers, and cover it with a test" \
    --allow-verification-commands --budget-calls 6
Run warn: .decant/runs/20260731T052055193Z-552ca062
```

| | |
|---|---|
| wall clock | **183 s** |
| agent launches | **5** of a 6 budget |
| files changed | `users.mjs` (+6 −2), `users.test.mjs` (+19) |
| the repo's own tests | 1 test → **5 tests, all passing** |
| verification | pass — `npm test` exited 0 |
| reviewer | pass |
| report clarity | 8/10 personas, 0 critical |
| status | `warn` |

What it wrote:

```diff
-export function listUsers() {
-  return USERS;
+export function listUsers({ limit = USERS.length, offset = 0 } = {}) {
+  const start = Math.max(0, offset);
+  const end = start + Math.max(0, limit);
+  return USERS.slice(start, end);
 }
```

…plus tests for offset beyond the end, a negative offset, and no limit given.

`warn`, not `pass`, because the generated report only reached 8 of 10 clarity
personas. The code is fine and the tests pass — that is the point of keeping the
signals apart. **Three minutes and five model calls** is the honest ballpark for
a task this size; `--budget-calls` is what stops it being more.

No token or currency figure, because Decant cannot see either. Your provider's
dashboard can.

And does the harness actually beat not using it? Three measured runs say **it
depends entirely on task size**, and two of the three do not favour it:

| task | harness | without |
|---|---:|---:|
| tight 10-minute spec | **0/100** | 70/100 |
| small browser game | 13/13 reqs, 305 s | 13/13 reqs, 78 s |
| larger 40-minute build | **100/100** | 90/100, at 1/5 the tokens |

On the short task the harness wrote a 145-line test file and never created the
source modules it imported. That failure is what the `--lane fast` vertical-slice
gate exists to stop. Full numbers, methodology, and what none of it establishes:
[docs/benchmarks.md](docs/benchmarks.md).

**Do not use the pipeline for small tasks.** For large ones, decide whether the
quality difference is worth roughly five times the tokens. In between,
`decant review` costs one call.

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

Left in the bottle: swarms, daemons, retry-until-done, vector memory,
schedulers, a TUI. Full lineage with links and licence notes:
[docs/prior-art.md](docs/prior-art.md).

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

`route` prints the plan: which stages, which model, which effort, and why. It also
estimates what the run will cost before you spend it:

```console
$ decant route "add pagination to the users endpoint"
Assessment: balanced (score 7)
…
Agent invocations: 4..5 (deterministic readers)
Estimated cost: ~5.0m of model time, 4..5 calls (5 of 6 stages calibrated from 1 local run(s))
  excludes verification commands — your programs, not ours to guess
  excludes tokens and currency — not observable from here; check your provider
```

The estimate is calibrated from **this workspace's own recorded runs** — every
completed stage already stores its duration, so past runs are a free calibration
set that improves with use. With no history it falls back to a seed table and says
so. On the one run measured against it, the prediction was 301 s against an actual
305 s. It reports no token figure, because nothing here can observe one.

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

There is no shell, so `&&` and `$(…)` are not interpreted. And if you configure
commands but forget the flag, the run stops rather than quietly skipping them.

**…stop it from getting expensive?**

```bash
decant run "small typo fix" --budget-calls 3
```

That caps **agent launches**. It does not cap tokens or money — see the limits
below.

**…just review what another agent already wrote?**

The cheapest useful thing here. One model call, read-only, no pipeline, no run
directory — point it at any workspace:

```bash
decant review "the task the code was supposed to accomplish"
```

Exit code carries the verdict: `0` pass, `2` the reviewer rejected it, `3` it
could not gather enough evidence to say. Findings cite file and line.

In the measured A/B below, this alone caught — unprompted, as `critical` — the
defect that broke the task's first requirement and that the unharnessed run
shipped silently. The full six-stage pipeline rated the same defect `low`.

**…make the reviewer answer *my* conditions, not its own?**

By default the reviewer invents its own acceptance checks, which means a model
grades itself against criteria it chose. Write them down first instead:

```json
{
  "version": 1,
  "criteria": [
    { "id": "opens-directly", "risk": "critical",
      "requirement": "index.html works when opened directly, no build step and no server." },
    { "id": "pure-scoring", "risk": "high",
      "requirement": "scoring.mjs exports a pure function with no DOM access, covered by tests." },
    { "id": "line-budget", "risk": "low",
      "requirement": "The whole thing is under 400 lines." }
  ]
}
```

```bash
decant review "build the game" --contract contract.json
```

Every id must come back with a decision and evidence. A rejected `critical` or
`high` criterion blocks; a missing answer on a `critical` one blocks; anything
else unresolved is reported as a visible gap. This check is deterministic and
ignores the reviewer's own verdict — a model that says `pass` while rejecting a
critical criterion, or that quietly drops an inconvenient requirement, does not
get taken at its word:

```text
Contract: 8/8 criteria answered
  BLOCKING opens-directly: reviewer rejected it
```

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

A folder of plain files. `report.html` is the one to open; the rest is there when
you want to check the report against what actually happened.

```text
.decant/runs/20260731T044012123Z-8f3a91c2/
├── report.html        ← open this
├── run.json           the plan, the backend used, budget spent, a sha256 per file
├── events.jsonl       one line per stage start, finish, decision
├── scout.json         the cheap look, including what it was unsure about
├── architect.md       the plan — or why it was skipped
├── maker.md           what the implementing stage says it changed
├── verification.json  exit code and output of your commands
├── reviewer.json       the reviewer model's verdict, with cited evidence
└── summary.md         a plain summary for someone who wasn't watching
```

Your tests, the reviewer model, and the readability check stay three separate
records. "The tests passed" and "a model thinks it looks right" are different
claims, so the report never merges them into one verdict.

If a stage fails, the run stops there. You keep what was produced and nothing is
rolled back.

---

## What it will not do

Three that will actually change your mind:

- **The routing is a guess.** Keyword patterns and hand-picked weights, with no
  calibration and no published comparison against just prompting your model.
- **`--budget-calls` counts launches, not money.** Not tokens, not turns, not
  currency.
- **Nothing here proves your code is correct.** The readability check is a
  linter. The hash check spots a changed file. A failed stage ends the run with
  no rollback.

The other dozen — what the labels mean, why the two backends differ, what replay
does and doesn't guarantee, why the report is still Korean — are in
[docs/limits.md](docs/limits.md), one page, written for the same reason.

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

- [Benchmarks](docs/benchmarks.md) — three measured runs, two of which the harness lost
- [A/B: with and without the harness](docs/ab-flamingo.md) — the flamingo run in detail
- [Limits](docs/limits.md) — every claim this tool does not make
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
