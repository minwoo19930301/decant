import { readFile } from 'node:fs/promises';

/**
 * A declared approval contract: the conditions a human wrote down *before* the
 * work, that a reviewer must answer one by one.
 *
 * Without this, `decant review` asks the model to invent its own
 * `acceptance_checks`, which means a model grades itself against criteria it
 * chose. On a live run it derived eight sensible criteria from the task text —
 * but nothing forced that list to be complete, and a model that quietly drops an
 * inconvenient requirement passes. Declaring the criteria moves that choice back
 * to the person who cares about the outcome.
 *
 * The gate policy below is Proofline's, applied to declared criteria: a failed
 * high- or critical-risk criterion blocks; a criterion with no answer or no
 * evidence blocks if it is critical, and is a visible gap otherwise.
 */
export const RISK_LEVELS = Object.freeze(['critical', 'high', 'medium', 'low']);
const BLOCKING_RISKS = Object.freeze(['critical', 'high']);
const MAX_CRITERIA = 100;

function fail(message) {
  throw new TypeError(`invalid approval contract: ${message}`);
}

/** Validate a parsed contract and return it normalised. */
export function validateContract(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('must be an object');
  if (value.version !== 1) fail('version must equal 1');
  const unknown = Object.keys(value).filter((key) => !['version', 'criteria'].includes(key));
  if (unknown.length) fail(`unsupported keys: ${unknown.join(', ')}`);
  if (!Array.isArray(value.criteria) || value.criteria.length === 0) {
    fail('criteria must be a non-empty array');
  }
  if (value.criteria.length > MAX_CRITERIA) fail(`at most ${MAX_CRITERIA} criteria`);

  const seen = new Set();
  const criteria = value.criteria.map((entry, index) => {
    const where = `criteria[${index}]`;
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) fail(`${where} must be an object`);
    const extra = Object.keys(entry).filter((key) => !['id', 'requirement', 'risk'].includes(key));
    if (extra.length) fail(`${where} has unsupported keys: ${extra.join(', ')}`);
    if (typeof entry.id !== 'string' || !/^[a-z0-9][a-z0-9-]{0,63}$/.test(entry.id)) {
      fail(`${where}.id must be lowercase letters, digits, and hyphens`);
    }
    if (seen.has(entry.id)) fail(`${where}.id is duplicated: ${entry.id}`);
    seen.add(entry.id);
    if (typeof entry.requirement !== 'string' || !entry.requirement.trim()) {
      fail(`${where}.requirement must be a non-empty string`);
    }
    const risk = entry.risk ?? 'medium';
    if (!RISK_LEVELS.includes(risk)) {
      fail(`${where}.risk must be one of: ${RISK_LEVELS.join(', ')}`);
    }
    return { id: entry.id, requirement: entry.requirement.trim(), risk };
  });
  return { version: 1, criteria };
}

/** Load and validate a contract from disk. */
export async function loadContract(file) {
  let parsed;
  try {
    parsed = JSON.parse(await readFile(file, 'utf8'));
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new TypeError(`invalid approval contract: ${file} is not valid JSON: ${error.message}`);
    }
    throw error;
  }
  return validateContract(parsed);
}

/** Render the criteria for a prompt. */
export function renderContract(contract) {
  return contract.criteria
    .map((entry) => `- id \`${entry.id}\` (risk: ${entry.risk}) — ${entry.requirement}`)
    .join('\n');
}

/**
 * Check a reviewer result against the declared contract.
 *
 * Deliberately deterministic and independent of the reviewer's own verdict: the
 * point is that the model does not get to decide whether it answered the
 * question.
 *
 * @returns {{passed: boolean, blocking: string[], gaps: string[], answered: number, total: number}}
 */
export function checkAgainstContract(contract, result) {
  const answers = new Map();
  for (const check of Array.isArray(result?.acceptance_checks) ? result.acceptance_checks : []) {
    // The reviewer is told to put the criterion id in `criterion`; accept an
    // exact id, or a criterion string that starts with the id, so a reviewer that
    // writes "single-file: works when opened directly" still resolves.
    const declared = contract.criteria.find((entry) => (
      check?.criterion === entry.id
      || (typeof check?.criterion === 'string' && check.criterion.trim().startsWith(entry.id))
    ));
    if (declared && !answers.has(declared.id)) answers.set(declared.id, check);
  }

  const blocking = [];
  const gaps = [];
  for (const entry of contract.criteria) {
    const answer = answers.get(entry.id);
    const blocks = BLOCKING_RISKS.includes(entry.risk);
    if (!answer) {
      (entry.risk === 'critical' ? blocking : gaps)
        .push(`${entry.id}: no answer from the reviewer`);
      continue;
    }
    const hasEvidence = typeof answer.evidence === 'string' && answer.evidence.trim().length > 0;
    if (answer.passed === false) {
      (blocks ? blocking : gaps).push(`${entry.id}: reviewer rejected it`);
      continue;
    }
    if (answer.passed !== true) {
      (entry.risk === 'critical' ? blocking : gaps)
        .push(`${entry.id}: reviewer recorded no decision`);
      continue;
    }
    if (!hasEvidence) {
      (entry.risk === 'critical' ? blocking : gaps)
        .push(`${entry.id}: accepted with no evidence`);
    }
  }

  return {
    passed: blocking.length === 0 && gaps.length === 0,
    blocking,
    gaps,
    answered: answers.size,
    total: contract.criteria.length,
  };
}
