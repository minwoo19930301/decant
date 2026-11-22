/**
 * Stage backends versus public HTTP APIs that are NOT connected.
 *
 * A row here only names a well-known endpoint and the environment variable
 * its client conventionally reads, so `decant doctor` can say plainly that the
 * host is not a stage backend. It is not a support claim: Decant never sends a
 * task to these hosts, and no model id is listed because none has been verified
 * end to end here. Endpoints and key names are conventions copied from each
 * vendor's public documentation and are not re-checked at runtime.
 *
 * Wired stage backends stay in src/providers/index.mjs.
 */

export const API_SURFACES = Object.freeze([
  {
    id: 'openrouter',
    name: 'OpenRouter',
    endpoint: 'https://openrouter.ai/api/v1',
    keyEnv: 'OPENROUTER_API_KEY',
    note: 'OpenAI-shaped HTTP API. Decant does not send a task to it.',
  },
  {
    id: 'groq',
    name: 'Groq',
    endpoint: 'https://api.groq.com/openai/v1',
    keyEnv: 'GROQ_API_KEY',
    note: 'Groq is not the Grok CLI. Decant does not call it or launch a groq binary.',
  },
  {
    id: 'gemini',
    name: 'Gemini API',
    endpoint: 'https://generativelanguage.googleapis.com/v1beta',
    keyEnv: 'GEMINI_API_KEY',
    note: 'Google Gemini HTTP API. There is no Gemini stage backend.',
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
    note: surface.note,
  };
}

export function describeApiSurfaces(env = process.env) {
  return API_SURFACES.map((surface) => describeApiSurface(surface, env));
}
