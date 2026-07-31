import path from 'node:path';

/**
 * Guard for the frozen v0.1.1 Relay10 launch evidence.
 *
 * `docs/launch-report.html`, `docs/launch-verification.json`, and
 * `docs/launch-reader-*.json` are released artifacts bound to each other by
 * recorded SHA-256 values: `launch-reader-live.json.reportSha256` must equal
 * `sha256(launch-report.html)`. Regenerating any of them in place replaces
 * released evidence with a fresh log and breaks that binding, which is why the
 * 0.2.0 rename left these files and their generators untouched.
 *
 * Every generator therefore writes to the gitignored `outputs/` directory by
 * default. Overwriting the archive requires BOTH `--freeze` on the command line
 * and `REIN_ALLOW_FROZEN_OVERWRITE=1` in the environment, so a stray flag in a
 * script or shell history cannot destroy the evidence on its own.
 */
export const FROZEN_EVIDENCE = Object.freeze([
  'docs/launch-report.html',
  'docs/launch-verification.json',
  'docs/launch-reader-live.json',
  'docs/launch-reader-deterministic.json',
]);

const OVERRIDE_ENV = 'REIN_ALLOW_FROZEN_OVERWRITE';

/**
 * Resolve where a generator should write one frozen-evidence artifact.
 *
 * @param {string} root repository root
 * @param {string} relativePath one of FROZEN_EVIDENCE
 * @param {{argv?: string[], env?: Record<string, string | undefined>}} [options]
 * @returns {{target: string, frozen: boolean, relative: string}}
 */
export function evidenceTarget(root, relativePath, options = {}) {
  const argv = options.argv ?? process.argv;
  const env = options.env ?? process.env;
  if (!FROZEN_EVIDENCE.includes(relativePath)) {
    throw new Error(`${relativePath} is not a declared frozen-evidence artifact`);
  }
  const requested = argv.includes('--freeze');
  if (!requested) {
    return {
      target: path.join(root, 'outputs', path.basename(relativePath)),
      frozen: false,
      relative: path.join('outputs', path.basename(relativePath)),
    };
  }
  if (env[OVERRIDE_ENV] !== '1') {
    throw new Error(
      `refusing to overwrite frozen v0.1.1 evidence ${relativePath}: `
      + `--freeze also requires ${OVERRIDE_ENV}=1. `
      + 'Without it the generator writes to outputs/ so you can diff instead.',
    );
  }
  return { target: path.join(root, relativePath), frozen: true, relative: relativePath };
}

/** Human-readable note for a generator to print after writing. */
export function describeTarget(root, result) {
  return `${result.relative}${result.frozen ? ' (OVERWROTE frozen v0.1.1 evidence)' : ''}`;
}
