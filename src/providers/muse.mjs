import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { buildCatalog, snapEffort } from '../catalog.mjs';
import { spawnCapture } from '../executor.mjs';
import { assertProvider, coerceToSchema, parseLooseJson } from './contract.mjs';

const EXECUTABLE = 'muse';

/**
 * Muse Spark advertises exactly these reasoning efforts on the Meta Model
 * API. `high` is the model default (confirmed by `muse model-profile show
 * muse-spark-1.3`). The Muse Code CLI flag also accepts `none`, `max`, and
 * `ultra`, but the API rejects them for Muse Spark — `none` is a 400 because
 * the model always reasons — so Decant snaps `max` and `ultra` down to
 * `xhigh` before the CLI sees them, the same treatment Grok 4.7 gets.
 */
export const MUSE_SPARK_ID = 'muse-spark-1.3';
export const MUSE_SPARK_EFFORTS = Object.freeze(['minimal', 'low', 'medium', 'high', 'xhigh']);

export const MUSE_SPARK_CATALOG_ENTRY = Object.freeze({
  id: MUSE_SPARK_ID,
  slug: MUSE_SPARK_ID,
  name: 'Muse Spark 1.3',
  display_name: 'Muse Spark 1.3',
  description: 'frontier flagship most capable. Advertised reasoning efforts: minimal, low, medium, high (default), xhigh.',
  priority: 1,
  visible: true,
  default_reasoning_level: 'high',
  supported_reasoning_levels: [...MUSE_SPARK_EFFORTS],
});

function isMuseSpark(id) {
  return id.startsWith('muse-spark');
}

export function resolveMuseEffort(model, effort) {
  const id = !model || model === 'auto' ? MUSE_SPARK_ID : String(model);
  if (!isMuseSpark(id)) return effort ?? null;
  if (!effort) return 'high';
  // `minimal` is on the model's menu but below Decant's own effort scale, so
  // snapEffort cannot rank it; it passes through as the API accepts it.
  if (MUSE_SPARK_EFFORTS.includes(effort)) return effort;
  return snapEffort(effort, MUSE_SPARK_EFFORTS);
}

/**
 * Muse Code runs an OS sandbox by default and this adapter never turns it
 * off: no `--yolo`, no `--disable-sandbox`. What Decant's levels map to is
 * the write surface on top of that sandbox. A read-only stage loses both
 * write channels — the workspace file tools (`--disable-write`) and the
 * shell (`--disable-shell`). A workspace-write stage keeps them.
 *
 * Approvals are `never` at both levels: a headless stage has nobody to
 * answer a prompt, so an approval the run needs is a refusal, not a wait.
 * The CLI's own `request_user_input` tool is withheld for the same reason;
 * questions in Decant travel through the pipeline, not the backend.
 */
const SANDBOX_FLAGS = Object.freeze({
  'read-only': ['--disable-write', '--disable-shell'],
  'workspace-write': [],
});

/** Build argv for one stage. Exported for tests. */
export function museArgs({
  model,
  effort,
  sandbox = 'read-only',
  search = false,
  promptFile,
  outputSchema,
}) {
  const sandboxFlags = SANDBOX_FLAGS[sandbox];
  if (!sandboxFlags) throw new RangeError(`muse provider does not support sandbox ${sandbox}`);
  if (!promptFile) throw new TypeError('muse provider requires a prompt file');
  const id = !model || model === 'auto' ? MUSE_SPARK_ID : String(model);
  const args = [
    'exec',
    '--json',
    '--prompt-file',
    promptFile,
    '--model',
    id,
    '--approval-mode',
    'never',
    '--disable-request-user-input',
    // Reminder agents are Muse Code's own background duties. In a stage run
    // they would add their tasks to the evidence stream and spend tokens on
    // work the pipeline did not ask for.
    '--disable-reminders',
    ...sandboxFlags,
  ];
  const resolvedEffort = resolveMuseEffort(id, effort);
  if (resolvedEffort) args.push('--reasoning-effort', resolvedEffort);
  if (!search) args.push('--disable-web-tools');
  if (outputSchema) args.push('--output-schema', outputSchema);
  return args;
}

/** Parse the JSONL event stream `muse exec --json` writes to stdout. */
export function parseMuseEvents(stdout) {
  const events = [];
  for (const line of String(stdout).split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      events.push(JSON.parse(trimmed));
    } catch {
      // Not every line on stdout is an event; a line that does not parse is
      // transcript noise, not the answer.
    }
  }
  return events;
}

/**
 * Recover the stage answer from the event stream.
 *
 * The session links exactly one primary run (`session.run.linked`), and the
 * answer is the concatenation of that run's `run.output.delta` text.
 * Subagent and reminder runs stream under their own run ids; their text is
 * not the stage answer and is skipped. The `turn.input.user` event carries
 * the prompt itself and is never an answer.
 */
export function museAnswer(events) {
  let primaryRunId;
  for (const event of events) {
    if (event?.payload_type === 'session.run.linked') {
      primaryRunId = event.payload?.run_stream?.id ?? primaryRunId;
    }
  }
  let text = '';
  for (const event of events) {
    if (event?.payload_type !== 'run.output.delta') continue;
    const payload = event.payload ?? {};
    if (primaryRunId && payload.run_stream?.id && payload.run_stream.id !== primaryRunId) continue;
    if (typeof payload.text === 'string') text += payload.text;
  }
  if (!text) {
    throw new Error('muse JSONL stream contained no run.output.delta text for the primary run');
  }
  return text;
}

export const museProvider = assertProvider({
  id: 'muse',
  displayName: 'Muse Code',
  executable: EXECUTABLE,
  capabilities: Object.freeze({
    outputSchema: 'native',
    sandbox: 'native',
    search: true,
  }),
  // There is no model-list command; this is the command that verifies the
  // pinned catalog entry against the installed CLI.
  catalogCommand: Object.freeze([EXECUTABLE, 'model-profile', 'show', MUSE_SPARK_ID]),
  async discoverCatalog({ overrides = {} } = {}) {
    // Muse Code exposes no way to list models, so the catalog is the
    // published Muse Spark entry, checked against
    // `muse model-profile show muse-spark-1.3` (default effort `high`).
    // Config overrides may still pin another model id, e.g. muse-spark-1.2.
    return buildCatalog([{ ...MUSE_SPARK_CATALOG_ENTRY }], { overrides });
  },
  async runStage({
    prompt,
    cwd,
    model,
    effort,
    sandbox,
    search,
    outputFile,
    outputSchema,
    timeoutMs,
    execute = spawnCapture,
  }) {
    const resolvedOutput = path.resolve(outputFile);
    const promptFile = `${resolvedOutput}.prompt`;
    await writeFile(promptFile, prompt, 'utf8');
    const resolvedSchema = outputSchema ? path.resolve(outputSchema) : undefined;
    const args = museArgs({
      model,
      effort,
      sandbox,
      search,
      promptFile,
      outputSchema: resolvedSchema,
    });
    const result = await execute(EXECUTABLE, args, { cwd, timeoutMs });
    if (result.code !== 0) {
      const error = new Error(
        `Muse stage failed (${result.code}): ${String(result.stderr ?? '').slice(-1200)}`,
      );
      error.result = result;
      throw error;
    }
    const answer = museAnswer(parseMuseEvents(result.stdout));
    if (!resolvedSchema) {
      await writeFile(resolvedOutput, answer.endsWith('\n') ? answer : `${answer}\n`, 'utf8');
      return result;
    }
    // The CLI shaped the answer with --output-schema; the coercion below is
    // the same drift repair the other native providers apply, so a key the
    // model spelled differently is renamed from the schema's vocabulary and
    // reported, never silently kept.
    const schema = JSON.parse(await readFile(resolvedSchema, 'utf8'));
    const { value, renamed } = coerceToSchema(parseLooseJson(answer), schema);
    await writeFile(resolvedOutput, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
    return { ...result, schemaRepairs: renamed };
  },
});
