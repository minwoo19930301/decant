import path from 'node:path';

import { spawnCapture } from '../src/executor.mjs';
import { writeJson } from '../src/utils.mjs';

const root = path.resolve(new URL('..', import.meta.url).pathname);
const specifications = [
  { label: 'Node 자동 테스트', command: 'npm', args: ['test'] },
  { label: '전체 JavaScript 문법 검사', command: 'npm', args: ['run', 'lint'] },
  { label: 'Codex Plugin·8 Skill 정적 검사', command: 'npm', args: ['run', 'validate:skills'] },
  { label: '실제 Codex 모델 탐색', command: 'node', args: ['src/cli.mjs', 'doctor', '--json'] },
  {
    label: '출시 작업 모델 배정 미리보기',
    command: 'node',
    args: ['src/cli.mjs', 'route', 'research current coding harnesses, build a lightweight CLI, verify it, and prepare a release', '--json'],
  },
  { label: 'npm 배포 파일 목록 검사', command: 'npm', args: ['pack', '--dry-run', '--json'] },
  { label: 'npm 설치본 전체 검사', command: 'npm', args: ['run', 'verify:package'] },
];

const commands = [];
for (const specification of specifications) {
  const startedAt = new Date().toISOString();
  const result = await spawnCapture(specification.command, specification.args, {
    cwd: root,
    timeoutMs: 1_200_000,
  });
  commands.push({
    label: specification.label,
    command: specification.command,
    args: specification.args,
    commandLine: [specification.command, ...specification.args].join(' '),
    startedAt,
    finishedAt: new Date().toISOString(),
    durationMs: result.durationMs,
    code: result.code,
    timedOut: result.timedOut,
    stdoutTruncated: result.stdoutTruncated,
    stderrTruncated: result.stderrTruncated,
    stdout: result.stdout,
    stderr: result.stderr,
    passed: result.code === 0 && result.timedOut !== true,
  });
}

const log = {
  version: 1,
  generatedAt: new Date().toISOString(),
  cwd: root,
  node: process.version,
  passed: commands.every((command) => command.passed),
  commands,
};
// docs/launch-verification.json is the frozen v0.1.1 Relay10 launch evidence and
// must not be regenerated: rewriting it would replace released evidence with a
// fresh log. Write to the gitignored outputs/ directory instead, and only touch
// the archived file when --freeze is passed explicitly.
const freeze = process.argv.includes('--freeze');
const target = freeze
  ? path.join(root, 'docs', 'launch-verification.json')
  : path.join(root, 'outputs', 'launch-verification.json');
await writeJson(target, log);
process.stdout.write(`launch verification: ${commands.filter((command) => command.passed).length}/${commands.length} commands passed\n`);
process.stdout.write(`log: ${path.relative(root, target)}${freeze ? ' (overwrote frozen v0.1.1 evidence)' : ''}\n`);
if (!log.passed) process.exitCode = 2;
