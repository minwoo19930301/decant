import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { buildCatalog } from '../catalog.mjs';
import { spawnCapture } from '../executor.mjs';
import {
  assertProvider,
  catalogFromIds,
  coerceToSchema,
  extractOutput,
  parseLooseJson,
  wrapPrompt,
} from './contract.mjs';

const EXECUTABLE = 'kiro-cli';

/**
 * Tool grants per sandbox level.
 *
 * This CLI has no filesystem sandbox; it has a tool allowlist. That is a weaker
 * guarantee than a kernel-enforced sandbox and the difference is recorded in
 * `capabilities.sandbox` so a run report cannot imply otherwise: a read-only
 * stage here is a stage that was not granted write or exec tools, not a stage
 * that was prevented from writing.
 */
const SANDBOX_TOOLS = Object.freeze({
  'read-only': ['fs_read'],
  'workspace-write': ['fs_read', 'fs_write', 'execute_bash'],
});
const SEARCH_TOOLS = Object.freeze(['web_search', 'web_fetch']);

/** Build argv for one stage. Exported for tests. */
export function kiroArgs({
  model,
  effort,
  sandbox = 'read-only',
  search = false,
  prompt,
}) {
  const tools = SANDBOX_TOOLS[sandbox];
  if (!tools) throw new RangeError(`kiro provider does not support sandbox ${sandbox}`);
  const granted = search ? [...tools, ...SEARCH_TOOLS] : tools;
  const args = ['chat', '--no-interactive'];
  if (model && model !== 'auto') args.push('--model', model);
  if (effort) args.push('--effort', effort);
  args.push(`--trust-tools=${granted.join(',')}`, prompt);
  return args;
}

/**
 * Ask the CLI which models it accepts.
 *
 * There is no `models` subcommand, but rejecting an impossible model name makes
 * it print the list. Probing an interface for its own vocabulary is uglier than
 * reading metadata, and it yields ids only — no capability descriptions — which
 * is why role labels for this provider are heuristic.
 */
export async function discoverKiroModels(execute = spawnCapture) {
  const result = await execute(EXECUTABLE, [
    'chat',
    '--no-interactive',
    '--model',
    '__rein_model_probe__',
    'probe',
  ], { timeoutMs: 60_000 });
  const transcript = `${result.stdout}\n${result.stderr}`;
  const match = transcript.match(/Available models:\s*([^\n]+)/i);
  if (!match) {
    throw new Error(
      `could not read the ${EXECUTABLE} model list; the probe printed: `
      + `${transcript.trim().slice(0, 400)}`,
    );
  }
  return match[1]
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
}

export const kiroProvider = assertProvider({
  id: 'kiro',
  displayName: 'Kiro CLI',
  executable: EXECUTABLE,
  capabilities: Object.freeze({
    // Requested in the prompt and extracted from the transcript. The provider
    // cannot refuse malformed output the way a native schema does.
    outputSchema: 'prompted',
    // A tool allowlist, not a kernel sandbox.
    sandbox: 'tool-allowlist',
    search: true,
  }),
  catalogCommand: Object.freeze([EXECUTABLE, 'chat', '--model', '<probe>']),
  async discoverCatalog({ overrides = {}, execute } = {}) {
    const ids = await discoverKiroModels(execute);
    return buildCatalog(catalogFromIds(ids), { overrides });
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
    // The pipeline hands over a schema file path, the way Codex's
    // --output-schema expects. Without native support the schema has to travel
    // in the prompt instead.
    const schema = outputSchema
      ? JSON.parse(await readFile(path.resolve(outputSchema), 'utf8'))
      : undefined;
    const wrapped = wrapPrompt(prompt, { schema });
    const args = kiroArgs({ model, effort, sandbox, search, prompt: wrapped });
    const result = await execute(EXECUTABLE, args, { cwd, timeoutMs });
    if (result.code !== 0) {
      const error = new Error(
        `Kiro stage failed (${result.code}): ${result.stderr.slice(-1200)}`,
      );
      error.result = result;
      throw error;
    }
    const output = extractOutput(result.stdout);
    if (!schema) {
      await writeFile(path.resolve(outputFile), `${output}\n`, 'utf8');
      return result;
    }
    // This adapter promised a shape it cannot enforce, so it repairs the drift it
    // can repair from the schema's own vocabulary, and reports what it changed.
    const { value, renamed } = coerceToSchema(parseLooseJson(output), schema);
    await writeFile(path.resolve(outputFile), `${JSON.stringify(value, null, 2)}\n`, 'utf8');
    return { ...result, schemaRepairs: renamed };
  },
});
