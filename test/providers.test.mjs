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
  wrapPrompt,
} from '../src/providers/contract.mjs';
import { discoverKiroModels, kiroArgs, kiroProvider } from '../src/providers/kiro.mjs';
import { codexProvider } from '../src/providers/codex.mjs';
import { DEFAULT_PROVIDER, PROVIDER_IDS, resolveProvider } from '../src/providers/index.mjs';

test('every registered provider satisfies the stage contract', () => {
  assert.deepEqual(PROVIDER_IDS, ['codex', 'kiro']);
  for (const id of PROVIDER_IDS) {
    const provider = assertProvider(resolveProvider(id));
    assert.equal(provider.id, id);
    assert.ok(provider.executable);
    assert.ok(provider.capabilities.sandbox);
  }
  assert.equal(resolveProvider(), resolveProvider(DEFAULT_PROVIDER));
  assert.throws(() => resolveProvider('anthropic'), /supported: codex, kiro/);
});

test('providers declare what they can and cannot enforce', () => {
  // The point of the abstraction is not that backends look alike. It is that
  // the difference is visible: Codex enforces a schema and a sandbox, the Kiro
  // adapter asks for a schema and grants tools.
  assert.equal(codexProvider.capabilities.outputSchema, 'native');
  assert.equal(codexProvider.capabilities.sandbox, 'native');
  assert.equal(kiroProvider.capabilities.outputSchema, 'prompted');
  assert.equal(kiroProvider.capabilities.sandbox, 'tool-allowlist');
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
  assert.equal(extractOutput(transcript), 'real answer line one\nline two');
  assert.throws(() => extractOutput('no sentinels here'), /did not contain a Rein sentinel block/);
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
  const sandbox = await mkdtemp(path.join(tmpdir(), 'rein-provider-'));
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
  assert.equal(await readFile(outputFile, 'utf8'), '{"ok":true}\n');
});

test('a nonzero stage exit becomes an error carrying the captured result', async (t) => {
  const sandbox = await mkdtemp(path.join(tmpdir(), 'rein-provider-'));
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
