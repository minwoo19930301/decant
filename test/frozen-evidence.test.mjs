import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, rmSync, symlinkSync, unlinkSync } from 'node:fs';
import { link, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  describeTarget,
  evidenceTarget,
  FROZEN_EVIDENCE,
  writeEvidence,
  writeOutputsSidecar,
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

test('a hardlink to the archive cannot be written through', async (t) => {
  const sandbox = await mkdtemp(path.join(tmpdir(), 'rein-evidence-'));
  t.after(() => rm(sandbox, { recursive: true, force: true }));
  const archive = path.join(sandbox, 'docs', 'launch-report.html');
  await mkdir(path.join(sandbox, 'docs'), { recursive: true });
  await mkdir(path.join(sandbox, 'outputs'), { recursive: true });
  await writeFile(archive, 'RELEASED', 'utf8');
  // A hardlink is an ordinary file: it passes every symlink test while sharing
  // the archive's inode, so O_NOFOLLOW does not stop it.
  await link(archive, path.join(sandbox, 'outputs', 'launch-report.html'));

  const destination = evidenceTarget(sandbox, 'docs/launch-report.html', { argv: [], env: {} });
  await assert.rejects(
    () => writeEvidence(sandbox, destination, 'OVERWRITTEN'),
    /hard links/,
  );
  assert.equal(await readFile(archive, 'utf8'), 'RELEASED');
});

test('a write that resolves onto a different archive file is refused by inode', async (t) => {
  const sandbox = await mkdtemp(path.join(tmpdir(), 'rein-evidence-'));
  t.after(() => rm(sandbox, { recursive: true, force: true }));
  await mkdir(path.join(sandbox, 'docs'), { recursive: true });
  const report = path.join(sandbox, 'docs', 'launch-report.html');
  const verification = path.join(sandbox, 'docs', 'launch-verification.json');
  await writeFile(report, 'RELEASED REPORT', 'utf8');
  await writeFile(verification, 'RELEASED LOG', 'utf8');

  // The descriptor lands on launch-report.html while the caller claimed
  // launch-verification.json. Only descriptor identity catches this, which is
  // the same check that stops a won race on an intermediate path component.
  await assert.rejects(
    () => writeEvidence(
      sandbox,
      { target: report, frozen: true, relative: 'docs/launch-verification.json' },
      'OVERWRITTEN',
    ),
    /is the same file as frozen evidence docs\/launch-report\.html/,
  );
  assert.equal(await readFile(report, 'utf8'), 'RELEASED REPORT');
  assert.equal(await readFile(verification, 'utf8'), 'RELEASED LOG');
});

test('flipping outputs into a symlink mid-write never reaches the archive', async (t) => {
  const sandbox = await mkdtemp(path.join(tmpdir(), 'rein-evidence-'));
  t.after(() => rm(sandbox, { recursive: true, force: true }));
  const archive = path.join(sandbox, 'docs', 'launch-report.html');
  await mkdir(path.join(sandbox, 'docs'), { recursive: true });
  await mkdir(path.join(sandbox, 'outputs'), { recursive: true });
  await writeFile(archive, 'RELEASED', 'utf8');

  // An auditor won this race against a purely path-based guard in 30 seconds.
  const flipper = setInterval(() => {
    try {
      rmSync(path.join(sandbox, 'outputs'), { recursive: true, force: true });
      symlinkSync('docs', path.join(sandbox, 'outputs'));
      unlinkSync(path.join(sandbox, 'outputs'));
      mkdirSync(path.join(sandbox, 'outputs'));
    } catch {
      // racing the writer; ignore
    }
  }, 0);
  t.after(() => clearInterval(flipper));

  const deadline = Date.now() + 1_500;
  while (Date.now() < deadline) {
    const destination = evidenceTarget(sandbox, 'docs/launch-report.html', { argv: [], env: {} });
    try {
      // eslint-disable-next-line no-await-in-loop
      await writeEvidence(sandbox, destination, 'RACE-ATTACK-PAYLOAD');
    } catch {
      // every rejection is the guard doing its job
    }
  }
  clearInterval(flipper);
  assert.equal(await readFile(archive, 'utf8'), 'RELEASED');
});

test('legacy outputs sidecars are guarded too', async (t) => {
  const sandbox = await mkdtemp(path.join(tmpdir(), 'rein-evidence-'));
  t.after(() => rm(sandbox, { recursive: true, force: true }));
  const archive = path.join(sandbox, 'docs', 'launch-report.html');
  await mkdir(path.join(sandbox, 'docs'), { recursive: true });
  await mkdir(path.join(sandbox, 'outputs'), { recursive: true });
  await writeFile(archive, 'RELEASED', 'utf8');

  // The frozen v0.1.1 report tells readers to look for these filenames, so they
  // are still produced — but they used to be written with a bare writeFile,
  // which a link planted here turned into a path to the archive.
  const sidecar = path.join(sandbox, 'outputs', 'relay10-launch-report.html');
  await symlink(path.join('..', 'docs', 'launch-report.html'), sidecar);
  await assert.rejects(
    () => writeOutputsSidecar(sandbox, 'relay10-launch-report.html', 'OVERWRITTEN'),
    /refusing to write evidence through the symlink/,
  );
  assert.equal(await readFile(archive, 'utf8'), 'RELEASED');

  await rm(sidecar);
  await link(archive, sidecar);
  await assert.rejects(
    () => writeOutputsSidecar(sandbox, 'relay10-launch-report.html', 'OVERWRITTEN'),
    /hard links/,
  );
  assert.equal(await readFile(archive, 'utf8'), 'RELEASED');

  await rm(sidecar);
  await writeOutputsSidecar(sandbox, 'relay10-launch-report.html', 'SIDECAR');
  assert.equal(await readFile(sidecar, 'utf8'), 'SIDECAR');
  assert.equal(await readFile(archive, 'utf8'), 'RELEASED');
});

test('a sidecar name cannot escape outputs/', async (t) => {
  const sandbox = await mkdtemp(path.join(tmpdir(), 'rein-evidence-'));
  t.after(() => rm(sandbox, { recursive: true, force: true }));
  await mkdir(path.join(sandbox, 'docs'), { recursive: true });
  await writeFile(path.join(sandbox, 'docs', 'launch-report.html'), 'RELEASED', 'utf8');
  await assert.rejects(
    () => writeOutputsSidecar(sandbox, '../docs/launch-report.html', 'OVERWRITTEN'),
    /must be a bare filename/,
  );
  assert.equal(await readFile(path.join(sandbox, 'docs', 'launch-report.html'), 'utf8'), 'RELEASED');
});

test('--freeze with the override may still write its own artifact', async (t) => {  const sandbox = await mkdtemp(path.join(tmpdir(), 'rein-evidence-'));
  t.after(() => rm(sandbox, { recursive: true, force: true }));
  const archive = path.join(sandbox, 'docs', 'launch-report.html');
  await mkdir(path.join(sandbox, 'docs'), { recursive: true });
  await writeFile(archive, 'RELEASED', 'utf8');

  const destination = evidenceTarget(sandbox, 'docs/launch-report.html', {
    argv: ['node', 'script', '--freeze'],
    env: { REIN_ALLOW_FROZEN_OVERWRITE: '1' },
  });
  await writeEvidence(sandbox, destination, 'DELIBERATELY REPLACED');
  assert.equal(await readFile(archive, 'utf8'), 'DELIBERATELY REPLACED');
});
