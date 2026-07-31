# Benchmarks: does the harness pay for itself?

Three measurements exist. They disagree, and the disagreement is the most useful
thing anyone has measured about this project. All of them are single runs per
condition and none is a statistical benchmark.

## The three results

| | task | ceiling | harness score | vanilla score | harness tokens | vanilla tokens |
|---|---|---|---:|---:|---:|---:|
| **DiffSentinel** | tight spec, 6 required rules | 10 min | **0/100** | **70/100** | 153,818 | 113,538 |
| **ForgeSignal** | larger build | 40 min | **100/100** | 90/100 | 4,002,239 | 735,755 |
| **Flamingo game** | small browser game | none | 13/13 reqs | 13/13 reqs | not measured | not measured |

DiffSentinel and ForgeSignal used `gpt-5.6-sol` at `ultra`, identical starting
trees, symmetric ceilings, and banned subagents and extra skills in both arms.
Evidence is in four private repositories:
`diffsentinel-{disciplinedrun,vanilla-codex}` and
`forgesignal-{disciplinedrun,vanilla-codex}`, each carrying its own
`BENCHMARK_SPEC.md` and `BENCHMARK_RESULT.md`.

The flamingo run is written up in [ab-flamingo.md](ab-flamingo.md). It used the
Kiro backend and a self-authored 13-point requirement check rather than a hidden
evaluator, so it is the weakest of the three.

## What the pattern says

**Task size decides whether the harness pays.**

- **Short, tightly specified work: the harness loses badly.** DiffSentinel scored
  zero. It wrote a 145-line test file at 4m45s and never created the source
  modules that file imported. Vanilla wrote a runnable parser, analyzer, CLI, and
  HTML renderer at 9m31s and found all six required risks. The harness spent its
  budget on the test contract and shipped nothing runnable.
- **Larger work: the harness wins on quality and loses on cost.** ForgeSignal
  scored 100 against 90, with 54 passing tests against 41, and a project-wide
  check that vanilla failed. It used **5.4× the tokens**.
- **Small work: a tie.** The flamingo task met the same 13 requirements in both
  arms; the harness took 3.9× the wall clock and 5× the calls. Consistent with
  DiffSentinel's direction, less extreme because the task had no deadline.

So the honest guidance is: **do not use the pipeline for small tasks.** For large
ones, decide whether the quality difference is worth roughly five times the
tokens. For everything in between, `decant review` costs one call.

## What was done about it

DiffSentinel's own result document named the fix:

> the current fast lane needs a hard vertical-slice gate: a runnable CLI and
> fixture output must exist before expanding the test contract

That is now implemented as the fast lane. `--lane auto --time-budget-minutes N
--first-artifact path` collapses five model calls to two, makes the maker the
first call, and requires a non-empty content change at the declared artifact
inside 30% of the budget or the run stops. A live run on a small task:

```text
status: pass | invocations: 2/4
lane: fast | short-safe-budget
timeBudget: {"minutes":10,"milliseconds":600000,"firstArtifactWindowMs":180000}
firstArtifact gate: {"passed":true,"path":"src/fmt.mjs",
  "before":{"exists":false,"sha256":null,"bytes":0},
  "after":{"exists":true,"sha256":"12b82141…","bytes":539},
  "deadlineMs":180000,
  "reason":"declared primary artifact changed and is non-empty"}
```

83 seconds, two calls, the source file exists, six tests pass. Whether that
actually repairs the DiffSentinel condition is **unmeasured** — the fast lane has
not been re-run against that benchmark.

## Methodology worth copying

The July benchmarks are better designed than the flamingo comparison, and a
future run should use their shape:

- **A hidden evaluator with a 100-point rubric**, written before the runs. The
  flamingo comparison used a checklist written afterwards by the same person
  who ran it, and it produced two false failures on the first pass.
- **Identical starting tree**, recorded by commit hash.
- **A symmetric ceiling** on both arms, with both interrupted at the same point.
- **First write and first source-code write timestamps.** This is the metric that
  exposed the DiffSentinel failure; a score alone would only have said "zero".
- **Token counts**, recovered from the provider's own session snapshot. Decant
  cannot see tokens, so this has to come from outside it.
- **Tool event counts.**
- **Subagents and extra skills banned in both arms**, so the harness is the only
  variable.
- **Evaluated commit hashes recorded**, so the score is attached to a specific
  tree.

## What none of this establishes

- One run per condition. No variance, so a difference of ten points is not
  distinguishable from noise.
- Two of the three used one model at one effort level.
- The flamingo arm had no time ceiling, so its wall-clock ratio is not comparable
  to the other two.
- No currency figures anywhere. Token counts are not cost.
- ForgeSignal's harness arm also invoked a separately installed `unslop-ui` skill,
  so it measures a skill ecosystem rather than this repository alone. Its own
  result document says so.
