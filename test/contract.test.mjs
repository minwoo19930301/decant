import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  checkAgainstContract,
  loadContract,
  renderContract,
  validateContract,
} from '../src/contract.mjs';

const contract = validateContract({
  version: 1,
  criteria: [
    { id: 'opens-directly', risk: 'critical', requirement: 'works when opened directly' },
    { id: 'keyboard', risk: 'high', requirement: 'arrow keys move the player' },
    { id: 'line-budget', risk: 'low', requirement: 'under 400 lines' },
  ],
});

const answer = (id, passed, evidence = 'index.html:1') => ({ criterion: id, passed, evidence });
const review = (checks) => ({
  verdict: 'pass',
  summary: 's',
  findings: [],
  acceptance_checks: checks,
});

test('a contract requires an id, a requirement, and a known risk', () => {
  assert.throws(() => validateContract({ version: 2, criteria: [] }), /version must equal 1/);
  assert.throws(() => validateContract({ version: 1, criteria: [] }), /non-empty array/);
  assert.throws(
    () => validateContract({ version: 1, criteria: [{ id: 'A_B', requirement: 'x' }] }),
    /lowercase letters, digits, and hyphens/,
  );
  assert.throws(
    () => validateContract({ version: 1, criteria: [{ id: 'a', requirement: ' ' }] }),
    /requirement must be a non-empty string/,
  );
  assert.throws(
    () => validateContract({ version: 1, criteria: [{ id: 'a', requirement: 'x', risk: 'blocker' }] }),
    /risk must be one of/,
  );
  assert.throws(
    () => validateContract({
      version: 1,
      criteria: [{ id: 'a', requirement: 'x' }, { id: 'a', requirement: 'y' }],
    }),
    /id is duplicated/,
  );
  // Risk defaults to medium rather than to the strictest or the loosest.
  assert.equal(validateContract({ version: 1, criteria: [{ id: 'a', requirement: 'x' }] }).criteria[0].risk, 'medium');
});

test('every declared criterion answered and evidenced is a pass', () => {
  const outcome = checkAgainstContract(contract, review([
    answer('opens-directly', true),
    answer('keyboard', true),
    answer('line-budget', true),
  ]));
  assert.equal(outcome.passed, true);
  assert.deepEqual(outcome.blocking, []);
  assert.deepEqual(outcome.gaps, []);
  assert.equal(outcome.answered, 3);
});

test('a rejected high- or critical-risk criterion blocks; a low one is a gap', () => {
  const critical = checkAgainstContract(contract, review([
    answer('opens-directly', false),
    answer('keyboard', true),
    answer('line-budget', true),
  ]));
  assert.deepEqual(critical.blocking, ['opens-directly: reviewer rejected it']);

  const high = checkAgainstContract(contract, review([
    answer('opens-directly', true),
    answer('keyboard', false),
    answer('line-budget', true),
  ]));
  assert.deepEqual(high.blocking, ['keyboard: reviewer rejected it']);

  const low = checkAgainstContract(contract, review([
    answer('opens-directly', true),
    answer('keyboard', true),
    answer('line-budget', false),
  ]));
  assert.deepEqual(low.blocking, []);
  assert.deepEqual(low.gaps, ['line-budget: reviewer rejected it']);
});

test('a criterion the reviewer skipped is not silently a pass', () => {
  // The whole point of declaring criteria: a model that quietly drops an
  // inconvenient requirement must not be able to pass by omission.
  const skippedCritical = checkAgainstContract(contract, review([
    answer('keyboard', true),
    answer('line-budget', true),
  ]));
  assert.deepEqual(skippedCritical.blocking, ['opens-directly: no answer from the reviewer']);
  assert.equal(skippedCritical.answered, 2);

  const skippedHigh = checkAgainstContract(contract, review([
    answer('opens-directly', true),
    answer('line-budget', true),
  ]));
  assert.equal(skippedHigh.passed, false);
  assert.deepEqual(skippedHigh.gaps, ['keyboard: no answer from the reviewer']);
});

test('accepting a criterion with no evidence is not a pass', () => {
  const outcome = checkAgainstContract(contract, review([
    { criterion: 'opens-directly', passed: true, evidence: '   ' },
    answer('keyboard', true),
    answer('line-budget', true),
  ]));
  assert.deepEqual(outcome.blocking, ['opens-directly: accepted with no evidence']);
});

test('an id-prefixed criterion string still resolves', () => {
  const outcome = checkAgainstContract(contract, review([
    { criterion: 'opens-directly: works when double-clicked', passed: true, evidence: 'e' },
    answer('keyboard', true),
    answer('line-budget', true),
  ]));
  assert.equal(outcome.passed, true);
});

test('the contract check ignores the reviewer\'s own verdict', () => {
  // A reviewer that says "pass" while rejecting a critical criterion must not be
  // taken at its word.
  const outcome = checkAgainstContract(contract, {
    verdict: 'pass',
    summary: 's',
    findings: [],
    acceptance_checks: [answer('opens-directly', false), answer('keyboard', true), answer('line-budget', true)],
  });
  assert.equal(outcome.passed, false);
  assert.equal(outcome.blocking.length, 1);
});

test('rendered criteria carry the id and the risk into the prompt', () => {
  const rendered = renderContract(contract);
  for (const entry of contract.criteria) {
    assert.match(rendered, new RegExp(`\`${entry.id}\``));
    assert.match(rendered, new RegExp(`risk: ${entry.risk}`));
  }
});

test('loadContract reports invalid JSON by path', async (t) => {
  const dir = await mkdtemp(path.join(tmpdir(), 'decant-contract-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const file = path.join(dir, 'contract.json');
  await writeFile(file, '{ not json', 'utf8');
  await assert.rejects(() => loadContract(file), /is not valid JSON/);

  await writeFile(file, JSON.stringify({ version: 1, criteria: [{ id: 'a', requirement: 'x' }] }), 'utf8');
  assert.equal((await loadContract(file)).criteria[0].id, 'a');
});
