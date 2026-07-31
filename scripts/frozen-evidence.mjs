import { constants as fsConstants } from 'node:fs';
import { lstat, mkdir, open, realpath } from 'node:fs/promises';
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

/**
 * Write one evidence artifact without letting a symlink redirect the bytes.
 *
 * `evidenceTarget` only decides a pathname. A pathname check alone is not a
 * guard: if `outputs/launch-report.html` is a symlink to `docs/launch-report.html`,
 * an ordinary `writeFile` follows it and destroys the frozen archive while the
 * generator prints `outputs/…`. Both independent auditors reproduced exactly
 * that bypass, so the physical destination is verified here:
 *
 * - the resolved parent directory must stay inside the intended root
 *   (`outputs/` for a default write, the repository for a `--freeze` write);
 * - the final component must not be a symlink, enforced by `lstat` and again
 *   by `O_NOFOLLOW` so the check cannot be won by a race.
 *
 * @param {string} root repository root
 * @param {{target: string, frozen: boolean, relative: string}} destination from evidenceTarget
 * @param {string | Uint8Array} data
 */
export async function writeEvidence(root, destination, data) {
  const { target, frozen } = destination;
  const directory = path.dirname(target);
  await mkdir(directory, { recursive: true });

  const boundary = frozen ? root : path.join(root, 'outputs');
  const resolvedRoot = await realpath(root);
  const resolvedDirectory = await realpath(directory);

  // Compare against where the directory *should* physically be, derived from the
  // repository root, rather than against realpath(boundary). Resolving the
  // boundary itself is not a check: with `outputs` symlinked to `docs`, both
  // sides resolve to docs/ and the comparison passes. Deriving the expected
  // physical path instead rejects a symlink at any component of the path.
  const expectedDirectory = path.join(resolvedRoot, path.relative(root, directory));
  if (resolvedDirectory !== expectedDirectory) {
    throw new Error(
      `refusing to write evidence: ${directory} physically resolves to `
      + `${resolvedDirectory} instead of ${expectedDirectory}, so a symlinked `
      + 'path component could redirect the write onto frozen evidence',
    );
  }
  const resolvedBoundary = path.join(resolvedRoot, path.relative(root, boundary));
  if (
    resolvedDirectory !== resolvedBoundary
    && !resolvedDirectory.startsWith(resolvedBoundary + path.sep)
  ) {
    throw new Error(
      `refusing to write evidence: ${resolvedDirectory} is outside ${resolvedBoundary}`,
    );
  }

  const existing = await lstat(target).catch((error) => {
    if (error.code === 'ENOENT') return null;
    throw error;
  });
  if (existing?.isSymbolicLink()) {
    throw new Error(
      `refusing to write evidence through the symlink ${target}: `
      + 'a link here could redirect the write onto frozen evidence. Remove it first.',
    );
  }
  if (existing && !existing.isFile()) {
    throw new Error(`refusing to write evidence: ${target} is not a regular file`);
  }

  const handle = await open(
    target,
    // eslint-disable-next-line no-bitwise
    fsConstants.O_WRONLY | fsConstants.O_CREAT | fsConstants.O_TRUNC | fsConstants.O_NOFOLLOW,
  );
  try {
    await handle.writeFile(data);
  } finally {
    await handle.close();
  }
}
