/**
 * Stage backends versus public APIs that are not connected.
 *
 * Checked 2026-10-17. A row here is a public endpoint or CLI we could name,
 * not a claim that Decant calls it. Wired stage backends stay in
 * src/providers/index.mjs.
 *
 * Sources:
 * - https://openrouter.ai/models
 * - https://openrouter.ai/google/gemini-4-argon
 * - https://console.groq.com/docs/api-reference
 * - https://ai.google.dev/gemini-api/docs/models/gemini-4-argon
 * - https://docs.factory.com/droid-cli/cli-reference
 * - https://ampcode.com/docs/customize/model-routing
 * - https://hermes-agent.nousresearch.com/docs/
 */

export const SURFACE_CHECKED = '2026-10-17';

export const API_SURFACES = Object.freeze([
  {
    id: 'openrouter',
    name: 'OpenRouter',
    endpoint: 'https://openrouter.ai/api/v1',
    keyEnv: 'OPENROUTER_API_KEY',
    examples: Object.freeze([
      'google/gemini-4-argon',
      'x-ai/grok-4.7',
    ]),
    note: 'OpenAI-shaped HTTP API. Decant does not send a task to it.',
  },
  {
    id: 'groq',
    name: 'Groq',
    endpoint: 'https://api.groq.com/openai/v1',
    keyEnv: 'GROQ_API_KEY',
    examples: Object.freeze([
      'llama-3.3-70b-versatile',
      'openai/gpt-oss-120b',
    ]),
    note: 'Groq is not the Grok CLI. The groq binary from Groq Code CLI is not launched.',
  },
  {
    id: 'gemini',
    name: 'Gemini API',
    endpoint: 'https://generativelanguage.googleapis.com/v1beta',
    keyEnv: 'GEMINI_API_KEY',
    examples: Object.freeze(['gemini-4-argon']),
    note: 'Official Gemini API. There is no Gemini stage backend.',
  },
]);

/** Public products we read and did not connect. */
export const LOOKED_AT = Object.freeze([
  {
    id: 'factory-droid',
    name: 'Factory Droid',
    kept: 'The default run is read-only until autonomy is raised on purpose.',
    left: 'Missions, custom droids, and a second terminal UI.',
  },
  {
    id: 'amp',
    name: 'Amp',
    kept: 'A listed provider is not a connection. Access is a separate check.',
    left: 'Amp credits, orbs, and automatic subagent routing.',
  },
  {
    id: 'hermes-agent',
    name: 'Hermes Agent',
    kept: 'The user brings a provider. The harness does not pretend to host the model.',
    left: 'Memory, cron, and spawned subagents.',
  },
]);

export function describeApiSurface(surface, env = process.env) {
  const key = surface.keyEnv;
  const present = Boolean(env?.[key] && String(env[key]).trim());
  return {
    id: surface.id,
    name: surface.name,
    endpoint: surface.endpoint,
    keyEnv: key,
    keyPresent: present,
    connected: false,
    examples: [...surface.examples],
    note: surface.note,
  };
}

export function describeApiSurfaces(env = process.env) {
  return API_SURFACES.map((surface) => describeApiSurface(surface, env));
}
