import assert from 'node:assert/strict';
import {
  link,
  mkdir,
  mkdtemp,
  symlink,
} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  RUN_ID_PATTERN,
  configAndCatalog,
  exitCodeForStatus,
  formatCliError,
  main,
  parseCommandLine,
  requireVerificationOptIn,
  resolveReplayOutput,
  resolveReportOutput,
  resolveRunDir,
  validateRunBudget,
} from '../src/cli.mjs';
import {
  exists,
  readText,
  writeJson,
  writeText,
} from '../src/utils.mjs';

function captureOutput() {
  let value = '';
  return {
    stream: { write: (chunk) => { value += String(chunk); } },
    read: () => value,
  };
}

test('formatCliError turns missing executables into actionable PATH guidance', () => {
  const missing = Object.assign(new Error('spawn codex ENOENT'), {
    code: 'ENOENT',
    path: 'codex',
    syscall: 'spawn codex',
  });
  assert.match(formatCliError(missing), /codex not found on PATH/);
  assert.match(formatCliError(missing), /authenticated Codex CLI/);
  const missingFile = Object.assign(
    new Error("ENOENT: no such file or directory, open '/tmp/run.json'"),
    { code: 'ENOENT', path: '/tmp/run.json', syscall: 'open' },
  );
  assert.equal(formatCliError(missingFile), missingFile.message);
  assert.equal(formatCliError(new Error('boom')), 'boom');
});

test('doctor reports a structured FAIL when Codex is missing instead of crashing', async () => {
  const output = captureOutput();
  const context = {
    cwd: await mkdtemp(path.join(os.tmpdir(), 'rein-doctor-missing-')),
    stdout: output.stream,
    spawnCaptureImpl: async () => {
      const error = Object.assign(new Error('spawn codex ENOENT'), {
        code: 'ENOENT',
        path: 'codex',
      });
      throw error;
    },
    configAndCatalogImpl: async () => {
      const error = Object.assign(new Error('spawn codex ENOENT'), {
        code: 'ENOENT',
        path: 'codex',
      });
      throw error;
    },
  };

  assert.equal(await main(['doctor'], context), 1);
  const text = output.read();
  assert.match(text, /^FAIL Node /m);
  assert.match(text, /^INFO provider codex \(Codex CLI\); available: codex, kiro$/m);
  assert.match(text, /FAIL codex codex not found on PATH/);
  assert.match(text, /FAIL codex not found on PATH/);
  assert.doesNotMatch(text, /spawn codex ENOENT/);
});

test('doctor --json stays parseable when Codex spawn fails', async () => {
  const output = captureOutput();
  const context = {
    cwd: await mkdtemp(path.join(os.tmpdir(), 'rein-doctor-json-')),
    stdout: output.stream,
    spawnCaptureImpl: async () => {
      throw Object.assign(new Error('spawn codex ENOENT'), { code: 'ENOENT', path: 'codex' });
    },
    configAndCatalogImpl: async () => ({
      catalog: { roles: { economy: { model: 'e', effort: 'low' } } },
    }),
  };

  assert.equal(await main(['doctor', '--json'], context), 1);
  const payload = JSON.parse(output.read());
  assert.equal(payload.ok, false);
  assert.match(payload.backend, /codex not found on PATH/);
  assert.equal(payload.provider.id, 'codex');
  assert.equal(payload.provider.executable, 'codex');
  assert.equal(payload.error, undefined);
});

test('strict parser keeps boolean flags separate from following positional arguments', () => {
  assert.deepEqual(parseCommandLine(['route', '--json', 'fix typo']), {
    command: 'route',
    positionals: ['fix typo'],
    flags: { json: true },
  });
  assert.deepEqual(
    parseCommandLine(['run', '--budget-calls', '12', '--dry-run', 'fix', 'typo']),
    {
      command: 'run',
      positionals: ['fix', 'typo'],
      flags: { budgetCalls: '12', dryRun: true },
    },
  );
});

test('strict parser rejects unknown, duplicate, missing-value, and boolean-value options', () => {
  assert.throws(
    () => parseCommandLine(['run', 'task', '--bogus']),
    /Unknown option for run: --bogus/,
  );
  assert.throws(
    () => parseCommandLine(['run', 'task', '-x']),
    /Unknown option for run: -x/,
  );
  assert.throws(
    () => parseCommandLine(['route', 'task', '--json', '--json']),
    /Duplicate option for route: --json/,
  );
  assert.throws(
    () => parseCommandLine(['report', '--output']),
    /Option --output requires a value/,
  );
  assert.throws(
    () => parseCommandLine(['route', 'task', '--json=false']),
    /Option --json does not take a value/,
  );
  assert.throws(
    () => parseCommandLine(['inspect', 'first', 'second']),
    /inspect accepts at most 1 positional argument/,
  );
});

test('help bypasses required task validation without accepting unrelated options', () => {
  assert.equal(parseCommandLine(['run', '--help']).flags.help, true);
  assert.throws(() => parseCommandLine(['help', '--json']), /help does not accept/);
});

test('catalog discovery receives only trusted overrides, never configured executables or args', async () => {
  const config = {
    catalog: {
      command: '/tmp/untrusted-codex',
      args: ['run', 'arbitrary-command'],
      overrides: { frontier: 'frontier-model' },
    },
  };
  let received;
  const result = await configAndCatalog('/workspace', {
    loadConfigImpl: async () => config,
    discoverCatalogImpl: async (options) => {
      received = options;
      return { roles: {} };
    },
  });

  assert.deepEqual(received, { overrides: { frontier: 'frontier-model' } });
  assert.equal(result.config, config);
});

test('dry-run budget validation is strict and checks the planned minimum', () => {
  const plan = { callEstimate: { minimum: 15 } };
  const config = { limits: { maxModelCalls: 30 } };
  assert.equal(validateRunBudget(plan, config), 30);
  assert.equal(validateRunBudget(plan, config, '15'), 15);
  assert.throws(() => validateRunBudget(plan, config, '15x'), /must be an integer/);
  assert.throws(() => validateRunBudget({ callEstimate: { minimum: 0 } }, config, 0), /positive/);
  assert.throws(() => validateRunBudget(plan, config, 14), /below the minimum 15/);
});

test('verification commands require an explicit run opt-in', () => {
  const config = { verification: { commands: ['npm test'] } };
  assert.throws(() => requireVerificationOptIn(config, {}), /--allow-verification-commands/);
  assert.doesNotThrow(() => requireVerificationOptIn(config, { allowVerificationCommands: true }));
  assert.doesNotThrow(() => requireVerificationOptIn({ verification: { commands: [] } }, {}));
});

test('run ids are strict and resolve only beneath the runs directory', async () => {
  const cwd = await mkdtemp(path.join(os.tmpdir(), 'rein-cli-'));
  const id = '20260713T000000123Z-1234abcd';
  const runDir = path.join(cwd, '.rein', 'runs', id);
  await mkdir(runDir, { recursive: true });
  await writeJson(path.join(runDir, 'run.json'), { id, status: 'pass' });

  assert.equal(RUN_ID_PATTERN.test(id), true);
  assert.equal(await resolveRunDir(cwd, id), runDir);
  assert.equal(await resolveRunDir(cwd), runDir);
  await assert.rejects(resolveRunDir(cwd, '../../escape-run'), /Invalid run id/);
  await assert.rejects(
    resolveRunDir(cwd, '20260713T000000124Z-aaaaaaaa'),
    /Run not found/,
  );

  const escapedId = '20260713T000000124Z-bbbbbbbb';
  const outside = await mkdtemp(path.join(os.tmpdir(), 'rein-cli-outside-'));
  await symlink(outside, path.join(cwd, '.rein', 'runs', escapedId), 'dir');
  await assert.rejects(resolveRunDir(cwd, escapedId), /escapes the Rein runs directory/);
});

test('report and replay output contracts preserve the frozen run', () => {
  const cwd = '/workspace';
  const runDir = '/workspace/.rein/runs/20260713T000000123Z-1234abcd';
  assert.equal(
    resolveReportOutput(cwd, runDir),
    path.join(runDir, 'report.regenerated.html'),
  );
  assert.throws(
    () => resolveReportOutput(cwd, runDir, path.join(runDir, 'report.html')),
    /immutable report\.html/,
  );
  assert.equal(resolveReplayOutput(cwd, runDir), null);
  assert.equal(resolveReplayOutput(cwd, runDir, 'exports/replay.html'), '/workspace/exports/replay.html');
  assert.throws(
    () => resolveReplayOutput(cwd, runDir, path.join(runDir, 'copy.html')),
    /outside the frozen run directory/,
  );
});

test('report output cannot alias the immutable report or manifest', async () => {
  const cwd = await mkdtemp(path.join(os.tmpdir(), 'rein-report-output-'));
  const runDir = path.join(cwd, '.rein', 'runs', '20260713T000000123Z-1234abcd');
  await mkdir(runDir, { recursive: true });
  const reportFile = path.join(runDir, 'report.html');
  const manifestFile = path.join(runDir, 'run.json');
  await writeText(reportFile, 'original');
  await writeJson(manifestFile, { status: 'pass' });

  const reportLink = path.join(cwd, 'report-hardlink.html');
  const manifestLink = path.join(cwd, 'manifest-symlink.json');
  await link(reportFile, reportLink);
  await symlink(manifestFile, manifestLink);

  assert.throws(() => resolveReportOutput(cwd, runDir, reportLink), /immutable report\.html/);
  assert.throws(() => resolveReportOutput(cwd, runDir, manifestLink), /symbolic-link report output/);
});

test('replay output rejects a physical path that enters the frozen run through a symlink', async () => {
  const cwd = await mkdtemp(path.join(os.tmpdir(), 'rein-replay-output-'));
  const runDir = path.join(cwd, '.rein', 'runs', '20260713T000000123Z-1234abcd');
  await mkdir(runDir, { recursive: true });
  const alias = path.join(cwd, 'run-alias');
  await symlink(runDir, alias, 'dir');
  assert.throws(
    () => resolveReplayOutput(cwd, runDir, path.join(alias, 'copy.html')),
    /outside the frozen run directory/,
  );
});

test('dry-run validates verification opt-in and the planned call budget without executing', async () => {
  const output = captureOutput();
  const config = {
    routing: {},
    readerGate: { mode: 'deterministic', minPass: 9, maxRounds: 2 },
    verification: { commands: [{ command: 'npm', args: ['test'] }] },
    limits: { maxModelCalls: 30 },
  };
  const plan = {
    assessment: {
      role: 'balanced',
      score: 8,
      complexity: 1,
      risk: 1,
      blastRadius: 0,
      verifiability: 3,
      reversibility: 3,
    },
    stages: [{
      id: 'scout', enabled: true, modelRole: 'economy', effort: 'low', model: 'economy-model',
    }],
    liveReaders: false,
    callEstimate: { minimum: 5, maximum: 5 },
  };
  let executions = 0;
  const context = {
    cwd: await mkdtemp(path.join(os.tmpdir(), 'rein-dry-run-')),
    stdout: output.stream,
    configAndCatalogImpl: async () => ({ config, catalog: { roles: {} } }),
    pipeline: {
      buildRunPlan: () => plan,
      runPipeline: async () => { executions += 1; },
    },
  };

  await assert.rejects(
    main(['run', 'task', '--dry-run'], context),
    /--allow-verification-commands/,
  );
  await assert.rejects(
    main([
      'run',
      'task',
      '--dry-run',
      '--allow-verification-commands',
      '--budget-calls',
      '4',
    ], context),
    /below the minimum 5/,
  );
  assert.equal(
    await main([
      'run',
      'task',
      '--dry-run',
      '--allow-verification-commands',
      '--budget-calls',
      '5',
    ], context),
    0,
  );
  assert.equal(executions, 0);
  assert.match(output.read(), /Codex invocations: 5\.\.5/);
  assert.match(output.read(), /economy\/low -> economy-model/);
  assert.match(output.read(), /deterministic readers/);
  assert.doesNotMatch(output.read(), /undefined/);
});

test('an authorized run passes verification consent and the validated budget to the pipeline', async () => {
  const cwd = await mkdtemp(path.join(os.tmpdir(), 'rein-authorized-run-'));
  const config = {
    routing: {},
    readerGate: { mode: 'deterministic', minPass: 9, maxRounds: 2 },
    verification: { commands: [{ command: 'npm', args: ['test'] }] },
    limits: { maxModelCalls: 30 },
  };
  const plan = {
    assessment: {
      role: 'balanced', score: 8, complexity: 1, risk: 1, blastRadius: 0,
      verifiability: 3, reversibility: 3,
    },
    stages: [],
    callEstimate: { minimum: 5, maximum: 5, readerMode: 'deterministic' },
  };
  let received;
  const code = await main([
    'run',
    'task',
    '--allow-verification-commands',
    '--budget-calls',
    '7',
  ], {
    cwd,
    stdout: captureOutput().stream,
    configAndCatalogImpl: async () => ({ config, catalog: { roles: {} } }),
    pipeline: {
      buildRunPlan: () => plan,
      runPipeline: async (options) => {
        received = options;
        return { runDir: path.join(cwd, 'run'), manifest: { status: 'warn' } };
      },
    },
  });

  assert.equal(code, 2);
  assert.equal(received.allowVerificationCommands, true);
  assert.equal(received.budgetCalls, 7);
});

test('report defaults to a regenerated file and leaves the original immutable', async () => {
  const cwd = await mkdtemp(path.join(os.tmpdir(), 'rein-report-command-'));
  const id = '20260713T000000123Z-1234abcd';
  const runDir = path.join(cwd, '.rein', 'runs', id);
  const original = path.join(runDir, 'report.html');
  await mkdir(runDir, { recursive: true });
  await writeJson(path.join(runDir, 'run.json'), { id, status: 'warn' });
  await writeText(original, '<p>original</p>');

  let received;
  const output = captureOutput();
  const code = await main(['report', id], {
    cwd,
    stdout: output.stream,
    pipeline: {
      regenerateReport: async (selectedRun, options) => {
        received = { selectedRun, options };
        await writeText(options.outputFile, '<p>regenerated</p>');
        return { manifest: { status: 'warn' } };
      },
    },
  });

  assert.equal(code, 2);
  assert.equal(received.selectedRun, runDir);
  assert.equal(received.options.outputFile, path.join(runDir, 'report.regenerated.html'));
  assert.equal(await readText(original), '<p>original</p>');
  assert.equal(await readText(received.options.outputFile), '<p>regenerated</p>');
});

test('inspect prints the restored pipeline manifest runId and preserves warn exit status', async () => {
  const cwd = await mkdtemp(path.join(os.tmpdir(), 'rein-inspect-command-'));
  const id = '20260713T000000123Z-1234abcd';
  const runDir = path.join(cwd, '.rein', 'runs', id);
  await mkdir(runDir, { recursive: true });
  await writeJson(path.join(runDir, 'run.json'), {
    runId: id,
    status: 'warn',
    task: 'inspect me',
    calls: { used: 5, budget: 10 },
    assessment: { role: 'balanced', score: 8 },
  });
  const output = captureOutput();

  assert.equal(await main(['inspect', id], { cwd, stdout: output.stream }), 2);
  assert.match(output.read(), new RegExp(`Run: ${id}`));
  assert.doesNotMatch(output.read(), /Run: undefined/);
});

test('frozen replay verifies before atomically copying and never mutates run artifacts', async () => {
  const cwd = await mkdtemp(path.join(os.tmpdir(), 'rein-replay-command-'));
  const id = '20260713T000000123Z-1234abcd';
  const runDir = path.join(cwd, '.rein', 'runs', id);
  const reportFile = path.join(runDir, 'report.html');
  const manifestFile = path.join(runDir, 'run.json');
  const outputFile = path.join(cwd, 'exports', 'replayed.html');
  await mkdir(runDir, { recursive: true });
  await writeText(reportFile, '<p>frozen</p>');
  await writeJson(manifestFile, { id, status: 'pass' });
  const manifestBefore = await readText(manifestFile);

  await assert.rejects(
    main(['replay', id, '--frozen', '--output', outputFile], {
      cwd,
      stdout: captureOutput().stream,
      pipeline: { verifyFrozenRun: async () => { throw new Error('hash mismatch'); } },
    }),
    /hash mismatch/,
  );
  assert.equal(await exists(outputFile), false);

  await mkdir(path.dirname(outputFile), { recursive: true });
  await link(manifestFile, outputFile);
  let verified = 0;
  const code = await main(['replay', id, '--frozen', '--output', outputFile], {
    cwd,
    stdout: captureOutput().stream,
    pipeline: {
      verifyFrozenRun: async (selectedRun) => {
        verified += 1;
        assert.equal(selectedRun, runDir);
        return { manifest: { status: 'pass' }, reportFile, artifacts: [] };
      },
    },
  });

  assert.equal(code, 0);
  assert.equal(verified, 1);
  assert.equal(await readText(outputFile), '<p>frozen</p>');
  assert.equal(await readText(reportFile), '<p>frozen</p>');
  assert.equal(await readText(manifestFile), manifestBefore);
});

test('warn and fail statuses use the non-success exit code', () => {
  assert.equal(exitCodeForStatus('pass'), 0);
  assert.equal(exitCodeForStatus('warn'), 2);
  assert.equal(exitCodeForStatus('fail'), 2);
  assert.equal(exitCodeForStatus('error'), 2);
});
