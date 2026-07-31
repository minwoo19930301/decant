import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  latestRun,
  parseCli,
  readJson,
  readText,
  runId,
  sha256,
  writeJson,
} from '../src/utils.mjs';

test('parseCli separates positional arguments and flags', () => {
  const parsed = parseCli(['run', 'do work', '--dry-run', '--budget-calls=12']);
  assert.deepEqual(parsed.positional, ['run', 'do work']);
  assert.equal(parsed.flags.dryRun, true);
  assert.equal(parsed.flags.budgetCalls, '12');
});

test('writeJson creates parent directories', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'rein-'));
  const target = path.join(root, 'nested', 'value.json');
  await writeJson(target, { ok: true });
  assert.deepEqual(await readJson(target), { ok: true });
  assert.deepEqual(await readdir(path.dirname(target)), ['value.json']);
});

test('concurrent writeJson calls leave one complete document and no temporary files', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'rein-'));
  const target = path.join(root, 'run.json');
  await Promise.all([
    writeJson(target, { writer: 'alpha', values: Array.from({ length: 100 }, (_, index) => index) }),
    writeJson(target, { writer: 'beta', values: Array.from({ length: 100 }, (_, index) => index) }),
  ]);

  const result = await readJson(target);
  assert.ok(['alpha', 'beta'].includes(result.writer));
  assert.equal(result.values.length, 100);
  assert.deepEqual(await readdir(root), ['run.json']);
});

test('writeJson removes its temporary file when rename fails', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'rein-'));
  const target = path.join(root, 'existing-directory');
  await mkdir(target);

  await assert.rejects(writeJson(target, { ok: true }));
  assert.deepEqual((await readdir(root)).sort(), ['existing-directory']);
});

test('readText propagates errors unless a missing-file fallback is explicit', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'rein-'));
  const missing = path.join(root, 'missing.txt');

  await assert.rejects(readText(missing), { code: 'ENOENT' });
  assert.equal(
    await readText(missing, { allowMissing: true, fallback: 'not found' }),
    'not found',
  );
  assert.equal(await readText(missing, 'legacy fallback'), 'legacy fallback');

  const directory = path.join(root, 'directory');
  await mkdir(directory);
  await assert.rejects(
    readText(directory, { allowMissing: true, fallback: 'not found' }),
    (error) => error.code !== 'ENOENT',
  );
});

test('latestRun skips missing and malformed manifests', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'rein-'));
  assert.equal(await latestRun(path.join(root, 'missing')), null);

  const runs = path.join(root, 'runs');
  await mkdir(path.join(runs, '20260713T000000100Z-aaaaaaaa'), { recursive: true });
  await writeJson(
    path.join(runs, '20260713T000000100Z-aaaaaaaa', 'run.json'),
    { status: 'pass' },
  );
  await mkdir(path.join(runs, '20260713T000000200Z-bbbbbbbb'));
  await writeFile(
    path.join(runs, '20260713T000000200Z-bbbbbbbb', 'run.json'),
    '{ not json',
    'utf8',
  );
  await mkdir(path.join(runs, '20260713T000000300Z-cccccccc'));

  assert.equal(await latestRun(runs), '20260713T000000100Z-aaaaaaaa');

  await writeJson(
    path.join(runs, '20260713T000000300Z-cccccccc', 'run.json'),
    { status: 'error' },
  );
  assert.equal(await latestRun(runs), '20260713T000000300Z-cccccccc');
});

test('hash is deterministic and run ids include milliseconds plus an injected UUID suffix', () => {
  assert.equal(sha256('rein'), sha256('rein'));
  assert.equal(
    runId(
      new Date('2026-07-13T00:00:00.123Z'),
      () => '12345678-90ab-cdef-1234-567890abcdef',
    ),
    '20260713T000000123Z-12345678',
  );
  assert.notEqual(
    runId(new Date('2026-07-13T00:00:00.123Z'), () => 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'),
    runId(new Date('2026-07-13T00:00:00.123Z'), () => 'bbbbbbbb-cccc-dddd-eeee-ffffffffffff'),
  );
});
