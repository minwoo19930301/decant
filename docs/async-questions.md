# Async questions

Decant can post questions while independent, read-only planning continues.
The CLI uses a durable local queue: answer from another terminal in the same
workspace, without keeping an interactive input prompt open.

```sh
decant run "Implement the requested CLI flag" --question-mode async

# In another terminal, use the run ID printed with the questions.
decant questions "<run-id>"
decant answer "<run-id>" "<question-id>" "Support Node 22"
```

`decant questions` uses the latest run when its ID is omitted. Both `questions`
and `answer` support `--json`. Suggested options are hints; answers accept free
text. An answer is explicit and durable: repeating the same answer is allowed,
but replacing an already recorded answer is rejected.

Async mode is the default. Set `questions.mode` in `decant.config.json` to
`"async"` or `"off"`, or override it for a run with `--question-mode off`.
Off mode creates no question queue or notifications and does not apply the
question dependency gate. Other routing, permission, and verification rules
still apply. Dry runs do not execute scout or post questions.

The scout may return up to three structured questions with an ID, title,
optional choices, an explicit `required` boolean, and an optional
`assumption` string with a `reversible` boolean (`null` when unused). Structured questions take
precedence over legacy `open_questions` strings, including an empty structured
array. Legacy output contributes at most its first three questions, all optional.
The fast lane skips the scout model stage, so it generates no question queue.
The native output schema requires `questions` (use `[]` for none) and each
question's `options`, `assumption` and `reversible` (use `null` for none). The
queue normalizes null values to omitted fields. Legacy artifacts may omit all of
them.

Questions are saved and printed before the read-only architect stage. Decant
refreshes answers immediately before the maker:

- Required questions are prerequisites for edits. If maker is enabled and any remain unanswered,
  the run finishes with status `waiting`, exit code **4**, a frozen report, and
  a released workspace lock. Maker, verification, and later model stages have
  not run.
- Optional questions allow work to continue. Stage prompts require concrete
  assumptions and disclosure of unresolved questions.

Decant never writes an assumption itself. It does not pick the first suggested
choice and does not supply a fixed sentence. The only assumption that exists is
one the scout model wrote for a question it also marked `reversible: true`,
and only when that question is not `required`. A required question stays a
blocking prerequisite even if the model supplied an assumption; the assumption
is dropped. A question without a model-written assumption behaves exactly as
before: it is listed as pending, the stage prompt asks the stage to state its own
assumptions, and nothing is recorded as a default.

A recorded assumption is shown by `decant questions` as an assumption, passed to
the maker, reviewer and explainer prompts as a reversible working assumption to
name in their output, and kept in the question store. It is never recorded as
an answer, the question stays pending, and silence is not consent. There are no
automatic answers or timeout consent. A question store written by an earlier
version has no assumption, and reading it does not add one. Normal
invocation budgets and advisor policy still apply; an unfunded required advisor
can stop the run before it reaches the question gate.

When an answer arrives for a question that has a model-written assumption,
`decant questions` and `decant answer` compare them. Both are trimmed,
lower-cased and have runs of whitespace collapsed; for an option question,
each side is first mapped to the option it names, so the chosen option is what is
compared. Wording or spacing differences alone do not count as a change. If the
answer still differs, Decant reads the run's `events.jsonl` and lists the stages
that started after the question was recorded and before the answer arrived,
limited to maker, reviewer and explainer, the stages that act on an assumption.
Scout and architect only plan read-only, and a stage that starts after the answer
reads the answer instead. Only then does it print the `decant resume` command.
An answer that arrives before maker starts, or while the run is waiting,
affects no stage, so nothing is listed and no resume is suggested. The list is
computed when the command runs from the run record and is not stored in the
queue. `--json` adds an `assumptionReview` array only when such a comparison
exists. Resume still starts a new child run; it does not edit the parent.

Answers received before maker starts can inform implementation. Later answers
can inform the subsequent reviewer and explainer when those stages refresh
their context. They do not revise edits already made or restart a completed
stage. Answers are passed as quoted, untrusted task context and do not grant
additional tool permissions or publication authority.

To continue after waiting, answer every required question, then run:

```sh
decant resume "<run-id>" --dry-run --allow-verification-commands
decant resume "<run-id>" --budget-calls 8 --allow-verification-commands
```

`resume` starts a **new child run**, using the original task, recorded human
answers, current workspace, current configuration, and a fresh invocation
budget. It reruns the pipeline; it does not restore a paused process or skip
straight to maker. The budget must cover the new plan. Configured verification
commands require a fresh `--allow-verification-commands` opt-in. Without
`--budget-calls`, the current configured limit applies.

Resume accepts a frozen `waiting`, `pass`, or `warn` parent with at least one
recorded answer and no required answers outstanding. It verifies the parent's
artifact hashes, original task identity, and question definitions before starting.
Definitions are also checked at every live refresh, so changing a required
question into an optional one cannot bypass the gate. Omitting the run ID
selects the latest run; use an explicit ID when several runs exist.

The mutable queue lives at `.decant/questions/<run-id>.json`, outside frozen run
artifacts. Runs reaching the maker boundary record the exact context in
`.decant/runs/<run-id>/questions.json`. Later stage reads use separate
`questions.reviewer.json` and `questions.explainer.json` snapshots. Answers posted
after completion update only the queue. Resume records `parentRunId` and copies
answer context into the child's evidence; the parent's report, manifest, and
snapshots remain unchanged.

A host-native async-question skill is a separate interaction mechanism. It
uses the host's available question tools during an agent conversation. It does
not automatically create, synchronize with, or resume Decant's CLI queue.
