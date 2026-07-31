import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { collectHistory, estimatePlan, formatEstimate } from '../src/estimate.mjs';

const plan = {
  stages: [
    { id: 'scout', modelRole: 'economy', effort: 'low' },
    { id: 'architect', modelRole: 'frontier', effort: 'max' },
    { id: 'maker', modelRole: 'balanced', effort: 'medium' },
    { id: 'explainer', modelRole: 'balanced', effort: 'low', enabled: false },
  ],
  invocationEstimate: { minimum: 3, maximum: 4 },
};

async function workspace(t, runs) {
  const root = await mkdtemp(path.join(tmpdir(), 'decant-estimate-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const runsDir = path.join(root, '.decant', 'runs');
  for (const [name, manifest] of Object.entries(runs)) {
    // eslint-disable-next-line no-await-in-loop
    await mkdir(path.join(runsDir, name), { recursive: true });
    // eslint-disable-next-line no-await-in-loop
    await writeFile(path.join(runsDir, name, 'run.json'), JSON.stringify(manifest), 'utf8');
  }
  return runsDir;
}

const stage = (id, profile, effort, seconds, status = 'pass') => ({
  id, profile, effort, status, durationMs: seconds * 1000,
});

test('with no history the seed table is used and labelled as a seed', async () => {
  const estimate = estimatePlan(plan, { samples: new Map(), runs: 0 });
  assert.equal(estimate.basis.runsSampled, 0);
  assert.equal(estimate.basis.stagesFromHistory, 0);
  assert.match(estimate.basis.confidence, /no runs recorded/);
  assert.ok(estimate.stages.every((entry) => entry.source.startsWith('seed')));
  // A disabled stage costs nothing.
  assert.ok(!estimate.stages.some((entry) => entry.stage === 'explainer'));
  assert.equal(estimate.seconds, 17 + 44 + 37);
});

test('recorded runs override the seeds and report their sample count', async (t) => {
  const runsDir = await workspace(t, {
    '20260731T000000000Z-aaaaaaaa': {
      stages: {
        scout: stage('scout', 'economy', 'low', 10),
        maker: stage('maker', 'balanced', 'medium', 100),
      },
    },
    '20260731T000001000Z-bbbbbbbb': {
      stages: {
        scout: stage('scout', 'economy', 'low', 20),
        maker: stage('maker', 'balanced', 'medium', 200),
      },
    },
  });
  const history = await collectHistory(runsDir);
  assert.equal(history.runs, 2);

  const estimate = estimatePlan(plan, history);
  const byStage = Object.fromEntries(estimate.stages.map((entry) => [entry.stage, entry]));
  assert.equal(byStage.scout.source, 'local-history');
  assert.equal(byStage.scout.seconds, 15, 'the median of 10 and 20');
  assert.equal(byStage.scout.sampleCount, 2);
  assert.equal(byStage.maker.seconds, 150);
  // The architect never ran, so it stays seeded — history and seeds coexist.
  assert.equal(byStage.architect.source, 'seed');
  assert.match(estimate.basis.confidence, /2 of 3 stages calibrated from 2 local run\(s\)/);
});

test('a failed or unmeasured stage is not calibration data', async (t) => {
  const runsDir = await workspace(t, {
    '20260731T000000000Z-cccccccc': {
      stages: {
        scout: stage('scout', 'economy', 'low', 999, 'fail'),
        maker: { id: 'maker', profile: 'balanced', effort: 'medium', status: 'pass' },
        architect: stage('architect', 'frontier', 'max', 0),
      },
    },
  });
  const history = await collectHistory(runsDir);
  assert.equal(history.samples.size, 0, 'nothing above is a usable sample');
  assert.equal(history.runs, 0);
});

test('a missing or unreadable runs directory is not an error', async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), 'decant-estimate-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const absent = await collectHistory(path.join(root, 'nope'));
  assert.equal(absent.runs, 0);

  const runsDir = path.join(root, '.decant', 'runs');
  await mkdir(path.join(runsDir, 'broken'), { recursive: true });
  await writeFile(path.join(runsDir, 'broken', 'run.json'), '{ truncated', 'utf8');
  const damaged = await collectHistory(runsDir);
  assert.equal(damaged.runs, 0, 'a partial run.json must not throw or count');
});

test('the estimate says what it excludes rather than inventing it', () => {
  const estimate = estimatePlan(plan, {});
  const excluded = estimate.excluded.join(' ');
  assert.match(excluded, /verification commands/);
  assert.match(excluded, /tokens and currency/);
  // Nothing anywhere may present a token figure, because none is observable.
  assert.ok(!Object.hasOwn(estimate, 'tokens'));
});

test('the summary line carries minutes, calls, and the basis', () => {
  const long = formatEstimate(estimatePlan(plan, {}));
  assert.match(long, /~1\.6m of model time/);
  assert.match(long, /3\.\.4 calls/);
  assert.match(long, /no runs recorded/);

  const short = formatEstimate(estimatePlan(
    { stages: [{ id: 'reader', modelRole: 'economy', effort: 'low' }] },
    {},
  ));
  assert.match(short, /^20s of model time/, 'under a minute is reported in seconds');
  assert.match(short, /calls unknown/, 'an absent call estimate is not faked as zero');
});
