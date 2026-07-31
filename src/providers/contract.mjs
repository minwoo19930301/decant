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
export const OUTPUT_BEGIN = '<<<DECANT_OUTPUT_BEGIN>>>';
export const OUTPUT_END = '<<<DECANT_OUTPUT_END>>>';

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
 * A live run lost a whole reviewer stage because the model simply did not emit
 * the sentinels on a long answer, so `expect` controls what happens then. With a
 * JSON schema in play there is a safe fallback — find the outermost object in the
 * transcript — because a JSON object is self-delimiting in a way prose is not.
 * Without one, refuse: silently keeping a transcript full of tool logs as the
 * "answer" would corrupt the stage artifact rather than fail it.
 *
 * @param {string} transcript
 * @param {{expect?: 'json' | 'text'}} [options]
 * @returns {{output: string, fallback: boolean}}
 */
export function extractOutput(transcript, options = {}) {
  const text = String(transcript);
  const matches = [...text.matchAll(SENTINEL_PATTERN)];
  if (matches.length > 0) {
    return { output: stripQuotePrefix(matches[matches.length - 1][1]), fallback: false };
  }
  if (options.expect === 'json') {
    const stripped = stripQuotePrefix(text);
    const first = stripped.indexOf('{');
    const last = stripped.lastIndexOf('}');
    if (first >= 0 && last > first) {
      return { output: stripped.slice(first, last + 1).trim(), fallback: true };
    }
  }
  throw new Error(
    'provider output did not contain a Decant sentinel block, so the stage answer '
    + 'could not be separated from the transcript',
  );
}

function stripQuotePrefix(value) {
  return String(value).replace(/^[ \t]*>[ \t]?/gm, '').trim();
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
 */export function catalogFromIds(ids) {
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

const NORMALISE = /[^a-z0-9]/g;

function normaliseKey(key) {
  return String(key).toLowerCase().replace(NORMALISE, '');
}

/**
 * Pull a JSON object out of a model's answer.
 *
 * Even when asked for bare JSON, a model may wrap it in a fence or add a
 * sentence. This trims those two habits and nothing else — it does not repair
 * malformed JSON, because guessing at broken syntax would hide a real failure.
 */
export function parseLooseJson(text) {
  let body = String(text).trim();
  const fence = body.match(/^```(?:json)?\s*\n([\s\S]*?)\n?```$/);
  if (fence) body = fence[1].trim();
  try {
    return JSON.parse(body);
  } catch {
    const first = body.indexOf('{');
    const last = body.lastIndexOf('}');
    if (first >= 0 && last > first) return JSON.parse(body.slice(first, last + 1));
    throw new SyntaxError('provider answer was requested as JSON but is not parseable');
  }
}

/**
 * Rename keys that drifted, using the schema's own vocabulary.
 *
 * A provider whose `outputSchema` capability is `'prompted'` asked for a shape
 * rather than enforcing one, so it owns the gap. The commonest drift is a key
 * spelled differently: a live run produced `openquestions` where the schema says
 * `open_questions`, which failed validation while every value was correct.
 *
 * The repair is deliberately narrow. A key is renamed only when its normalised
 * form — lowercased with non-alphanumerics removed — equals the normalised form
 * of a key the schema declares. `openquestions` and `open_questions` both
 * normalise to `openquestions`, so that is a rename, not a guess. Nothing is
 * invented: a missing key stays missing and validation still fails, because
 * fabricating a value would turn a visible failure into a silent one.
 *
 * @returns {{value: unknown, renamed: string[]}}
 */
export function coerceToSchema(value, schema) {
  const renamed = [];
  const walk = (node, shape, path) => {
    if (!shape || typeof shape !== 'object') return node;
    if (Array.isArray(node)) {
      const items = shape.items;
      return items ? node.map((entry, index) => walk(entry, items, `${path}[${index}]`)) : node;
    }
    if (!node || typeof node !== 'object') return node;
    const properties = shape.properties;
    if (!properties) return node;
    const byNormalised = new Map(
      Object.keys(properties).map((key) => [normaliseKey(key), key]),
    );
    const out = {};
    for (const [key, entry] of Object.entries(node)) {
      const canonical = Object.hasOwn(properties, key)
        ? key
        : byNormalised.get(normaliseKey(key));
      if (canonical && canonical !== key) renamed.push(`${path}${key} -> ${canonical}`);
      const target = canonical ?? key;
      out[target] = walk(entry, properties[target], `${path}${target}.`);
    }
    return out;
  };
  return { value: walk(value, schema, ''), renamed };
}

/** Validate that an object satisfies the provider contract. */
export function assertProvider(provider) {  for (const key of ['id', 'displayName', 'executable', 'capabilities']) {
    if (!provider?.[key]) throw new TypeError(`provider is missing ${key}`);
  }
  for (const method of ['discoverCatalog', 'runStage']) {
    if (typeof provider[method] !== 'function') {
      throw new TypeError(`provider ${provider.id} is missing ${method}()`);
    }
  }
  return provider;
}
