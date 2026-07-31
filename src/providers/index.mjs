import { codexProvider } from './codex.mjs';
import { kiroProvider } from './kiro.mjs';

export { assertProvider, extractOutput, wrapPrompt } from './contract.mjs';

export const PROVIDERS = Object.freeze({
  codex: codexProvider,
  kiro: kiroProvider,
});

export const PROVIDER_IDS = Object.freeze(Object.keys(PROVIDERS));

export const DEFAULT_PROVIDER = 'codex';

/**
 * Look up a provider by id.
 *
 * Config may name a provider but may not supply one: an arbitrary executable
 * from a project config would let a checked-in file decide what binary runs, so
 * the set is closed here in code, the same reason config cannot replace the
 * Codex executable.
 */
export function resolveProvider(id = DEFAULT_PROVIDER) {
  const provider = PROVIDERS[id];
  if (!provider) {
    throw new RangeError(
      `unknown provider ${JSON.stringify(id)}; supported: ${PROVIDER_IDS.join(', ')}`,
    );
  }
  return provider;
}
