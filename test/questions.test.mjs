import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import {
  link,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  symlink,
  utimes,
  writeFile,
} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';
import {
  answerQuestion,
  normalizeQuestions,
  openQuestions,
  questionSummary,
  readQuestions,
  snapshotQuestions,
} from '../src/questions.mjs';

const execute = promisify(execFile);
const RUN_ID = '20260919T010203456Z-abc123de';
const MODULE_URL = new URL('../src/questions.mjs', import.meta.url).href;

async function workspace(t) {
  const cwd = await mkdtemp(path.join(os.tmpdir(), 'decant-questions-'));
  t.after(() => rm(cwd, { recursive: true, force: true }));
  return cwd;
}

function queueFile(cwd) {
  return path.join(cwd, '.decant', 'questions', `${RUN_ID}.json`);
}

async function childOperation(cwd, operation, options) {
  const script = `import { ${operation} } from ${JSON.stringify(MODULE_URL)};
    const state = await ${operation}(JSON.parse(process.argv[1]));
    process.stdout.write(JSON.stringify(state));`;
  const { stdout } = await execute(process.execPath, ['--input-type=module', '-e', script, JSON.stringify({ cwd, runId: RUN_ID, ...options })]);
  return JSON.parse(stdout);
}

test('normalization preserves required intent and converts legacy questions to optional slugs', () => {
  assert.deepEqual(normalizeQuestions([' Select a color? ', { id: 'ship_now', title: 'Ship?', required: true, options: [' Yes ', 'No'] }]), [
    { id: 'q-1', title: 'Select a color?', required: false },
    { id: 'ship_now', title: 'Ship?', required: true, options: ['Yes', 'No'] },
  ]);
  assert.deepEqual(normalizeQuestions([], 0), []);
  assert.deepEqual(questionSummary(null), { pending: 0, requiredPending: 0, answered: 0 });
});

test('strict scout wire schema requires all properties and represents optional choices as null', async () => {
  const schema = JSON.parse(await readFile(new URL('../schema/scout-result.schema.json', import.meta.url), 'utf8'));
  function checkStrictObject(value) {
    if (!value || typeof value !== 'object') return;
    if (value.type === 'object') {
      assert.deepEqual([...value.required].sort(), Object.keys(value.properties).sort());
      assert.equal(value.additionalProperties, false);
    }
    assert.equal(Object.hasOwn(value, 'uniqueItems'), false, 'Codex rejects uniqueItems in output schemas');
    for (const child of Object.values(value)) {
      if (Array.isArray(child)) child.forEach(checkStrictObject);
      else checkStrictObject(child);
    }
  }
  checkStrictObject(schema);
  assert.deepEqual(schema.properties.questions.items.properties.options.type, ['array', 'null']);
});

test('nullable wire choices normalize to omitted legacy choices without answering the question', async (t) => {
  const cwd = await workspace(t);
  const wireQuestion = { id: 'format', title: 'Which output format?', required: true, options: null };
  assert.deepEqual(normalizeQuestions([wireQuestion]), [
    { id: 'format', title: 'Which output format?', required: true },
  ]);
  const state = await openQuestions({ cwd, runId: RUN_ID, questions: [wireQuestion] });
  assert.equal(Object.hasOwn(state.questions[0], 'options'), false);
  assert.equal(state.questions[0].status, 'pending');
  assert.equal(state.questions[0].answer, undefined);
  const reopened = await openQuestions({ cwd, runId: RUN_ID, questions: [
    { id: 'format', title: 'Which output format?', required: true },
  ] });
  assert.deepEqual(reopened, state);
  assert.deepEqual(await readQuestions({ cwd, runId: RUN_ID }), state);
});

test('question bounds, unique IDs, and field types fail explicitly', () => {
  for (const input of [null, {}, 'question']) {
    assert.throws(() => normalizeQuestions(input), /array/);
  }
  assert.throws(() => normalizeQuestions(['a', 'b', 'c', 'd']), /At most 3/);
  assert.throws(() => normalizeQuestions([], -1), /limit/);
  assert.throws(() => normalizeQuestions([{ id: 'a', title: 'A' }, { id: 'a', title: 'B' }]), /Duplicate/);
  for (const id of ['../escape', '', 'a/b', 'a.b', '-invalid', 'a'.repeat(65)]) {
    assert.throws(() => normalizeQuestions([{ id, title: 'Question?' }]), /slug/);
  }
  assert.throws(() => normalizeQuestions([{ id: 'a', title: ' ' }]), /non-empty/);
  assert.throws(() => normalizeQuestions([{ id: 'a', title: 'a'.repeat(1001) }]), /1000/);
  assert.throws(() => normalizeQuestions([{ id: 'a', title: 'A', required: 'false' }]), /boolean/);
  for (const options of [[], ['same', ' same '], [1], 'yes', Array(11).fill('x')]) {
    assert.throws(() => normalizeQuestions([{ id: 'a', title: 'A', options }]), /option/);
  }
});

test('an empty fresh workspace needs no Git repository and reads do not create files', async (t) => {
  const cwd = await workspace(t);
  assert.equal(await readQuestions({ cwd, runId: RUN_ID }), null);
  assert.deepEqual(await readdir(cwd), []);
  const state = await openQuestions({ cwd, runId: RUN_ID, questions: [] });
  assert.deepEqual(state, { version: 1, runId: RUN_ID, questions: [] });
  assert.deepEqual(await readQuestions({ cwd, runId: RUN_ID }), state);
});

test('posting is nonblocking, has no selected answer, and returns detached snapshots', async (t) => {
  const cwd = await workspace(t);
  const start = performance.now();
  const state = await openQuestions({ cwd, runId: RUN_ID, questions: [
    { id: 'theme', title: 'Which theme?', options: ['Light', 'Dark'] },
    { id: 'publish', title: 'May I publish?', required: true },
  ] });
  assert.ok(performance.now() - start < 1000);
  assert.deepEqual(questionSummary(state), { pending: 2, requiredPending: 1, answered: 0 });
  assert.ok(state.questions.every((question) => question.status === 'pending' && question.answer === undefined && question.answeredAt === undefined));
  const snapshot = snapshotQuestions(state);
  snapshot.questions[0].options.push('Changed');
  state.questions[0].title = 'Changed';
  const persisted = await readQuestions({ cwd, runId: RUN_ID });
  assert.equal(persisted.questions[0].title, 'Which theme?');
  assert.deepEqual(persisted.questions[0].options, ['Light', 'Dark']);
});

test('explicit free text survives process restart and leaves frozen run evidence untouched', async (t) => {
  const cwd = await workspace(t);
  const frozen = path.join(cwd, '.decant', 'runs', RUN_ID, 'run.json');
  await mkdir(path.dirname(frozen), { recursive: true });
  const evidence = '{"status":"blocked","questionSnapshot":"pending"}\n';
  await writeFile(frozen, evidence);
  await openQuestions({ cwd, runId: RUN_ID, questions: [
    { id: 'theme', title: 'Which theme?', options: ['Light', 'Dark'] },
    { id: 'publish', title: 'May I publish?', required: true },
  ] });
  await childOperation(cwd, 'answerQuestion', { questionId: 'theme', answer: 'Use the system setting instead' });
  const state = await childOperation(cwd, 'readQuestions', {});
  assert.equal(state.questions[0].answer, 'Use the system setting instead');
  assert.ok(Number.isFinite(Date.parse(state.questions[0].answeredAt)));
  assert.deepEqual(questionSummary(state), { pending: 1, requiredPending: 1, answered: 1 });
  assert.equal(await readFile(frozen, 'utf8'), evidence);
  assert.deepEqual(await readdir(path.dirname(queueFile(cwd))), [`${RUN_ID}.json`]);
});

test('registration and answers are idempotent but cannot rewrite existing intent', async (t) => {
  const cwd = await workspace(t);
  const definition = { id: 'color', title: 'Color?', required: false };
  const first = await openQuestions({ cwd, runId: RUN_ID, questions: [definition] });
  assert.deepEqual(await openQuestions({ cwd, runId: RUN_ID, questions: [definition] }), first);
  const answered = await answerQuestion({ cwd, runId: RUN_ID, questionId: 'color', answer: ' Blue ' });
  assert.equal(answered.questions[0].answer, 'Blue');
  assert.deepEqual(await answerQuestion({ cwd, runId: RUN_ID, questionId: 'color', answer: 'Blue' }), answered);
  assert.deepEqual(await openQuestions({ cwd, runId: RUN_ID, questions: [definition] }), answered);
  await assert.rejects(answerQuestion({ cwd, runId: RUN_ID, questionId: 'color', answer: 'Red' }), /already been answered/);
  await assert.rejects(openQuestions({ cwd, runId: RUN_ID, questions: [{ ...definition, required: true }] }), /different definition/);
  await assert.rejects(answerQuestion({ cwd, runId: RUN_ID, questionId: 'missing', answer: 'Yes' }), /not found/);
  await assert.rejects(answerQuestion({ cwd, runId: RUN_ID, questionId: 'color', answer: ' ' }), /non-empty/);
  await assert.rejects(answerQuestion({ cwd, runId: RUN_ID, questionId: 'color', answer: 'x'.repeat(8001) }), /8000/);
  assert.deepEqual(await readQuestions({ cwd, runId: RUN_ID }), answered);
});

test('concurrent processes preserve distinct registrations and distinct answers', async (t) => {
  const cwd = await workspace(t);
  await Promise.all(['first', 'second', 'third'].map((id) => childOperation(cwd, 'openQuestions', {
    questions: [{ id, title: `Question ${id}?`, required: id === 'first' }],
  })));
  await Promise.all(['first', 'second', 'third'].map((id) => childOperation(cwd, 'answerQuestion', {
    questionId: id, answer: `Answer ${id}`,
  })));
  const state = await readQuestions({ cwd, runId: RUN_ID });
  assert.equal(state.questions.length, 3);
  for (const entry of state.questions) assert.equal(entry.answer, `Answer ${entry.id}`);
  assert.deepEqual(questionSummary(state), { pending: 0, requiredPending: 0, answered: 3 });
  await assert.rejects(openQuestions({ cwd, runId: RUN_ID, questions: [{ id: 'fourth', title: 'Fourth?' }] }), /At most 3/);
  assert.deepEqual(await readQuestions({ cwd, runId: RUN_ID }), state);
  assert.deepEqual(await readdir(path.dirname(queueFile(cwd))), [`${RUN_ID}.json`]);
});

test('competing answers to one question retain exactly one explicit answer', async (t) => {
  const cwd = await workspace(t);
  await openQuestions({ cwd, runId: RUN_ID, questions: ['Ready?'] });
  const results = await Promise.allSettled(['Yes', 'No'].map((answer) => childOperation(cwd, 'answerQuestion', { questionId: 'q-1', answer })));
  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
  assert.equal(results.filter((result) => result.status === 'rejected').length, 1);
  assert.ok(['Yes', 'No'].includes((await readQuestions({ cwd, runId: RUN_ID })).questions[0].answer));
});

test('invalid run IDs cannot escape the question store', async (t) => {
  const cwd = await workspace(t);
  for (const runId of ['../escape', RUN_ID + '/other', path.join(cwd, RUN_ID), '', '..']) {
    await assert.rejects(readQuestions({ cwd, runId }), /run ID/);
    await assert.rejects(openQuestions({ cwd, runId, questions: [] }), /run ID/);
    await assert.rejects(answerQuestion({ cwd, runId, questionId: 'q-1', answer: 'Yes' }), /run ID/);
  }
  assert.deepEqual(await readdir(cwd), []);
});

test('symlinked store directories, state files, and lock paths are rejected', async (t) => {
  for (const component of ['.decant', 'questions', 'state', 'lock']) {
    await t.test(component, async (subtest) => {
      const cwd = await workspace(subtest);
      const outside = path.join(cwd, 'outside');
      await mkdir(outside);
      const directory = path.join(cwd, '.decant', 'questions');
      let target;
      if (component === '.decant') target = path.join(cwd, '.decant');
      else if (component === 'questions') {
        await mkdir(path.join(cwd, '.decant'));
        target = directory;
      } else {
        await mkdir(directory, { recursive: true });
        target = component === 'state' ? queueFile(cwd) : path.join(directory, `${RUN_ID}.lock`);
      }
      await symlink(outside, target);
      if (component !== 'lock') await assert.rejects(readQuestions({ cwd, runId: RUN_ID }), /symlink|regular file/);
      await assert.rejects(openQuestions({ cwd, runId: RUN_ID, questions: ['Question?'] }), /symlink|regular file/);
      await assert.rejects(answerQuestion({ cwd, runId: RUN_ID, questionId: 'q-1', answer: 'Yes' }), /symlink|regular file/);
      assert.deepEqual(await readdir(outside), []);
    });
  }
});

test('hard-linked and oversized store files cannot be read or overwritten', async (t) => {
  const cwd = await workspace(t);
  await openQuestions({ cwd, runId: RUN_ID, questions: ['Question?'] });
  const alias = path.join(cwd, 'alias.json');
  await link(queueFile(cwd), alias);
  await assert.rejects(readQuestions({ cwd, runId: RUN_ID }), /regular file/);
  await assert.rejects(answerQuestion({ cwd, runId: RUN_ID, questionId: 'q-1', answer: 'Yes' }), /regular file/);
  await rm(alias);
  await writeFile(queueFile(cwd), ' '.repeat(64 * 1024 + 1));
  await assert.rejects(readQuestions({ cwd, runId: RUN_ID }), /64 KiB/);
});

test('stale and active abandoned locks fail within a bounded interval without stealing ownership', async (t) => {
  const cwd = await workspace(t);
  await openQuestions({ cwd, runId: RUN_ID, questions: ['Question?'] });
  const lock = path.join(path.dirname(queueFile(cwd)), `${RUN_ID}.lock`);
  await mkdir(lock);
  const stale = new Date(Date.now() - 60_000);
  await utimes(lock, stale, stale);
  const started = performance.now();
  await assert.rejects(answerQuestion({ cwd, runId: RUN_ID, questionId: 'q-1', answer: 'Yes' }), /locked/);
  assert.ok(performance.now() - started < 1000);
  assert.deepEqual(await readdir(lock), []);
  await utimes(lock, new Date(), new Date());
  const activeStarted = performance.now();
  await assert.rejects(answerQuestion({ cwd, runId: RUN_ID, questionId: 'q-1', answer: 'Yes' }), /locked/);
  assert.ok(performance.now() - activeStarted < 3000);
  assert.equal((await readQuestions({ cwd, runId: RUN_ID })).questions[0].status, 'pending');
});

test('malformed persisted state is surfaced and never silently replaced', async (t) => {
  const cwd = await workspace(t);
  await mkdir(path.dirname(queueFile(cwd)), { recursive: true });
  await writeFile(queueFile(cwd), '{bad JSON');
  await assert.rejects(readQuestions({ cwd, runId: RUN_ID }), SyntaxError);
  await assert.rejects(openQuestions({ cwd, runId: RUN_ID, questions: ['Question?'] }), SyntaxError);
  assert.equal(await readFile(queueFile(cwd), 'utf8'), '{bad JSON');
  await writeFile(queueFile(cwd), JSON.stringify({ version: 1, runId: RUN_ID, questions: [{
    id: 'question', title: 'Question?', required: false, status: 'pending', askedAt: new Date().toISOString(), answer: 'Implicit answer',
  }] }));
  await assert.rejects(readQuestions({ cwd, runId: RUN_ID }), /cannot have an answer/);
});
