#!/usr/bin/env node

import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { spawnCapture } from '../src/executor.mjs';

const root = path.resolve(new URL('..', import.meta.url).pathname);
const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), 'decant-package-'));

function assertSucceeded(label, result) {
  if (result.code === 0 && result.timedOut !== true) return;
  const detail = [result.stdout, result.stderr].filter(Boolean).join('\n').trim();
  throw new Error(`${label} failed with exit ${result.code}${detail ? `\n${detail}` : ''}`);
}

try {
  const pack = await spawnCapture('npm', ['pack', '--json', '--pack-destination', temporaryRoot], {
    cwd: root,
    timeoutMs: 120_000,
  });
  assertSucceeded('npm pack', pack);

  let packMetadata;
  try {
    packMetadata = JSON.parse(pack.stdout);
  } catch (error) {
    throw new Error(`npm pack did not return JSON: ${error.message}`);
  }
  const filename = packMetadata?.[0]?.filename;
  if (typeof filename !== 'string' || filename.length === 0) {
    throw new Error('npm pack JSON did not contain a filename');
  }

  const installRoot = path.join(temporaryRoot, 'install');
  await mkdir(installRoot, { recursive: true });
  await writeFile(path.join(installRoot, 'package.json'), '{"private":true}\n', 'utf8');

  const install = await spawnCapture(
    'npm',
    ['install', '--ignore-scripts', '--no-audit', '--no-fund', path.join(temporaryRoot, filename)],
    { cwd: installRoot, timeoutMs: 120_000 },
  );
  assertSucceeded('fresh package install', install);

  const packageRoot = path.join(installRoot, 'node_modules', 'decant');
  const check = await spawnCapture('npm', ['run', 'check'], {
    cwd: packageRoot,
    timeoutMs: 120_000,
  });
  assertSucceeded('installed package check', check);

  const binSuffix = process.platform === 'win32' ? '.cmd' : '';
  for (const command of ['decant']) {
    const executable = path.join(
      installRoot,
      'node_modules',
      '.bin',
      `${command}${binSuffix}`,
    );
    const help = await spawnCapture(executable, ['--help'], {
      cwd: installRoot,
      timeoutMs: 30_000,
    });
    assertSucceeded(`${command} installed CLI help`, help);
    if (!help.stdout.includes('Decant')) {
      throw new Error(`${command} installed CLI help did not show Decant`);
    }
  }

  process.stdout.write(`packed package verification: pass (${filename})\n`);
} finally {
  await rm(temporaryRoot, { recursive: true, force: true });
}
