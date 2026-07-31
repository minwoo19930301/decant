/**
 * Provider contract.
 *
 * Every model stage in the pipeline goes through exactly one call shape:
 *
 *   runStage({ prompt, cwd, model, effort, sandbox, search,
 *              outputFile, outputSchema, timeoutMs })
 *     -> writes the stage's final answer to outputFile
 *     -> resolves with a spawnCapture-shaped result, or throws
 *
 * A provider is whatever satisfies that plus model discovery. Nothing else in
 * the pipeline may reach for a specific CLI, which is what makes "the same
 * discipline, whatever model you run underneath" a checkable claim rather than
 * a slogan.
 *
 * Providers declare capabilities honestly. A provider without native
 * structured output must say `outputSchema: false`; the shared helpers below
 * then ask for the schema in the prompt and extract it from stdout, and the run
 * manifest records that the structure was requested rather than enforced.
 */

/** Sentinels used when a provider has no native "final message" channel. */
export const OUTPUT_BEGIN = '<<<REIN_OUTPUT_BEGIN>>>';
export const OUTPUT_END = '<<<REIN_OUTPUT_END>>>';

/**
 * Wrap a stage prompt so the final answer can be recovered from interleaved
 * tool logs, and so a JSON schema can be requested without native support.
 *
 * @param {string} prompt
 * @param {{schema?: unknown}} [options]
 */
export function wrapPrompt(prompt, options = {}) {
  const lines = [prompt.trimEnd(), ''];
  if (options.schema) {
    lines.push(
      'Your answer must be a single JSON object and nothing else. It must satisfy',
      'this JSON Schema. Do not wrap it in a code fence.',
      '',
      JSON.stringify(options.schema, null, 2),
      '',
    );
  }
  lines.push(
    'Put your entire final answer between these two sentinel lines, each on its',
    'own line, with no other text after the closing sentinel:',
    OUTPUT_BEGIN,
    '...your answer...',
    OUTPUT_END,
  );
  return lines.join('\n');
}

const SENTINEL_PATTERN = new RegExp(`${OUTPUT_BEGIN}([\\s\\S]*?)${OUTPUT_END}`, 'g');

/**
 * Recover the final answer from a transcript.
 *
 * Takes the LAST sentinel block, because an agent may quote the instructions
 * before answering. Strips the single-level quote prefix some CLIs put on
 * assistant lines.
 *
 * @param {string} transcript
 * @returns {string}
 */
export function extractOutput(transcript) {
  const matches = [...String(transcript).matchAll(SENTINEL_PATTERN)];
  if (matches.length === 0) {
    throw new Error(
      'provider output did not contain a Rein sentinel block, so the stage answer '
      + 'could not be separated from the transcript',
    );
  }
  return matches[matches.length - 1][1]
    .replace(/^[ \t]*>[ \t]?/gm, '')
    .trim();
}

/**
 * Normalise a model list into the JSON shape buildCatalog() already parses, so
 * a provider without Codex-style metadata still gets role selection.
 *
 * Role hints are derived from model family names only. That is a heuristic, not
 * vendor metadata, and callers must not present it as a measured capability
 * ranking.
 *
 * @param {string[]} ids in the provider's own preference order
 */
export function catalogFromIds(ids) {
  const hints = [
    [/opus/i, 'frontier flagship most capable'],
    [/sonnet/i, 'balanced everyday strong general'],
    [/haiku|mini|small|flash|lite/i, 'economy fast affordable small'],
  ];
  return ids
    .filter((id) => id && id !== 'auto')
    .map((id, index) => {
      const hint = hints.find(([pattern]) => pattern.test(id));
      return {
        id,
        name: id,
        description: hint
          ? `${hint[1]} (heuristic label from the model family name, not vendor metadata)`
          : 'no capability metadata available from this provider',
        priority: index + 1,
        visible: true,
      };
    });
}

/** Validate that an object satisfies the provider contract. */
export function assertProvider(provider) {
  for (const key of ['id', 'displayName', 'executable', 'capabilities']) {
    if (!provider?.[key]) throw new TypeError(`provider is missing ${key}`);
  }
  for (const method of ['discoverCatalog', 'runStage']) {
    if (typeof provider[method] !== 'function') {
      throw new TypeError(`provider ${provider.id} is missing ${method}()`);
    }
  }
  return provider;
}
