import assert from 'node:assert/strict';
import { mkdir, mkdtemp, open } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { DEFAULT_CONFIG } from '../src/config.mjs';
import {
  acquireWorkspaceLock,
  buildRunPlan,
  releaseWorkspaceLock,
  runPipeline,
  verifyFrozenRun,
} from '../src/pipeline.mjs';
import { routeTask } from '../src/router.mjs';
import { readJson, readText, writeText } from '../src/utils.mjs';

const catalog = {
  roles: {
    frontier: { model: 'frontier', effort: 'max', supportedEfforts: ['low', 'high', 'max'] },
    balanced: { model: 'balanced', effort: 'medium', supportedEfforts: ['low', 'medium', 'high'] },
    economy: { model: 'economy', effort: 'low', supportedEfforts: ['low'] },
  },
};

const task = '작은 CLI를 구현하고 테스트해줘';

test('buildRunPlan counts deterministic and live reader calls', () => {
  const route = routeTask(task, { quorum: 9 });
  const deterministic = buildRunPlan({ task, route, catalog, config: DEFAULT_CONFIG });
  const live = buildRunPlan({ task, route, catalog, config: DEFAULT_CONFIG, liveReaders: true });
  assert.equal(deterministic.callEstimate.minimum, 4);
  assert.equal(deterministic.callEstimate.maximum, 5);
  assert.equal(deterministic.callEstimate.conditionalInvocations, 1);
  assert.equal(deterministic.routingPolicy.advisorMode, 'conditional');
  assert.equal(live.callEstimate.minimum, 14);
  assert.equal(live.callEstimate.maximum, 26);
  assert.equal(deterministic.stages.find((stage) => stage.id === 'architect').effort, 'max');
  assert.equal(deterministic.stages.find((stage) => stage.id === 'architect').activation, 'conditional');
});

test('runPipeline completes with injected model execution and writes a frozen report', async () => {
  const cwd = await mkdtemp(path.join(os.tmpdir(), 'rein-pipeline-'));
  const route = routeTask(task, { quorum: 9 });
  const calls = [];
  const fakeCodex = async (options) => {
    calls.push(options);
    let output = '작은 CLI 구현 작업의 목적과 결과를 기록했습니다. 다음 단계는 변경 내용을 사람이 확인하는 것입니다. 실패하면 로그를 확인하세요.';
    if (options.outputFile.endsWith('scout.json')) {
      output = JSON.stringify({
        summary: '작은 CLI 구현에 필요한 파일을 확인했습니다.',
        facts: ['Node 프로젝트입니다.'],
        evidence: [{ title: 'package.json', url: 'package.json', excerpt: '테스트 명령이 있습니다.' }],
        open_questions: [],
      });
    }
    if (options.outputFile.endsWith('reviewer.json')) {
      output = JSON.stringify({
        verdict: 'pass',
        summary: '요청과 구현이 일치합니다.',
        findings: [],
        acceptance_checks: [{ criterion: '작은 CLI 구현', passed: true, evidence: 'maker.md와 검증 결과' }],
      });
    }
    if (options.outputFile.endsWith('summary.md')) {
      output = '결과 요약\n\n요청한 작은 CLI 구현을 완료했습니다. 승인된 테스트 검증은 통과했습니다. 다음 단계는 변경 내용을 확인하는 것입니다. 오류가 발생하면 검증 로그를 확인하세요.';
    }
    await writeText(options.outputFile, output);
    return { code: 0, durationMs: 1, stdout: '', stderr: '' };
  };

  const result = await runPipeline({
    task,
    cwd,
    config: {
      ...structuredClone(DEFAULT_CONFIG),
      verification: { commands: [{ command: 'npm', args: ['test'] }] },
    },
    catalog,
    route,
    runCodexImpl: fakeCodex,
    runVerificationImpl: async () => ({ code: 0, timedOut: false, stdout: 'ok', stderr: '' }),
    allowVerificationCommands: true,
    now: () => new Date('2026-07-13T00:00:00Z'),
  });

  assert.equal(result.manifest.status, 'pass');
  assert.equal(result.manifest.calls.used, 4);
  assert.equal(result.manifest.stages.architect.status, 'skipped');
  assert.equal(result.manifest.routing.find((row) => row.stage === 'architect').decision, 'skip');
  assert.match(await readText(path.join(result.runDir, 'architect.md')), /고급 조언 생략/);
  assert.equal(calls.find((call) => call.outputFile.endsWith('maker.md')).sandbox, 'workspace-write');
  assert.equal(calls.some((call) => call.outputFile.endsWith('architect.md')), false);
  assert.equal(calls.find((call) => call.outputFile.endsWith('scout.json')).sandbox, 'read-only');
  assert.match(await readText(path.join(result.runDir, 'report.html')), /Reader-10 검수/);
  assert.match(await readText(path.join(result.runDir, 'report.html')), /미해결 질문 0개/);
  assert.equal((await readJson(path.join(result.runDir, 'readers.json'))).passed, true);
  assert.ok(result.manifest.artifacts['report.html'].sha256);
  assert.equal((await verifyFrozenRun(result.runDir)).manifest.status, 'pass');
  await writeText(path.join(result.runDir, 'report.html'), 'tampered');
  await assert.rejects(verifyFrozenRun(result.runDir), /hash mismatch: report\.html/);
});

test('mutation without verification commands is WARN, never a verified pass', async () => {
  const cwd = await mkdtemp(path.join(os.tmpdir(), 'rein-unverified-'));
  const route = routeTask(task, { quorum: 9 });
  const fakeCodex = async ({ outputFile }) => {
    let output = '작은 CLI 구현 결과입니다. 다음 단계는 사람이 결과를 확인하는 것입니다. 오류가 생기면 실행 기록을 확인하세요.';
    if (outputFile.endsWith('scout.json')) output = JSON.stringify({
      summary: '작은 CLI 파일을 읽었습니다.', facts: ['Node 프로젝트'],
      evidence: [{ title: 'package.json', url: 'package.json', excerpt: '프로젝트 정보' }], open_questions: [],
    });
    if (outputFile.endsWith('reviewer.json')) output = JSON.stringify({
      verdict: 'pass', summary: '구조는 맞습니다.', findings: [],
      acceptance_checks: [{ criterion: '구현 존재', passed: true, evidence: 'maker.md' }],
    });
    await writeText(outputFile, output);
    return { code: 0, durationMs: 1, stdout: '', stderr: '' };
  };
  const result = await runPipeline({
    task, cwd, config: structuredClone(DEFAULT_CONFIG), catalog, route, runCodexImpl: fakeCodex,
  });
  assert.equal(result.verification.status, 'unverified');
  assert.equal(result.verification.passed, false);
  assert.equal(result.manifest.status, 'warn');
});

test('economy work invokes the advisor when scout records an unresolved question', async () => {
  const cwd = await mkdtemp(path.join(os.tmpdir(), 'rein-advisor-question-'));
  const route = routeTask(task, { quorum: 9 });
  const calls = [];
  const fakeCodex = async (options) => {
    calls.push(options);
    let output = '작업 결과입니다. 다음 단계는 변경 내용을 확인하는 것입니다. 오류가 생기면 검증 로그를 확인하세요.';
    if (options.outputFile.endsWith('scout.json')) output = JSON.stringify({
      summary: '구현 대상을 확인했습니다.', facts: ['Node 프로젝트'],
      evidence: [{ title: 'package.json', url: 'package.json', excerpt: '테스트 명령' }],
      open_questions: ['호환성 범위를 먼저 결정해야 합니다.'],
    });
    if (options.outputFile.endsWith('reviewer.json')) output = JSON.stringify({
      verdict: 'pass', summary: '구현과 검증이 일치합니다.', findings: [],
      acceptance_checks: [{ criterion: '구현 존재', passed: true, evidence: 'maker.md' }],
    });
    await writeText(options.outputFile, output);
    return { code: 0, durationMs: 1, stdout: '', stderr: '' };
  };
  const result = await runPipeline({
    task,
    cwd,
    config: {
      ...structuredClone(DEFAULT_CONFIG),
      verification: { commands: [{ command: 'npm', args: ['test'] }] },
    },
    catalog,
    route,
    runCodexImpl: fakeCodex,
    runVerificationImpl: async () => ({ code: 0, timedOut: false, stdout: 'ok', stderr: '' }),
    allowVerificationCommands: true,
  });

  assert.equal(result.manifest.calls.used, 5);
  assert.equal(result.manifest.stages.architect.status, 'pass');
  const decision = result.manifest.routing.find((row) => row.stage === 'architect');
  assert.equal(decision.decision, 'invoke');
  assert.equal(decision.reasonCode, 'scout-open-questions');
  assert.equal(decision.evidence.scout.openQuestionCount, 1);
  assert.equal(calls.filter((call) => call.outputFile.endsWith('architect.md')).length, 1);
});

test('always and never advisor policies execute end to end with consistent budgets', async () => {
  async function execute(advisorMode) {
    const cwd = await mkdtemp(path.join(os.tmpdir(), `rein-advisor-${advisorMode}-`));
    const config = structuredClone(DEFAULT_CONFIG);
    config.routing.advisorMode = advisorMode;
    const route = routeTask(task, { quorum: 9, advisorMode });
    const calls = [];
    const fakeCodex = async (options) => {
      calls.push(options);
      let output = '작은 CLI 구현 결과입니다. 다음 단계는 사람이 결과를 확인하는 것입니다. 오류가 생기면 실행 기록을 확인하세요.';
      if (options.outputFile.endsWith('scout.json')) output = JSON.stringify({
        summary: '작은 CLI 파일을 읽었습니다.', facts: ['Node 프로젝트'],
        evidence: [{ title: 'package.json', url: 'package.json', excerpt: '프로젝트 정보' }],
        open_questions: [],
      });
      if (options.outputFile.endsWith('reviewer.json')) output = JSON.stringify({
        verdict: 'pass', summary: '구조는 맞습니다.', findings: [],
        acceptance_checks: [{ criterion: '구현 존재', passed: true, evidence: 'maker.md' }],
      });
      await writeText(options.outputFile, output);
      return { code: 0, durationMs: 1, stdout: '', stderr: '' };
    };
    const result = await runPipeline({ task, cwd, config, catalog, route, runCodexImpl: fakeCodex });
    return { result, calls };
  }

  const always = await execute('always');
  const alwaysDecision = always.result.manifest.routing.find((row) => row.stage === 'architect');
  assert.equal(always.result.manifest.calls.used, 5);
  assert.equal(always.result.manifest.stages.architect.status, 'pass');
  assert.equal(alwaysDecision.decision, 'invoke');
  assert.equal(alwaysDecision.reasonCode, 'policy-always');
  assert.equal(alwaysDecision.budget.mandatoryRemaining, 3);
  assert.equal(alwaysDecision.budget.advisorInvocations, 1);
  assert.equal(always.calls.filter((call) => call.outputFile.endsWith('architect.md')).length, 1);

  const never = await execute('never');
  const neverDecision = never.result.manifest.routing.find((row) => row.stage === 'architect');
  assert.equal(never.result.manifest.calls.used, 4);
  assert.equal(never.result.manifest.stages.architect.status, 'skipped');
  assert.equal(neverDecision.decision, 'skip');
  assert.equal(neverDecision.reasonCode, 'policy-never');
  assert.equal(neverDecision.budget.mandatoryRemaining, 3);
  assert.equal(neverDecision.budget.advisorInvocations, 0);
  assert.equal(never.calls.some((call) => call.outputFile.endsWith('architect.md')), false);
});

test('unresolved scout questions stop before mutation when advisor headroom is missing', async () => {
  const cwd = await mkdtemp(path.join(os.tmpdir(), 'rein-advisor-budget-'));
  const route = routeTask(task, { quorum: 9 });
  const fixedRunId = '20260714T000000000Z-deadbeef';
  const fakeCodex = async ({ outputFile }) => {
    await writeText(outputFile, JSON.stringify({
      summary: '구현 대상을 확인했습니다.', facts: ['Node 프로젝트'],
      evidence: [{ title: 'package.json', url: 'package.json', excerpt: '테스트 명령' }],
      open_questions: ['호환성 범위를 먼저 결정해야 합니다.'],
    }));
    return { code: 0, durationMs: 1, stdout: '', stderr: '' };
  };

  await assert.rejects(
    runPipeline({
      task,
      cwd,
      config: structuredClone(DEFAULT_CONFIG),
      catalog,
      route,
      budgetCalls: 4,
      runCodexImpl: fakeCodex,
      idFactory: () => fixedRunId,
    }),
    /invocation budget cannot fund the advisor and all mandatory stages/,
  );

  const manifest = await readJson(path.join(cwd, '.rein', 'runs', fixedRunId, 'run.json'));
  assert.equal(manifest.status, 'error');
  assert.equal(manifest.calls.used, 1);
  assert.equal(manifest.routing.find((row) => row.stage === 'architect').decision, 'budget-blocked');
  assert.equal(manifest.stages.architect.status, 'fail');
  assert.equal(manifest.stages.maker, undefined);
});

test('a run never removes a workspace lock that it did not acquire', async () => {
  const cwd = await mkdtemp(path.join(os.tmpdir(), 'rein-locked-'));
  const stateDir = path.join(cwd, '.rein');
  const lockFile = path.join(stateDir, 'workspace.lock');
  await mkdir(stateDir, { recursive: true });
  await writeText(lockFile, 'other-run\n');
  const route = routeTask(task, { quorum: 9 });

  await assert.rejects(
    runPipeline({
      task,
      cwd,
      config: structuredClone(DEFAULT_CONFIG),
      catalog,
      route,
      runCodexImpl: async () => { throw new Error('must not execute'); },
    }),
    /another mutating Rein run holds/,
  );
  assert.equal(await readText(lockFile), 'other-run\n');
});

const OWNER_A = '11111111-1111-4111-8111-111111111111';
const OWNER_B = '22222222-2222-4222-8222-222222222222';

async function assertMissing(file) {
  await assert.rejects(
    () => readText(file),
    (error) => error?.code === 'ENOENT',
  );
}

test('acquireWorkspaceLock reclaims only a provably dead holder and records an owner token', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'rein-lock-'));
  const lockFile = path.join(dir, 'workspace.lock');
  const clock = () => '2026-07-17T10:00:00.000Z';
  await writeText(lockFile, `${JSON.stringify({ runId: 'old-run', pid: 12345, createdAt: '2026-07-17T09:59:00.000Z' })}\n`);
  const ownerToken = await acquireWorkspaceLock({
    lockFile,
    runId: 'new-run',
    clock,
    ownerToken: OWNER_A,
    probePid: () => 'dead',
  });
  const record = JSON.parse(await readText(lockFile));
  assert.equal(ownerToken, OWNER_A);
  assert.equal(record.runId, 'new-run');
  assert.equal(record.pid, process.pid);
  assert.equal(record.ownerToken, OWNER_A);
});

test('acquireWorkspaceLock refuses a fresh lock held by a live process', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'rein-lock-'));
  const lockFile = path.join(dir, 'workspace.lock');
  const clock = () => '2026-07-17T10:00:00.000Z';
  await writeText(lockFile, `${JSON.stringify({ runId: 'old-run', pid: 12345, createdAt: '2026-07-17T09:59:00.000Z' })}\n`);
  await assert.rejects(
    () => acquireWorkspaceLock({ lockFile, runId: 'new-run', clock, probePid: () => 'alive' }),
    /another mutating Rein run holds .*old-run.*12345/s,
  );
  assert.equal(JSON.parse(await readText(lockFile)).runId, 'old-run');
});

test('acquireWorkspaceLock never reclaims a live holder solely because the record is old', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'rein-lock-'));
  const lockFile = path.join(dir, 'workspace.lock');
  const clock = () => '2026-07-18T11:00:00.000Z';
  await writeText(lockFile, `${JSON.stringify({ runId: 'old-run', pid: 12345, createdAt: '2026-07-17T09:00:00.000Z' })}\n`);
  await assert.rejects(
    () => acquireWorkspaceLock({ lockFile, runId: 'new-run', clock, probePid: () => 'alive' }),
    /another mutating Rein run holds/,
  );
  assert.equal(JSON.parse(await readText(lockFile)).runId, 'old-run');
});

test('acquireWorkspaceLock fails closed for invalid, unknown, and unparsable holders', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'rein-lock-'));
  const lockFile = path.join(dir, 'workspace.lock');
  const clock = () => '2026-07-18T11:00:00.000Z';

  await writeText(lockFile, `${JSON.stringify({ runId: 'invalid-pid', pid: 0, createdAt: '2020-01-01T00:00:00.000Z' })}\n`);
  await assert.rejects(
    () => acquireWorkspaceLock({
      lockFile,
      runId: 'new-run',
      clock,
      probePid: () => { throw new Error('invalid PID must not be probed'); },
    }),
    /another mutating Rein run holds/,
  );

  await writeText(lockFile, `${JSON.stringify({ runId: 'unknown-pid', pid: 12345, createdAt: '2020-01-01T00:00:00.000Z' })}\n`);
  await assert.rejects(
    () => acquireWorkspaceLock({ lockFile, runId: 'new-run', clock, probePid: () => 'unknown' }),
    /another mutating Rein run holds/,
  );

  const permissionError = new Error('permission denied');
  permissionError.code = 'EPERM';
  await assert.rejects(
    () => acquireWorkspaceLock({
      lockFile,
      runId: 'new-run',
      clock,
      probePid: () => { throw permissionError; },
    }),
    /another mutating Rein run holds .*state unknown/s,
  );

  await writeText(lockFile, 'not json\n');
  await assert.rejects(
    () => acquireWorkspaceLock({ lockFile, runId: 'new-run', clock }),
    /another mutating Rein run holds/,
  );
  assert.equal(await readText(lockFile), 'not json\n');
});

test('acquireWorkspaceLock acquires cleanly when no lock exists', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'rein-lock-'));
  const lockFile = path.join(dir, 'workspace.lock');
  const ownerToken = await acquireWorkspaceLock({
    lockFile,
    runId: 'solo-run',
    clock: () => new Date().toISOString(),
    ownerToken: OWNER_A,
  });
  const record = JSON.parse(await readText(lockFile));
  assert.equal(ownerToken, OWNER_A);
  assert.equal(record.runId, 'solo-run');
  assert.equal(record.ownerToken, OWNER_A);
});

test('the reclaim guard serializes contenders and forces a guarded recheck', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'rein-lock-race-'));
  const lockFile = path.join(dir, 'workspace.lock');
  const clock = () => '2026-07-17T10:00:00.000Z';
  const oldPid = 12345;
  await writeText(lockFile, `${JSON.stringify({ runId: 'dead-run', pid: oldPid, createdAt: '2026-07-17T09:00:00.000Z' })}\n`);

  let releaseCreate;
  const createBlocked = new Promise((resolve) => { releaseCreate = resolve; });
  let reportCreateReached;
  const createReached = new Promise((resolve) => { reportCreateReached = resolve; });
  const firstOpen = async (file, flags) => {
    if (file === lockFile) {
      reportCreateReached();
      await createBlocked;
    }
    return open(file, flags);
  };
  const probePid = (pid) => (pid === oldPid ? 'dead' : 'alive');
  const first = acquireWorkspaceLock({
    lockFile,
    runId: 'winner',
    clock,
    ownerToken: OWNER_A,
    probePid,
    openFile: firstOpen,
  });
  await createReached;
  const second = acquireWorkspaceLock({
    lockFile,
    runId: 'loser',
    clock,
    ownerToken: OWNER_B,
    probePid,
  });
  await new Promise((resolve) => setTimeout(resolve, 20));
  releaseCreate();

  assert.equal(await first, OWNER_A);
  await assert.rejects(second, /another mutating Rein run holds .*winner/s);
  const record = JSON.parse(await readText(lockFile));
  assert.equal(record.runId, 'winner');
  assert.equal(record.ownerToken, OWNER_A);
  await assertMissing(`${lockFile}.reclaim`);
});

test('a guard left by a dead reclaimer is atomically claimable', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'rein-lock-dead-guard-'));
  const lockFile = path.join(dir, 'workspace.lock');
  const guardDir = `${lockFile}.reclaim`;
  const deadToken = '33333333-3333-4333-8333-333333333333';
  await mkdir(guardDir);
  await writeText(path.join(guardDir, `owner-99999999-${deadToken}`), '');

  const ownerToken = await acquireWorkspaceLock({
    lockFile,
    runId: 'recover-run',
    clock: () => '2026-07-17T10:00:00.000Z',
    ownerToken: OWNER_B,
    probePid: (pid) => (pid === 99999999 ? 'dead' : 'alive'),
  });
  assert.equal(ownerToken, OWNER_B);
  assert.equal(JSON.parse(await readText(lockFile)).runId, 'recover-run');
  await releaseWorkspaceLock({
    lockFile,
    ownerToken,
    clock: () => '2026-07-17T10:00:00.000Z',
    probePid: (pid) => (pid === 99999999 ? 'dead' : 'alive'),
  });
  await assertMissing(lockFile);
  await assertMissing(guardDir);
});

test('releaseWorkspaceLock removes only the matching owner token', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'rein-lock-owner-'));
  const lockFile = path.join(dir, 'workspace.lock');
  const clock = () => '2026-07-17T10:00:00.000Z';
  await acquireWorkspaceLock({ lockFile, runId: 'owner-a', clock, ownerToken: OWNER_A });
  await writeText(lockFile, `${JSON.stringify({
    runId: 'owner-b', pid: process.pid, createdAt: clock(), ownerToken: OWNER_B,
  })}\n`);

  assert.equal(await releaseWorkspaceLock({ lockFile, ownerToken: OWNER_A, clock }), false);
  assert.equal(JSON.parse(await readText(lockFile)).ownerToken, OWNER_B);
  assert.equal(await releaseWorkspaceLock({ lockFile, ownerToken: OWNER_B, clock }), true);
  await assertMissing(lockFile);
});

test('lock initialization failures close handles and remove only files created by that attempt', async () => {
  for (const failure of ['open', 'write', 'close']) {
    const dir = await mkdtemp(path.join(os.tmpdir(), `rein-lock-${failure}-`));
    const lockFile = path.join(dir, 'workspace.lock');
    let handleClosed = false;
    let closeAttempts = 0;
    const openFile = async (file, flags) => {
      if (file !== lockFile) return open(file, flags);
      if (failure === 'open') {
        const error = new Error('injected open failure');
        error.code = 'EIO';
        throw error;
      }
      const handle = await open(file, flags);
      return {
        writeFile: async (...args) => {
          if (failure === 'write') throw new Error('injected write failure');
          return handle.writeFile(...args);
        },
        close: async () => {
          closeAttempts += 1;
          if (failure === 'close' && closeAttempts === 1) {
            throw new Error('injected close failure');
          }
          handleClosed = true;
          await handle.close();
        },
      };
    };

    await assert.rejects(
      () => acquireWorkspaceLock({
        lockFile,
        runId: `failed-${failure}`,
        clock: () => '2026-07-17T10:00:00.000Z',
        ownerToken: OWNER_A,
        openFile,
      }),
      new RegExp(`injected ${failure} failure`),
    );
    if (failure !== 'open') assert.equal(handleClosed, true);
    await assertMissing(lockFile);
    await assertMissing(`${lockFile}.reclaim`);
  }
});

test('clock failure occurs before any workspace or reclaim lock is created', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'rein-lock-clock-'));
  const lockFile = path.join(dir, 'workspace.lock');
  await assert.rejects(
    () => acquireWorkspaceLock({
      lockFile,
      runId: 'failed-clock',
      clock: () => { throw new Error('injected clock failure'); },
      ownerToken: OWNER_A,
    }),
    /injected clock failure/,
  );
  await assertMissing(lockFile);
  await assertMissing(`${lockFile}.reclaim`);
});
