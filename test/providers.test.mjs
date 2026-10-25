import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  assertProvider,
  catalogFromIds,
  extractOutput,
  OUTPUT_BEGIN,
  OUTPUT_END,
  parseLooseJson,
  wrapPrompt,
} from '../src/providers/contract.mjs';
import { discoverKiroModels, kiroArgs, kiroProvider } from '../src/providers/kiro.mjs';
import { codexProvider } from '../src/providers/codex.mjs';
import {
  GROK_47_EFFORTS,
  discoverGrokModels,
  grokAnswer,
  grokArgs,
  grokCost,
  grokProvider,
  parseGrokModelIds,
} from '../src/providers/grok.mjs';
import {
  MUSE_SPARK_EFFORTS,
  museAnswer,
  museArgs,
  museProvider,
  parseMuseEvents,
  resolveMuseEffort,
} from '../src/providers/muse.mjs';
import { DEFAULT_PROVIDER, PROVIDER_IDS, resolveProvider } from '../src/providers/index.mjs';

test('every registered provider satisfies the stage contract', () => {
  assert.deepEqual(PROVIDER_IDS, ['codex', 'kiro', 'grok', 'muse']);
  for (const id of PROVIDER_IDS) {
    const provider = assertProvider(resolveProvider(id));
    assert.equal(provider.id, id);
    assert.ok(provider.executable);
    assert.ok(provider.capabilities.sandbox);
  }
  assert.equal(resolveProvider(), resolveProvider(DEFAULT_PROVIDER));
  assert.throws(() => resolveProvider('anthropic'), /supported: codex, kiro, grok, muse/);
});

test('providers declare what they can and cannot enforce', () => {
  // The point of the abstraction is not that backends look alike. It is that
  // the difference is visible: Codex enforces a schema and a sandbox, the Kiro
  // adapter asks for a schema and grants tools.
  assert.equal(codexProvider.capabilities.outputSchema, 'native');
  assert.equal(codexProvider.capabilities.sandbox, 'native');
  assert.equal(kiroProvider.capabilities.outputSchema, 'prompted');
  assert.equal(kiroProvider.capabilities.sandbox, 'tool-allowlist');
  assert.equal(grokProvider.capabilities.outputSchema, 'native');
  assert.equal(grokProvider.capabilities.sandbox, 'fail-open');
  assert.equal(museProvider.capabilities.outputSchema, 'native');
  assert.equal(museProvider.capabilities.sandbox, 'native');
});

test('sandbox levels map to tool grants, and unknown levels are refused', () => {
  const readOnly = kiroArgs({ model: 'm', effort: 'low', sandbox: 'read-only', prompt: 'p' });
  assert.ok(readOnly.includes('--trust-tools=fs_read'));
  const write = kiroArgs({ model: 'm', effort: 'low', sandbox: 'workspace-write', prompt: 'p' });
  assert.ok(write.includes('--trust-tools=fs_read,fs_write,execute_bash'));
  const searching = kiroArgs({ model: 'm', effort: 'low', sandbox: 'read-only', search: true, prompt: 'p' });
  assert.ok(searching.includes('--trust-tools=fs_read,web_search,web_fetch'));
  assert.throws(
    () => kiroArgs({ model: 'm', sandbox: 'danger-full-access', prompt: 'p' }),
    /does not support sandbox danger-full-access/,
  );
});

test('the auto sentinel is never passed through as a model name', () => {
  assert.ok(!kiroArgs({ model: 'auto', prompt: 'p' }).includes('auto'));
  assert.ok(kiroArgs({ model: 'claude-opus-5', prompt: 'p' }).includes('claude-opus-5'));
});

test('a prompted schema travels in the prompt and the answer is fenced by sentinels', () => {
  const wrapped = wrapPrompt('Do the thing.', { schema: { type: 'object' } });
  assert.match(wrapped, /Do the thing\./);
  assert.match(wrapped, /"type": "object"/);
  assert.ok(wrapped.includes(OUTPUT_BEGIN) && wrapped.includes(OUTPUT_END));
});

test('extractOutput takes the last block and survives quoted transcript lines', () => {
  const transcript = [
    'tool log noise',
    `${OUTPUT_BEGIN}`,
    'the instructions quoted back',
    `${OUTPUT_END}`,
    ' ▸ running a tool',
    `> ${OUTPUT_BEGIN}`,
    '> real answer line one',
    '> line two',
    `${OUTPUT_END}`,
    ' ▸ Credits: 0.02',
  ].join('\n');
  assert.equal(extractOutput(transcript).output, 'real answer line one\nline two');
  assert.equal(extractOutput(transcript).fallback, false);
  assert.throws(() => extractOutput('no sentinels here'), /did not contain a Decant sentinel block/);
});

test('a missing sentinel falls back to the outermost JSON object, but only for JSON', () => {
  // A live run lost an entire reviewer stage this way: the model answered well
  // and simply did not emit the sentinels.
  const transcript = ' > running a tool\nHere is the review:\n{"verdict":"pass","findings":[]}\nCredits: 0.4';
  const recovered = extractOutput(transcript, { expect: 'json' });
  assert.equal(recovered.fallback, true);
  assert.deepEqual(JSON.parse(recovered.output), { verdict: 'pass', findings: [] });

  // Prose has no self-delimiting shape, so keeping the transcript would corrupt
  // the artifact instead of failing the stage.
  assert.throws(
    () => extractOutput('a long prose answer with tool logs and no sentinels', { expect: 'text' }),
    /did not contain a Decant sentinel block/,
  );
});

test('a provider without capability metadata still gets labelled roles, marked heuristic', () => {
  const models = catalogFromIds(['auto', 'claude-opus-5', 'claude-sonnet-5', 'claude-haiku-4.5', 'glm-5']);
  assert.ok(!models.some((model) => model.id === 'auto'), 'auto is a sentinel, not a model');
  const opus = models.find((model) => model.id === 'claude-opus-5');
  assert.match(opus.description, /frontier/);
  assert.match(opus.description, /heuristic label/);
  const glm = models.find((model) => model.id === 'glm-5');
  assert.match(glm.description, /no capability metadata/);
});

test('model discovery parses the probe listing and reports an unreadable probe', async () => {
  const ids = await discoverKiroModels(async () => ({
    stdout: "error: Model 'x' does not exist. Available models: auto, claude-opus-5, glm-5\n",
    stderr: '',
  }));
  assert.deepEqual(ids, ['auto', 'claude-opus-5', 'glm-5']);
  await assert.rejects(
    () => discoverKiroModels(async () => ({ stdout: 'unexpected', stderr: '' })),
    /could not read the kiro-cli model list/,
  );
});

test('a stage writes only the extracted answer to the output file', async (t) => {
  const sandbox = await mkdtemp(path.join(tmpdir(), 'decant-provider-'));
  t.after(() => rm(sandbox, { recursive: true, force: true }));
  const schemaFile = path.join(sandbox, 'schema.json');
  const outputFile = path.join(sandbox, 'stage.json');
  await writeFile(schemaFile, JSON.stringify({ type: 'object' }), 'utf8');

  let seen;
  await kiroProvider.runStage({
    prompt: 'summarise',
    cwd: sandbox,
    model: 'claude-haiku-4.5',
    effort: 'low',
    sandbox: 'read-only',
    outputFile,
    outputSchema: schemaFile,
    timeoutMs: 1_000,
    execute: async (command, args) => {
      seen = { command, args };
      return {
        code: 0,
        stdout: `noise\n${OUTPUT_BEGIN}\n{"ok":true}\n${OUTPUT_END}\ntrailing credits\n`,
        stderr: '',
      };
    },
  });
  assert.equal(seen.command, 'kiro-cli');
  assert.match(seen.args.at(-1), /"type": "object"/, 'the schema must reach the model');
  assert.equal(await readFile(outputFile, 'utf8'), '{\n  "ok": true\n}\n');
});

test('a drifted key is renamed from the schema, and the rename is reported', async (t) => {
  const sandbox = await mkdtemp(path.join(tmpdir(), 'rein-provider-'));
  t.after(() => rm(sandbox, { recursive: true, force: true }));
  const schemaFile = path.join(sandbox, 'schema.json');
  const outputFile = path.join(sandbox, 'scout.json');
  await writeFile(schemaFile, JSON.stringify({
    type: 'object',
    required: ['summary', 'open_questions'],
    properties: {
      summary: { type: 'string' },
      open_questions: { type: 'array', items: { type: 'string' } },
    },
  }), 'utf8');

  // A live run produced exactly this: every value correct, one key spelled
  // `openquestions`, and the whole stage rejected for it.
  const result = await kiroProvider.runStage({
    prompt: 'scout',
    cwd: sandbox,
    outputFile,
    outputSchema: schemaFile,
    timeoutMs: 1_000,
    execute: async () => ({
      code: 0,
      stdout: `${OUTPUT_BEGIN}\n\`\`\`json\n{"summary":"s","openquestions":["q"]}\n\`\`\`\n${OUTPUT_END}\n`,
      stderr: '',
    }),
  });
  const written = JSON.parse(await readFile(outputFile, 'utf8'));
  assert.deepEqual(written, { summary: 's', open_questions: ['q'] });
  assert.deepEqual(result.schemaRepairs, ['openquestions -> open_questions']);
});

test('a missing key stays missing rather than being invented', async (t) => {
  const sandbox = await mkdtemp(path.join(tmpdir(), 'rein-provider-'));
  t.after(() => rm(sandbox, { recursive: true, force: true }));
  const schemaFile = path.join(sandbox, 'schema.json');
  const outputFile = path.join(sandbox, 'scout.json');
  await writeFile(schemaFile, JSON.stringify({
    type: 'object',
    required: ['summary', 'facts'],
    properties: { summary: { type: 'string' }, facts: { type: 'array' } },
  }), 'utf8');

  await kiroProvider.runStage({
    prompt: 'scout',
    cwd: sandbox,
    outputFile,
    outputSchema: schemaFile,
    timeoutMs: 1_000,
    execute: async () => ({
      code: 0,
      stdout: `${OUTPUT_BEGIN}\n{"summary":"s"}\n${OUTPUT_END}\n`,
      stderr: '',
    }),
  });
  // Fabricating `facts: []` would turn a visible stage failure into a silent
  // one, so the gap is left for the pipeline's validator to reject.
  assert.deepEqual(JSON.parse(await readFile(outputFile, 'utf8')), { summary: 's' });
});

test('a nonzero stage exit becomes an error carrying the captured result', async (t) => {
  const sandbox = await mkdtemp(path.join(tmpdir(), 'decant-provider-'));
  t.after(() => rm(sandbox, { recursive: true, force: true }));
  await assert.rejects(
    () => kiroProvider.runStage({
      prompt: 'p',
      cwd: sandbox,
      outputFile: path.join(sandbox, 'out.md'),
      timeoutMs: 1_000,
      execute: async () => ({ code: 3, stdout: '', stderr: 'boom' }),
    }),
    (error) => {
      assert.match(error.message, /Kiro stage failed \(3\)/);
      assert.equal(error.result.code, 3);
      return true;
    },
  );
});

test('grok model listing keeps every Grok 4.7 effort on that model', () => {
  assert.deepEqual(
    parseGrokModelIds('Default model: grok-4.7\n\nAvailable models:\n  * grok-4.7 (default)\n'),
    ['grok-4.7'],
  );
  assert.deepEqual([...GROK_47_EFFORTS], ['low', 'medium', 'high', 'xhigh']);
});

test('grok passes each advertised effort and snaps max down to xhigh', () => {
  for (const effort of GROK_47_EFFORTS) {
    const args = grokArgs({
      model: 'grok-4.7',
      effort,
      sandbox: 'read-only',
      promptFile: 'prompt.txt',
    });
    assert.ok(args.includes('--reasoning-effort'));
    assert.equal(args[args.indexOf('--reasoning-effort') + 1], effort);
  }
  const snapped = grokArgs({
    model: 'auto',
    effort: 'max',
    sandbox: 'workspace-write',
    search: true,
    promptFile: 'prompt.txt',
    schemaText: '{"type":"object"}',
  });
  assert.equal(snapped[snapped.indexOf('--model') + 1], 'grok-4.7');
  assert.equal(snapped[snapped.indexOf('--reasoning-effort') + 1], 'xhigh');
  assert.ok(snapped.includes('--permission-mode'));
  assert.equal(snapped[snapped.indexOf('--permission-mode') + 1], 'acceptEdits');
  assert.ok(!snapped.includes('--disable-web-search'));
  assert.ok(snapped.includes('--json-schema'));
  assert.throws(
    () => grokArgs({ model: 'grok-4.7', sandbox: 'danger-full-access', promptFile: 'p' }),
    /does not support sandbox danger-full-access/,
  );
});

test('grok discovery attaches the full effort menu and a stage writes the JSON text', async (t) => {
  const ids = await discoverGrokModels(async () => ({
    stdout: 'Available models:\n  * grok-4.7 (default)\n',
    stderr: '',
  }));
  assert.deepEqual(ids, ['grok-4.7']);
  const catalog = await grokProvider.discoverCatalog({
    execute: async () => ({
      stdout: 'Available models:\n  * grok-4.7 (default)\n',
      stderr: '',
    }),
  });
  assert.deepEqual(catalog.roles.frontier.supportedEfforts, [...GROK_47_EFFORTS]);
  assert.equal(catalog.roles.frontier.effort, 'xhigh');
  assert.equal(catalog.roles.balanced.effort, 'medium');
  assert.equal(catalog.roles.economy.effort, 'low');

  const sandbox = await mkdtemp(path.join(tmpdir(), 'decant-grok-'));
  t.after(() => rm(sandbox, { recursive: true, force: true }));
  const outputFile = path.join(sandbox, 'stage.md');
  let seen;
  await grokProvider.runStage({
    prompt: 'say pong',
    cwd: sandbox,
    model: 'grok-4.7',
    effort: 'low',
    sandbox: 'read-only',
    outputFile,
    timeoutMs: 1_000,
    execute: async (command, args) => {
      seen = { command, args };
      return { code: 0, stdout: '{"text":"pong","stopReason":"end_turn"}\n', stderr: '' };
    },
  });
  assert.equal(seen.command, 'grok');
  assert.equal(seen.args[seen.args.indexOf('--reasoning-effort') + 1], 'low');
  assert.equal(seen.args[seen.args.indexOf('--permission-mode') + 1], 'plan');
  assert.equal(await readFile(outputFile, 'utf8'), 'pong\n');
});

test('grok CLI 1.0.52 structuredOutput wins over concatenated text, and the last object is kept', async (t) => {
  const progress = '{"note":"스카우트 중입니다 } {아직"}';
  const finalObject = {
    summary: 'done',
    facts: ['a'],
    evidence: [],
    open_questions: [],
    questions: [],
  };
  const text = `${progress}${JSON.stringify(finalObject)}`;
  assert.throws(() => JSON.parse(text), /Unexpected non-whitespace character after JSON/);
  assert.deepEqual(parseLooseJson(text), finalObject);
  assert.deepEqual(parseLooseJson(`note first\n${text}\ntrailing`), finalObject);

  const envelope = {
    text,
    stopReason: 'end_turn',
    sessionId: 'sess',
    requestId: 'req',
    cwd: '/tmp/repo',
    thought: '',
    usage: { input_tokens: 12, output_tokens: 34 },
    num_turns: 2,
    total_cost_usd: 0.0123,
    total_cost_usd_ticks: 123,
    modelUsage: { 'grok-4.7': { input_tokens: 12, output_tokens: 34 } },
    structuredOutput: finalObject,
  };
  assert.equal(grokAnswer(envelope), JSON.stringify(finalObject));
  assert.doesNotMatch(grokAnswer(envelope), /스카우트/);
  assert.deepEqual(grokCost(envelope), {
    usage: envelope.usage,
    totalCostUsd: 0.0123,
  });
  assert.equal(
    grokAnswer({ structured_output: '{"summary":"legacy"}', text: '{"summary":"ignored"}' }),
    '{"summary":"legacy"}',
  );

  const sandbox = await mkdtemp(path.join(tmpdir(), 'decant-grok-envelope-'));
  t.after(() => rm(sandbox, { recursive: true, force: true }));
  const schemaFile = path.join(sandbox, 'schema.json');
  await writeFile(schemaFile, JSON.stringify({
    type: 'object',
    properties: { summary: { type: 'string' } },
  }));
  const outputFile = path.join(sandbox, 'scout.json');
  const recorded = await grokProvider.runStage({
    prompt: 'scout',
    cwd: sandbox,
    model: 'grok-4.7',
    effort: 'low',
    sandbox: 'read-only',
    outputFile,
    outputSchema: schemaFile,
    timeoutMs: 1_000,
    execute: async () => ({ code: 0, stdout: JSON.stringify(envelope), stderr: '', durationMs: 4 }),
  });
  assert.deepEqual(JSON.parse(await readFile(outputFile, 'utf8')), finalObject);
  assert.deepEqual(recorded.usage, envelope.usage);
  assert.equal(recorded.totalCostUsd, 0.0123);

  const textOnly = path.join(sandbox, 'text-only.json');
  await grokProvider.runStage({
    prompt: 'scout',
    cwd: sandbox,
    model: 'grok-4.7',
    effort: 'low',
    sandbox: 'read-only',
    outputFile: textOnly,
    outputSchema: schemaFile,
    timeoutMs: 1_000,
    execute: async () => ({
      code: 0,
      stdout: JSON.stringify({ text, stopReason: 'end_turn' }),
      stderr: '',
    }),
  });
  assert.deepEqual(JSON.parse(await readFile(textOnly, 'utf8')), finalObject);
});

test('muse passes each advertised effort and snaps max and ultra down to xhigh', () => {
  assert.deepEqual([...MUSE_SPARK_EFFORTS], ['minimal', 'low', 'medium', 'high', 'xhigh']);
  for (const effort of MUSE_SPARK_EFFORTS) {
    assert.equal(resolveMuseEffort('muse-spark-1.3', effort), effort);
    const args = museArgs({
      model: 'muse-spark-1.3',
      effort,
      sandbox: 'read-only',
      promptFile: 'prompt.txt',
    });
    assert.equal(args[args.indexOf('--reasoning-effort') + 1], effort);
  }
  // The CLI flag accepts max and ultra, but the Muse Spark API rejects
  // them, so they snap to xhigh before the CLI sees them. `none` is not on
  // the menu either: the model always reasons.
  assert.equal(resolveMuseEffort('muse-spark-1.3', 'max'), 'xhigh');
  assert.equal(resolveMuseEffort('auto', 'ultra'), 'xhigh');
  assert.equal(resolveMuseEffort('muse-spark-1.2', undefined), 'high');
  assert.equal(resolveMuseEffort('some-other-model', 'max'), 'max');
});

test('muse read-only stages lose both write channels and never wait for approval', () => {
  const readOnly = museArgs({ model: 'auto', sandbox: 'read-only', promptFile: 'p' });
  assert.equal(readOnly[readOnly.indexOf('--model') + 1], 'muse-spark-1.3');
  assert.ok(readOnly.includes('--disable-write'));
  assert.ok(readOnly.includes('--disable-shell'));
  assert.ok(readOnly.includes('--disable-web-tools'));
  assert.equal(readOnly[readOnly.indexOf('--approval-mode') + 1], 'never');
  assert.ok(readOnly.includes('--disable-request-user-input'));
  // The sandbox itself is never turned off.
  assert.ok(!readOnly.includes('--yolo'));
  assert.ok(!readOnly.includes('--disable-sandbox'));

  const write = museArgs({ model: 'auto', sandbox: 'workspace-write', search: true, promptFile: 'p' });
  assert.ok(!write.includes('--disable-write'));
  assert.ok(!write.includes('--disable-shell'));
  assert.ok(!write.includes('--disable-web-tools'));
  assert.throws(
    () => museArgs({ model: 'auto', sandbox: 'danger-full-access', promptFile: 'p' }),
    /does not support sandbox danger-full-access/,
  );
});

test('muse answer comes only from the primary run output deltas', () => {
  const stdout = [
    '{"payload_type":"session.run.linked","payload":{"run_stream":{"id":"run-1"}}}',
    '{"payload_type":"turn.input.user","payload":{"prompt":"say pong"}}',
    '{"payload_type":"run.output.delta","payload":{"run_stream":{"id":"run-2"},"text":"reminder noise"}}',
    '{"payload_type":"run.output.delta","payload":{"run_stream":{"id":"run-1"},"text":"po"}}',
    'not json at all',
    '{"payload_type":"run.output.delta","payload":{"run_stream":{"id":"run-1"},"text":"ng"}}',
  ].join('\n');
  assert.equal(museAnswer(parseMuseEvents(stdout)), 'pong');
  assert.throws(() => museAnswer(parseMuseEvents('')), /no run\.output\.delta/);
});

test('muse discovery pins Muse Spark 1.3 and a stage writes the streamed text', async (t) => {
  const catalog = await museProvider.discoverCatalog({});
  assert.deepEqual(catalog.roles.frontier.supportedEfforts, [...MUSE_SPARK_EFFORTS]);
  assert.equal(catalog.roles.frontier.model, 'muse-spark-1.3');
  assert.equal(catalog.roles.frontier.effort, 'xhigh');
  assert.equal(catalog.roles.balanced.effort, 'medium');
  assert.equal(catalog.roles.economy.effort, 'low');

  const sandbox = await mkdtemp(path.join(tmpdir(), 'decant-muse-'));
  t.after(() => rm(sandbox, { recursive: true, force: true }));
  const outputFile = path.join(sandbox, 'stage.md');
  let seen;
  await museProvider.runStage({
    prompt: 'say pong',
    cwd: sandbox,
    model: 'muse-spark-1.3',
    effort: 'low',
    sandbox: 'read-only',
    outputFile,
    timeoutMs: 1_000,
    execute: async (command, args) => {
      seen = { command, args };
      return {
        code: 0,
        stdout: [
          '{"payload_type":"session.run.linked","payload":{"run_stream":{"id":"run-1"}}}',
          '{"payload_type":"run.output.delta","payload":{"run_stream":{"id":"run-1"},"text":"pong"}}',
          '',
        ].join('\n'),
        stderr: '',
      };
    },
  });
  assert.equal(seen.command, 'muse');
  assert.equal(seen.args[0], 'exec');
  assert.equal(seen.args[seen.args.indexOf('--reasoning-effort') + 1], 'low');
  assert.ok(seen.args.includes('--disable-write'));
  assert.equal(await readFile(outputFile, 'utf8'), 'pong\n');
});
