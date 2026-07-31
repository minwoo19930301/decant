import {
  appendFile,
  mkdir,
  open,
  readdir,
  rename,
  rmdir,
  stat,
  unlink,
} from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { mapPool, runVerification } from './executor.mjs';
import { DEFAULT_PROVIDER, resolveProvider } from './providers/index.mjs';
import {
  architectPrompt,
  explainerPrompt,
  liveReaderPrompt,
  makerPrompt,
  reviewerPrompt,
  scoutPrompt,
} from './prompts.mjs';
import {
  aggregateReader10,
  evaluateReader10,
  evaluateReader10Payload,
  READER10_PERSONAS,
} from './reader10.mjs';
import { generateReport } from './report.mjs';
import { validateConfig } from './config.mjs';
import { readJson, readText, runId, sha256, writeJson, writeText } from './utils.mjs';

const SCOUT_SCHEMA = fileURLToPath(new URL('../schema/scout-result.schema.json', import.meta.url));
const REVIEWER_SCHEMA = fileURLToPath(new URL('../schema/reviewer-result.schema.json', import.meta.url));
const READER_SCHEMA = fileURLToPath(new URL('../schema/reader-result.schema.json', import.meta.url));
const RUN_ID_PATTERN = /^\d{8}T\d{9}Z-[A-Za-z0-9]{8}$/;

const OUTPUTS = Object.freeze({
  scout: 'scout.json',
  architect: 'architect.md',
  maker: 'maker.md',
  verification: 'verification.json',
  reviewer: 'reviewer.json',
  explainer: 'summary.md',
  readers: 'readers.json',
  events: 'events.jsonl',
  report: 'report.html',
});

function nonEmptyTask(task) {
  const value = typeof task === 'string'
    ? task.trim()
    : String(task?.description ?? task?.task ?? task?.title ?? '').trim();
  if (!value) throw new TypeError('task must be a non-empty string');
  return value;
}

function routeStage(route, id) {
  return route?.byId?.[id] ?? route?.stages?.find((stage) => stage.id === id);
}

function roleSelection(catalog, role) {
  const selected = catalog?.roles?.[role];
  if (!selected?.model) throw new TypeError(`catalog is missing model role: ${role}`);
  return selected;
}

function stageSelection(stage, config, catalog) {
  const selected = roleSelection(catalog, stage.modelRole);
  const requested = config.effort?.[stage.id] ?? stage.effort ?? selected.effort;
  const supported = selected.supportedEfforts ?? [];
  const effort = supported.length === 0 || supported.includes(requested)
    ? requested
    : selected.effort ?? supported[0];
  return { ...selected, effort };
}

function stageInvocationBounds(stage) {
  if (!stage || stage.enabled === false || stage.activation === 'never') {
    return { minimum: 0, maximum: 0 };
  }
  if (stage.activation === 'conditional') return { minimum: 0, maximum: 1 };
  return { minimum: 1, maximum: 1 };
}

function baseInvocationBounds(route) {
  return ['scout', 'architect', 'maker', 'reviewer', 'explainer']
    .map((id) => stageInvocationBounds(routeStage(route, id)))
    .reduce((total, bounds) => ({
      minimum: total.minimum + bounds.minimum,
      maximum: total.maximum + bounds.maximum,
    }), { minimum: 0, maximum: 0 });
}

/** Describe the bounded Codex invocation plan. Counts are invocations, not price estimates. */
export function buildRunPlan({ task, route, catalog, config, liveReaders = false } = {}) {
  const normalizedTask = nonEmptyTask(task);
  validateConfig(config);
  if (!route?.assessment || !Array.isArray(route?.stages)) {
    throw new TypeError('route must be a routeTask result');
  }

  const stages = route.stages.map((stage) => {
    const selection = stage.id === 'reader'
      ? stageSelection(stage, config, catalog)
      : stageSelection(stage, config, catalog);
    return {
      ...stage,
      model: selection.model,
      effort: selection.effort,
      modelSource: selection.source ?? 'provided',
    };
  });
  const base = baseInvocationBounds(route);
  const rounds = liveReaders && routeStage(route, 'reader')?.enabled !== false
    ? config.readerGate.maxRounds
    : 0;
  const minimum = base.minimum + (rounds > 0 ? READER10_PERSONAS.length : 0);
  const maximum = base.maximum
    + (rounds * READER10_PERSONAS.length)
    + Math.max(0, rounds - 1);
  const estimate = {
    minimum,
    maximum,
    conditionalInvocations: base.maximum - base.minimum,
    unit: 'codex-exec-invocations',
  };

  return {
    task: normalizedTask,
    assessment: route.assessment,
    routingPolicy: route.policy ?? null,
    stages,
    liveReaders: rounds > 0,
    invocationEstimate: estimate,
    // Kept for 0.1 API compatibility. It does not estimate token or currency cost.
    callEstimate: estimate,
  };
}

/** Decide whether the frontier architect checkpoint is worth one invocation. */
export function decideAdvisor({
  stage,
  assessment,
  scout,
  budget,
  used,
  minimumInvocations,
} = {}) {
  const activation = stage?.enabled === false ? 'never' : stage?.activation ?? 'always';
  const openQuestionCount = Array.isArray(scout?.open_questions) ? scout.open_questions.length : 0;
  const evidence = {
    assessment: {
      role: assessment?.role ?? 'unknown',
      score: assessment?.score ?? null,
    },
    scout: {
      artifact: OUTPUTS.scout,
      openQuestionCount,
    },
  };
  const budgetEvidence = {
    unit: 'codex-exec-invocations',
    budget,
    usedBefore: used,
    // Keep this additive with advisorInvocations in every mode. The always-on
    // plan minimum already contains the pending architect call.
    mandatoryRemaining: Math.max(
      0,
      minimumInvocations - used - (activation === 'always' ? 1 : 0),
    ),
    advisorInvocations: 0,
    headroom: budget - minimumInvocations,
  };

  if (activation === 'never') {
    return {
      decision: 'skip',
      reasonCode: 'policy-never',
      reason: 'The configured policy disables the frontier advisor checkpoint.',
      evidence,
      budget: budgetEvidence,
    };
  }
  if (activation === 'always') {
    return {
      decision: 'invoke',
      reasonCode: stage?.reasonCode ?? 'policy-always',
      reason: assessment?.role === 'economy'
        ? 'The configured policy requires an advisor for every task.'
        : 'The initial assessment is not economy-tier, so frontier advice is required.',
      evidence,
      budget: { ...budgetEvidence, advisorInvocations: 1 },
    };
  }
  if (openQuestionCount === 0) {
    return {
      decision: 'skip',
      reasonCode: 'easy-no-open-questions',
      reason: 'Economy-tier work has no unresolved scout questions, so the fixed advisor overhead is skipped.',
      evidence,
      budget: budgetEvidence,
    };
  }
  if (budget < minimumInvocations + 1) {
    return {
      decision: 'budget-blocked',
      reasonCode: 'advisor-budget-blocked',
      reason: 'Scout found unresolved questions, but the invocation budget cannot fund the advisor and all mandatory stages.',
      evidence,
      budget: { ...budgetEvidence, advisorInvocations: 1, requiredTotal: minimumInvocations + 1 },
    };
  }
  return {
    decision: 'invoke',
    reasonCode: 'scout-open-questions',
    reason: 'Scout recorded unresolved questions, so the frontier advisor is invoked before mutation.',
    evidence,
    budget: { ...budgetEvidence, advisorInvocations: 1 },
  };
}

function skippedAdvisorArtifact(decision) {
  return `# 고급 조언 생략\n\n판단 근거: ${decision.reason}\n\nscout.json의 근거로 뒷받침되는 가장 작은 직접 계획으로 진행합니다. 누락된 요구사항을 지어내거나 권한 범위를 넓히거나 설정된 검증을 생략하지 않습니다.`;
}

export function validateRunRequest({
  task,
  route,
  catalog,
  config,
  liveReaders = false,
  budgetCalls,
  allowVerificationCommands = false,
} = {}) {
  const plan = buildRunPlan({ task, route, catalog, config, liveReaders });
  const budget = budgetCalls === undefined
    ? config.limits.maxModelCalls
    : Number(budgetCalls);
  if (!Number.isInteger(budget) || budget < 1) {
    throw new RangeError('invocation budget must be a positive integer');
  }
  if (budget < plan.invocationEstimate.minimum) {
    throw new RangeError(
      `invocation budget ${budget} is below the minimum ${plan.invocationEstimate.minimum}`,
    );
  }
  if (config.verification.commands.length > 0 && !allowVerificationCommands) {
    throw new Error(
      'verification commands are configured; rerun with --allow-verification-commands after reviewing them',
    );
  }
  return { plan, budget };
}

function assertScout(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError('scout result must be an object');
  }
  if (typeof value.summary !== 'string' || !value.summary.trim()) {
    throw new TypeError('scout.summary must be a non-empty string');
  }
  for (const key of ['facts', 'evidence', 'open_questions']) {
    if (!Array.isArray(value[key])) throw new TypeError(`scout.${key} must be an array`);
  }
  if (value.facts.some((item) => typeof item !== 'string' || !item.trim())) {
    throw new TypeError('scout.facts must contain non-empty strings');
  }
  if (value.open_questions.some((item) => typeof item !== 'string' || !item.trim())) {
    throw new TypeError('scout.open_questions must contain non-empty strings');
  }
  for (const [index, item] of value.evidence.entries()) {
    if (!item || typeof item !== 'object') throw new TypeError(`scout.evidence[${index}] must be an object`);
    if (typeof item.title !== 'string' || typeof item.url !== 'string' || typeof item.excerpt !== 'string') {
      throw new TypeError(`scout.evidence[${index}] must contain title, url, and excerpt strings`);
    }
  }
  return value;
}

function assessReviewer(value) {
  const problems = [];
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { passed: false, status: 'fail', problems: ['reviewer result is not an object'] };
  }
  if (!['pass', 'fail', 'uncertain'].includes(value.verdict)) problems.push('invalid reviewer verdict');
  if (typeof value.summary !== 'string' || !value.summary.trim()) problems.push('missing reviewer summary');
  if (!Array.isArray(value.findings)) problems.push('reviewer findings must be an array');
  if (!Array.isArray(value.acceptance_checks) || value.acceptance_checks.length === 0) {
    problems.push('reviewer acceptance_checks must be non-empty');
  }
  const checks = Array.isArray(value.acceptance_checks) ? value.acceptance_checks : [];
  const findings = Array.isArray(value.findings) ? value.findings : [];
  if (findings.some((finding) => (
    !finding
    || !['critical', 'high', 'medium', 'low'].includes(finding.severity)
    || typeof finding.message !== 'string'
    || !finding.message.trim()
    || typeof finding.evidence !== 'string'
    || !finding.evidence.trim()
  ))) problems.push('reviewer finding is incomplete');
  if (checks.some((check) => (
    !check
    || typeof check.criterion !== 'string'
    || typeof check.passed !== 'boolean'
    || typeof check.evidence !== 'string'
    || !check.evidence.trim()
  ))) problems.push('reviewer acceptance check is incomplete');
  const unsupportedPass = value.verdict === 'pass' && checks.some((check) => !check.passed);
  if (unsupportedPass) problems.push('reviewer verdict contradicts a failed acceptance check');
  if (value.verdict === 'pass' && findings.some((finding) => ['critical', 'high'].includes(finding.severity))) {
    problems.push('reviewer pass verdict contradicts a blocking finding');
  }
  const passed = problems.length === 0
    && value.verdict === 'pass'
    && checks.every((check) => check.passed);
  return { passed, status: passed ? 'pass' : 'fail', problems };
}

function assertLiveReader(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError('reader result must be an object');
  }
  if (typeof value.understood !== 'boolean') throw new TypeError('reader.understood must be boolean');
  if (typeof value.restatement !== 'string') throw new TypeError('reader.restatement must be string');
  if (!Array.isArray(value.blocking_ambiguities)) throw new TypeError('reader.blocking_ambiguities must be an array');
  if (!Array.isArray(value.jargon)) throw new TypeError('reader.jargon must be an array');
  if (typeof value.action !== 'string') throw new TypeError('reader.action must be string');
  return value;
}

function skippedReviewer(reason) {
  return {
    verdict: 'uncertain',
    summary: reason,
    findings: [],
    acceptance_checks: [{ criterion: 'Correctness review enabled', passed: false, evidence: reason }],
  };
}

function deriveRisks(scout, reviewer, verification) {
  const findings = Array.isArray(reviewer?.findings)
    ? reviewer.findings.map((finding) => finding.message).filter(Boolean)
    : [];
  const questions = Array.isArray(scout?.open_questions) ? scout.open_questions : [];
  const risks = [...findings, ...questions];
  if (verification.status === 'unverified') {
    risks.push('구현 변경에 대해 승인된 결정론적 검증 명령이 실행되지 않았습니다.');
  }
  if (risks.length === 0) {
    risks.push('모델 생성 결과와 기록된 근거는 최종 적용 전에 사람이 확인해야 합니다.');
  }
  return [...new Set(risks)];
}

function deriveNextSteps(reviewer, verification) {
  const failed = Array.isArray(reviewer?.acceptance_checks)
    ? reviewer.acceptance_checks.filter((check) => !check.passed).map((check) => `미통과 기준 확인: ${check.criterion}`)
    : [];
  const steps = [...failed];
  if (verification.status === 'unverified') {
    steps.push('decant.config.json에 구조화된 검증 명령을 추가하고 명시적으로 실행을 승인합니다.');
  } else if (verification.status === 'fail') {
    steps.push('verification.json의 실패 출력을 확인하고 수정한 뒤 다시 실행합니다.');
  }
  steps.push('report.html에서 변경 결과, 근거, 남은 위험을 사람이 최종 확인합니다.');
  return [...new Set(steps)];
}

function verificationPayload(verification) {
  return {
    status: verification.status,
    checks: verification.checks.map((check) => ({
      name: check.name,
      passed: check.passed,
      detail: check.detail,
    })),
  };
}

function canonicalPayload({ task, summary, evidence, verification, risks, nextSteps }) {
  return { task, summary, evidence, verification: verificationPayload(verification), risks, nextSteps };
}

function statusFromGates({ truth, verification, readers, renderAudit }) {
  if (!truth.passed || verification.status === 'fail' || !readers.passed || renderAudit?.passed === false) {
    return 'fail';
  }
  if (verification.status === 'unverified') return 'warn';
  return 'pass';
}

function reportData(manifest, { summary, verification, readers, evidence, nextSteps }) {
  return {
    title: 'Decant 실행 보고서',
    task: manifest.task,
    summary,
    status: manifest.status,
    runId: manifest.runId,
    generatedAt: manifest.updatedAt,
    routing: { decisions: manifest.routing },
    stages: Object.values(manifest.stages),
    verification,
    reader10: readers,
    evidence,
    nextSteps,
  };
}

async function renderRunReport(manifest, data, outputFile) {
  const html = generateReport(reportData(manifest, data));
  await writeText(outputFile, html);
  return html;
}

async function collectArtifactHashes(runDir) {
  const entries = await readdir(runDir, { withFileTypes: true });
  const artifacts = {};
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (!entry.isFile() || entry.name === 'run.json') continue;
    const file = path.join(runDir, entry.name);
    const content = await readText(file);
    const details = await stat(file);
    artifacts[entry.name] = { sha256: sha256(content), bytes: details.size };
  }
  return artifacts;
}

function safeArtifactPath(runDir, relative) {
  if (typeof relative !== 'string' || !relative || path.isAbsolute(relative)) {
    throw new Error(`invalid frozen artifact path: ${relative}`);
  }
  const root = path.resolve(runDir);
  const target = path.resolve(root, relative);
  if (target === root || !target.startsWith(`${root}${path.sep}`)) {
    throw new Error(`frozen artifact escapes run directory: ${relative}`);
  }
  return target;
}

/** Verify every recorded frozen artifact without writing to the run directory. */
export async function verifyFrozenRun(runDir) {
  const root = path.resolve(runDir);
  const manifest = await readJson(path.join(root, 'run.json'));
  if (!manifest.artifacts || typeof manifest.artifacts !== 'object') {
    throw new Error('run manifest has no frozen artifact hashes');
  }
  const names = Object.keys(manifest.artifacts);
  if (!names.includes(OUTPUTS.report)) throw new Error('frozen manifest does not include report.html');
  for (const name of names) {
    const expected = manifest.artifacts[name];
    const file = safeArtifactPath(root, name);
    const content = await readText(file);
    const actual = sha256(content);
    if (actual !== expected?.sha256) {
      throw new Error(`frozen artifact hash mismatch: ${name}`);
    }
    if (Number.isInteger(expected?.bytes) && Buffer.byteLength(content, 'utf8') !== expected.bytes) {
      throw new Error(`frozen artifact size mismatch: ${name}`);
    }
  }
  return {
    manifest,
    artifacts: manifest.artifacts,
    reportFile: path.join(root, OUTPUTS.report),
  };
}

const OWNER_TOKEN_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const RECLAIM_GUARD_SUFFIX = '.reclaim';
const RECLAIM_GUARD_ATTEMPTS = 200;
const RECLAIM_GUARD_DELAY_MS = 5;
const RECLAIM_ENTRY_PATTERN = /^(owner|claim)-([1-9]\d*)-([0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i;

function probeLockHolder(pid) {
  if (!Number.isSafeInteger(pid) || pid <= 0) return 'unknown';
  try {
    process.kill(pid, 0);
    return 'alive';
  } catch (error) {
    return error?.code === 'ESRCH' ? 'dead' : 'unknown';
  }
}

function validOwnerToken(value) {
  return typeof value === 'string' && OWNER_TOKEN_PATTERN.test(value);
}

function validWorkspaceRecord(record) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) return false;
  if (typeof record.runId !== 'string' || !record.runId.trim()) return false;
  if (!Number.isSafeInteger(record.pid) || record.pid <= 0) return false;
  if (typeof record.createdAt !== 'string' || !Number.isFinite(Date.parse(record.createdAt))) return false;
  // Records written before owner tokens were introduced remain reclaimable,
  // but only when their PID is provably dead.
  return record.ownerToken === undefined || validOwnerToken(record.ownerToken);
}

async function readWorkspaceLock(lockFile) {
  let content;
  try {
    content = await readText(lockFile);
  } catch (error) {
    if (error?.code === 'ENOENT') return { status: 'missing', record: null };
    throw error;
  }

  let record;
  try {
    record = JSON.parse(content);
  } catch {
    return { status: 'invalid', record: null };
  }

  return validWorkspaceRecord(record)
    ? { status: 'valid', record }
    : { status: 'invalid', record };
}

async function createExclusiveRecord(file, record, openFile) {
  // Serialize before creating the path so clock/JSON failures cannot leave an
  // empty lock behind.
  const content = `${JSON.stringify(record)}\n`;
  let handle;
  let created = false;
  let failure;
  try {
    handle = await openFile(file, 'wx');
    created = true;
    try {
      await handle.writeFile(content);
    } catch (error) {
      failure = error;
    }
    try {
      await handle.close();
    } catch (error) {
      failure ??= error;
      try { await handle.close(); } catch {}
    }
  } catch (error) {
    failure = error;
  }

  if (!failure) return;
  if (created) {
    try {
      await unlink(file);
    } catch (cleanupError) {
      if (cleanupError?.code !== 'ENOENT') {
        // Preserve the operation failure; a later attempt will fail closed on
        // any file that could not be removed.
      }
    }
  }
  throw failure;
}

async function removeRecordOwnedBy(file, ownerToken) {
  let record;
  try {
    record = JSON.parse(await readText(file));
  } catch (error) {
    if (error?.code === 'ENOENT') return false;
    if (error instanceof SyntaxError) return false;
    throw error;
  }

  if (record?.ownerToken !== ownerToken) return false;
  try {
    await unlink(file);
    return true;
  } catch (error) {
    if (error?.code === 'ENOENT') return false;
    throw error;
  }
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function reclaimEntryName(state, pid, token) {
  return `${state}-${pid}-${token}`;
}

function parseReclaimEntry(name) {
  const match = RECLAIM_ENTRY_PATTERN.exec(name);
  if (!match) return null;
  const pid = Number(match[2]);
  if (!Number.isSafeInteger(pid) || pid <= 0) return null;
  return { state: match[1].toLowerCase(), pid, token: match[3].toLowerCase() };
}

async function cleanCandidateDirectory({ candidateDir, candidateEntry }) {
  try {
    await unlink(path.join(candidateDir, candidateEntry));
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
  try {
    await rmdir(candidateDir);
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
}

async function installFreshReclaimGuard({ guardDir, token, openFile }) {
  const entryName = reclaimEntryName('owner', process.pid, token);
  const candidateDir = `${guardDir}.candidate-${process.pid}-${token}`;
  await mkdir(candidateDir, { mode: 0o700 });

  let handle;
  let initialized = false;
  let failure;
  try {
    handle = await openFile(path.join(candidateDir, entryName), 'wx');
    try {
      await handle.close();
      initialized = true;
    } catch (error) {
      failure = error;
      try {
        await handle.close();
        initialized = true;
      } catch {}
    }
    if (!failure) {
      await rename(candidateDir, guardDir);
      return { guardDir, entryName };
    }
  } catch (error) {
    failure = error;
  }

  // A failed rename leaves only our uniquely named candidate. It is never
  // necessary (or safe) to remove the shared guard directory here.
  try {
    await cleanCandidateDirectory({ candidateDir, candidateEntry: entryName });
  } catch (cleanupError) {
    failure ??= cleanupError;
  }
  if (!initialized && handle) {
    try { await handle.close(); } catch {}
  }
  throw failure;
}

async function inspectReclaimGuard(guardDir) {
  let entries;
  try {
    entries = await readdir(guardDir, { withFileTypes: true });
  } catch (error) {
    if (error?.code === 'ENOENT') return { status: 'missing' };
    if (error?.code === 'ENOTDIR') return { status: 'invalid' };
    throw error;
  }

  if (entries.length === 0) return { status: 'empty' };
  if (entries.length !== 1 || !entries[0].isFile()) return { status: 'invalid' };
  const parsed = parseReclaimEntry(entries[0].name);
  if (!parsed) return { status: 'invalid' };
  return { status: 'owned', entryName: entries[0].name, ...parsed };
}

async function classifyPid(probePid, pid) {
  try {
    const observed = await probePid(pid);
    return observed === 'alive' || observed === 'dead' ? observed : 'unknown';
  } catch {
    return 'unknown';
  }
}

async function acquireReclaimGuard({ lockFile, probePid, openFile }) {
  const guardDir = `${lockFile}${RECLAIM_GUARD_SUFFIX}`;
  const token = randomUUID();

  for (let attempt = 0; attempt < RECLAIM_GUARD_ATTEMPTS; attempt += 1) {
    try {
      return await installFreshReclaimGuard({ guardDir, token, openFile });
    } catch (error) {
      if (!['EEXIST', 'ENOTEMPTY', 'ENOTDIR', 'EISDIR'].includes(error?.code)) throw error;
    }

    const current = await inspectReclaimGuard(guardDir);
    if (current.status === 'missing') continue;
    if (current.status === 'empty') {
      try {
        await rmdir(guardDir);
      } catch (error) {
        // A successful contender can replace the empty directory with a fully
        // initialized nonempty guard before this rmdir. Never remove it.
        if (!['ENOENT', 'ENOTEMPTY', 'EEXIST'].includes(error?.code)) throw error;
      }
      continue;
    }
    if (current.status === 'invalid') {
      throw new Error(`reclaim guard for ${lockFile} is invalid or unidentifiable`);
    }

    const holderState = await classifyPid(probePid, current.pid);
    if (holderState === 'dead') {
      const claimName = reclaimEntryName('claim', process.pid, token);
      try {
        // The exact old filename is the compare-and-swap token. A competing
        // reclaimer can rename it only once, and the new filename immediately
        // exposes this live claimant's PID and unguessable token.
        await rename(
          path.join(guardDir, current.entryName),
          path.join(guardDir, claimName),
        );
        return { guardDir, entryName: claimName };
      } catch (error) {
        if (error?.code === 'ENOENT') continue;
        throw error;
      }
    }

    if (attempt + 1 < RECLAIM_GUARD_ATTEMPTS) {
      await delay(RECLAIM_GUARD_DELAY_MS);
    }
  }

  throw new Error(`another mutating Decant run is acquiring or reclaiming ${lockFile}`);
}

async function releaseReclaimGuard({ guardDir, entryName }) {
  try {
    await unlink(path.join(guardDir, entryName));
  } catch (error) {
    if (error?.code === 'ENOENT') {
      throw new Error(`reclaim guard ownership was lost for ${guardDir}`);
    }
    throw error;
  }

  try {
    await rmdir(guardDir);
  } catch (error) {
    // Once our exact entry is gone, a contender may atomically install its
    // nonempty guard before rmdir. That guard belongs to the contender.
    if (!['ENOENT', 'ENOTEMPTY', 'EEXIST'].includes(error?.code)) throw error;
  }
}

async function withReclaimGuard(options, operation) {
  const guard = await acquireReclaimGuard(options);
  let result;
  let operationError;
  try {
    result = await operation();
  } catch (error) {
    operationError = error;
  }

  let guardError;
  try {
    await releaseReclaimGuard(guard);
  } catch (error) {
    guardError = error;
  }

  if (operationError) throw operationError;
  if (guardError) throw guardError;
  return result;
}

async function writeAndVerifyWorkspaceLock({ lockFile, record, openFile }) {
  try {
    await createExclusiveRecord(lockFile, record, openFile);
    const installed = await readWorkspaceLock(lockFile);
    if (installed.status !== 'valid' || installed.record.ownerToken !== record.ownerToken) {
      throw new Error(`workspace lock ownership verification failed for ${lockFile}`);
    }
  } catch (error) {
    try { await removeRecordOwnedBy(lockFile, record.ownerToken); } catch {}
    throw error;
  }
}

/**
 * Acquire the mutating-run workspace lock under a short-lived atomic reclaim
 * guard. Only ESRCH proves that a recorded PID is dead. Live, invalid, and
 * unknown holders fail closed regardless of record age. Every new lock has an
 * unguessable owner token used by the guarded release path.
 */
export async function acquireWorkspaceLock({
  lockFile,
  runId,
  clock,
  ownerToken = randomUUID(),
  probePid = probeLockHolder,
  openFile = open,
} = {}) {
  if (typeof lockFile !== 'string' || !lockFile) throw new TypeError('lockFile must be a non-empty string');
  if (typeof runId !== 'string' || !runId) throw new TypeError('runId must be a non-empty string');
  if (typeof clock !== 'function') throw new TypeError('clock must be a function');
  if (!validOwnerToken(ownerToken)) throw new TypeError('ownerToken must be a UUID v4');
  if (typeof probePid !== 'function') throw new TypeError('probePid must be a function');
  if (typeof openFile !== 'function') throw new TypeError('openFile must be a function');

  const record = {
    runId,
    pid: process.pid,
    createdAt: clock(),
    ownerToken,
  };

  return withReclaimGuard({ lockFile, runId, clock, probePid, openFile }, async () => {
    const current = await readWorkspaceLock(lockFile);
    if (current.status === 'missing') {
      await writeAndVerifyWorkspaceLock({ lockFile, record, openFile });
      return ownerToken;
    }
    if (current.status !== 'valid') {
      throw new Error(`another mutating Decant run holds ${lockFile} (owner record is invalid or unidentifiable)`);
    }

    let holderState = 'unknown';
    try {
      const observed = await probePid(current.record.pid);
      if (observed === 'alive' || observed === 'dead') holderState = observed;
    } catch {
      holderState = 'unknown';
    }
    if (holderState !== 'dead') {
      throw new Error(
        `another mutating Decant run holds ${lockFile}`
        + ` (runId ${current.record.runId}, pid ${current.record.pid}, started ${current.record.createdAt}, state ${holderState})`,
      );
    }

    // Every acquisition path honors this guard, so this unlink/create pair has
    // no unguarded gap for another Decant process to enter. Re-read and
    // PID classification above happen only after the guard is held.
    await unlink(lockFile);
    await writeAndVerifyWorkspaceLock({ lockFile, record, openFile });
    return ownerToken;
  });
}

/** Remove the workspace lock only when the guarded record still has our token. */
export async function releaseWorkspaceLock({
  lockFile,
  ownerToken,
  clock,
  openFile = open,
} = {}) {
  if (typeof lockFile !== 'string' || !lockFile) throw new TypeError('lockFile must be a non-empty string');
  if (!validOwnerToken(ownerToken)) throw new TypeError('ownerToken must be a UUID v4');
  if (typeof clock !== 'function') throw new TypeError('clock must be a function');
  return withReclaimGuard({ lockFile, runId: `release-${process.pid}`, clock, openFile }, async () => (
    removeRecordOwnedBy(lockFile, ownerToken)
  ));
}

export async function runPipeline({
  task,
  cwd = process.cwd(),
  config,
  catalog,
  route,
  liveReaders = config?.readerGate?.mode === 'live',
  budgetCalls,
  allowVerificationCommands = false,
  provider,
  runCodexImpl,
  runVerificationImpl = runVerification,
  now = () => new Date(),
  idFactory,
} = {}) {
  // The pipeline never names a CLI. It resolves whichever provider the config
  // selected and calls the one stage contract every provider implements, so
  // adding an execution backend does not touch this file. `runStageImpl` stays
  // injectable for tests.
  const activeProvider = provider ?? resolveProvider(config?.provider ?? DEFAULT_PROVIDER);
  const runStageImpl = runCodexImpl ?? ((options) => activeProvider.runStage(options));
  const root = path.resolve(cwd);
  const { plan, budget } = validateRunRequest({
    task,
    route,
    catalog,
    config,
    liveReaders,
    budgetCalls,
    allowVerificationCommands,
  });
  const clock = () => {
    const value = now();
    return (value instanceof Date ? value : new Date(value)).toISOString();
  };
  const id = idFactory ? idFactory() : runId(new Date(clock()));
  if (!RUN_ID_PATTERN.test(id)) throw new Error(`invalid run id: ${id}`);

  const stateDir = path.join(root, '.decant');
  const runsDir = path.join(stateDir, 'runs');
  const runDir = path.join(runsDir, id);
  const manifestFile = path.join(runDir, 'run.json');
  const eventsFile = path.join(runDir, OUTPUTS.events);
  const lockFile = path.join(stateDir, 'workspace.lock');
  const mutationEnabled = routeStage(route, 'maker')?.enabled !== false;
  let lockOwnerToken;
  let runCreated = false;
  let writeQueue = Promise.resolve();
  let eventSequence = 0;

  const manifest = {
    version: 1,
    runId: id,
    task: plan.task,
    cwd: root,
    status: 'running',
    createdAt: clock(),
    updatedAt: clock(),
    assessment: plan.assessment,
    routingPolicy: plan.routingPolicy,
    // Which backend actually ran the stages, and what it could and could not
    // enforce. A report that does not say this cannot be read honestly: a
    // "read-only" stage means a kernel sandbox on one provider and a tool
    // allowlist on another.
    provider: {
      id: activeProvider.id,
      displayName: activeProvider.displayName,
      executable: activeProvider.executable,
      capabilities: { ...activeProvider.capabilities },
    },
    invocationEstimate: plan.invocationEstimate,
    invocations: { used: 0, budget },
    calls: { used: 0, budget, unit: `${activeProvider.id}-stage-invocations` },
    routing: plan.stages.map((stage) => ({
      stage: stage.id,
      profile: stage.modelRole,
      effort: stage.effort,
      model: stage.model,
      enabled: stage.enabled !== false,
      activation: stage.activation ?? (stage.enabled === false ? 'never' : 'always'),
      checkpoint: stage.checkpoint ?? null,
      decision: stage.decision ?? (stage.enabled === false ? 'skip' : 'invoke'),
      reasonCode: stage.reasonCode ?? null,
      reason: stage.purpose,
    })),
    stages: {},
    evidence: [],
    risks: [],
    nextSteps: [],
    gates: {},
  };

  function queueWrite(operation) {
    const queued = writeQueue.then(operation, operation);
    writeQueue = queued.catch(() => {});
    return queued;
  }

  async function persist() {
    manifest.updatedAt = clock();
    await writeJson(manifestFile, manifest);
  }

  function recordEvent(type, data = {}) {
    const event = {
      sequence: ++eventSequence,
      at: clock(),
      type,
      ...data,
    };
    return queueWrite(async () => {
      await appendFile(eventsFile, `${JSON.stringify(event)}\n`, 'utf8');
      await persist();
    });
  }

  function consumeInvocation(label) {
    if (manifest.invocations.used >= budget) {
      throw new RangeError(`invocation budget exhausted before ${label}`);
    }
    manifest.invocations.used += 1;
    manifest.calls.used = manifest.invocations.used;
  }

  function stageContract(id) {
    const stage = plan.stages.find((item) => item.id === id);
    if (!stage) throw new Error(`missing stage contract: ${id}`);
    return stage;
  }

  async function invokeStage(id, {
    prompt,
    outputFile,
    outputSchema,
    sandbox = 'read-only',
    search = false,
    stageId = id,
  }) {
    const stage = stageContract(id);
    if (stage.enabled === false) return null;
    consumeInvocation(stageId);
    await recordEvent('stage.started', { stage: stageId, model: stage.model, effort: stage.effort });
    const started = Date.now();
    try {
      const result = await runStageImpl({
        prompt,
        cwd: root,
        model: stage.model,
        effort: stage.effort,
        sandbox,
        search,
        outputFile,
        outputSchema,
        timeoutMs: config.limits.stageTimeoutMs,
      });
      const output = await readText(outputFile);
      if (!output.trim()) throw new Error(`${stageId} produced an empty output`);
      manifest.stages[stageId] = {
        id: stageId,
        title: stage.purpose,
        status: 'pass',
        enabled: true,
        profile: stage.modelRole,
        model: stage.model,
        effort: stage.effort,
        durationMs: result?.durationMs ?? Date.now() - started,
        output,
      };
      await recordEvent('stage.completed', { stage: stageId, durationMs: manifest.stages[stageId].durationMs });
      return { result, output };
    } catch (error) {
      manifest.stages[stageId] = {
        id: stageId,
        title: stage.purpose,
        status: 'fail',
        enabled: true,
        profile: stage.modelRole,
        model: stage.model,
        effort: stage.effort,
        durationMs: Date.now() - started,
        output: error.message,
      };
      await recordEvent('stage.failed', { stage: stageId, error: error.message });
      throw error;
    }
  }

  try {
    await mkdir(stateDir, { recursive: true });
    if (mutationEnabled) {
      lockOwnerToken = await acquireWorkspaceLock({ lockFile, runId: id, clock });
    }
    await mkdir(runsDir, { recursive: true });
    await mkdir(runDir);
    runCreated = true;
    await writeText(eventsFile, '');
    await persist();
    await recordEvent('run.started', { task: plan.task });

    const scoutFile = path.join(runDir, OUTPUTS.scout);
    await invokeStage('scout', {
      prompt: scoutPrompt(plan.task, runDir),
      outputFile: scoutFile,
      outputSchema: SCOUT_SCHEMA,
      search: true,
    });
    const scout = assertScout(await readJson(scoutFile));
    manifest.evidence = scout.evidence;
    await persist();

    const architectFile = path.join(runDir, OUTPUTS.architect);
    const architect = stageContract('architect');
    const advisorDecision = decideAdvisor({
      stage: architect,
      assessment: plan.assessment,
      scout,
      budget,
      used: manifest.invocations.used,
      minimumInvocations: plan.invocationEstimate.minimum,
    });
    const advisorRoute = manifest.routing.find((row) => row.stage === 'architect');
    Object.assign(advisorRoute, advisorDecision);
    await recordEvent('routing.decided', {
      stage: 'architect',
      decision: advisorDecision.decision,
      reasonCode: advisorDecision.reasonCode,
      evidence: advisorDecision.evidence,
      budget: advisorDecision.budget,
    });
    if (advisorDecision.decision === 'budget-blocked') {
      const output = `# ADVISOR BLOCKED\n\n${advisorDecision.reason}`;
      await writeText(architectFile, output);
      manifest.stages.architect = {
        id: 'architect', title: architect.purpose, status: 'fail', enabled: true,
        profile: architect.modelRole, model: architect.model, effort: architect.effort, output,
      };
      await recordEvent('stage.blocked', {
        stage: 'architect', reasonCode: advisorDecision.reasonCode,
      });
      throw new RangeError(advisorDecision.reason);
    }
    if (advisorDecision.decision === 'skip') {
      const output = skippedAdvisorArtifact(advisorDecision);
      await writeText(architectFile, output);
      manifest.stages.architect = {
        id: 'architect', title: architect.purpose, status: 'skipped', enabled: false,
        profile: architect.modelRole, model: architect.model, effort: architect.effort, output,
      };
      await recordEvent('stage.skipped', {
        stage: 'architect', reasonCode: advisorDecision.reasonCode,
      });
    } else {
      await invokeStage('architect', {
        prompt: architectPrompt(plan.task, runDir, plan.assessment),
        outputFile: architectFile,
      });
    }

    const maker = stageContract('maker');
    const makerFile = path.join(runDir, OUTPUTS.maker);
    if (maker.enabled === false) {
      const reason = 'SKIPPED: this request was classified as read-only.';
      await writeText(makerFile, reason);
      manifest.stages.maker = {
        id: 'maker', title: maker.purpose, status: 'skipped', enabled: false,
        profile: maker.modelRole, model: maker.model, effort: maker.effort, output: reason,
      };
      await recordEvent('stage.skipped', { stage: 'maker', reason });
    } else {
      await invokeStage('maker', {
        prompt: makerPrompt(plan.task, runDir),
        outputFile: makerFile,
        sandbox: 'workspace-write',
      });
    }

    const verificationFile = path.join(runDir, OUTPUTS.verification);
    const configuredCommands = config.verification.commands;
    let verification;
    if (configuredCommands.length === 0 && maker.enabled === false) {
      verification = {
        status: 'not-applicable',
        passed: true,
        authorized: false,
        checks: [{
          name: 'Mutation verification',
          passed: true,
          detail: 'No mutation stage ran, so command verification was not applicable.',
        }],
      };
    } else if (configuredCommands.length === 0) {
      verification = {
        status: 'unverified',
        passed: false,
        authorized: false,
        checks: [{
          name: 'Deterministic verification commands',
          passed: false,
          detail: 'No verification commands were configured. This run cannot claim verified implementation.',
        }],
      };
    } else {
      await recordEvent('verification.started', { count: configuredCommands.length });
      const checks = [];
      for (const [index, command] of configuredCommands.entries()) {
        let result;
        try {
          result = await runVerificationImpl(command, {
            cwd: root,
            timeoutMs: config.limits.commandTimeoutMs,
          });
        } catch (error) {
          result = {
            code: 1,
            timedOut: false,
            stdout: '',
            stderr: error.message,
            executionError: true,
          };
        }
        checks.push({
          name: `${command.command} ${(command.args ?? []).join(' ')}`.trim(),
          passed: result.code === 0 && result.timedOut !== true,
          detail: [
            `exit=${result.code}`,
            result.timedOut ? 'timed out' : '',
            result.truncated ? 'output truncated' : '',
            result.stdout?.slice(-4_000) ?? '',
            result.stderr?.slice(-4_000) ?? '',
          ].filter(Boolean).join('\n'),
          command: { command: command.command, args: command.args ?? [] },
          index,
        });
      }
      verification = {
        status: checks.every((check) => check.passed) ? 'pass' : 'fail',
        passed: checks.length > 0 && checks.every((check) => check.passed),
        authorized: true,
        checks,
      };
      await recordEvent('verification.completed', { status: verification.status });
    }
    await writeJson(verificationFile, verification);
    manifest.gates.verification = { status: verification.status, passed: verification.passed };
    await persist();

    const reviewer = stageContract('reviewer');
    const reviewerFile = path.join(runDir, OUTPUTS.reviewer);
    let reviewerResult;
    let truth;
    if (reviewer.enabled === false) {
      reviewerResult = skippedReviewer('Correctness reviewer was disabled by the route.');
      await writeJson(reviewerFile, reviewerResult);
      manifest.stages.reviewer = {
        id: 'reviewer', title: reviewer.purpose, status: 'skipped', enabled: false,
        profile: reviewer.modelRole, model: reviewer.model, effort: reviewer.effort,
        output: JSON.stringify(reviewerResult, null, 2),
      };
      truth = { passed: false, status: 'fail', problems: ['correctness reviewer was disabled'] };
      await recordEvent('stage.skipped', { stage: 'reviewer', reason: truth.problems[0] });
    } else {
      try {
        await invokeStage('reviewer', {
          prompt: reviewerPrompt(plan.task, runDir),
          outputFile: reviewerFile,
          outputSchema: REVIEWER_SCHEMA,
        });
        reviewerResult = await readJson(reviewerFile);
        truth = assessReviewer(reviewerResult);
      } catch (error) {
        const raw = await readText(reviewerFile, { allowMissing: true, fallback: '' });
        if (raw) await writeText(path.join(runDir, 'reviewer.invalid.txt'), raw);
        reviewerResult = skippedReviewer(`Correctness review failed: ${error.message}`);
        await writeJson(reviewerFile, reviewerResult);
        truth = { passed: false, status: 'fail', problems: [error.message] };
        await recordEvent('reviewer.invalid', { error: error.message });
      }
    }
    manifest.gates.truth = truth;
    manifest.stages.reviewer.output = JSON.stringify(reviewerResult, null, 2);
    manifest.stages.reviewer.status = truth.passed ? 'pass' : 'fail';
    await persist();

    const explainer = stageContract('explainer');
    const summaryFile = path.join(runDir, OUTPUTS.explainer);
    let summary;
    if (explainer.enabled === false) {
      summary = 'SKIPPED: model-generated explanation was disabled.';
      await writeText(summaryFile, summary);
      manifest.stages.explainer = {
        id: 'explainer', title: explainer.purpose, status: 'skipped', enabled: false,
        profile: explainer.modelRole, model: explainer.model, effort: explainer.effort, output: summary,
      };
      await recordEvent('stage.skipped', { stage: 'explainer', reason: summary });
    } else {
      await invokeStage('explainer', {
        prompt: explainerPrompt(plan.task, runDir),
        outputFile: summaryFile,
      });
      summary = await readText(summaryFile);
    }

    manifest.risks = deriveRisks(scout, reviewerResult, verification);
    manifest.nextSteps = deriveNextSteps(reviewerResult, verification);
    let payload = canonicalPayload({
      task: plan.task,
      summary,
      evidence: scout.evidence,
      verification,
      risks: manifest.risks,
      nextSteps: manifest.nextSteps,
    });

    const readersFile = path.join(runDir, OUTPUTS.readers);
    const reportFile = path.join(runDir, OUTPUTS.report);
    const readerStage = stageContract('reader');
    let readers;
    if (readerStage.enabled === false) {
      readers = {
        version: 1,
        mode: 'disabled',
        semanticVerified: false,
        passed: false,
        pass: false,
        status: 'fail',
        minPass: config.readerGate.minPass,
        totalPersonas: 0,
        passedPersonas: 0,
        failedPersonas: 0,
        criticalCount: 1,
        criticalIssues: [{ code: 'reader-disabled', message: 'Reader gate was disabled.' }],
        personas: [],
      };
    } else if (!liveReaders) {
      readers = evaluateReader10Payload(payload, { minPass: config.readerGate.minPass });
    } else {
      const rounds = [];
      const configuredModels = config.readerGate.models;
      for (let round = 1; round <= config.readerGate.maxRounds; round += 1) {
        const remaining = budget - manifest.invocations.used;
        if (remaining < READER10_PERSONAS.length) {
          readers = {
            version: 1,
            mode: 'live',
            semanticVerified: true,
            passed: false,
            pass: false,
            status: 'fail',
            minPass: config.readerGate.minPass,
            totalPersonas: READER10_PERSONAS.length,
            passedPersonas: 0,
            failedPersonas: READER10_PERSONAS.length,
            criticalCount: 1,
            criticalIssues: [{ code: 'budget-limited', message: '다음 Reader-10 라운드의 호출 예산이 부족합니다.' }],
            personas: [],
            budgetLimited: true,
            rounds,
          };
          break;
        }
        manifest.status = !truth.passed || verification.status === 'fail'
          ? 'fail'
          : verification.status === 'unverified'
            ? 'warn'
            : 'pass';
        const draftFile = path.join(runDir, `report.round-${round}.html`);
        await renderRunReport(manifest, {
          summary, verification, readers: readers ?? null, evidence: scout.evidence,
          nextSteps: manifest.nextSteps,
        }, draftFile);
        const evaluatedContentHash = sha256(JSON.stringify(payload));
        await recordEvent('reader.round.started', { round, evaluatedContentHash });
        const personaResults = await mapPool(
          READER10_PERSONAS,
          config.readerGate.concurrency,
          async (persona, index) => {
            const selectedModel = configuredModels.length > 0
              ? configuredModels[index % configuredModels.length]
              : readerStage.model;
            const outputFile = path.join(runDir, `reader-${round}-${persona.id}.json`);
            consumeInvocation(`reader-${round}-${persona.id}`);
            try {
              const result = await runStageImpl({
                prompt: liveReaderPrompt(draftFile, persona),
                cwd: root,
                model: selectedModel,
                effort: readerStage.effort,
                sandbox: 'read-only',
                outputFile,
                outputSchema: READER_SCHEMA,
                timeoutMs: config.limits.stageTimeoutMs,
              });
              const raw = assertLiveReader(await readJson(outputFile));
              await recordEvent('reader.completed', {
                round, persona: persona.id, understood: raw.understood, durationMs: result?.durationMs,
              });
              return { persona, raw, model: selectedModel };
            } catch (error) {
              await recordEvent('reader.failed', { round, persona: persona.id, error: error.message });
              return {
                persona,
                model: selectedModel,
                raw: {
                  understood: false,
                  restatement: '',
                  blocking_ambiguities: [`Reader execution failed: ${error.message}`],
                  jargon: [],
                  action: '',
                },
              };
            }
          },
        );
        const personas = personaResults.map(({ persona, raw, model }) => ({
          id: persona.id,
          name: persona.name,
          description: persona.description,
          model,
          passed: raw.understood === true,
          restatement: raw.restatement,
          checks: [{
            id: 'live-understanding',
            label: '목적·결과·근거·위험·다음 행동을 재진술한다',
            passed: raw.understood === true,
            severity: 'warning',
            detail: raw.blocking_ambiguities.join(' · ') || '이해도 문제 없음',
          }],
          raw,
        }));
        const aggregate = aggregateReader10(personas, { minPass: config.readerGate.minPass });
        const roundResult = {
          version: 1,
          mode: 'live',
          semanticVerified: true,
          effort: readerStage.effort,
          round,
          evaluatedContentHash,
          ...aggregate,
          personas,
        };
        rounds.push(roundResult);
        readers = { ...roundResult, rounds };
        await recordEvent('reader.round.completed', {
          round, passed: readers.passed, passedPersonas: readers.passedPersonas,
        });
        if (readers.passed || round === config.readerGate.maxRounds) break;

        const requiredForRevision = 1 + READER10_PERSONAS.length;
        if (budget - manifest.invocations.used < requiredForRevision) {
          readers = {
            ...readers,
            passed: false,
            pass: false,
            status: 'fail',
            budgetLimited: true,
            criticalCount: readers.criticalCount + 1,
            criticalIssues: [
              ...readers.criticalIssues,
              { code: 'budget-limited', message: '설명 수정과 다음 Reader-10 라운드의 호출 예산이 부족합니다.' },
            ],
          };
          break;
        }
        const feedbackFile = path.join(runDir, `reader-feedback-${round}.json`);
        await writeJson(feedbackFile, {
          round,
          failed: personas.filter((persona) => !persona.passed).map((persona) => ({
            id: persona.id,
            ambiguities: persona.raw.blocking_ambiguities,
            jargon: persona.raw.jargon,
            action: persona.raw.action,
          })),
        });
        await invokeStage('explainer', {
          stageId: `explainer-revision-${round}`,
          prompt: explainerPrompt(plan.task, runDir, feedbackFile),
          outputFile: summaryFile,
        });
        summary = await readText(summaryFile);
        payload = canonicalPayload({
          task: plan.task,
          summary,
          evidence: scout.evidence,
          verification,
          risks: manifest.risks,
          nextSteps: manifest.nextSteps,
        });
      }
    }

    manifest.gates.reader = {
      status: readers.status,
      passed: readers.passed,
      mode: readers.mode,
      semanticVerified: readers.semanticVerified === true,
    };
    manifest.status = statusFromGates({ truth, verification, readers });
    await writeJson(readersFile, readers);
    await persist();

    let html = await renderRunReport(manifest, {
      summary, verification, readers, evidence: scout.evidence, nextSteps: manifest.nextSteps,
    }, reportFile);
    const renderAudit = evaluateReader10(html, { minPass: config.readerGate.minPass });
    readers.renderAudit = {
      mode: 'deterministic-render',
      passed: renderAudit.passed,
      passedPersonas: renderAudit.passedPersonas,
      totalPersonas: renderAudit.totalPersonas,
      criticalCount: renderAudit.criticalCount,
      criticalIssues: renderAudit.criticalIssues,
    };
    manifest.gates.render = readers.renderAudit;
    manifest.status = statusFromGates({ truth, verification, readers, renderAudit });
    await writeJson(readersFile, readers);
    html = await renderRunReport(manifest, {
      summary, verification, readers, evidence: scout.evidence, nextSteps: manifest.nextSteps,
    }, reportFile);
    await recordEvent('run.completed', { status: manifest.status });
    await writeQueue;
    manifest.artifacts = await collectArtifactHashes(runDir);
    await persist();
    return { runDir, reportFile, manifest, readers, verification, reviewer: reviewerResult, html };
  } catch (error) {
    if (runCreated) {
      manifest.status = 'error';
      manifest.error = { name: error.name, message: error.message };
      try {
        await recordEvent('run.failed', { error: error.message });
        await writeQueue;
        await persist();
      } catch {
        // Preserve the original pipeline error when failure recording also fails.
      }
    }
    throw error;
  } finally {
    if (lockOwnerToken) {
      await releaseWorkspaceLock({ lockFile, ownerToken: lockOwnerToken, clock });
    }
  }
}

/** Re-render to a new file. The original report and manifest remain unchanged. */
export async function regenerateReport(runDir, { outputFile } = {}) {
  const root = path.resolve(runDir);
  const manifest = await readJson(path.join(root, 'run.json'));
  const verification = await readJson(path.join(root, OUTPUTS.verification));
  const readers = await readJson(path.join(root, OUTPUTS.readers));
  const scout = assertScout(await readJson(path.join(root, OUTPUTS.scout)));
  const summary = await readText(path.join(root, OUTPUTS.explainer));
  const target = path.resolve(outputFile ?? path.join(root, 'report.regenerated.html'));
  if (target === path.join(root, OUTPUTS.report)) {
    throw new Error('regeneration cannot overwrite the frozen report.html');
  }
  const html = generateReport(reportData(manifest, {
    summary,
    verification,
    readers,
    evidence: scout.evidence,
    nextSteps: manifest.nextSteps,
  }));
  await writeText(target, html);
  return { outputFile: target, html, manifest };
}
