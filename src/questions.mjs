import { randomUUID } from 'node:crypto';
import { constants } from 'node:fs';
import {
  lstat,
  mkdir,
  open,
  realpath,
  rename,
  rmdir,
  unlink,
} from 'node:fs/promises';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const RUN_ID_PATTERN = /^\d{8}T\d{9}Z-[a-z0-9]{8}$/i;
const QUESTION_ID_PATTERN = /^[a-z0-9][a-z0-9_-]{0,63}$/i;
const MAX_QUESTIONS = 3;
const MAX_STORE_BYTES = 64 * 1024;
const LOCK_WAIT_MS = 1500;
const LOCK_STALE_MS = 30_000;

function text(value, label, maximum) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new TypeError(`${label} must be a non-empty string`);
  }
  const trimmed = value.trim();
  if (trimmed.length > maximum) throw new RangeError(`${label} exceeds ${maximum} characters`);
  return trimmed;
}

function validateRunId(runId) {
  if (typeof runId !== 'string' || !RUN_ID_PATTERN.test(runId)) {
    throw new TypeError('Invalid question run ID');
  }
}

/** Normalize at most three questions; legacy strings always remain optional. */
export function normalizeQuestions(input, max = MAX_QUESTIONS) {
  if (!Number.isInteger(max) || max < 0 || max > 100) {
    throw new RangeError('Question limit must be an integer between 0 and 100');
  }
  if (!Array.isArray(input)) throw new TypeError('Questions must be an array');
  if (input.length > max) throw new RangeError(`At most ${max} questions are allowed`);

  const ids = new Set();
  return input.map((raw, index) => {
    const value = typeof raw === 'string' ? { id: `q-${index + 1}`, title: raw } : raw;
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new TypeError(`Question ${index + 1} must be an object or string`);
    }
    if (typeof value.id !== 'string' || !QUESTION_ID_PATTERN.test(value.id)) {
      throw new TypeError('Question ID must be a slug of 1 to 64 letters, digits, underscores, or hyphens');
    }
    if (ids.has(value.id)) throw new TypeError(`Duplicate question ID: ${value.id}`);
    ids.add(value.id);
    if (value.required !== undefined && typeof value.required !== 'boolean') {
      throw new TypeError(`Question ${value.id} required must be a boolean`);
    }
    const question = {
      id: value.id,
      title: text(value.title, `Question ${value.id} title`, 1000),
      required: value.required ?? false,
    };
    // Codex's strict wire schema requires every property, so null represents
    // omitted choices. Legacy callers may continue to omit the property.
    if (value.options !== undefined && value.options !== null) {
      if (!Array.isArray(value.options) || value.options.length < 1 || value.options.length > 10) {
        throw new TypeError(`Question ${value.id} options must contain 1 to 10 strings`);
      }
      question.options = value.options.map((option) => text(option, `Question ${value.id} option`, 500));
      if (new Set(question.options).size !== question.options.length) {
        throw new TypeError(`Question ${value.id} options must be distinct`);
      }
    }
    return question;
  });
}

function timestamp(value, label) {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) {
    throw new TypeError(`Invalid question ${label}`);
  }
  return value;
}

function validateState(value, runId) {
  if (!value || value.version !== 1 || value.runId !== runId) {
    throw new TypeError('Invalid question store version or run ID');
  }
  const definitions = normalizeQuestions(value.questions);
  const questions = definitions.map((definition, index) => {
    const entry = value.questions[index];
    if (typeof entry !== 'object' || typeof entry.required !== 'boolean') {
      throw new TypeError(`Invalid stored question: ${definition.id}`);
    }
    if (!['pending', 'answered'].includes(entry.status)) {
      throw new TypeError(`Invalid question status: ${definition.id}`);
    }
    const question = { ...definition, status: entry.status, askedAt: timestamp(entry.askedAt, 'askedAt') };
    if (entry.status === 'answered') {
      question.answer = text(entry.answer, `Question ${definition.id} answer`, 8000);
      question.answeredAt = timestamp(entry.answeredAt, 'answeredAt');
    } else if (entry.answer !== undefined || entry.answeredAt !== undefined) {
      throw new TypeError(`Pending question ${definition.id} cannot have an answer`);
    }
    return question;
  });
  return { version: 1, runId, questions };
}

/** A detached, validated plain object suitable for frozen run evidence. */
export function snapshotQuestions(state) {
  if (state == null) return null;
  validateRunId(state.runId);
  return validateState(state, state.runId);
}

export function questionSummary(state) {
  const questions = snapshotQuestions(state)?.questions ?? [];
  return {
    pending: questions.filter((question) => question.status === 'pending').length,
    requiredPending: questions.filter((question) => question.status === 'pending' && question.required).length,
    answered: questions.filter((question) => question.status === 'answered').length,
  };
}

async function inspect(file) {
  try {
    return await lstat(file);
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

async function safeDirectory(directory, create) {
  if (create) {
    try {
      await mkdir(directory, { mode: 0o700 });
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
    }
  }
  const info = await inspect(directory);
  if (!info) return false;
  if (info.isSymbolicLink() || !info.isDirectory() || await realpath(directory) !== directory) {
    throw new Error(`Question store directory must not be a symlink or escape the workspace: ${directory}`);
  }
  return true;
}

async function storePaths({ cwd = process.cwd(), runId }, create = false) {
  validateRunId(runId);
  const root = await realpath(path.resolve(cwd));
  const parent = path.join(root, '.decant');
  const directory = path.join(parent, 'questions');
  if (!await safeDirectory(parent, create) || !await safeDirectory(directory, create)) return null;
  return {
    root,
    parent,
    directory,
    file: path.join(directory, `${runId}.json`),
    lock: path.join(directory, `${runId}.lock`),
  };
}

async function checkDirectories(paths) {
  if (!await safeDirectory(paths.parent, false) || !await safeDirectory(paths.directory, false)) {
    throw new Error('Question store directory disappeared');
  }
}

async function checkFile(file) {
  const info = await inspect(file);
  if (info && (info.isSymbolicLink() || !info.isFile() || info.nlink !== 1)) {
    throw new Error(`Question store file must be a regular file without links: ${file}`);
  }
  return info;
}

async function readState(paths, runId) {
  await checkDirectories(paths);
  if (!await checkFile(paths.file)) return null;
  const handle = await open(paths.file, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const info = await handle.stat();
    if (!info.isFile() || info.nlink !== 1 || info.size > MAX_STORE_BYTES) {
      throw new Error('Question store must be a regular file no larger than 64 KiB');
    }
    const value = await handle.readFile('utf8');
    if (Buffer.byteLength(value) > MAX_STORE_BYTES) throw new Error('Question store exceeds 64 KiB');
    await checkDirectories(paths);
    return validateState(JSON.parse(value), runId);
  } finally {
    await handle.close();
  }
}

/** Read live answers without mutating or creating any run artifacts. */
export async function readQuestions(options) {
  const paths = await storePaths(options);
  return paths ? readState(paths, options.runId) : null;
}

async function acquireLock(paths) {
  const deadline = performance.now() + LOCK_WAIT_MS;
  while (true) {
    await checkDirectories(paths);
    try {
      await mkdir(paths.lock, { mode: 0o700 });
      return;
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
    }
    const info = await inspect(paths.lock);
    if (!info) continue;
    if (info.isSymbolicLink() || !info.isDirectory()) {
      throw new Error('Question store lock must be a directory without symlinks');
    }
    if (Date.now() - info.mtimeMs > LOCK_STALE_MS || performance.now() >= deadline) {
      throw new Error(`Question store is locked: ${paths.lock}. Retry after the writer finishes; remove an abandoned lock only after verifying no writer is running.`);
    }
    await delay(25);
  }
}

async function writeState(paths, state) {
  const serialized = `${JSON.stringify(state, null, 2)}\n`;
  if (Buffer.byteLength(serialized) > MAX_STORE_BYTES) throw new RangeError('Question store exceeds 64 KiB');
  const temporary = path.join(paths.directory, `.${state.runId}.${randomUUID()}.tmp`);
  let handle;
  try {
    await checkDirectories(paths);
    await checkFile(paths.file);
    handle = await open(temporary, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
    await handle.writeFile(serialized, 'utf8');
    await handle.sync();
    await handle.close();
    handle = null;
    await checkDirectories(paths);
    await checkFile(paths.file);
    await rename(temporary, paths.file);
    const directoryHandle = await open(paths.directory, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
    try {
      await directoryHandle.sync();
    } finally {
      await directoryHandle.close();
    }
  } finally {
    if (handle) await handle.close();
    await unlink(temporary).catch((error) => { if (error.code !== 'ENOENT') throw error; });
  }
}

async function updateQuestions(options, update) {
  const paths = await storePaths(options, true);
  await acquireLock(paths);
  try {
    const current = await readState(paths, options.runId);
    const next = update(current);
    if (next !== current) await writeState(paths, next);
    return snapshotQuestions(next);
  } finally {
    await checkDirectories(paths);
    await rmdir(paths.lock);
  }
}

/** Post questions immediately; no answer is selected and no response is awaited. */
export async function openQuestions({ cwd, runId, questions = [] }) {
  const definitions = normalizeQuestions(questions);
  return updateQuestions({ cwd, runId }, (current) => {
    const state = current ?? { version: 1, runId, questions: [] };
    const additions = [];
    for (const definition of definitions) {
      const previous = state.questions.find((question) => question.id === definition.id);
      if (previous) {
        const [existing] = normalizeQuestions([previous]);
        if (JSON.stringify(existing) !== JSON.stringify(definition)) {
          throw new Error(`Question ${definition.id} already exists with a different definition`);
        }
      } else {
        additions.push({ ...definition, status: 'pending', askedAt: new Date().toISOString() });
      }
    }
    if (state.questions.length + additions.length > MAX_QUESTIONS) {
      throw new RangeError(`At most ${MAX_QUESTIONS} questions are allowed per run`);
    }
    if (current && additions.length === 0) return current;
    return { ...state, questions: [...state.questions, ...additions] };
  });
}

/** Record explicit free text, accepting choices as suggestions rather than a restriction. */
export async function answerQuestion({ cwd, runId, questionId, answer }) {
  if (typeof questionId !== 'string' || !QUESTION_ID_PATTERN.test(questionId)) {
    throw new TypeError('Invalid question ID');
  }
  const normalizedAnswer = text(answer, `Question ${questionId} answer`, 8000);
  return updateQuestions({ cwd, runId }, (current) => {
    const question = current?.questions.find((entry) => entry.id === questionId);
    if (!question) throw new Error(`Question not found: ${questionId}`);
    if (question.status === 'answered') {
      if (question.answer === normalizedAnswer) return current;
      throw new Error(`Question ${questionId} has already been answered`);
    }
    return {
      ...current,
      questions: current.questions.map((entry) => entry.id === questionId
        ? { ...entry, status: 'answered', answer: normalizedAnswer, answeredAt: new Date().toISOString() }
        : entry),
    };
  });
}
