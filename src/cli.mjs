#!/usr/bin/env node

import { randomUUID } from 'node:crypto';
import {
  existsSync,
  lstatSync,
  realpathSync,
  statSync,
} from 'node:fs';
import {
  copyFile,
  realpath,
  rename,
  stat,
  unlink,
} from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { discoverCatalog } from './catalog.mjs';
import { CONFIG_FILENAME, DEFAULT_CONFIG, loadConfig } from './config.mjs';
import { spawnCapture } from './executor.mjs';
import { routeTask } from './router.mjs';
import {
  ensureDir,
  exists,
  latestRun,
  readJson,
  writeJson,
} from './utils.mjs';

export const HELP = `Rein — keep a coding-agent run on a short rein
Explicit scope. Risk-aware effort. Inspectable evidence. Separate verdicts.
Routing + invocation ceiling. Formerly Relay10 / DisciplinedRun.

Usage:
  rein init [--force]
  rein doctor [--json]
  rein route <task> [--json]
  rein run <task> [--dry-run] [--live-readers] [--budget-calls N] [--allow-verification-commands]
  rein inspect [run-id] [--json]
  rein report [run-id] [--output file]
  rein replay [run-id] --frozen [--output file]

Safety:
  Config cannot replace the Codex executable or model-catalog command.
  Configured verification commands run only with --allow-verification-commands.
  report writes report.regenerated.html by default and never replaces report.html.
  replay --frozen verifies artifact hashes and never changes the frozen run.

Model stages run through the Codex CLI only. Reports are written in Korean.
Run artifacts: .rein/runs/<run-id>/
`;

export const RUN_ID_PATTERN = /^\d{8}T\d{9}Z-[a-z0-9]{8}$/i;

/** Human-readable CLI error for missing executables and other failures. */
export function formatCliError(error) {
  const message = error?.message || String(error);
  const syscall = typeof error?.syscall === 'string' ? error.syscall : '';
  const missingExecutable = error?.code === 'ENOENT'
    && (syscall.startsWith('spawn ') || message.startsWith('spawn '));
  if (missingExecutable) {
    const command = error.path || error.cmd || 'executable';
    return `${command} not found on PATH. Rein model stages require an authenticated Codex CLI (install Codex, then re-run rein doctor).`;
  }
  return message;
}

const BOOLEAN = 'boolean';
const VALUE = 'value';
const COMMAND_SPECS = Object.freeze({
  init: {
    minPositionals: 0,
    maxPositionals: 0,
    flags: { force: { key: 'force', type: BOOLEAN } },
  },
  doctor: {
    minPositionals: 0,
    maxPositionals: 0,
    flags: { json: { key: 'json', type: BOOLEAN } },
  },
  route: {
    minPositionals: 1,
    maxPositionals: Number.POSITIVE_INFINITY,
    flags: { json: { key: 'json', type: BOOLEAN } },
  },
  run: {
    minPositionals: 1,
    maxPositionals: Number.POSITIVE_INFINITY,
    flags: {
      'dry-run': { key: 'dryRun', type: BOOLEAN },
      'live-readers': { key: 'liveReaders', type: BOOLEAN },
      'budget-calls': { key: 'budgetCalls', type: VALUE },
      'allow-verification-commands': { key: 'allowVerificationCommands', type: BOOLEAN },
    },
  },
  inspect: {
    minPositionals: 0,
    maxPositionals: 1,
    flags: { json: { key: 'json', type: BOOLEAN } },
  },
  report: {
    minPositionals: 0,
    maxPositionals: 1,
    flags: { output: { key: 'output', type: VALUE } },
  },
  replay: {
    minPositionals: 0,
    maxPositionals: 1,
    flags: {
      frozen: { key: 'frozen', type: BOOLEAN },
      output: { key: 'output', type: VALUE },
    },
  },
});

/** Parse one command against its own option allowlist. */
export function parseCommandLine(argv) {
  if (!Array.isArray(argv)) throw new TypeError('CLI arguments must be an array');
  if (argv.length === 0 || (argv.length === 1 && argv[0] === '--help')) {
    return { command: null, positionals: [], flags: { help: true } };
  }

  const command = argv[0];
  if (command === 'help') {
    if (argv.length !== 1) throw new Error('help does not accept arguments or options');
    return { command, positionals: [], flags: { help: true } };
  }
  if (command.startsWith('-')) throw new Error(`Option must follow a command: ${command}`);

  const spec = COMMAND_SPECS[command];
  if (!spec) throw new Error(`Unknown command: ${command}`);

  const positionals = [];
  const flags = {};
  for (let index = 1; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--') {
      positionals.push(...argv.slice(index + 1));
      break;
    }
    if (!token.startsWith('-')) {
      positionals.push(token);
      continue;
    }
    if (!token.startsWith('--')) {
      throw new Error(`Unknown option for ${command}: ${token}`);
    }

    const separator = token.indexOf('=');
    const rawName = token.slice(2, separator === -1 ? undefined : separator);
    const inlineValue = separator === -1 ? undefined : token.slice(separator + 1);
    const definition = rawName === 'help'
      ? { key: 'help', type: BOOLEAN }
      : spec.flags[rawName];
    if (!definition) throw new Error(`Unknown option for ${command}: --${rawName}`);
    if (Object.hasOwn(flags, definition.key)) {
      throw new Error(`Duplicate option for ${command}: --${rawName}`);
    }

    if (definition.type === BOOLEAN) {
      if (inlineValue !== undefined) throw new Error(`Option --${rawName} does not take a value`);
      flags[definition.key] = true;
      continue;
    }

    let value = inlineValue;
    if (value === undefined) {
      const candidate = argv[index + 1];
      if (candidate === undefined || candidate.startsWith('--')) {
        throw new Error(`Option --${rawName} requires a value`);
      }
      value = candidate;
      index += 1;
    }
    if (value.length === 0) throw new Error(`Option --${rawName} requires a non-empty value`);
    flags[definition.key] = value;
  }

  if (!flags.help && positionals.length < spec.minPositionals) {
    throw new Error(`${command} requires ${command === 'route' || command === 'run' ? 'a task' : 'an argument'}`);
  }
  if (!flags.help && positionals.length > spec.maxPositionals) {
    throw new Error(`${command} accepts at most ${spec.maxPositionals} positional argument`);
  }
  return { command, positionals, flags };
}

function routeOptions(config) {
  return {
    balancedThreshold: config.routing?.balancedThreshold,
    frontierThreshold: config.routing?.frontierThreshold,
    advisorMode: config.routing?.advisorMode,
    jurySize: 10,
    quorum: config.readerGate?.minPass ?? 9,
    maxRounds: config.readerGate?.maxRounds ?? 2,
  };
}

export async function configAndCatalog(cwd, {
  loadConfigImpl = loadConfig,
  discoverCatalogImpl = discoverCatalog,
} = {}) {
  const config = await loadConfigImpl({ cwd });
  const catalog = await discoverCatalogImpl({
    overrides: config.catalog?.overrides ?? {},
  });
  return { config, catalog };
}

export function validateRunBudget(plan, config, requested) {
  const raw = requested ?? config.limits?.maxModelCalls ?? 30;
  const budget = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isInteger(budget)) throw new Error(`Model-call budget must be an integer: ${raw}`);
  if (budget < 1) throw new Error(`Model-call budget must be positive: ${raw}`);
  if (budget < plan.callEstimate.minimum) {
    throw new Error(`Model-call budget ${budget} is below the minimum ${plan.callEstimate.minimum}`);
  }
  return budget;
}

export function requireVerificationOptIn(config, flags) {
  const commands = config.verification?.commands ?? [];
  if (commands.length > 0 && !flags.allowVerificationCommands) {
    throw new Error(
      'Verification commands are configured but disabled; rerun with --allow-verification-commands',
    );
  }
}

function printRoute(plan, asJson, stdout) {
  if (asJson) {
    stdout.write(`${JSON.stringify(plan, null, 2)}\n`);
    return;
  }
  stdout.write(`Assessment: ${plan.assessment.role} (score ${plan.assessment.score})\n`);
  stdout.write(`Dimensions: complexity=${plan.assessment.complexity}, risk=${plan.assessment.risk}, blast=${plan.assessment.blastRadius}, verifiability=${plan.assessment.verifiability}, reversibility=${plan.assessment.reversibility}\n`);
  for (const stage of plan.stages) {
    const state = stage.enabled === false
      ? 'skip'
      : stage.activation === 'conditional' ? 'conditional' : 'run';
    const capability = stage.capability ?? stage.modelRole ?? stage.profile ?? 'unassigned';
    stdout.write(`- ${stage.id.padEnd(10)} ${state.padEnd(11)} ${capability}/${stage.effort} -> ${stage.model}\n`);
  }
  const readerMode = plan.callEstimate.readerMode ?? (plan.liveReaders ? 'live' : 'deterministic');
  stdout.write(`Codex invocations: ${plan.callEstimate.minimum}..${plan.callEstimate.maximum} (${readerMode} readers)\n`);
}

function pathIsWithin(parent, candidate) {
  const relative = path.relative(path.resolve(parent), path.resolve(candidate));
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

function physicalCandidate(candidate) {
  const absolute = path.resolve(candidate);
  if (existsSync(absolute)) return realpathSync(absolute);

  const missing = [];
  let current = absolute;
  while (!existsSync(current)) {
    const parent = path.dirname(current);
    if (parent === current) return absolute;
    missing.unshift(path.basename(current));
    current = parent;
  }
  return path.join(realpathSync(current), ...missing);
}

function sameExistingFile(left, right) {
  try {
    const leftStat = statSync(left);
    const rightStat = statSync(right);
    return leftStat.dev === rightStat.dev && leftStat.ino === rightStat.ino;
  } catch (error) {
    if (error?.code === 'ENOENT' || error?.code === 'ENOTDIR') return false;
    throw error;
  }
}

function isFinalSymlink(candidate) {
  try {
    return lstatSync(candidate).isSymbolicLink();
  } catch (error) {
    if (error?.code === 'ENOENT' || error?.code === 'ENOTDIR') return false;
    throw error;
  }
}

function aliasesProtectedFile(candidate, protectedFile) {
  return path.resolve(candidate) === path.resolve(protectedFile)
    || physicalCandidate(candidate) === physicalCandidate(protectedFile)
    || sameExistingFile(candidate, protectedFile);
}

export async function resolveRunDir(cwd, candidate) {
  const runsDir = path.resolve(cwd, '.rein', 'runs');
  const id = candidate ?? await latestRun(runsDir);
  if (!id) throw new Error('No Rein run found');
  if (!RUN_ID_PATTERN.test(id)) throw new Error(`Invalid run id: ${id}`);

  const runDir = path.resolve(runsDir, id);
  if (!pathIsWithin(runsDir, runDir) || path.dirname(runDir) !== runsDir) {
    throw new Error(`Run path escapes the Rein runs directory: ${id}`);
  }
  if (!(await exists(runDir))) throw new Error(`Run not found: ${id}`);

  const [runsDirectory, selectedRun, selectedStat] = await Promise.all([
    realpath(runsDir),
    realpath(runDir),
    stat(runDir),
  ]);
  if (!selectedStat.isDirectory()) throw new Error(`Run path is not a directory: ${id}`);
  if (selectedRun !== path.join(runsDirectory, id)) {
    throw new Error(`Run path escapes the Rein runs directory: ${id}`);
  }
  return runDir;
}

export function resolveReportOutput(cwd, runDir, requested) {
  const output = requested
    ? path.resolve(cwd, requested)
    : path.join(runDir, 'report.regenerated.html');
  const original = path.join(runDir, 'report.html');
  const manifest = path.join(runDir, 'run.json');
  if (isFinalSymlink(output)) {
    throw new Error('Refusing a symbolic-link report output because it could replace a frozen artifact');
  }
  if (aliasesProtectedFile(output, original)) {
    throw new Error('Refusing to replace the immutable report.html; choose another --output path');
  }
  if (aliasesProtectedFile(output, manifest)) {
    throw new Error('Refusing to replace the frozen run manifest');
  }
  return output;
}

export function resolveReplayOutput(cwd, runDir, requested) {
  if (!requested) return null;
  const output = path.resolve(cwd, requested);
  const physicalRunDir = physicalCandidate(runDir);
  if (pathIsWithin(runDir, output) || pathIsWithin(physicalRunDir, physicalCandidate(output))) {
    throw new Error('Replay output must be outside the frozen run directory');
  }
  return output;
}

async function copyReportAtomically(reportFile, outputFile) {
  const temporary = path.join(
    path.dirname(outputFile),
    `.${path.basename(outputFile)}.${process.pid}.${randomUUID()}.tmp`,
  );
  try {
    await copyFile(reportFile, temporary);
    await rename(temporary, outputFile);
  } catch (error) {
    try {
      await unlink(temporary);
    } catch (cleanupError) {
      if (cleanupError?.code !== 'ENOENT' && error.cause === undefined) error.cause = cleanupError;
    }
    throw error;
  }
}

export function exitCodeForStatus(status) {
  return status === 'pass' ? 0 : 2;
}

async function pipelineModule(injected) {
  return injected ?? import('./pipeline.mjs');
}

export async function main(argv = process.argv.slice(2), context = {}) {
  const { command, positionals, flags } = parseCommandLine(argv);
  const cwd = path.resolve(context.cwd ?? process.cwd());
  const stdout = context.stdout ?? process.stdout;
  if (!command || flags.help || command === 'help') {
    stdout.write(HELP);
    return 0;
  }

  if (command === 'init') {
    const target = path.join(cwd, CONFIG_FILENAME);
    if (await exists(target) && !flags.force) {
      throw new Error(`${CONFIG_FILENAME} already exists; use --force to replace it`);
    }
    await writeJson(target, DEFAULT_CONFIG);
    stdout.write(`Created ${target}\n`);
    return 0;
  }

  if (command === 'doctor') {
    const spawnCaptureImpl = context.spawnCaptureImpl ?? spawnCapture;
    const configAndCatalogImpl = context.configAndCatalogImpl ?? configAndCatalog;
    let codex;
    let codexSpawnError;
    try {
      codex = await spawnCaptureImpl('codex', ['--version'], { cwd, timeoutMs: 10_000 });
    } catch (error) {
      codexSpawnError = error;
      codex = {
        code: 1,
        stdout: '',
        stderr: formatCliError(error),
      };
    }
    let catalog;
    let catalogError;
    try {
      ({ catalog } = await configAndCatalogImpl(cwd));
    } catch (error) {
      catalogError = formatCliError(error);
    }
    const codexDetail = codex.stdout.trim() || codex.stderr.trim() || (codexSpawnError ? formatCliError(codexSpawnError) : 'unknown Codex failure');
    const result = {
      ok: Number(process.versions.node.split('.')[0]) >= 20 && codex.code === 0 && !catalogError,
      node: process.version,
      codex: codexDetail,
      config: (await exists(path.join(cwd, CONFIG_FILENAME))) ? CONFIG_FILENAME : 'defaults',
      roles: catalog?.roles,
      error: catalogError,
    };
    if (flags.json) stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    else {
      stdout.write(`${result.ok ? 'PASS' : 'FAIL'} Node ${result.node}\n`);
      stdout.write(`${codex.code === 0 ? 'PASS' : 'FAIL'} Codex ${result.codex}\n`);
      for (const [role, selected] of Object.entries(result.roles ?? {})) {
        stdout.write(`PASS ${role}: ${selected.model}/${selected.effort}\n`);
      }
      if (result.error) stdout.write(`FAIL ${result.error}\n`);
    }
    return result.ok ? 0 : 1;
  }

  if (command === 'route' || command === 'run') {
    const task = positionals.join(' ').trim();
    const configAndCatalogImpl = context.configAndCatalogImpl ?? configAndCatalog;
    const { config, catalog } = await configAndCatalogImpl(cwd);
    const route = routeTask(task, routeOptions(config));
    const liveReaders = Boolean(flags.liveReaders || config.readerGate?.mode === 'live');
    const pipeline = await pipelineModule(context.pipeline);
    const plan = pipeline.buildRunPlan({ task, route, catalog, config, liveReaders });

    if (command === 'route') {
      printRoute(plan, Boolean(flags.json), stdout);
      return 0;
    }

    requireVerificationOptIn(config, flags);
    const budgetCalls = validateRunBudget(plan, config, flags.budgetCalls);
    if (flags.dryRun) {
      printRoute(plan, false, stdout);
      return 0;
    }

    const result = await pipeline.runPipeline({
      task,
      cwd,
      config,
      catalog,
      route,
      liveReaders,
      budgetCalls,
      allowVerificationCommands: Boolean(flags.allowVerificationCommands),
    });
    stdout.write(`Run ${result.manifest.status}: ${result.runDir}\n`);
    stdout.write(`Report: ${path.join(result.runDir, 'report.html')}\n`);
    return exitCodeForStatus(result.manifest.status);
  }

  if (command === 'inspect') {
    const runDir = await resolveRunDir(cwd, positionals[0]);
    const manifest = await readJson(path.join(runDir, 'run.json'));
    if (flags.json) stdout.write(`${JSON.stringify(manifest, null, 2)}\n`);
    else {
      stdout.write(`Run: ${manifest.runId ?? manifest.id ?? path.basename(runDir)}\nStatus: ${manifest.status}\nTask: ${manifest.task}\n`);
      stdout.write(`Codex invocations: ${manifest.invocations?.used ?? manifest.calls?.used ?? 0}/${manifest.invocations?.budget ?? manifest.calls?.budget ?? '-'}\n`);
      stdout.write(`Assessment: ${manifest.assessment?.role ?? '-'} (${manifest.assessment?.score ?? '-'})\n`);
      stdout.write(`Report: ${path.join(runDir, 'report.html')}\n`);
    }
    return exitCodeForStatus(manifest.status);
  }

  if (command === 'report') {
    const runDir = await resolveRunDir(cwd, positionals[0]);
    const outputFile = resolveReportOutput(cwd, runDir, flags.output);
    const pipeline = await pipelineModule(context.pipeline);
    const result = await pipeline.regenerateReport(runDir, { outputFile });
    stdout.write(`Report regenerated without model calls: ${outputFile}\n`);
    return exitCodeForStatus(result.manifest.status);
  }

  if (command === 'replay') {
    if (!flags.frozen) throw new Error('Replay requires --frozen');
    const runDir = await resolveRunDir(cwd, positionals[0]);
    const pipeline = await pipelineModule(context.pipeline);
    const verified = await pipeline.verifyFrozenRun(runDir);
    const reportFile = path.resolve(verified.reportFile);
    const expectedReport = path.resolve(runDir, 'report.html');
    if (reportFile !== expectedReport || !pathIsWithin(runDir, reportFile)) {
      throw new Error('Frozen verification returned a report outside the selected run');
    }

    const outputFile = resolveReplayOutput(cwd, runDir, flags.output);
    if (outputFile) {
      await ensureDir(path.dirname(outputFile));
      resolveReplayOutput(cwd, runDir, outputFile);
      await copyReportAtomically(reportFile, outputFile);
      stdout.write(`Frozen replay verified and copied without model calls: ${outputFile}\n`);
    } else {
      stdout.write(`Frozen replay verified without model calls: ${reportFile}\n`);
    }
    return exitCodeForStatus(verified.manifest.status);
  }

  throw new Error(`Unknown command: ${command}`);
}

function isMainModule() {
  if (!process.argv[1]) return false;
  try {
    return realpathSync(process.argv[1]) === fileURLToPath(import.meta.url);
  } catch {
    return false;
  }
}

if (isMainModule()) {
  main().then((code) => {
    process.exitCode = code;
  }).catch((error) => {
    process.stderr.write(`rein: ${formatCliError(error)}\n`);
    process.exitCode = 1;
  });
}
