# Decant architecture

Decant is a thin subprocess harness around the installed Codex CLI, built with
zero third-party npm runtime dependencies. It does not replace the agent
runtime, provide a second terminal interface, or maintain a hidden memory
database. A run writes inspectable artifacts beneath `.decant/runs/<id>/`.

## Stage backends

Version `0.1.1` was concretely Codex-runtime-only: `src/executor.mjs` started
`codex exec` for every model stage, `src/catalog.mjs` shelled out to
`codex debug models`, and configuration had model overrides but no notion of a
provider. `0.2` replaces that with one contract in `src/providers/contract.mjs`:

    runStage({ prompt, cwd, model, effort, sandbox, search,
               outputFile, outputSchema, timeoutMs })

plus `discoverCatalog()`. `src/pipeline.mjs` names no CLI; it resolves whichever
provider `config.provider` selected. Two implementations ship:

- `codex` — native `--output-last-message` and `--output-schema`, kernel
  sandbox, `codex debug models` discovery.
- `kiro` — Kiro CLI. No final-message channel and no schema flag, so the adapter
  fences the answer with sentinels and extracts it from the transcript, and
  carries the JSON schema in the prompt. Isolation is a tool allowlist.

The abstraction's job is **not** to make backends look alike. Providers declare
capabilities (`outputSchema: 'native' | 'prompted'`,
`sandbox: 'native' | 'tool-allowlist'`) and those declarations are recorded in
the run manifest, so a report cannot imply a guarantee the backend never made. A
prompted schema cannot refuse malformed output; a tool allowlist is not a
kernel-enforced sandbox.

The provider set is closed in code. Config selects a provider by id but cannot
supply an executable, for the same reason it cannot replace the model-catalog
command: a checked-in project file must not decide which binary runs.

Not implemented: direct Anthropic, OpenAI, xAI, or Gemini HTTP adapters, and
mixing providers within one run. The contract assumes a CLI subprocess that can
produce a final answer, so an HTTP provider would need to supply the workspace
file tools, shell execution, approval behavior, search, and tool-call loop that
a coding-agent CLI already provides.

Protocol compatibility alone is insufficient. Codex currently supplies the
workspace file tools, shell execution, sandbox and approval behavior, search,
tool-call loop, schema output, and catalog. A direct provider adapter must also
supply or connect to that workspace-agent runtime.

```text
request
  -> deterministic initial task assessment
  -> scout      catalog economy label / low / read-only
  -> advisor decision after scout evidence
     -> architect  catalog frontier label / max / read-only, or recorded skip
  -> maker      catalog balanced label / medium / workspace-write
  -> commands   only explicitly configured argv commands
  -> reviewer   model judgment / read-only
  -> explainer  plain-language summary / read-only
  -> Reader-10  structural rules by default, ten live calls per round on request
  -> self-contained HTML report
```

## Initial routing with one evidence checkpoint

Task difficulty alone is a poor proxy for a suitable role. Decant records five
scores from 0 to 3:

- `complexity`: expected synthesis or decomposition;
- `risk`: security, privacy, money, or production sensitivity;
- `blastRadius`: impact if the result is wrong;
- `verifiability`: availability of schemas, tests, and objective checks;
- `reversibility`: expected ease of undoing the action.

The router uses these values to build a bounded stage plan before execution.
After scout writes evidence, one conditional checkpoint may change the
architect from pending to invoked or skipped. Under the default policy,
balanced/frontier tasks always invoke it; economy tasks invoke it only when
scout records an open question. The decision and its invocation budget are
stored in the run manifest.

This is not general adaptive escalation. A test failure or model failure does
not dynamically select a new model tier, and the maker cannot pause and resume
around an advisor call. Failures are recorded and can stop or fail a run;
transcript-aware retry and mid-execution advice remain future work.

## Model labels come from metadata

Decant reads `codex debug models` and maps visible entries to `frontier`,
`balanced`, and `economy` using catalog descriptions, priority, supported
efforts, and user overrides. These labels are routing hints. Decant does not
measure current token price, latency, benchmark performance, or relative
intelligence, so `economy` does not mean provably cheapest or weakest and
`frontier` does not mean provably best for every task.

## Correctness signals and clarity signals

The pipeline keeps three different kinds of signal separate:

1. Verification commands record exit codes and bounded output. Commands run
   only when the user explicitly configures `{ "command", "args" }` entries;
   the default list is empty.
2. The reviewer is a model judgment over the plan, changes, and available
   command results. It is not a formal proof.
3. Reader-10 evaluates report presentation. It does not replace tests or the
   reviewer.

Deterministic Reader-10 is a reproducible set of structural heuristics covering
headings, length, terminology, links, action cues, and HTML accessibility. It
does not semantically understand the report. Live Reader-10 schedules ten
separate reader-model invocations per round. Those invocations may reuse one
model or related models, so their errors are not guaranteed to be independent.
The configured invocation limit counts Decant subprocess launches, not hidden
provider turns, tokens, or monetary cost.

## Artifact contract

A completed run contains an artifact hash map in `run.json` and can contain:

- `run.json`: task, selected model metadata, advisor decision/reason/evidence
  counts/budget, timestamps, gate results, artifact hashes, and status;
- `scout.json`, `architect.md`, `maker.md`, `reviewer.json`, and `summary.md`;
- `verification.json`: configured command argv, exit codes, durations, bounded
  logs, and truncation indicators;
- `readers.json`: persona results and the aggregate Reader-10 decision;
- `report.html`: standalone HTML with no external JavaScript and a strict CSP;
- `events.jsonl`: stage events.

The list is an execution-artifact contract, not a complete audit ledger. A
completed run hashes its files so `replay --frozen` can reject missing or
changed artifacts and copy the already-saved report without model calls.
`decant report` is the separate model-free re-render path and never
overwrites the frozen report. Neither command resumes a run or recreates its
original machine, toolchain, hooks, credentials, or remote model service.

## Process and safety boundary

Scout, architect, reviewer, explainer, and reader stages request read-only Codex
sandboxing. The maker requests workspace-write. Verification uses literal argv
without a shell, captures bounded output, and terminates the spawned process
group on POSIX timeout. Users must still choose verification executables they
trust.

Decant prompts do not authorize Git push, deployment, merge, purchase, or
other external publication. The effective boundary also depends on the local
Codex installation, configuration, hooks, MCP servers, credentials, and
operating system; Decant cannot independently constrain capabilities supplied
outside its subprocess arguments.

## Target portability boundary

Multi-provider and app support should preserve the artifact and safety contract
by separating four layers:

```text
workflow core
  -> provider/catalog adapter
  -> workspace-agent executor adapter
  -> common StageResult + artifact contract
  -> CLI / MCP / App Server / GUI surface adapter
```

The first useful extraction is a `CodexProfileAdapter`: discover a catalog and
execute a stage through a named Codex provider profile while validating model
effort, tool, search, and schema capabilities. Native xAI, Anthropic, or Gemini
adapters should only be labelled supported after end-to-end workspace tests,
not merely after a text response succeeds.

For app surfaces:

- a Skill can document and call `decant route/run/inspect`, but cannot by itself
  force the current Codex desktop task to switch models per stage;
- a Codex Plugin with a local stdio MCP server can expose `route`, `run`,
  `status`, `inspect`, and `report` as app tools while reusing the CLI engine;
- ChatGPT requires a remote MCP backend and optional Apps SDK UI; a web client
  does not gain direct access to a local Mac repository;
- a provider-neutral desktop GUI needs a local sidecar, while a Codex-native
  custom client can use Codex App Server.

These are roadmap boundaries, not features present in 0.1.1. See
[`lineage-and-portability.md`](./lineage-and-portability.md) for the complete
support matrix and official references.

## Version 0.1 omissions

- There are no direct provider adapters, per-stage provider selection, or
  mixed-provider runs.
- There is no Skill, Plugin, MCP server, Apps SDK UI, App Server client, or
  standalone GUI in the v0.1.1 release; current previews add Skill and Plugin
  bundles for Codex and Claude Code, plus Grok Build skill discovery via
  `.agents/skills`, still without MCP or a custom UI.
- Scout is not a dedicated crawler or browser-automation engine.
- There is no resume/checkpoint engine, `/goal` DSL, workflow scheduler, or
  durable state database.
- Routing has one post-scout advisor decision; it does not pause the maker or
  automatically escalate after observed failures.
- Model roles do not use live price or benchmark data.
- Deterministic Reader-10 is structural rather than semantic.
- Live Reader-10 costs ten model invocations per round and does not guarantee
  model diversity.
- Verification is explicit opt-in; Decant does not infer safe project commands.
- Run artifacts do not snapshot the entire machine, toolchain, or remote model
  service.
