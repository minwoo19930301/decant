import { discoverCatalog } from '../catalog.mjs';
import { runCodex } from '../executor.mjs';
import { assertProvider } from './contract.mjs';

/**
 * Codex CLI provider — the original and, until 0.2, only execution path.
 *
 * Codex has native support for both of the things other CLIs lack: it writes
 * the final assistant message to a file (`--output-last-message`) and it can be
 * held to a JSON schema (`--output-schema`). So this adapter needs no prompt
 * wrapping and declares both capabilities true.
 */
export const codexProvider = assertProvider({
  id: 'codex',
  displayName: 'Codex CLI',
  executable: 'codex',
  capabilities: Object.freeze({
    outputSchema: 'native',
    sandbox: 'native',
    search: true,
  }),
  catalogCommand: Object.freeze(['codex', 'debug', 'models']),
  discoverCatalog(options = {}) {
    return discoverCatalog(options);
  },
  runStage(options) {
    return runCodex(options);
  },
});
