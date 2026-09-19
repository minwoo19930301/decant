# Optional Jev routing advice

Decant can ask TypeSafe's Jev for a typed judgment before building a run plan. Codex or Kiro still executes the coding stages. Jev selects a capability tier and estimates risk and missing information; it does not generate code or plans. See TypeSafe's [introduction](https://docs.typesafe.ai/introduction) and [HTTP API reference](https://docs.typesafe.ai/api).

## Enable a request explicitly

Set `TYPESAFE_API_KEY` in the environment of the process running Decant, then add `--jev` to the command that should make a request:

```sh
decant doctor --json
decant route "Fix the CLI argument parser" --jev --json
decant run "Fix the CLI argument parser" --jev --budget-calls 30
decant resume 20260919T120000000Z-12345678 --jev --budget-calls 30
```

The run ID above is an example; use the ID printed by your run. Resume requires recorded human answers and verifies the frozen parent before creating a new child run. See [asynchronous questions](async-questions.md).

Setting the key or adding a `judgment` configuration section does not enable requests. Each `route`, `run`, or `resume` invocation needs its own `--jev`. In particular, `route --jev` makes a real request even though it only prints a plan.

Dry runs skip the Jev request:

```sh
decant run "Fix the CLI argument parser" --jev --dry-run
decant resume 20260919T120000000Z-12345678 --jev --dry-run
```

These show the judgment as `skipped`, with reason `dry-run` and `requestCount: 0`, without creating a run. They still perform the normal local configuration, catalog, and plan checks. `doctor` reports a `judgment.keyConfigured` boolean; this checks whether the environment variable is nonempty, not whether the key authenticates. Doctor does not call Jev or display the key.

## Request and data boundary

The implementation sends one POST to `https://api.typesafe.ai/v1/systemone`, using `Authorization: Bearer` and the environment key. The endpoint is fixed and redirects are rejected. `TYPESAFE_BASE_URL`, other providers' keys, and arbitrary endpoints are not supported by this integration.

The request's `state` is the CLI task text. Decant also sends its fixed questions and selected model ID. It does not read or attach repository files, command output, configuration contents, or other environment variables to this request. On resume, Jev receives the original task text; human answers are not added to the Jev state. Anything you include in the task text itself is transmitted to TypeSafe.

All three questions share one request:

| Question | Type | Result used by Decant |
| --- | --- | --- |
| `route` | Choice | One of `economy`, `balanced`, or `frontier`, with probabilities and confidence |
| `risk` | Noul | Probability of a consequential operation, from 0 to 1 |
| `clarification` | Noul | Probability that essential task information is missing, from 0 to 1 |

Noul has no separate confidence field. `clarificationProbability` is recorded as advisory metadata only: it does not automatically post questions, invent answers, or block the run. The scout's structured questions drive the separate question workflow. The integration does not use Score. See the official [Choice](https://docs.typesafe.ai/primitives/choice), [Noul](https://docs.typesafe.ai/primitives/noul), and [Score](https://docs.typesafe.ai/primitives/score) contracts.

## Configuration and accounting

The default configuration pins `jev-1.13.0`:

```json
{
  "version": 1,
  "judgment": {
    "model": "jev-1.13.0",
    "timeoutMs": 3000,
    "minConfidence": 0.8
  }
}
```

Merge this section into `decant.config.json`. It contains no API key. The accepted configuration is:

| Setting | Limit |
| --- | --- |
| `model` | `jev-latest`, `jev-preview`, or a version shaped like `jev-1.13.0`; at most 128 characters |
| `timeoutMs` | Integer from 100 to 30,000 milliseconds |
| `minConfidence` | Finite number from 0.5 to 1 |

TypeSafe's [model list](https://docs.typesafe.ai/models) identified `jev-1.13.0` as the current version when checked on September 19, 2026. Aliases can change; a syntactically valid version is not proof that the service offers it.

The default timeout is three seconds and covers both the request and response-body consumption. Decant makes at most one Jev request per opted-in command, with no retries. Blank task text or text exceeding 64,000 JavaScript string characters does not produce a request; the deterministic route remains available.

Jev requests are separate from the coding-stage invocation budget. `--budget-calls` limits Codex or Kiro stage invocations; it does not include the Jev request. Judgment metadata records `requestCount`, latency, resolved model, reason code, and validated token usage when available. A run stores that metadata in its manifest and `judgment.json`; it does not retain authorization headers or raw API errors.

## How advice affects a route

Decant computes its deterministic route first. A sufficiently confident Jev route can raise its capability tier, but cannot lower it. Below `minConfidence`, the route recommendation is null. Independently, a risk probability of at least 0.8 raises the risk assessment to the highest level. Applying either escalation selects the full lane, so Jev can promote a fast plan to a full plan.

The resulting plan must still fit the configured invocation budget. If it does not, Decant refuses to start instead of bypassing the budget. The read-only classification, write restrictions, and explicit verification-command opt-in remain in force. No Jev answer grants permission to publish, deploy, change account permissions, or execute an otherwise unauthorized action.

Responses are checked for required typed answers, allowed roles, finite values, complete probability maps that sum to one, a selected maximum-probability option, and valid token counts. Missing keys, timeouts, HTTP errors, network failures, redirects, and malformed responses produce an `unavailable` judgment and preserve the deterministic route. Raw server error text is not included in that result.

TypeSafe documents susceptibility to adversarial task content and other [Jev 1.13 limitations](https://docs.typesafe.ai/model-jaggedness/jev-1.13). Its [confidence guidance](https://docs.typesafe.ai/confidence) recommends evaluating thresholds on the workload. The defaults here are routing policy, not a measured accuracy guarantee.

## Validation status

Local tests use mocked HTTP responses to verify the official wire shape, validation, fallback, redirect handling, and deadlines, including a hung response body. No successful authenticated call to the hosted TypeSafe API was used to validate this integration. A configured key indicator or passing mocked tests must not be reported as a successful live API test.
