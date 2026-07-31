#!/usr/bin/env node

import { readFile, readdir, realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_FILE = fileURLToPath(import.meta.url);
const REPOSITORY_ROOT = fileURLToPath(new URL('..', import.meta.url));
const DEFAULT_PLUGIN_ROOT = path.join(REPOSITORY_ROOT, 'plugins', 'decant');
const TEXT_EXTENSIONS = new Set([
  '.json',
  '.md',
  '.mjs',
  '.js',
  '.jsx',
  '.py',
  '.sh',
  '.ts',
  '.tsx',
  '.txt',
  '.yaml',
  '.yml',
]);
const SEMVER_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;
const SKILL_NAME_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const ABSOLUTE_USER_PATH_PATTERN = /(?:\/Users\/[A-Za-z0-9._-]+(?:\/[^\s"'`<>)]*)?|\/home\/[A-Za-z0-9._-]+(?:\/[^\s"'`<>)]*)?|[A-Za-z]:[\\/]Users[\\/][^\\/\s"'`<>]+(?:[\\/][^\s"'`<>)]*)?)/g;

function portablePath(value) {
  return value.split(path.sep).join('/');
}

function isInside(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

function lineNumberAt(source, index) {
  let line = 1;
  for (let cursor = 0; cursor < index; cursor += 1) {
    if (source.charCodeAt(cursor) === 10) line += 1;
  }
  return line;
}

function yamlSyntaxError(line, message) {
  const error = new SyntaxError(`line ${line}: ${message}`);
  error.line = line;
  return error;
}

function parseYamlScalar(rawValue, line) {
  const value = rawValue.trim();
  if (value.startsWith('"')) {
    if (value.length < 2 || !value.endsWith('"')) {
      throw yamlSyntaxError(line, 'double-quoted scalar is not closed');
    }
    try {
      return JSON.parse(value);
    } catch {
      throw yamlSyntaxError(line, 'double-quoted scalar contains an invalid escape or trailing content');
    }
  }
  if (value.startsWith("'")) {
    if (value.length < 2 || !value.endsWith("'")) {
      throw yamlSyntaxError(line, 'single-quoted scalar is not closed');
    }
    const body = value.slice(1, -1);
    if ([...body.matchAll(/'+/g)].some((match) => match[0].length % 2 !== 0)) {
      throw yamlSyntaxError(line, 'single quotes inside a scalar must be doubled');
    }
    return body.replaceAll("''", "'");
  }

  if (/^[\[{]/.test(value)) {
    throw yamlSyntaxError(line, 'flow collections are not supported; use a string scalar');
  }
  if (/^[|>]/.test(value)) {
    throw yamlSyntaxError(line, 'block scalars are not supported; keep metadata on one line');
  }
  if (/^(?:-\s|[?:]\s|#|[\]},&*!%@`])/.test(value)
    || /:\s/.test(value)
    || /\s#/.test(value)) {
    throw yamlSyntaxError(line, 'plain scalar uses unsupported YAML syntax');
  }
  if (/^(?:null|~|true|false)$/i.test(value)
    || /^[-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?$/i.test(value)) {
    throw yamlSyntaxError(line, 'metadata values must be strings');
  }
  return value;
}

// Decant metadata deliberately uses a strict YAML subset: two-space-indented
// mappings and one-line string scalars. Rejecting everything else keeps the
// dependency-free parser fail-closed instead of pretending to implement YAML.
export function parseYamlScalars(source) {
  const values = new Map();
  const parents = [];
  const seenPaths = new Set();

  for (const [index, line] of source.split(/\r?\n/).entries()) {
    const lineNumber = index + 1;
    if (!line.trim() || /^\s*#/.test(line)) continue;
    if (/^\s*\t/.test(line) || /^ *\t/.test(line)) {
      throw yamlSyntaxError(lineNumber, 'indentation must use spaces, not tabs');
    }
    const match = /^( *)([A-Za-z0-9_-]+):(?:\s*(.*))?$/.exec(line);
    if (!match) {
      throw yamlSyntaxError(lineNumber, 'expected a mapping entry in key: value form');
    }

    const indent = match[1].length;
    const key = match[2];
    const rawValue = match[3] ?? '';
    if (indent % 2 !== 0) {
      throw yamlSyntaxError(lineNumber, 'indentation must use exactly two spaces per level');
    }
    const level = indent / 2;
    if (level > parents.length) {
      throw yamlSyntaxError(lineNumber, 'indentation jumps past a parent mapping');
    }
    while (parents.length > level) parents.pop();
    const keys = [...parents, key];
    const dottedPath = keys.join('.');
    if (seenPaths.has(dottedPath)) {
      throw yamlSyntaxError(lineNumber, `duplicate key ${dottedPath}`);
    }
    seenPaths.add(dottedPath);

    if (rawValue.trim() === '') {
      parents.push(key);
    } else {
      values.set(dottedPath, parseYamlScalar(rawValue, lineNumber));
    }
  }

  return values;
}

function extractFrontmatter(source) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(source);
  return match ? match[1] : null;
}

async function collectFiles(root) {
  const files = [];

  async function visit(directory) {
    let entries;
    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
      const target = path.join(directory, entry.name);
      if (entry.isDirectory()) await visit(target);
      else if (entry.isFile()) files.push(target);
    }
  }

  await visit(root);
  return files;
}

async function existsWithType(target, expectedType) {
  try {
    const details = await stat(target);
    if (expectedType === 'directory') return details.isDirectory();
    if (expectedType === 'file') return details.isFile();
    return true;
  } catch {
    return false;
  }
}

function markdownDestinations(source) {
  const results = [];
  const patterns = [
    /!?\[[^\]\n]*\]\(\s*(<[^>\n]+>|[^)\n]+)\s*\)/g,
    /^\s{0,3}\[[^\]\n]+\]:\s*(<[^>\n]+>|\S+)/gm,
  ];

  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      let destination = match[1].trim();
      if (destination.startsWith('<') && destination.endsWith('>')) {
        destination = destination.slice(1, -1);
      } else {
        destination = destination.split(/\s+(?=["'])/, 1)[0];
      }
      results.push({ destination, index: match.index ?? 0 });
    }
  }
  return results;
}

function relativeLinkPath(destination) {
  if (!destination || destination.startsWith('#') || destination.startsWith('?')) return null;
  if (destination.startsWith('/') || destination.startsWith('//')) return null;
  if (/^[A-Za-z][A-Za-z0-9+.-]*:/.test(destination)) return null;

  const withoutFragment = destination.split('#', 1)[0].split('?', 1)[0];
  if (!withoutFragment) return null;
  try {
    return decodeURIComponent(withoutFragment.replaceAll('\\', '/'));
  } catch {
    return withoutFragment.replaceAll('\\', '/');
  }
}

function manifestValue(manifest, dottedPath) {
  return dottedPath.split('.').reduce((value, key) => (
    value && typeof value === 'object' ? value[key] : undefined
  ), manifest);
}

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

export async function validateSkillPack(pluginRoot = DEFAULT_PLUGIN_ROOT) {
  const resolvedRoot = path.resolve(pluginRoot);
  const errors = [];
  const seenErrors = new Set();
  let skillCount = 0;

  function addError(code, target, message, line) {
    const relative = isInside(resolvedRoot, target)
      ? portablePath(path.relative(resolvedRoot, target)) || '.'
      : portablePath(target);
    const key = `${code}\0${relative}\0${line ?? ''}\0${message}`;
    if (seenErrors.has(key)) return;
    seenErrors.add(key);
    errors.push({ code, path: relative, ...(line ? { line } : {}), message });
  }

  if (!(await existsWithType(resolvedRoot, 'directory'))) {
    addError('plugin-root-missing', resolvedRoot, 'plugin root is not a directory');
    return {
      version: 1,
      pluginRoot: resolvedRoot,
      passed: false,
      skillCount,
      errors,
    };
  }

  const manifestFile = path.join(resolvedRoot, '.codex-plugin', 'plugin.json');
  let manifest = null;
  if (!(await existsWithType(manifestFile, 'file'))) {
    addError('manifest-missing', manifestFile, 'missing .codex-plugin/plugin.json');
  } else {
    try {
      const parsed = JSON.parse(await readFile(manifestFile, 'utf8'));
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        addError('manifest-shape', manifestFile, 'plugin.json must contain a JSON object');
      } else {
        manifest = parsed;
      }
    } catch (error) {
      addError('manifest-json', manifestFile, `plugin.json is not valid JSON: ${error.message}`);
    }
  }

  if (manifest) {
    const requiredStrings = [
      'name',
      'version',
      'description',
      'author.name',
      'interface.displayName',
      'interface.shortDescription',
      'interface.longDescription',
      'interface.developerName',
      'interface.category',
    ];
    for (const field of requiredStrings) {
      if (!nonEmptyString(manifestValue(manifest, field))) {
        addError('manifest-required-field', manifestFile, `field ${field} must be a non-empty string`);
      }
    }
    if (nonEmptyString(manifest.name) && !SKILL_NAME_PATTERN.test(manifest.name)) {
      addError('manifest-name', manifestFile, 'field name must use kebab-case');
    }
    if (nonEmptyString(manifest.version) && !SEMVER_PATTERN.test(manifest.version)) {
      addError('manifest-version', manifestFile, 'field version must use strict semantic versioning');
    }
    const capabilities = manifestValue(manifest, 'interface.capabilities');
    if (!Array.isArray(capabilities) || !capabilities.every(nonEmptyString)) {
      addError('manifest-required-field', manifestFile, 'field interface.capabilities must be an array of strings');
    }
    const defaultPrompt = manifestValue(manifest, 'interface.defaultPrompt')
      ?? manifestValue(manifest, 'interface.default_prompt');
    const validDefaultPrompt = nonEmptyString(defaultPrompt)
      || (Array.isArray(defaultPrompt)
        && defaultPrompt.length > 0
        && defaultPrompt.length <= 3
        && defaultPrompt.every((entry) => nonEmptyString(entry) && entry.length <= 128));
    if (!validDefaultPrompt) {
      addError(
        'manifest-required-field',
        manifestFile,
        'field interface.defaultPrompt must be a non-empty string or 1-3 strings up to 128 characters',
      );
    }
  }

  const rootRealPath = await realpath(resolvedRoot);
  async function validateManifestPath(field, rawPath, expectedType = 'file') {
    if (!nonEmptyString(rawPath)) {
      addError('manifest-path', manifestFile, `field ${field} must be a non-empty relative path`);
      return null;
    }
    const normalized = rawPath.replaceAll('\\', '/');
    const parts = normalized.split('/');
    if (!normalized.startsWith('./')
      || path.posix.isAbsolute(normalized)
      || path.win32.isAbsolute(rawPath)
      || parts.includes('..')) {
      addError('manifest-path', manifestFile, `field ${field} must start with ./ and stay inside the plugin`);
      return null;
    }
    const target = path.resolve(resolvedRoot, normalized);
    if (!isInside(resolvedRoot, target)) {
      addError('manifest-path', manifestFile, `field ${field} escapes the plugin root`);
      return null;
    }
    if (!(await existsWithType(target, expectedType))) {
      addError('manifest-path-missing', manifestFile, `field ${field} points to a missing ${expectedType}`);
      return null;
    }
    const targetRealPath = await realpath(target);
    if (!isInside(rootRealPath, targetRealPath)) {
      addError('manifest-path', manifestFile, `field ${field} resolves outside the plugin root`);
      return null;
    }
    return target;
  }

  let skillsRoot = path.join(resolvedRoot, 'skills');
  if (manifest) {
    if (!Object.hasOwn(manifest, 'skills')) {
      addError('manifest-required-field', manifestFile, 'field skills is required');
    } else {
      skillsRoot = await validateManifestPath('skills', manifest.skills, 'directory') ?? skillsRoot;
    }
    if (Object.hasOwn(manifest, 'apps')) {
      await validateManifestPath('apps', manifest.apps, 'file');
    }
    if (typeof manifest.mcpServers === 'string') {
      await validateManifestPath('mcpServers', manifest.mcpServers, 'file');
    }
    for (const field of ['composerIcon', 'logo', 'logoDark']) {
      const value = manifestValue(manifest, `interface.${field}`);
      if (value !== undefined) await validateManifestPath(`interface.${field}`, value, 'file');
    }
    const screenshots = manifestValue(manifest, 'interface.screenshots');
    if (screenshots !== undefined) {
      if (!Array.isArray(screenshots)) {
        addError('manifest-path', manifestFile, 'field interface.screenshots must be an array');
      } else {
        for (const [index, screenshot] of screenshots.entries()) {
          await validateManifestPath(`interface.screenshots[${index}]`, screenshot, 'file');
        }
      }
    }
  }

  const claudeManifestFile = path.join(resolvedRoot, '.claude-plugin', 'plugin.json');
  let claudeManifest = null;
  if (!(await existsWithType(claudeManifestFile, 'file'))) {
    addError('claude-manifest-missing', claudeManifestFile, 'missing .claude-plugin/plugin.json');
  } else {
    try {
      const parsed = JSON.parse(await readFile(claudeManifestFile, 'utf8'));
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        addError('claude-manifest-shape', claudeManifestFile, 'plugin.json must contain a JSON object');
      } else {
        claudeManifest = parsed;
      }
    } catch (error) {
      addError('claude-manifest-json', claudeManifestFile, `plugin.json is not valid JSON: ${error.message}`);
    }
  }

  if (claudeManifest) {
    for (const field of ['name', 'version', 'description', 'author.name']) {
      if (!nonEmptyString(manifestValue(claudeManifest, field))) {
        addError('claude-manifest-required-field', claudeManifestFile, `field ${field} must be a non-empty string`);
      }
    }
    if (nonEmptyString(claudeManifest.name) && !SKILL_NAME_PATTERN.test(claudeManifest.name)) {
      addError('claude-manifest-name', claudeManifestFile, 'field name must use kebab-case');
    }
    if (nonEmptyString(claudeManifest.version) && !SEMVER_PATTERN.test(claudeManifest.version)) {
      addError('claude-manifest-version', claudeManifestFile, 'field version must use strict semantic versioning');
    }
    if (manifest && nonEmptyString(claudeManifest.name) && nonEmptyString(manifest.name)
      && claudeManifest.name !== manifest.name) {
      addError('claude-manifest-name-mismatch', claudeManifestFile, 'field name must match the .codex-plugin/plugin.json name');
    }
    if (manifest && nonEmptyString(claudeManifest.version) && nonEmptyString(manifest.version)
      && claudeManifest.version !== manifest.version) {
      addError('claude-manifest-version-mismatch', claudeManifestFile, 'field version must match the .codex-plugin/plugin.json version');
    }
    // Claude Code scans ./skills at the plugin root by default, and that
    // default layout is the only one this validator checks per skill. Fail
    // closed on extra declared directories instead of pretending their
    // skills were validated.
    if (Object.hasOwn(claudeManifest, 'skills')) {
      addError(
        'claude-manifest-skills-unsupported',
        claudeManifestFile,
        'field skills is not validated here; keep skills in the default ./skills directory or extend the validator',
      );
    }
  }

  let skillEntries = [];
  try {
    skillEntries = (await readdir(skillsRoot, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
      .sort((left, right) => left.name.localeCompare(right.name));
  } catch {
    addError('skills-missing', skillsRoot, 'skills directory is missing or unreadable');
  }
  skillCount = skillEntries.length;
  if (skillCount === 0) addError('skills-empty', skillsRoot, 'plugin must contain at least one skill');

  for (const entry of skillEntries) {
    const skillRoot = path.join(skillsRoot, entry.name);
    const skillFile = path.join(skillRoot, 'SKILL.md');
    if (!(await existsWithType(skillFile, 'file'))) {
      addError('skill-file-missing', skillFile, 'skill is missing SKILL.md');
      continue;
    }

    const skillSource = await readFile(skillFile, 'utf8');
    const frontmatterSource = extractFrontmatter(skillSource);
    if (frontmatterSource === null) {
      addError('skill-frontmatter', skillFile, 'SKILL.md must start with closed YAML frontmatter');
    } else {
      try {
        const frontmatter = parseYamlScalars(frontmatterSource);
        const skillName = frontmatter.get('name');
        const description = frontmatter.get('description');
        if (!nonEmptyString(skillName)) {
          addError('skill-name', skillFile, 'frontmatter name must be a non-empty string');
        } else if (!SKILL_NAME_PATTERN.test(skillName)) {
          addError('skill-name', skillFile, 'frontmatter name must use kebab-case');
        } else if (skillName !== entry.name) {
          addError('skill-name-mismatch', skillFile, `frontmatter name must match directory ${entry.name}`);
        }
        if (!nonEmptyString(description)) {
          addError('skill-description', skillFile, 'frontmatter description must be a non-empty string');
        }
      } catch (error) {
        addError(
          'skill-frontmatter-yaml',
          skillFile,
          `frontmatter is outside the supported YAML subset: ${error.message}`,
          error.line,
        );
      }
    }

    const agentFile = path.join(skillRoot, 'agents', 'openai.yaml');
    if (!(await existsWithType(agentFile, 'file'))) {
      addError('agent-file-missing', agentFile, 'skill is missing agents/openai.yaml');
      continue;
    }
    let agentMetadata;
    try {
      agentMetadata = parseYamlScalars(await readFile(agentFile, 'utf8'));
    } catch (error) {
      addError(
        'agent-yaml',
        agentFile,
        `agents/openai.yaml is outside the supported YAML subset: ${error.message}`,
        error.line,
      );
      continue;
    }
    const requiredAgentFields = [
      'interface.display_name',
      'interface.short_description',
      'interface.default_prompt',
    ];
    for (const field of requiredAgentFields) {
      if (!nonEmptyString(agentMetadata.get(field))) {
        addError('agent-required-field', agentFile, `${field} must be a non-empty string`);
      }
    }
    const shortDescription = agentMetadata.get('interface.short_description');
    if (nonEmptyString(shortDescription) && (shortDescription.length < 25 || shortDescription.length > 64)) {
      addError('agent-short-description', agentFile, 'interface.short_description must contain 25-64 characters');
    }
    const defaultPrompt = agentMetadata.get('interface.default_prompt');
    if (nonEmptyString(defaultPrompt) && !defaultPrompt.includes(`$${entry.name}`)) {
      addError(
        'agent-default-prompt',
        agentFile,
        `interface.default_prompt must contain the literal $${entry.name}`,
      );
    }
  }

  for (const file of await collectFiles(resolvedRoot)) {
    if (!TEXT_EXTENSIONS.has(path.extname(file).toLowerCase())) continue;
    const source = await readFile(file, 'utf8');
    for (const match of source.matchAll(/\bTODO\b/gi)) {
      addError('todo-marker', file, 'remove the TODO marker', lineNumberAt(source, match.index ?? 0));
    }
    for (const match of source.matchAll(ABSOLUTE_USER_PATH_PATTERN)) {
      addError(
        'absolute-user-path',
        file,
        `replace the user-specific absolute path ${match[0]} with a portable path`,
        lineNumberAt(source, match.index ?? 0),
      );
    }
    if (path.extname(file).toLowerCase() !== '.md') continue;

    for (const { destination, index } of markdownDestinations(source)) {
      const relativeTarget = relativeLinkPath(destination);
      if (!relativeTarget) continue;
      const target = path.resolve(path.dirname(file), relativeTarget);
      if (!isInside(resolvedRoot, target)) {
        addError(
          'relative-link-outside-pack',
          file,
          `relative link ${destination} leaves the plugin root`,
          lineNumberAt(source, index),
        );
      } else if (!(await existsWithType(target))) {
        addError(
          'relative-link-missing',
          file,
          `relative link ${destination} points to a missing target`,
          lineNumberAt(source, index),
        );
      }
    }
  }

  errors.sort((left, right) => (
    left.path.localeCompare(right.path)
      || (left.line ?? 0) - (right.line ?? 0)
      || left.code.localeCompare(right.code)
      || left.message.localeCompare(right.message)
  ));
  return {
    version: 1,
    pluginRoot: resolvedRoot,
    passed: errors.length === 0,
    skillCount,
    errors,
  };
}

function helpText() {
  return [
    'Usage: node scripts/validate-skill-pack.mjs [plugin-path] [--json]',
    '',
    'Validate the Decant Codex and Claude Code plugin manifests and every bundled skill.',
    '',
    'Options:',
    '  --json  Print the machine-readable result.',
    '  --help  Show this help.',
  ].join('\n');
}

function parseArguments(argv) {
  const options = { json: false, help: false, pluginPath: null };
  for (const argument of argv) {
    if (argument === '--json') options.json = true;
    else if (argument === '--help' || argument === '-h') options.help = true;
    else if (argument.startsWith('-')) throw new Error(`Unknown option: ${argument}`);
    else if (options.pluginPath !== null) throw new Error('Accepts at most one plugin path');
    else options.pluginPath = argument;
  }
  return options;
}

export async function main(argv = process.argv.slice(2), io = {}) {
  const stdout = io.stdout ?? process.stdout;
  const stderr = io.stderr ?? process.stderr;
  const cwd = io.cwd ?? process.cwd();
  let options;
  try {
    options = parseArguments(argv);
  } catch (error) {
    stderr.write(`skill pack validation: ${error.message}\n`);
    return 2;
  }

  if (options.help) {
    stdout.write(`${helpText()}\n`);
    return 0;
  }

  const pluginRoot = options.pluginPath
    ? path.resolve(cwd, options.pluginPath)
    : DEFAULT_PLUGIN_ROOT;
  const result = await validateSkillPack(pluginRoot);
  if (options.json) {
    stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } else if (result.passed) {
    stdout.write(`skill pack validation: pass (${result.skillCount} skills)\n`);
  } else {
    stderr.write(`skill pack validation: fail (${result.errors.length} errors)\n`);
    for (const error of result.errors) {
      const location = `${error.path}${error.line ? `:${error.line}` : ''}`;
      stderr.write(`- [${error.code}] ${location}: ${error.message}\n`);
    }
  }
  return result.passed ? 0 : 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === SCRIPT_FILE) {
  process.exitCode = await main();
}
