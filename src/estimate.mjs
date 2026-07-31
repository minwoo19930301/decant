import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

/**
 * Estimate what a run will cost before starting it.
 *
 * Borrowed premise, from a sibling project (swarmscope): decide whether the work
 * is worth the agents *before* the real run spends anything. Its own model is a
 * parallel critical-path simulator, which does not apply here — this pipeline is
 * sequential — so only the premise carries over.
 *
 * The estimate comes from this repository's own recorded runs. Every completed
 * stage already stores its `durationMs`, its capability profile, and its effort
 * in `run.json`, so past runs are a calibration set that costs nothing to
 * collect and gets better with use. That matters because the benchmarks showed
 * the pipeline is worth roughly five times the tokens on a large task and a
 * clear loss on a small one, and a user cannot make that call without a number
 * in front of them.
 *
 * With no local history the seed table below is used and labelled as a seed. The
 * seeds are medians of three real runs on 2026-07-31 (Kiro backend, Sonnet for
 * the working stages, Haiku for the cheap ones) and are not a general benchmark:
 * a different backend, model, or machine will differ, which is exactly why local
 * history overrides them.
 */
const SEED_SECONDS = Object.freeze({
  'scout/economy/low': 17,
  'architect/frontier/max': 44,
  'maker/balanced/medium': 37,
  'reviewer/frontier/high': 81,
  'reviewer/frontier/medium': 43,
  'explainer/balanced/low': 31,
  'reader/economy/low': 20,
});
const SEED_FALLBACK_SECONDS = 45;
const MAX_RUNS_SAMPLED = 200;

function key(stageId, profile, effort) {
  return `${stageId}/${profile}/${effort}`;
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round((sorted[middle - 1] + sorted[middle]) / 2)
    : sorted[middle];
}

/**
 * Collect per-stage durations from recorded runs.
 *
 * @returns {Promise<{samples: Map<string, number[]>, runs: number}>}
 */
export async function collectHistory(runsDir) {
  const samples = new Map();
  let runs = 0;
  const entries = await readdir(runsDir, { withFileTypes: true }).catch((error) => {
    if (error.code === 'ENOENT') return [];
    throw error;
  });
  const directories = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
    .slice(-MAX_RUNS_SAMPLED);
  for (const name of directories) {
    let manifest;
    try {
      // eslint-disable-next-line no-await-in-loop
      manifest = JSON.parse(await readFile(path.join(runsDir, name, 'run.json'), 'utf8'));
    } catch {
      continue; // a partial or hand-edited run is not calibration data
    }
    let used = false;
    for (const stage of Object.values(manifest?.stages ?? {})) {
      if (stage?.status !== 'pass') continue;
      if (!Number.isFinite(stage.durationMs) || stage.durationMs <= 0) continue;
      if (!stage.profile || !stage.effort) continue;
      const id = key(stage.id, stage.profile, stage.effort);
      if (!samples.has(id)) samples.set(id, []);
      samples.get(id).push(Math.round(stage.durationMs / 1000));
      used = true;
    }
    if (used) runs += 1;
  }
  return { samples, runs };
}

/**
 * Estimate a plan's wall clock and model calls.
 *
 * Verification commands are excluded: they are the caller's own programs and
 * their runtime is not this project's to guess. Tokens are excluded because
 * nothing here can observe them — a fabricated token number would be worse than
 * none, so the caller is pointed at the provider instead.
 *
 * @param {{stages: Array<{id: string, modelRole: string, effort: string, enabled?: boolean}>,
 *          invocationEstimate?: {minimum: number, maximum: number}}} plan
 * @param {{samples?: Map<string, number[]>, runs?: number}} [history]
 */
export function estimatePlan(plan, history = {}) {
  const samples = history.samples ?? new Map();
  const stages = [];
  let measured = 0;
  let seeded = 0;

  for (const stage of plan.stages ?? []) {
    if (stage.enabled === false) continue;
    if (stage.id === 'reader' && stage.modelCalls === 0) continue;
    const id = key(stage.id, stage.modelRole, stage.effort);
    const observed = samples.get(id);
    if (observed?.length) {
      stages.push({
        stage: stage.id,
        profile: stage.modelRole,
        effort: stage.effort,
        seconds: median(observed),
        source: 'local-history',
        sampleCount: observed.length,
      });
      measured += 1;
    } else {
      stages.push({
        stage: stage.id,
        profile: stage.modelRole,
        effort: stage.effort,
        seconds: SEED_SECONDS[id] ?? SEED_FALLBACK_SECONDS,
        source: SEED_SECONDS[id] ? 'seed' : 'seed-default',
        sampleCount: 0,
      });
      seeded += 1;
    }
  }

  const seconds = stages.reduce((total, stage) => total + stage.seconds, 0);
  return {
    seconds,
    stages,
    calls: plan.invocationEstimate ?? null,
    basis: {
      runsSampled: history.runs ?? 0,
      stagesFromHistory: measured,
      stagesFromSeed: seeded,
      // Stated so the number is never mistaken for a measurement of this task.
      confidence: measured === 0
        ? 'seed table only; no runs recorded in this workspace yet'
        : `${measured} of ${measured + seeded} stages calibrated from ${history.runs} local run(s)`,
    },
    excluded: [
      'verification commands — your programs, not ours to guess',
      'tokens and currency — not observable from here; check your provider',
    ],
  };
}

/** One-line summary for the CLI. */
export function formatEstimate(estimate) {
  const minutes = estimate.seconds / 60;
  const rounded = minutes < 1
    ? `${estimate.seconds}s`
    : `~${minutes < 10 ? minutes.toFixed(1) : Math.round(minutes)}m`;
  const calls = estimate.calls
    ? `${estimate.calls.minimum}..${estimate.calls.maximum} calls`
    : 'calls unknown';
  return `${rounded} of model time, ${calls} (${estimate.basis.confidence})`;
}
