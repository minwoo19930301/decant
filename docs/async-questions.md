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
optional choices, and an explicit `required` boolean. Structured questions take
precedence over legacy `open_questions` strings, including an empty structured
array. Legacy output contributes at most its first three questions, all optional.
The fast lane skips the scout model stage, so it generates no question queue.
The native output schema requires `questions` (use `[]` for none) and each
question's `options` (use `null` for no suggested choices). The queue normalizes
null choices to an omitted field. Legacy artifacts may omit both fields.

Questions are saved and printed before the read-only architect stage. Decant
refreshes answers immediately before the maker:

- Required questions are prerequisites for edits. If maker is enabled and any remain unanswered,
  the run finishes with status `waiting`, exit code **4**, a frozen report, and
  a released workspace lock. Maker, verification, and later model stages have
  not run.
- Optional questions allow work to continue. Stage prompts require concrete
  assumptions and disclosure of unresolved questions.

There are no automatic answers, selected defaults, or timeout consent. Normal
invocation budgets and advisor policy still apply; an unfunded required advisor
can stop the run before it reaches the question gate.

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
