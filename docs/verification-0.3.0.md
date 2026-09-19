# Decant 0.3.0 validation

Checked on September 19, 2026, on macOS with Node 26.4.0 and Codex CLI 0.153.4.
This records compatibility and behavior checks, not a performance benchmark.

## Automated checks

- `npm run check`: 211 tests passed, 0 failed; syntax checked all 44 JavaScript
  modules; the eight-skill pack passed validation.
- The updated spec and orchestrate skills also passed the skill-creator
  frontmatter/instruction validator.
- `npm run verify:package`: packs `decant-0.3.0.tgz`, installs it in a fresh
  directory, reruns the check suite from the installed package, and invokes the
  installed CLI's help command.

New behavior coverage includes answers from a second Node process while planning
continues; required-answer gates; lock release; immutable stage snapshots;
late-answer visibility; a new child run on resume; frozen parent preservation;
task/definition tamper rejection; API request formatting, validation, timeouts,
and fallback; and preservation of read-only and verification permission rules.
Pipeline tests use fake coding backends. Jev tests use mocked HTTP responses.

## Live Codex scout

One successful call used the actual provider adapter with `gpt-5.6-luna`, low
effort, native read-only sandbox, and the updated scout output schema in an
isolated temporary workspace. It exited 0 in 8.643 seconds, without a timeout.
The synthetic task produced these questions:

```json
[
  {
    "id": "format",
    "title": "What output format should the CLI use?",
    "options": ["CSV", "JSON"],
    "required": true
  },
  {
    "id": "label",
    "title": "What optional display label should be used?",
    "options": null,
    "required": false
  }
]
```

The queue normalizer accepted both questions and omitted the null choices. Two
earlier attempts exposed native schema restrictions: `uniqueItems` was rejected,
and every property had to be included in `required`. The final schema removes
that keyword, requires the question fields, and uses nullable choices. Runtime
validation still rejects duplicate choices. Regression tests preserve this
contract while accepting legacy artifacts without structured questions.

This was a live scout compatibility check, not a complete live maker/reviewer
pipeline or a new Kiro end-to-end test.

## Jev and local CLI

`decant doctor --json` successfully discovered the installed Codex backend and
its model catalog. Jev reported `keyConfigured: false`. With no TypeSafe key,
`route --jev --json` returned `missing_api_key`, made zero requests, and retained
the deterministic route. `run --dry-run --jev` reported `skipped` and zero
requests.

The implementation follows the published [TypeSafe API](https://docs.typesafe.ai/api)
and pins `jev-1.13.0` from the [model list](https://docs.typesafe.ai/models).
No authenticated hosted Jev call was performed; live availability, accuracy,
latency, and cost remain unmeasured. See [Jev configuration and limits](jev.md).
