# A/B: the same task, with and without the harness

Run on 2026-07-31. The point of this document is to be usable as evidence, so it
records what happened including the parts that do not favour Decant.

## Setup

Identical task in both arms, given verbatim from a file so the wording could not
drift:

> Build a small playable browser game in this repository where a flamingo is the
> protagonist. Single `index.html`, no build step, no network requests, no
> external assets. Flamingo drawn with canvas or CSS. Arrow keys or WASD. At
> least one hazard or goal. A visible score. Scoring rule in a separate
> `scoring.mjs` as a pure function, with `scoring.test.mjs` runnable by
> `node --test`. A "How to play" section in `README.md`. Under 400 lines.

Both arms started from the same empty repo (a `package.json` with
`test: node --test *.test.mjs`, and a one-line `README.md`).

- **Without the harness:** one `kiro-cli` invocation, `claude-sonnet-5` at
  medium effort, granted read, write, and shell tools.
- **With the harness:** `decant run` on the same task, Kiro provider,
  `claude-sonnet-5` for the working stages and `claude-haiku-4.5` for the cheap
  ones, `--budget-calls 6`, `--allow-verification-commands` with `npm test`
  configured.

The same model does the implementing in both arms, so the comparison is about the
harness, not the model.

## Result

| | without | with |
|---|---|---|
| wall clock | **78 s** | **305 s** (3.9×) |
| model invocations | **1** | **5** |
| stated requirements met (13 checks) | **13/13** | **13/13** |
| total non-blank lines | 371 | 261 |
| tests written | **11** | 7 |
| `npm test` | pass | pass |
| script syntax valid | yes | yes |
| artifacts left behind | none | 10 files + `report.html` |
| run verdict | n/a (exit 0) | `warn` |

The checklist is in `scripts` history as a throwaway; it checked file existence,
absence of network or external assets, canvas/CSS drawing, key handling, a
win/lose state, a visible score, `scoring.mjs` exporting a pure function with no
DOM references, `index.html` importing it, `node:test` usage, a "How to play"
section, and the line budget.

**On the stated requirements, it is a tie.** The harness did not produce a better
game. It produced a slightly smaller one with fewer tests, four times slower, for
five times the model calls.

## The one real difference

The harness's reviewer stage flagged this, at `low` severity:

> `index.html` uses `<script type="module">` importing `./scoring.mjs`; this works
> when opened via `file://` in current major browsers, but module script CORS
> restrictions on `file://` have historically varied by browser/version, so
> "just double-click it" may not work in 100% of browsers.

That is a real defect against the task's first requirement — "works by opening it
directly in a browser, no build step". Module scripts are fetched with CORS and a
`file://` origin is opaque, so the relative import is blocked.

**Both arms shipped this bug.** Only one of them told us:

```
without:  <script type="module">  import { applyEvent, … } from "./scoring.mjs"   — unflagged
with:     <script type="module">  import { addFood, … }   from './scoring.mjs'    — flagged
```

So the honest summary of the value on this task is: one paragraph of correct
review, for 227 extra seconds and four extra model calls. Whether that trade is
worth it depends entirely on the cost of shipping the defect.

## What did not go well

- **The harness's verdict was `warn`, and the reason was its own writing.** All
  five stages passed, `npm test` passed, the reviewer passed — but the generated
  report scored 5 of 10 clarity personas, so the run is not `pass`. The most
  prominent output of the run is a complaint about the report's prose.
- **The reviewer could not re-run the tests itself.** Its other finding was that
  `execute_bash` was unavailable to it, so it relied on the recorded
  `verification.json` and static reading. A read-only reviewer is by design, but
  it means the reviewer's "pass" is a reading, not a re-execution.
- **The unharnessed run wrote more tests** — 11 against 7 — and a longer, more
  documented `scoring.mjs`.

## What this exercise cost the harness

Running this comparison found three real bugs in Decant, all of which had been
unreachable because every pipeline test injects a fake backend:

1. A prompted schema is not an enforced schema: the scout spelled a key
   `openquestions` where the schema says `open_questions` and the run died.
2. The clarity gate counted `<img …>` quoted inside the maker's write-up as
   images in the report, and failed the run for missing alt text.
3. The image pattern's attribute span crossed newlines, so the prose sentence
   "Grepped index.html for `http://`, `<img`, `fetch(`" consumed a later `>` and
   became an image element.

The first attempt at this A/B failed outright. The second failed on a false
positive. The third produced the numbers above. That is worth stating plainly:
on this evidence the harness is less mature than the CLI it wraps.

## What this does not tell you

- One task, one model, one machine, one run per arm. No repetition, so the timing
  and the quality difference are both single samples.
- The task was small and low-risk. The harness's routing exists for the opposite
  case, and this A/B says nothing about it.
- No token or currency figures. Decant cannot see either.
- Nobody played either game in a browser. Both were checked mechanically and by
  syntax, which is exactly how the `file://` defect survived to be found by
  reading rather than by running.
