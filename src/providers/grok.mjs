import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { buildCatalog, snapEffort } from '../catalog.mjs';
import { spawnCapture } from '../executor.mjs';
import { assertProvider, coerceToSchema, parseLooseJson } from './contract.mjs';

const EXECUTABLE = 'grok';

/**
 * Grok 4.7 advertises exactly these reasoning efforts. `high` is the server
 * default. `none`, `minimal`, `max`, and `ultra` are not on this model's menu;
 * Decant snaps `max` and `ultra` down to `xhigh` before the CLI sees them.
 */
export const GROK_47_ID = 'grok-4.7';
export const GROK_47_EFFORTS = Object.freeze(['low', 'medium', 'high', 'xhigh']);

export const GROK_47_CATALOG_ENTRY = Object.freeze({
  id: GROK_47_ID,
  slug: GROK_47_ID,
  name: 'Grok 4.7',
  display_name: 'Grok 4.7',
  description: 'frontier flagship most capable. Advertised reasoning efforts: low, medium, high (default), xhigh.',
  priority: 1,
  visible: true,
  default_reasoning_level: 'high',
  supported_reasoning_levels: [...GROK_47_EFFORTS],
});

/**
 * Permission mode is a request, not a kernel sandbox. Grok's own sandbox is
 * fail-open, so a read-only stage here is "plan mode was requested", not
 * "writes were prevented".
 */
const PERMISSION_MODE = Object.freeze({
  'read-only': 'plan',
  'workspace-write': 'acceptEdits',
});

export function resolveGrokEffort(model, effort) {
  const id = !model || model === 'auto' ? GROK_47_ID : String(model);
  if (id === GROK_47_ID) return snapEffort(effort ?? 'high', GROK_47_EFFORTS);
  return effort ?? null;
}

/** Build argv for one stage. Exported for tests. */
export function grokArgs({
  model,
  effort,
  sandbox = 'read-only',
  search = false,
  promptFile,
  schemaText,
}) {
  const permission = PERMISSION_MODE[sandbox];
  if (!permission) throw new RangeError(`grok provider does not support sandbox ${sandbox}`);
  if (!promptFile) throw new TypeError('grok provider requires a prompt file');
  const id = !model || model === 'auto' ? GROK_47_ID : String(model);
  const args = [
    '--model',
    id,
    '--prompt-file',
    promptFile,
    '--output-format',
    'json',
    '--permission-mode',
    permission,
  ];
  const resolvedEffort = resolveGrokEffort(id, effort);
  if (resolvedEffort) args.push('--reasoning-effort', resolvedEffort);
  if (!search) args.push('--disable-web-search');
  if (schemaText) args.push('--json-schema', schemaText);
  return args;
}

export function parseGrokModelIds(transcript) {
  const ids = [];
  for (const line of String(transcript).split(/\r?\n/)) {
    const starred = line.match(/^\s*\*\s+([A-Za-z0-9][A-Za-z0-9._:-]*)/);
    if (starred) ids.push(starred[1]);
  }
  if (ids.length === 0) {
    const fallback = String(transcript).match(/Default model:\s*([A-Za-z0-9][A-Za-z0-9._:-]*)/);
    if (fallback) ids.push(fallback[1]);
  }
  return [...new Set(ids)];
}

export function grokCatalogEntries(ids) {
  return ids.filter((id) => id && id !== 'auto').map((id, index) => {
    if (id === GROK_47_ID) return { ...GROK_47_CATALOG_ENTRY };
    return {
      id,
      name: id,
      description: 'no effort menu advertised by grok models',
      priority: index + 2,
      visible: true,
    };
  });
}

export function parseGrokResult(stdout) {
  const text = String(stdout).trim();
  if (!text) throw new SyntaxError('grok did not emit a JSON result');
  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start < 0 || end <= start) throw new SyntaxError('grok did not emit a JSON result');
    return JSON.parse(text.slice(start, end + 1));
  }
}

function structuredText(value) {
  if (value === undefined || value === null) return null;
  return typeof value === 'string' ? value : JSON.stringify(value);
}

/** Cost fields the Grok CLI 1.0.52 envelope reports. Absent fields stay absent. */
export function grokCost(payload) {
  const cost = {};
  if (payload?.usage && typeof payload.usage === 'object' && !Array.isArray(payload.usage)) {
    cost.usage = payload.usage;
  }
  if (typeof payload?.total_cost_usd === 'number' && Number.isFinite(payload.total_cost_usd)) {
    cost.totalCostUsd = payload.total_cost_usd;
  }
  return cost;
}

export function grokAnswer(payload) {
  if (!payload || typeof payload !== 'object') {
    throw new TypeError('grok JSON result is not an object');
  }
  // CLI 1.0.52 writes `structuredOutput` (camelCase object). Older envelopes
  // used `structured_output`. Prefer the current key, then the old one.
  const structured = structuredText(payload.structuredOutput)
    ?? structuredText(payload.structured_output);
  if (structured !== null) return structured;
  if (typeof payload.text === 'string') return payload.text;
  if (typeof payload.result === 'string') return payload.result;
  throw new Error('grok JSON result has no text');
}

export async function discoverGrokModels(execute = spawnCapture) {
  const result = await execute(EXECUTABLE, ['models'], { timeoutMs: 60_000 });
  const ids = parseGrokModelIds(`${result.stdout}\n${result.stderr}`);
  if (ids.length === 0) {
    const transcript = `${result.stdout}\n${result.stderr}`.trim();
    throw new Error(
      `could not read the ${EXECUTABLE} model list; the command printed: ${transcript.slice(0, 400)}`,
    );
  }
  return ids;
}

export const grokProvider = assertProvider({
  id: 'grok',
  displayName: 'Grok CLI',
  executable: EXECUTABLE,
  capabilities: Object.freeze({
    outputSchema: 'native',
    sandbox: 'fail-open',
    search: true,
  }),
  catalogCommand: Object.freeze([EXECUTABLE, 'models']),
  async discoverCatalog({ overrides = {}, execute } = {}) {
    const ids = await discoverGrokModels(execute);
    return buildCatalog(grokCatalogEntries(ids), { overrides });
  },
  async runStage({
    prompt,
    cwd,
    model,
    effort,
    sandbox,
    search,
    outputFile,
    outputSchema,
    timeoutMs,
    execute = spawnCapture,
  }) {
    const resolvedOutput = path.resolve(outputFile);
    const promptFile = `${resolvedOutput}.prompt`;
    await writeFile(promptFile, prompt, 'utf8');
    const schemaText = outputSchema
      ? await readFile(path.resolve(outputSchema), 'utf8')
      : undefined;
    const args = grokArgs({
      model,
      effort,
      sandbox,
      search,
      promptFile,
      schemaText,
    });
    const result = await execute(EXECUTABLE, args, { cwd, timeoutMs });
    if (result.code !== 0) {
      const error = new Error(
        `Grok stage failed (${result.code}): ${String(result.stderr ?? '').slice(-1200)}`,
      );
      error.result = result;
      throw error;
    }
    const payload = parseGrokResult(result.stdout);
    const answer = grokAnswer(payload);
    const cost = grokCost(payload);
    if (!schemaText) {
      await writeFile(resolvedOutput, answer.endsWith('\n') ? answer : `${answer}\n`, 'utf8');
      return { ...result, ...cost };
    }
    const schema = JSON.parse(schemaText);
    const { value, renamed } = coerceToSchema(parseLooseJson(answer), schema);
    await writeFile(resolvedOutput, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
    return { ...result, ...cost, schemaRepairs: renamed };
  },
});
