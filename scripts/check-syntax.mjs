#!/usr/bin/env node
import { readdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
async function files(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  return (await Promise.all(entries.map(entry => entry.isDirectory()
    ? files(path.join(directory, entry.name))
    : entry.isFile() && entry.name.endsWith('.mjs') ? [path.join(directory, entry.name)] : []))).flat();
}
const targets = (await Promise.all(['src', 'test', 'scripts'].map(name => files(path.join(root, name))))).flat().sort();
for (const target of targets) execFileSync(process.execPath, ['--check', target], { stdio: 'inherit' });
process.stdout.write(`syntax checks: pass (${targets.length} modules)\n`);
