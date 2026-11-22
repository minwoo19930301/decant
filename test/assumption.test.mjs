import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { main } from '../src/cli.mjs';
import { DEFAULT_CONFIG } from '../src/config.mjs';
import { makerPrompt } from '../src/prompts.mjs';
import {
  answerDiverges,
  assumptionReview,
  normalizeQuestions,
  readQuestions,
  stagesUsingAssumption,
} from '../src/questions.mjs';

const RUN_ID = '20260919T010203456Z-abc123de';

async function workspace(t) {
  const cwd = await mkdtemp(path.join(os.tmpdir(), 'decant-assumption-'));
  t.after(() => rm(cwd, { recursive: true, force: true }));
  return cwd;
}

async function writeStore(cwd, questions) {
  const directory = path.join(cwd, '.decant', 'questions');
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, `${RUN_ID}.json`), JSON.stringify({ version: 1, runId: RUN_ID, questions }));
}

async function writeEvents(cwd, events) {
  const directory = path.join(cwd, '.decant', 'runs', RUN_ID);
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, 'events.jsonl'), events.map((event) => JSON.stringify(event)).join('\n') + (events.length ? '\n' : ''));
}

function capture() {
  let output = '';
  return { stream: { write: (value) => { output += value; } }, read: () => output };
}

// Problem 1: the model writes the assumption; the system never invents one.
test('the scout schema lets the model write an assumption and mark it reversible', async () => {
  const schema = JSON.parse(await readFile(new URL('../schema/scout-result.schema.json', import.meta.url), 'utf8'));
  const properties = schema.properties.questions.items.properties;
  assert.deepEqual(properties.assumption.type, ['string', 'null']);
  assert.deepEqual(properties.reversible.type, ['boolean', 'null']);
});

test('only a model-written assumption on a reversible, non-required question is recorded', () => {
  const [kept, plain, noFlag] = normalizeQuestions([
    { id: 'kept', title: 'Style?', options: ['Light', 'Dark'], required: false, assumption: ' Dark ', reversible: true },
    { id: 'plain', title: 'Label?', options: ['A', 'B'], required: false },
    { id: 'noflag', title: 'Name?', required: false, assumption: 'Use foo', reversible: false },
  ]);
  const [blocking, nulls] = normalizeQuestions([
    { id: 'blocking', title: 'Target?', required: true, assumption: 'CLI', reversible: true },
    { id: 'nulls', title: 'Wording?', options: null, required: false, assumption: null, reversible: null },
  ]);
  assert.deepEqual(kept, { id: 'kept', title: 'Style?', required: false, options: ['Light', 'Dark'], assumption: 'Dark', reversible: true });
  assert.deepEqual(plain, { id: 'plain', title: 'Label?', required: false, options: ['A', 'B'] });
  assert.deepEqual(noFlag, { id: 'noflag', title: 'Name?', required: false });
  assert.deepEqual(blocking, { id: 'blocking', title: 'Target?', required: true });
  assert.deepEqual(nulls, { id: 'nulls', title: 'Wording?', required: false });
  assert.throws(() => normalizeQuestions([{ id: 'x', title: 'X?', assumption: 5 }]), TypeError);
  assert.throws(() => normalizeQuestions([{ id: 'x', title: 'X?', assumption: 'a', reversible: 'yes' }]), TypeError);
});

test('without a model assumption the question and prompt behave as before', () => {
  // Legacy strings and options-only questions get no default, not even options[0].
  assert.deepEqual(normalizeQuestions(['Select a color?']), [{ id: 'q-1', title: 'Select a color?', required: false }]);
  const context = { version: 1, current: { questions: [{ id: 'style', title: 'Style?', required: false, status: 'pending' }] } };
  const prompt = makerPrompt('task', '/tmp/run', { questionContext: context });
  assert.match(prompt, /Unanswered optional questions do not block independent work\. State the concrete assumptions you use for them/);
  assert.match(prompt, /Never invent an answer or assume consent from silence\./);
  assert.doesNotMatch(prompt, /model-written assumption/);
  const withAssumption = makerPrompt('task', '/tmp/run', {
    questionContext: { ...context, current: { questions: [{ ...context.current.questions[0], assumption: 'Dark', reversible: true }] } },
  });
  assert.match(withAssumption, /model-written assumption/);
  assert.match(withAssumption, /never an answer/);
});

// Problem 3: a store written before this change must not gain an assumption.
test('an old question store loads without any assumption', async (t) => {
  const cwd = await workspace(t);
  await writeStore(cwd, [
    { id: 'style', title: 'Style?', required: false, options: ['A', 'B'], status: 'pending', askedAt: '2026-09-19T01:00:00.000Z' },
    { id: 'name', title: 'Name?', required: false, status: 'answered', askedAt: '2026-09-19T01:00:00.000Z', answer: 'foo', answeredAt: '2026-09-19T02:00:00.000Z' },
  ]);
  const state = await readQuestions({ cwd, runId: RUN_ID });
  assert.ok(state.questions.every((question) => !('assumption' in question) && !('reversible' in question)));
  assert.doesNotMatch(JSON.stringify(state), /assumption/);
});

// Problem 4: affected stages come from the run record, not a constant.
test('affected stages are the stages that started between the assumption and the answer', () => {
  const question = { assumption: 'Dark', askedAt: '2026-09-19T01:00:00.000Z', answeredAt: '2026-09-19T03:00:00.000Z' };
  const started = (stage, at) => ({ type: 'stage.started', stage, at });
  assert.deepEqual(stagesUsingAssumption(question, [
    started('scout', '2026-09-19T00:59:00.000Z'),
    started('architect', '2026-09-19T01:10:00.000Z'),
    started('maker', '2026-09-19T02:00:00.000Z'),
    started('reviewer', '2026-09-19T04:00:00.000Z'),
    { type: 'run.waiting', at: '2026-09-19T02:30:00.000Z' },
  ]), ['maker']);
  // Answer arrived before maker started, or the run was waiting: nothing used it.
  assert.deepEqual(stagesUsingAssumption(question, [started('maker', '2026-09-19T05:00:00.000Z')]), []);
  assert.deepEqual(stagesUsingAssumption(question, []), []);
  assert.deepEqual(stagesUsingAssumption({ ...question, answeredAt: undefined }, [started('maker', '2026-09-19T02:00:00.000Z')]), []);
});

// Problem 5: divergence is decided on a normalised answer.
test('divergence ignores case, spacing and option form but not meaning', () => {
  const free = { assumption: 'Use the Dark   theme' };
  assert.equal(answerDiverges(free, '  use the dark theme '), false);
  assert.equal(answerDiverges(free, 'Use the light theme'), true);
  const options = { assumption: 'Dark', options: ['Light', 'Dark'] };
  assert.equal(answerDiverges(options, ' DARK '), false);
  assert.equal(answerDiverges(options, 'light'), true);
  assert.equal(answerDiverges({ options: ['A'] }, 'A'), false, 'no assumption means nothing to diverge from');
});

test('assumptionReview reports nothing for old or assumption-free questions', () => {
  const questions = [{ id: 'a', status: 'answered', answer: 'x', answeredAt: '2026-09-19T03:00:00.000Z', askedAt: '2026-09-19T01:00:00.000Z' }];
  assert.deepEqual(assumptionReview(questions, []), []);
});

async function answerCommand(cwd, answer) {
  const output = capture();
  const code = await main(['answer', RUN_ID, 'style', answer], {
    cwd, stdout: output.stream, configAndCatalogImpl: async () => ({ config: structuredClone(DEFAULT_CONFIG), catalog: {} }),
  });
  return { code, text: output.read() };
}

const ASSUMED = { id: 'style', title: 'Style?', required: false, options: ['Light', 'Dark'], assumption: 'Dark', reversible: true, status: 'pending', askedAt: '2026-09-19T01:00:00.000Z' };

test('a diverging answer after maker started names the stage and offers resume', async (t) => {
  const cwd = await workspace(t);
  await writeStore(cwd, [ASSUMED]);
  await writeEvents(cwd, [{ type: 'stage.started', stage: 'maker', at: '2026-09-19T02:00:00.000Z' }]);
  const { code, text } = await answerCommand(cwd, 'Light');
  assert.equal(code, 0);
  assert.match(text, /Differs from assumption: Dark/);
  assert.match(text, /Affected stages: maker\n/);
  assert.match(text, new RegExp(`decant resume ${RUN_ID}`));
});

test('an answer that matches the assumption after normalising prints no resume prompt', async (t) => {
  const cwd = await workspace(t);
  await writeStore(cwd, [ASSUMED]);
  await writeEvents(cwd, [{ type: 'stage.started', stage: 'maker', at: '2026-09-19T02:00:00.000Z' }]);
  const { text } = await answerCommand(cwd, '  dark ');
  assert.doesNotMatch(text, /Differs from assumption|Affected stages|decant resume/);
});

test('a diverging answer before maker started affects no stage and prints no resume prompt', async (t) => {
  const cwd = await workspace(t);
  await writeStore(cwd, [ASSUMED]);
  await writeEvents(cwd, [{ type: 'stage.started', stage: 'maker', at: '2999-01-01T00:00:00.000Z' }]);
  const { text } = await answerCommand(cwd, 'Light');
  assert.doesNotMatch(text, /Affected stages|decant resume/);
  const waiting = await workspace(t);
  await writeStore(waiting, [ASSUMED]);
  await writeEvents(waiting, []);
  assert.doesNotMatch((await answerCommand(waiting, 'Light')).text, /Affected stages|decant resume/);
});
