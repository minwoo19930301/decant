import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  describeTarget,
  evidenceTarget,
  FROZEN_EVIDENCE,
  writeEvidence,
} from '../scripts/frozen-evidence.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

test('generators default to outputs/ and never the frozen archive', () => {
  for (const relativePath of FROZEN_EVIDENCE) {
    const result = evidenceTarget(ROOT, relativePath, { argv: ['node', 'script'], env: {} });
    assert.equal(result.frozen, false);
    assert.equal(result.relative, path.join('outputs', path.basename(relativePath)));
    assert.ok(
      result.target.startsWith(path.join(ROOT, 'outputs') + path.sep),
      `${relativePath} must resolve beneath outputs/`,
    );
    assert.notEqual(result.target, path.join(ROOT, relativePath));
  }
});

test('--freeze alone is refused; it needs the explicit environment override', () => {
  for (const relativePath of FROZEN_EVIDENCE) {
    assert.throws(
      () => evidenceTarget(ROOT, relativePath, { argv: ['node', 'script', '--freeze'], env: {} }),
      /refusing to overwrite frozen v0\.1\.1 evidence/,
      `${relativePath} must refuse a bare --freeze`,
    );
    assert.throws(
      () => evidenceTarget(ROOT, relativePath, {
        argv: ['node', 'script', '--freeze'],
        env: { REIN_ALLOW_FROZEN_OVERWRITE: 'true' },
      }),
      /REIN_ALLOW_FROZEN_OVERWRITE=1/,
      `${relativePath} must require exactly "1"`,
    );
  }
});

test('--freeze with the override resolves to the archive and says so', () => {
  const result = evidenceTarget(ROOT, 'docs/launch-report.html', {
    argv: ['node', 'script', '--freeze'],
    env: { REIN_ALLOW_FROZEN_OVERWRITE: '1' },
  });
  assert.equal(result.frozen, true);
  assert.equal(result.target, path.join(ROOT, 'docs', 'launch-report.html'));
  assert.match(describeTarget(ROOT, result), /OVERWROTE frozen v0\.1\.1 evidence/);
});

test('undeclared paths cannot borrow the guard', () => {
  assert.throws(
    () => evidenceTarget(ROOT, 'docs/architecture.md', { argv: [], env: {} }),
    /not a declared frozen-evidence artifact/,
  );
});

test('the released reader log is still bound to the released report bytes', async () => {
  const html = await readFile(path.join(ROOT, 'docs', 'launch-report.html'));
  const live = JSON.parse(
    await readFile(path.join(ROOT, 'docs', 'launch-reader-live.json'), 'utf8'),
  );
  assert.equal(createHash('sha256').update(html).digest('hex'), live.reportSha256);
});

// Both bypasses below were reproduced by independent auditors against an
// earlier guard that only checked the pathname, so they are regression tests,
// not hypotheticals.

test('a symlink at the destination cannot redirect the write', async (t) => {
  const sandbox = await mkdtemp(path.join(tmpdir(), 'rein-evidence-'));
  t.after(() => rm(sandbox, { recursive: true, force: true }));
  const archive = path.join(sandbox, 'docs', 'launch-report.html');
  await mkdir(path.join(sandbox, 'docs'), { recursive: true });
  await mkdir(path.join(sandbox, 'outputs'), { recursive: true });
  await writeFile(archive, 'RELEASED', 'utf8');
  await symlink(path.join('..', 'docs', 'launch-report.html'), path.join(sandbox, 'outputs', 'launch-report.html'));

  const destination = evidenceTarget(sandbox, 'docs/launch-report.html', { argv: [], env: {} });
  await assert.rejects(
    () => writeEvidence(sandbox, destination, 'OVERWRITTEN'),
    /refusing to write evidence through the symlink/,
  );
  assert.equal(await readFile(archive, 'utf8'), 'RELEASED');
});

test('a symlinked outputs directory cannot redirect the write', async (t) => {
  const sandbox = await mkdtemp(path.join(tmpdir(), 'rein-evidence-'));
  t.after(() => rm(sandbox, { recursive: true, force: true }));
  const archive = path.join(sandbox, 'docs', 'launch-verification.json');
  await mkdir(path.join(sandbox, 'docs'), { recursive: true });
  await writeFile(archive, 'RELEASED', 'utf8');
  await symlink('docs', path.join(sandbox, 'outputs'));

  const destination = evidenceTarget(sandbox, 'docs/launch-verification.json', { argv: [], env: {} });
  await assert.rejects(
    () => writeEvidence(sandbox, destination, 'OVERWRITTEN'),
    /physically resolves to/,
  );
  assert.equal(await readFile(archive, 'utf8'), 'RELEASED');
});

test('an ordinary write lands in outputs and leaves the archive alone', async (t) => {
  const sandbox = await mkdtemp(path.join(tmpdir(), 'rein-evidence-'));
  t.after(() => rm(sandbox, { recursive: true, force: true }));
  const archive = path.join(sandbox, 'docs', 'launch-report.html');
  await mkdir(path.join(sandbox, 'docs'), { recursive: true });
  await writeFile(archive, 'RELEASED', 'utf8');

  const destination = evidenceTarget(sandbox, 'docs/launch-report.html', { argv: [], env: {} });
  await writeEvidence(sandbox, destination, 'REGENERATED');
  assert.equal(await readFile(path.join(sandbox, 'outputs', 'launch-report.html'), 'utf8'), 'REGENERATED');
  assert.equal(await readFile(archive, 'utf8'), 'RELEASED');
});
