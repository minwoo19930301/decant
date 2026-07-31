import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  main,
  parseYamlScalars,
  validateSkillPack,
} from '../scripts/validate-skill-pack.mjs';

function captureOutput() {
  let value = '';
  return {
    stream: { write: (chunk) => { value += String(chunk); } },
    read: () => value,
  };
}

async function writeFixture(overrides = {}) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'rein-skill-pack-'));
  const skillName = overrides.skillName ?? 'rein-example';
  const skillRoot = path.join(root, 'skills', skillName);
  await mkdir(path.join(root, '.codex-plugin'), { recursive: true });
  await mkdir(path.join(root, '.claude-plugin'), { recursive: true });
  await mkdir(path.join(skillRoot, 'agents'), { recursive: true });
  await mkdir(path.join(skillRoot, 'references'), { recursive: true });

  const manifest = {
    name: 'rein',
    version: '0.1.1',
    description: 'A focused workflow skill pack.',
    author: { name: 'Relay10 contributors' },
    skills: './skills/',
    interface: {
      displayName: 'Relay10',
      shortDescription: 'Focused engineering workflows.',
      longDescription: 'A portable, evidence-first engineering workflow skill pack.',
      developerName: 'Relay10 contributors',
      category: 'Productivity',
      capabilities: [],
      defaultPrompt: ['Use Relay10 to choose the smallest safe workflow.'],
    },
    ...overrides.manifest,
  };
  await writeFile(
    path.join(root, '.codex-plugin', 'plugin.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
    'utf8',
  );
  if (overrides.claudeManifest !== false) {
    const claudeManifest = {
      name: 'rein',
      version: '0.1.1',
      description: 'A focused workflow skill pack.',
      author: { name: 'Relay10 contributors' },
      ...overrides.claudeManifest,
    };
    await writeFile(
      path.join(root, '.claude-plugin', 'plugin.json'),
      `${JSON.stringify(claudeManifest, null, 2)}\n`,
      'utf8',
    );
  }
  await writeFile(
    path.join(skillRoot, 'SKILL.md'),
    overrides.skill ?? `---\nname: ${skillName}\ndescription: Use this skill when a bounded example workflow needs verification.\n---\n\n# Example\n\nRead [the reference](./references/example.md).\n`,
    'utf8',
  );
  await writeFile(
    path.join(skillRoot, 'references', 'example.md'),
    '# Example reference\n',
    'utf8',
  );
  await writeFile(
    path.join(skillRoot, 'agents', 'openai.yaml'),
    overrides.agent ?? `interface:\n  display_name: "Relay10 Example"\n  short_description: "Run a bounded and verified example workflow"\n  default_prompt: "Use $${skillName} to verify this bounded workflow."\n`,
    'utf8',
  );
  return root;
}

test('small YAML parser extracts quoted nested interface values', () => {
  const result = parseYamlScalars(`interface:\n  display_name: "Relay10 Build"\n  default_prompt: 'Use $rein-build now.'\n`);
  assert.equal(result.get('interface.display_name'), 'Relay10 Build');
  assert.equal(result.get('interface.default_prompt'), 'Use $rein-build now.');
});

test('small YAML parser rejects malformed syntax instead of silently accepting it', () => {
  const malformed = [
    ['unclosed double quote', 'interface:\n  display_name: "Relay10 Build\n'],
    ['unmatched line', 'interface:\n  - display_name: Relay10 Build\n'],
    ['duplicate key', 'interface:\n  display_name: First\n  display_name: Second\n'],
    ['odd indentation', 'interface:\n   display_name: Relay10 Build\n'],
    ['indentation jump', 'interface:\n    display_name: Relay10 Build\n'],
    ['flow scalar', 'name: [rein-build]\n'],
  ];

  for (const [label, source] of malformed) {
    assert.throws(
      () => parseYamlScalars(source),
      { name: 'SyntaxError' },
      `expected ${label} to fail`,
    );
  }
});

test('validator returns itemized YAML errors for malformed skill and agent metadata', async () => {
  const root = await writeFixture({
    skill: `---\nname: rein-example\ndescription: [unfinished\n---\n\n# Example\n`,
    agent: `interface:\n  display_name: "Relay10 Example\n  short_description: "Run a bounded and verified example workflow"\n  default_prompt: "Use $rein-example to verify this workflow."\n`,
  });
  const result = await validateSkillPack(root);

  assert.equal(result.passed, false);
  assert.ok(result.errors.some((error) => (
    error.code === 'skill-frontmatter-yaml'
      && error.line === 2
      && /flow collections/.test(error.message)
  )), JSON.stringify(result.errors, null, 2));
  assert.ok(result.errors.some((error) => (
    error.code === 'agent-yaml'
      && error.line === 2
      && /not closed/.test(error.message)
  )), JSON.stringify(result.errors, null, 2));
});

test('valid skill pack passes manifest, skill, agent, and relative-link checks', async () => {
  const root = await writeFixture();
  const result = await validateSkillPack(root);
  assert.equal(result.passed, true, JSON.stringify(result.errors, null, 2));
  assert.equal(result.skillCount, 1);
  assert.deepEqual(result.errors, []);
});

test('validator reports placeholders, personalized paths, broken links, and agent metadata separately', async () => {
  const root = await writeFixture({
    skill: `---\nname: wrong-name\ndescription: TODO replace this description\n---\n\nRead [missing evidence](./references/missing.md).\n\nNever depend on /Users/alice/private/config.json.\n`,
    agent: `interface:\n  display_name: "Relay10 Example"\n  default_prompt: "Invoke the example without its skill token."\n`,
  });
  const result = await validateSkillPack(root);
  const codes = new Set(result.errors.map((error) => error.code));

  assert.equal(result.passed, false);
  for (const code of [
    'absolute-user-path',
    'agent-default-prompt',
    'agent-required-field',
    'relative-link-missing',
    'skill-name-mismatch',
    'todo-marker',
  ]) {
    assert.ok(codes.has(code), `missing ${code}: ${JSON.stringify(result.errors, null, 2)}`);
  }
  assert.ok(result.errors.every((error) => error.path && error.message));
});

test('manifest paths must start with ./ and cannot traverse outside the plugin', async () => {
  const root = await writeFixture({ manifest: { skills: '../skills' } });
  const result = await validateSkillPack(root);
  assert.ok(result.errors.some((error) => error.code === 'manifest-path'));
});

test('validator requires a Claude Code plugin manifest next to the Codex manifest', async () => {
  const root = await writeFixture({ claudeManifest: false });
  const result = await validateSkillPack(root);
  assert.equal(result.passed, false);
  assert.ok(result.errors.some((error) => error.code === 'claude-manifest-missing'));
});

test('Claude manifest must agree with the Codex manifest and stay within the validated layout', async () => {
  const root = await writeFixture({
    claudeManifest: {
      name: 'Relay 10',
      version: '0.2',
      description: '',
      skills: './skills/',
    },
  });
  const result = await validateSkillPack(root);
  const codes = new Set(result.errors.map((error) => error.code));

  assert.equal(result.passed, false);
  for (const code of [
    'claude-manifest-name',
    'claude-manifest-name-mismatch',
    'claude-manifest-version',
    'claude-manifest-version-mismatch',
    'claude-manifest-required-field',
    'claude-manifest-skills-unsupported',
  ]) {
    assert.ok(codes.has(code), `missing ${code}: ${JSON.stringify(result.errors, null, 2)}`);
  }
  assert.ok(result.errors
    .filter((error) => error.code.startsWith('claude-manifest-'))
    .every((error) => error.path === '.claude-plugin/plugin.json'));
});

test('repository marketplace manifest points at the bundled plugin with a matching name', async () => {
  const repositoryRoot = fileURLToPath(new URL('..', import.meta.url));
  const marketplace = JSON.parse(await readFile(
    path.join(repositoryRoot, '.claude-plugin', 'marketplace.json'),
    'utf8',
  ));

  assert.equal(marketplace.name, 'rein');
  assert.ok(marketplace.owner?.name, 'marketplace owner.name is required');
  assert.ok(Array.isArray(marketplace.plugins) && marketplace.plugins.length > 0);
  for (const entry of marketplace.plugins) {
    assert.match(entry.name, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    assert.match(entry.source, /^\.\//, 'plugin source must be a relative path inside the repository');
    const pluginManifest = JSON.parse(await readFile(
      path.join(repositoryRoot, entry.source, '.claude-plugin', 'plugin.json'),
      'utf8',
    ));
    assert.equal(pluginManifest.name, entry.name);
  }
});

test('CLI help is side-effect free and JSON failure returns a nonzero status with itemized errors', async () => {
  const helpOutput = captureOutput();
  assert.equal(await main(['--help'], { stdout: helpOutput.stream }), 0);
  assert.match(helpOutput.read(), /Usage:/);

  const root = await writeFixture({
    agent: `interface:\n  display_name: "Relay10 Example"\n  short_description: "Run a bounded and verified example workflow"\n  default_prompt: "Missing the required literal token."\n`,
  });
  const stdout = captureOutput();
  const stderr = captureOutput();
  const code = await main([root, '--json'], { stdout: stdout.stream, stderr: stderr.stream });
  const payload = JSON.parse(stdout.read());
  assert.equal(code, 1);
  assert.equal(payload.passed, false);
  assert.ok(payload.errors.some((error) => error.code === 'agent-default-prompt'));
  assert.equal(stderr.read(), '');
});

test('repository Rein plugin and all bundled skills pass the static validator', async () => {
  const repositoryRoot = path.resolve(new URL('..', import.meta.url).pathname);
  const result = await validateSkillPack(path.join(repositoryRoot, 'plugins', 'rein'));
  assert.equal(result.passed, true, JSON.stringify(result.errors, null, 2));
  assert.ok(result.skillCount >= 8);
});
