import assert from 'node:assert/strict';
import { access, mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  codexArgs,
  mapPool,
  MAX_CAPTURE_BYTES,
  runVerification,
  spawnCapture,
} from '../src/executor.mjs';

test('codexArgs keeps the scout read-only and applies model effort', () => {
  const args = codexArgs({
    model: 'economy-model',
    effort: 'low',
    cwd: '/tmp/project',
    outputFile: '/tmp/out.md',
    sandbox: 'read-only',
    search: true,
  });
  assert.ok(args.includes('economy-model'));
  assert.ok(args.includes('model_reasoning_effort="low"'));
  assert.equal(args[args.indexOf('--sandbox') + 1], 'read-only');
  assert.ok(args.includes('--search'));
  assert.ok(args.indexOf('--ask-for-approval') < args.indexOf('exec'));
  assert.ok(args.indexOf('--search') < args.indexOf('exec'));
  assert.deepEqual(args, [
    '--ask-for-approval', 'never',
    '--search',
    'exec', '-',
    '--ephemeral',
    '--skip-git-repo-check',
    '--color', 'never',
    '--sandbox', 'read-only',
    '--cd', '/tmp/project',
    '--output-last-message', '/tmp/out.md',
    '--model', 'economy-model',
    '--config', 'model_reasoning_effort="low"',
  ]);
});

test('codexArgs does not pass the auto sentinel as a model', () => {
  const args = codexArgs({
    model: 'auto',
    effort: 'medium',
    cwd: '/tmp/project',
    outputFile: '/tmp/out.md',
  });
  assert.equal(args.includes('--model'), false);
});

test('spawnCapture writes stdin without shell interpolation', async () => {
  const result = await spawnCapture(process.execPath, ['-e', 'process.stdin.pipe(process.stdout)'], {
    input: 'literal $(whoami)',
    timeoutMs: 5_000,
  });
  assert.equal(result.code, 0);
  assert.equal(result.stdout, 'literal $(whoami)');
  assert.equal(result.truncated, false);
});

test('runVerification accepts argv objects and never interprets shell syntax', async () => {
  const literal = 'literal; $(whoami) && echo injected';
  const result = await runVerification({
    command: process.execPath,
    args: ['-e', 'process.stdout.write(process.argv[1])', literal],
  }, {
    cwd: process.cwd(),
    timeoutMs: 5_000,
  });

  assert.equal(result.code, 0);
  assert.equal(result.stdout, literal);
  assert.equal(result.executable, process.execPath);
  assert.deepEqual(result.args, ['-e', 'process.stdout.write(process.argv[1])', literal]);
  await assert.rejects(
    runVerification('echo unsafe', { cwd: process.cwd(), timeoutMs: 5_000 }),
    /object with command and args/,
  );
});

test('spawnCapture caps stdout and stderr independently at 2 MiB', async () => {
  const emittedBytes = MAX_CAPTURE_BYTES + 32 * 1024;
  const result = await spawnCapture(process.execPath, [
    '-e',
    `const size=${emittedBytes}; process.stdout.write('o'.repeat(size)); process.stderr.write('e'.repeat(size));`,
  ], { timeoutMs: 10_000 });

  assert.equal(result.code, 0);
  assert.equal(Buffer.byteLength(result.stdout), MAX_CAPTURE_BYTES);
  assert.equal(Buffer.byteLength(result.stderr), MAX_CAPTURE_BYTES);
  assert.equal(result.stdoutTruncated, true);
  assert.equal(result.stderrTruncated, true);
  assert.equal(result.truncated, true);
  assert.equal(result.captureLimitBytes, MAX_CAPTURE_BYTES);
});

test('spawnCapture kills the full POSIX process group after timeout', {
  skip: process.platform === 'win32',
}, async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'decant-process-group-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const marker = path.join(directory, 'descendant-survived.txt');
  const descendant = `
    const fs = require('node:fs');
    process.on('SIGTERM', () => {});
    setTimeout(() => fs.writeFileSync(${JSON.stringify(marker)}, 'survived'), 700);
    setInterval(() => {}, 1_000);
  `;
  const parent = `
    const { spawn } = require('node:child_process');
    spawn(process.execPath, ['-e', ${JSON.stringify(descendant)}], { stdio: 'ignore' });
    setInterval(() => {}, 1_000);
  `;

  const result = await spawnCapture(process.execPath, ['-e', parent], {
    timeoutMs: 250,
    killGraceMs: 75,
  });
  await new Promise((resolve) => setTimeout(resolve, 650));

  assert.equal(result.timedOut, true);
  await assert.rejects(access(marker), { code: 'ENOENT' });
});

test('mapPool preserves input order', async () => {
  const output = await mapPool([3, 1, 2], 2, async (value) => {
    await new Promise((resolve) => setTimeout(resolve, value));
    return value * 2;
  });
  assert.deepEqual(output, [6, 2, 4]);
});
