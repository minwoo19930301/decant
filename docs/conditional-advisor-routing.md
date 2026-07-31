# Conditional advisor routing

Status: implemented on the current development branch, not yet released.
Evidence snapshot: 2026-07-14.

## Decision

Rein keeps a cheap evidence-gathering stage first and spends the frontier
architect invocation only when the task or the gathered evidence justifies it.
The default `routing.advisorMode` is `conditional`:

1. The deterministic five-dimension assessment runs before any model call.
2. `scout` reads the workspace and writes `scout.json` with evidence and
   `open_questions`.
3. For an economy-tier task with no open questions, Rein writes a
   deterministic `architect.md` skip record and proceeds without a frontier
   architect call.
4. If the initial assessment is balanced/frontier, or an economy scout records
   an open question, the frontier architect is invoked as an advisor before
   mutation.
5. If an advisor is required but the invocation budget only covers mandatory
   stages, the run stops before `maker` instead of silently proceeding.

Completed runs record the decision, reason code, evidence counts, and invocation
budget in the manifest and HTML report. A budget-blocked run records them in the
manifest and event log before stopping, so it does not claim a completed HTML
report. This is a bounded routing policy, not a promise of lower token or
currency cost.

## What the source material actually supports

There are two different Anthropic patterns, and their model roles should not be
swapped:

- In the BrowseComp orchestration experiment, Claude Fable 5 was the
  orchestrator and Claude Sonnet 5 instances were workers. Lance Martin's
  200-question easier slice reported the same 95.9% accuracy for Sonnet alone,
  Fable alone, and the mixed setup, while the reported per-problem costs were
  $0.62, $1.19, and $1.97 respectively. In that slice, coordination added cost
  without improving the score. His
  reported full-set result was 86.8% at $18.53 per problem for the mixed setup,
  compared with 90.8% at $40.56 for Fable alone and 77.8% at $16.01 for Sonnet
  alone. That is the source of the rounded “96% of performance at 46% of cost”
  claim.
- In the Parameter Golf experiment, Sonnet 5 was the executor and Fable 5 was
  the advisor. The executor consulted the advisor for an initial plan and at
  two checkpoints during 20 experiments. The author reported that the mixed
  run captured about 90% of the Fable-only improvement at about 34% of its
  token cost. The author said the initial ranking was negatively correlated
  with observed outcomes and attributed most of the value to later course
  corrections.
- Anthropic's current Advisor tool quick start also places Sonnet 5 in the
  executor slot and Fable 5 in the advisor slot. Its documentation explicitly
  says results are task-dependent, discourages the pattern for simple
  single-turn work, recommends allowing orientation before a nudge, and
  provides call/output caps.

Therefore, the social reply that says “Executor: Fable 5 / Advisor: Sonnet 5”
is reversed for the Advisor pattern. It describes neither the official Advisor
quick start nor the Parameter Golf setup.

Primary references:

- [Lance Martin's cost-efficient harness experiment record](https://x.com/RLanceMartin/article/2075641284635799865)
- [Anthropic's orchestration announcement](https://x.com/ClaudeDevs/status/2074606058128224365)
- [Anthropic Advisor tool documentation](https://platform.claude.com/docs/en/agents-and-tools/tool-use/advisor-tool)
- [Anthropic plan-big/execute-small cookbook, pinned revision](https://github.com/anthropics/claude-cookbooks/blob/5d5b01402b1782712b6cf34220e2ceb22e6f2af5/managed_agents/CMA_plan_big_execute_small.ipynb)
- [OpenAI BrowseComp description](https://openai.com/index/browsecomp/)
- [OpenAI Parameter Golf repository](https://github.com/openai/parameter-golf)

## Limits of those claims

The figures above are first-party experiment reports, not a universal routing
law:

- OpenAI publishes 1,266 BrowseComp tasks, but the easy `BrowseComp200` slice
  used in the follow-up report is not a named public split in the standard
  evaluation repository. Its sampling procedure was not published.
- The reports do not provide repeated runs, confidence intervals, raw task
  logs, cache settings, or an independent replication.
- BrowseComp intentionally contains hard-to-find questions with short answers.
  OpenAI warns that its performance may not generalize to open-ended real user
  work.
- The Parameter Golf observation is one 20-experiment trajectory. The initial
  ranking and later course corrections are informative, but they do not prove
  that checkpoint advice caused the final result across workloads.

The attached Artificial Analysis chart is useful as a current benchmark prior,
not as a routing rule. Its Coding Agent Index v1.1 covers 321 tasks across
DeepSWE, Terminal-Bench v2, and SWE-Atlas-QnA with three repeats. Each public row
is a model plus agent harness and settings, not a model in isolation. The cost
axis represents API-token estimates for the benchmark configuration and does
not include engineering, supervision, recovery, or subscription costs. Rein
therefore does not convert a plotted score or dollar position into an automatic
model threshold. The screenshot's roughly $0–$4,000 scale also appears to be
the 321-task aggregate, inferred by multiplying Artificial Analysis's average
per-task costs, rather than the price of one request. Treat its effort labels as
a dated agent-configuration snapshot, not interchangeable model settings.
OpenAI's published table identifies the Index score of 80 as GPT-5.6 Sol at
`max` and does not publish a Sol `ultra` Index score; the screenshot's `Ultra`
label at 80 therefore must not be treated as canonical.

References for the graph:

- [Artificial Analysis Coding Agent Index methodology](https://artificialanalysis.ai/methodology/coding-agents-benchmarking)
- [Artificial Analysis Coding Agent Index](https://artificialanalysis.ai/agents/coding-agents/)
- [OpenAI GPT-5.6 launch results](https://openai.com/index/gpt-5-6/)

## What Rein cherry-picks

| Observed pattern | Rein expression | Reason |
|---|---|---|
| Cheap work should absorb most routine reading and generation. | `scout` stays economy/low and `maker` stays balanced by default. | Preserves the existing small role-based core without provider-specific names. |
| Premium judgment is valuable after orientation and at a direction choice. | The architect decision occurs after `scout.json`, not blindly before evidence. | The advisor gets task evidence and can be skipped when there is no unresolved question. |
| Easy tasks should not pay a fixed coordination tax. | Economy task plus zero scout questions skips one frontier invocation. | Removes only overhead that Rein can identify and measure today. |
| Required advice must fit the budget. | An unresolved question with no optional invocation headroom stops before mutation. | Avoids silently substituting an under-informed build for the promised checkpoint. |
| Routing changes need measurement. | `run.json`, `events.jsonl`, and `report.html` record decision, reason, question count, and invocation budget. | Makes `always`, `conditional`, and `never` modes comparable. |

Rein does **not** cherry-pick hard-coded Fable/Sonnet pairings, automatic
fan-out, a claim of 60% savings, live benchmark-driven model selection, or a
true mid-`maker` resume loop. The current maker is one ephemeral Codex
subprocess; pausing it twice for advice would require a transcript/resume
protocol and a materially larger executor design.

## Configuration and behavior

```json
{
  "routing": {
    "advisorMode": "conditional"
  }
}
```

| Mode | Economy task | Balanced/frontier task | Intended use |
|---|---|---|---|
| `conditional` | decide after scout; invoke only for open questions | invoke after scout | default evidence-gated policy |
| `always` | invoke | invoke | always-call comparison baseline and A/B control |
| `never` | skip | skip | cost floor experiment; unsafe as a universal default |

For an economy mutation task with deterministic Reader-10, the planned range
is now 4–5 Codex subprocess invocations instead of a fixed 5. With live
Reader-10 it is 14–26 instead of 15–26. These are subprocess counts, not token
or dollar estimates. The reviewer remains frontier-tier, so this change removes
at most the architect invocation; it does not make all simple work cheap.

## Evaluation before making stronger claims

Run the same representative task set under `always`, `conditional`, and
`never`, keeping model versions, effort, tools, cache state, and verification
commands fixed. Stratify results by economy/balanced/frontier assessment and by
whether scout left open questions. Record:

- acceptance-check and deterministic verification pass rate;
- retries, reviewer findings, and human rework;
- Rein subprocess invocations and stage latency;
- provider-reported input, cache, reasoning, and output tokens when an adapter
  can expose them;
- actual billed cost and cost per accepted outcome.

Until that forward evaluation exists, the defensible claim is narrow: Rein
can skip one frontier architect call when the policy finds no open scout
questions and can record that decision in its artifacts.
