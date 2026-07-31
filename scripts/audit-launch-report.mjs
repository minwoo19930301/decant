import { createHash } from 'node:crypto';
import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { discoverCatalog } from '../src/catalog.mjs';
import { mapPool, runCodex } from '../src/executor.mjs';
import { liveReaderPrompt } from '../src/prompts.mjs';
import { aggregateReader10, READER10_PERSONAS } from '../src/reader10.mjs';
import { readJson, writeJson } from '../src/utils.mjs';
import { describeTarget, evidenceTarget } from './frozen-evidence.mjs';

const root = path.resolve(new URL('..', import.meta.url).pathname);
const reportFile = path.join(root, 'docs', 'launch-report.html');
const auditDir = path.join(root, '.relay10', 'launch-audit');
// Resolve the frozen-evidence target before spending ten model calls.
const liveDestination = evidenceTarget(root, 'docs/launch-reader-live.json');
const schema = fileURLToPath(new URL('../schema/reader-result.schema.json', import.meta.url));
await mkdir(auditDir, { recursive: true });
const reportSha256 = createHash('sha256').update(await readFile(reportFile)).digest('hex');

const catalog = await discoverCatalog();
const model = catalog.roles.economy.model;
const results = await mapPool(READER10_PERSONAS, 3, async (persona) => {
  const outputFile = path.join(auditDir, `${persona.id}.json`);
  await runCodex({
    prompt: liveReaderPrompt(reportFile, persona),
    cwd: root,
    model,
    effort: 'low',
    sandbox: 'read-only',
    outputFile,
    outputSchema: schema,
    timeoutMs: 1_200_000,
  });
  return { persona, result: await readJson(outputFile) };
});

const personas = results.map(({ persona, result }) => ({
  id: persona.id,
  name: persona.name,
  description: persona.description,
  passed: result.understood === true,
  restatement: result.restatement,
  checks: [{
    id: 'live-understanding',
    label: '목적·결과·근거·위험·다음 행동을 재진술한다',
    passed: result.understood === true,
    severity: 'warning',
    detail: result.blocking_ambiguities?.join(' · ') || '이해도 문제 없음',
  }],
  raw: result,
}));
const audit = {
  version: 1,
  mode: 'live',
  model,
  effort: 'low',
  reportSha256,
  generatedAt: new Date().toISOString(),
  ...aggregateReader10(personas, { minPass: 10 }),
  personas,
};
await writeJson(liveDestination.target, audit);
await writeJson(path.join(root, 'outputs', 'relay10-launch-reader-live.json'), audit);
process.stdout.write(`live audit: ${audit.passedPersonas}/10 readers, ${audit.criticalCount} critical, ${model}/low\n`);
process.stdout.write(`reader log: ${describeTarget(root, liveDestination)}\n`);
if (!audit.passed) process.exitCode = 2;
