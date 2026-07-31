import { readFile } from "node:fs/promises";
import path from "node:path";

import { DEFAULT_PROVIDER, PROVIDER_IDS } from "./providers/index.mjs";

export const CONFIG_FILENAME = "decant.config.json";

export const DEFAULT_CONFIG = deepFreeze({
  version: 1,
  provider: DEFAULT_PROVIDER,
  catalog: {
    overrides: {},
  },
  routing: {
    balancedThreshold: 7,
    frontierThreshold: 15,
    advisorMode: "conditional",
  },
  effort: {
    scout: "low",
    architect: "max",
    maker: "medium",
    reviewer: "high",
    explainer: "low",
    reader: "low",
  },
  verification: {
    commands: [],
  },
  readerGate: {
    mode: "deterministic",
    models: [],
    minPass: 9,
    maxRounds: 2,
    concurrency: 3,
  },
  limits: {
    maxModelCalls: 30,
    stageTimeoutMs: 1_200_000,
    commandTimeoutMs: 300_000,
  },
});

const ROOT_KEYS = Object.freeze([
  "$schema",
  "version",
  "provider",
  "catalog",
  "routing",
  "effort",
  "verification",
  "readerGate",
  "limits",
]);
const MODEL_ROLES = Object.freeze(["frontier", "balanced", "economy"]);
const STAGE_IDS = Object.freeze([
  "scout",
  "architect",
  "maker",
  "reviewer",
  "explainer",
  "reader",
]);
const EFFORT_LEVELS = Object.freeze(["low", "medium", "high", "xhigh", "max", "ultra"]);
const READER_MODES = Object.freeze(["deterministic", "live"]);
const ADVISOR_MODES = Object.freeze(["conditional", "always", "never"]);
const MAX_ROUTING_SCORE = 30;
const MAX_VERIFICATION_COMMANDS = 64;
const MAX_COMMAND_ARGS = 256;
const MAX_TIMEOUT_MS = 3_600_000;

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function isPlainObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function configError(location, message, ErrorType = TypeError) {
  throw new ErrorType(`Invalid Decant config at ${location}: ${message}`);
}

function assertObject(value, location) {
  if (!isPlainObject(value)) configError(location, "must be an object");
}

function assertKnownKeys(value, allowed, location) {
  const allowedKeys = new Set(allowed);
  const unknown = Object.keys(value).filter((key) => !allowedKeys.has(key));
  if (unknown.length > 0) {
    configError(location, `unknown ${unknown.length === 1 ? "key" : "keys"}: ${unknown.join(", ")}`);
  }
}

function assertString(value, location, { maxLength, nonEmpty = true } = {}) {
  if (typeof value !== "string") configError(location, "must be a string");
  if (nonEmpty && value.trim().length === 0) configError(location, "must not be empty");
  if (maxLength !== undefined && value.length > maxLength) {
    configError(location, `must contain at most ${maxLength} characters`, RangeError);
  }
  if (value.includes("\0")) configError(location, "must not contain NUL bytes");
}

function assertInteger(value, location, minimum, maximum) {
  if (!Number.isInteger(value)) configError(location, "must be an integer");
  if (value < minimum || value > maximum) {
    configError(location, `must be between ${minimum} and ${maximum}`, RangeError);
  }
}

function assertEnum(value, allowed, location) {
  if (!allowed.includes(value)) {
    configError(location, `must be one of: ${allowed.join(", ")}`, RangeError);
  }
}

function validateCatalog(catalog) {
  assertObject(catalog, "catalog");
  assertKnownKeys(catalog, ["overrides"], "catalog");
  if (!Object.hasOwn(catalog, "overrides")) return;

  assertObject(catalog.overrides, "catalog.overrides");
  assertKnownKeys(catalog.overrides, MODEL_ROLES, "catalog.overrides");
  for (const [role, override] of Object.entries(catalog.overrides)) {
    const location = `catalog.overrides.${role}`;
    if (typeof override === "string") {
      assertString(override, location, { maxLength: 256 });
      continue;
    }
    assertObject(override, location);
    assertKnownKeys(override, ["model", "effort"], location);
    if (!Object.hasOwn(override, "model")) configError(location, "model is required");
    assertString(override.model, `${location}.model`, { maxLength: 256 });
    if (Object.hasOwn(override, "effort")) {
      assertEnum(override.effort, EFFORT_LEVELS, `${location}.effort`);
    }
  }
}

function validateRouting(routing) {
  assertObject(routing, "routing");
  assertKnownKeys(routing, ["balancedThreshold", "frontierThreshold", "advisorMode"], "routing");
  if (Object.hasOwn(routing, "balancedThreshold")) {
    assertInteger(routing.balancedThreshold, "routing.balancedThreshold", 0, MAX_ROUTING_SCORE - 1);
  }
  if (Object.hasOwn(routing, "frontierThreshold")) {
    assertInteger(routing.frontierThreshold, "routing.frontierThreshold", 1, MAX_ROUTING_SCORE);
  }
  if (Object.hasOwn(routing, "advisorMode")) {
    assertEnum(routing.advisorMode, ADVISOR_MODES, "routing.advisorMode");
  }
}

function validateEffort(effort) {
  assertObject(effort, "effort");
  assertKnownKeys(effort, STAGE_IDS, "effort");
  for (const [stage, value] of Object.entries(effort)) {
    assertEnum(value, EFFORT_LEVELS, `effort.${stage}`);
  }
}

function validateVerification(verification) {
  assertObject(verification, "verification");
  assertKnownKeys(verification, ["commands"], "verification");
  if (!Object.hasOwn(verification, "commands")) return;
  if (!Array.isArray(verification.commands)) {
    configError("verification.commands", "must be an array");
  }
  if (verification.commands.length > MAX_VERIFICATION_COMMANDS) {
    configError(
      "verification.commands",
      `must contain at most ${MAX_VERIFICATION_COMMANDS} entries`,
      RangeError,
    );
  }
  verification.commands.forEach((entry, index) => {
    const location = `verification.commands[${index}]`;
    assertObject(entry, location);
    assertKnownKeys(entry, ["command", "args"], location);
    if (!Object.hasOwn(entry, "command")) configError(location, "command is required");
    assertString(entry.command, `${location}.command`, { maxLength: 1_024 });
    if (!Object.hasOwn(entry, "args")) return;
    if (!Array.isArray(entry.args)) configError(`${location}.args`, "must be an array");
    if (entry.args.length > MAX_COMMAND_ARGS) {
      configError(`${location}.args`, `must contain at most ${MAX_COMMAND_ARGS} entries`, RangeError);
    }
    entry.args.forEach((argument, argumentIndex) => {
      assertString(argument, `${location}.args[${argumentIndex}]`, {
        maxLength: 8_192,
        nonEmpty: false,
      });
    });
  });
}

function validateReaderGate(readerGate) {
  assertObject(readerGate, "readerGate");
  assertKnownKeys(
    readerGate,
    ["mode", "models", "minPass", "maxRounds", "concurrency"],
    "readerGate",
  );
  if (Object.hasOwn(readerGate, "mode")) {
    assertEnum(readerGate.mode, READER_MODES, "readerGate.mode");
  }
  if (Object.hasOwn(readerGate, "models")) {
    if (!Array.isArray(readerGate.models)) configError("readerGate.models", "must be an array");
    if (readerGate.models.length > 10) {
      configError("readerGate.models", "must contain at most 10 entries", RangeError);
    }
    const seen = new Set();
    readerGate.models.forEach((model, index) => {
      assertString(model, `readerGate.models[${index}]`, { maxLength: 256 });
      if (seen.has(model)) configError("readerGate.models", `contains duplicate model: ${model}`);
      seen.add(model);
    });
  }
  if (Object.hasOwn(readerGate, "minPass")) {
    assertInteger(readerGate.minPass, "readerGate.minPass", 1, 10);
  }
  if (Object.hasOwn(readerGate, "maxRounds")) {
    assertInteger(readerGate.maxRounds, "readerGate.maxRounds", 1, 3);
  }
  if (Object.hasOwn(readerGate, "concurrency")) {
    assertInteger(readerGate.concurrency, "readerGate.concurrency", 1, 10);
  }
}

function validateLimits(limits) {
  assertObject(limits, "limits");
  assertKnownKeys(limits, ["maxModelCalls", "stageTimeoutMs", "commandTimeoutMs"], "limits");
  if (Object.hasOwn(limits, "maxModelCalls")) {
    assertInteger(limits.maxModelCalls, "limits.maxModelCalls", 1, 100);
  }
  if (Object.hasOwn(limits, "stageTimeoutMs")) {
    assertInteger(limits.stageTimeoutMs, "limits.stageTimeoutMs", 1_000, MAX_TIMEOUT_MS);
  }
  if (Object.hasOwn(limits, "commandTimeoutMs")) {
    assertInteger(limits.commandTimeoutMs, "limits.commandTimeoutMs", 1_000, MAX_TIMEOUT_MS);
  }
}

export function validateConfig(config) {
  assertObject(config, "root");
  assertKnownKeys(config, ROOT_KEYS, "root");
  if (Object.hasOwn(config, "$schema")) {
    assertString(config.$schema, "$schema", { maxLength: 2_048 });
  }
  if (!Object.hasOwn(config, "version")) configError("version", "is required");
  if (config.version !== 1) configError("version", "must equal 1", RangeError);
  if (Object.hasOwn(config, "provider")) {
    assertEnum(config.provider, PROVIDER_IDS, "provider");
  }

  if (Object.hasOwn(config, "catalog")) validateCatalog(config.catalog);
  if (Object.hasOwn(config, "routing")) validateRouting(config.routing);
  if (Object.hasOwn(config, "effort")) validateEffort(config.effort);
  if (Object.hasOwn(config, "verification")) validateVerification(config.verification);
  if (Object.hasOwn(config, "readerGate")) validateReaderGate(config.readerGate);
  if (Object.hasOwn(config, "limits")) validateLimits(config.limits);

  const balancedThreshold = config.routing?.balancedThreshold
    ?? DEFAULT_CONFIG.routing.balancedThreshold;
  const frontierThreshold = config.routing?.frontierThreshold
    ?? DEFAULT_CONFIG.routing.frontierThreshold;
  if (balancedThreshold >= frontierThreshold) {
    configError(
      "routing",
      "balancedThreshold must be lower than frontierThreshold",
      RangeError,
    );
  }

  const readerMode = config.readerGate?.mode ?? DEFAULT_CONFIG.readerGate.mode;
  const readerModels = config.readerGate?.models ?? DEFAULT_CONFIG.readerGate.models;
  if (readerMode === "deterministic" && readerModels.length > 0) {
    configError("readerGate.models", "must be empty when readerGate.mode is deterministic");
  }

  const maxModelCalls = config.limits?.maxModelCalls ?? DEFAULT_CONFIG.limits.maxModelCalls;
  const maxRounds = config.readerGate?.maxRounds ?? DEFAULT_CONFIG.readerGate.maxRounds;
  if (readerMode === "live") {
    const advisorMode = config.routing?.advisorMode ?? DEFAULT_CONFIG.routing.advisorMode;
    const baseCalls = advisorMode === "never" ? 4 : 5;
    const requiredCalls = baseCalls + (10 * maxRounds) + Math.max(0, maxRounds - 1);
    if (maxModelCalls < requiredCalls) {
      configError(
        "limits.maxModelCalls",
        `must be at least ${requiredCalls} for ${maxRounds} live reader rounds`,
        RangeError,
      );
    }
  }
  return config;
}

export function mergeConfig(base, override) {
  if (!isPlainObject(base) || !isPlainObject(override)) {
    return structuredClone(override);
  }

  const merged = structuredClone(base);
  for (const [key, value] of Object.entries(override)) {
    const nextValue = isPlainObject(value) && isPlainObject(merged[key])
      ? mergeConfig(merged[key], value)
      : structuredClone(value);
    Object.defineProperty(merged, key, {
      configurable: true,
      enumerable: true,
      writable: true,
      value: nextValue,
    });
  }
  return merged;
}

export function expandEnvironment(value, {
  env = process.env,
  strict = true,
} = {}) {
  if (typeof value === "string") return expandString(value, env, strict);
  if (Array.isArray(value)) {
    return value.map((item) => expandEnvironment(item, { env, strict }));
  }
  if (isPlainObject(value)) {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [
      key,
      expandEnvironment(item, { env, strict }),
    ]));
  }
  return value;
}

function expandString(input, env, strict) {
  const escaped = "\u0000rein-dollar\u0000";
  const protectedInput = input.replaceAll("$$", escaped);
  const expanded = protectedInput.replace(
    /\$\{([A-Za-z_][A-Za-z0-9_]*)(?::-([^}]*))?\}/g,
    (token, name, fallback) => {
      if (Object.hasOwn(env, name)) return String(env[name]);
      if (fallback !== undefined) return fallback;
      if (!strict) return token;
      throw new Error(`Missing environment variable: ${name}`);
    },
  );
  return expanded.replaceAll(escaped, "$");
}

export async function loadConfig({
  cwd = process.cwd(),
  filePath = CONFIG_FILENAME,
  env = process.env,
  strictEnv = true,
  allowMissing = true,
  readFileImpl = readFile,
} = {}) {
  const resolvedPath = path.resolve(cwd, filePath);
  let source;

  try {
    source = await readFileImpl(resolvedPath, "utf8");
  } catch (error) {
    if (allowMissing && error?.code === "ENOENT") {
      return validateConfig(structuredClone(DEFAULT_CONFIG));
    }
    throw error;
  }

  let parsed;
  try {
    parsed = JSON.parse(source);
  } catch (error) {
    throw new SyntaxError(`Invalid JSON in ${resolvedPath}: ${error.message}`, { cause: error });
  }

  if (!isPlainObject(parsed)) {
    throw new TypeError(`${resolvedPath} must contain a JSON object`);
  }

  const expanded = expandEnvironment(parsed, { env, strict: strictEnv });
  validateConfig(expanded);
  const config = mergeConfig(DEFAULT_CONFIG, expanded);
  return validateConfig(config);
}
