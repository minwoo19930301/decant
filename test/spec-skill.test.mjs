import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(new URL('..', import.meta.url).pathname);
const skillRoot = path.join(root, 'plugins', 'decant', 'skills', 'decant-spec');

test('Decant spec skill carries a bounded confirmed-contract workflow', async () => {
  const [skill, contract, agent] = await Promise.all([
    readFile(path.join(skillRoot, 'SKILL.md'), 'utf8'),
    readFile(path.join(skillRoot, 'references', 'task-contract.md'), 'utf8'),
    readFile(path.join(skillRoot, 'agents', 'openai.yaml'), 'utf8'),
  ]);

  for (const pattern of [
    /at most three questions/i,
    /one question at a time/i,
    /user_decision/,
    /repo_fact/,
    /safe_assumption/,
    /blocker/,
    /Confirmed Task\s+Contract/,
    /cannot\s+authorize implementation/i,
    /new revision/i,
  ]) assert.match(skill, pattern);

  for (const field of [
    'status:',
    'revision:',
    'supersedes:',
    'goal:',
    'non_goals:',
    'constraints:',
    'allowed_mutations:',
    'forbidden_actions:',
    'acceptance_checks:',
    'verification:',
    'rollback:',
    'decisions:',
    'unresolved:',
  ]) assert.match(contract, new RegExp(field));

  assert.match(agent, /\$decant-spec/);
  assert.match(agent, /blocking decisions/i);
});

test('Decant spec evaluation set separates trigger, near-miss, outcome, and adversarial cases', async () => {
  const evaluation = JSON.parse(await readFile(path.join(skillRoot, 'evals', 'cases.json'), 'utf8'));
  const shouldTrigger = [
    ...evaluation.tuning.shouldTrigger,
    ...evaluation.validation.shouldTrigger,
  ];
  const nearMiss = [
    ...evaluation.tuning.nearMiss,
    ...evaluation.validation.nearMiss,
  ];

  assert.equal(shouldTrigger.length, 10);
  assert.equal(nearMiss.length, 10);
  assert.equal(new Set(shouldTrigger).size, 10);
  assert.equal(new Set(nearMiss).size, 10);
  assert.equal(shouldTrigger.some((prompt) => nearMiss.includes(prompt)), false);
  assert.equal(evaluation.outcomeTasks.length, 3);
  assert.equal(evaluation.adversarial.length, 1);
  for (const item of [...evaluation.outcomeTasks, ...evaluation.adversarial]) {
    assert.ok(item.id && item.prompt);
    assert.ok(Array.isArray(item.required) && item.required.length > 0);
    assert.ok(Array.isArray(item.forbidden) && item.forbidden.length > 0);
  }
});
