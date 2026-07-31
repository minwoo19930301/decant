import { constants as fsConstants } from 'node:fs';
import { lstat, mkdir, open, realpath, stat } from 'node:fs/promises';
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
 * Identify the four released artifacts by inode so a write can be checked
 * against what it will actually touch rather than against a pathname.
 *
 * Path-based validation cannot be made correct here. `O_NOFOLLOW` constrains
 * only the final component, so an intermediate component can be flipped into a
 * symlink after the directory check (an auditor won that race in 30 s), and a
 * hardlink is an ordinary file that passes every symlink test while sharing the
 * archive's inode. Comparing the opened descriptor's `dev`/`ino` against the
 * archive closes both, because it asks the only question that matters: is this
 * the released file?
 */
async function protectedIdentities(root) {
  const identities = [];
  for (const relativePath of FROZEN_EVIDENCE) {
    const info = await stat(path.join(root, relativePath)).catch((error) => {
      if (error.code === 'ENOENT') return null;
      throw error;
    });
    if (info) identities.push({ relativePath, dev: info.dev, ino: info.ino });
  }
  return identities;
}

/**
 * Write one evidence artifact without letting a symlink, a hardlink, or a
 * mid-write path swap redirect the bytes onto the released archive.
 *
 * @param {string} root repository root
 * @param {{target: string, frozen: boolean, relative: string}} destination from evidenceTarget
 * @param {string | Uint8Array} data
 */
export async function writeEvidence(root, destination, data) {
  const { target, frozen, relative } = destination;
  const directory = path.dirname(target);
  await mkdir(directory, { recursive: true });

  const boundary = frozen ? root : path.join(root, 'outputs');
  const resolvedRoot = await realpath(root);
  const resolvedDirectory = await realpath(directory);

  // First line of defence: reject an obviously redirected directory. Compare
  // against where the layout says the directory should physically be, not
  // against realpath(boundary) — with `outputs` symlinked to `docs` both sides
  // resolve to docs/ and that comparison passes.
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

  const identities = await protectedIdentities(root);
  const allowed = frozen
    ? identities.find((identity) => identity.relativePath === relative)
    : undefined;

  // Open without O_TRUNC so nothing is destroyed before the descriptor itself
  // has been checked.
  const handle = await open(
    target,
    // eslint-disable-next-line no-bitwise
    fsConstants.O_WRONLY | fsConstants.O_CREAT | fsConstants.O_NOFOLLOW,
  );
  try {
    const opened = await handle.stat();
    if (opened.nlink > 1) {
      throw new Error(
        `refusing to write evidence: ${target} has ${opened.nlink} hard links, `
        + 'so the write could reach frozen evidence through a shared inode',
      );
    }
    const collision = identities.find(
      (identity) => identity.dev === opened.dev && identity.ino === opened.ino,
    );
    if (collision && collision !== allowed) {
      throw new Error(
        `refusing to write evidence: ${target} is the same file as frozen evidence `
        + `${collision.relativePath}. Overwriting it requires --freeze and `
        + `${OVERRIDE_ENV}=1 naming that artifact directly.`,
      );
    }
    await handle.truncate(0);
    await handle.writeFile(data);
  } finally {
    await handle.close();
  }
}
