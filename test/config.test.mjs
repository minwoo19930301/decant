import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  DEFAULT_CONFIG,
  expandEnvironment,
  loadConfig,
  validateConfig,
} from "../src/config.mjs";

function loadInline(value, options = {}) {
  return loadConfig({
    filePath: "inline.json",
    allowMissing: false,
    readFileImpl: async () => JSON.stringify(value),
    ...options,
  });
}

test("loadConfig returns a mutable copy of defaults when the file is absent", async () => {
  const config = await loadConfig({ cwd: "/definitely/missing/decant" });
  assert.deepEqual(config, DEFAULT_CONFIG);
  config.catalog.overrides.frontier = "changed";
  assert.deepEqual(DEFAULT_CONFIG.catalog.overrides, {});
});

test("loadConfig deep-merges validated JSON and expands environment variables", async () => {
  const config = await loadInline({
    version: 1,
    catalog: {
      overrides: { frontier: { model: "${FRONTIER_MODEL}", effort: "max" } },
    },
    verification: {
      commands: [{ command: "${PACKAGE_RUNNER:-npm}", args: ["test", "--", "${SUITE}"] }],
    },
    readerGate: { minPass: 4 },
  }, { env: { FRONTIER_MODEL: "gpt-frontier", SUITE: "unit" } });

  assert.deepEqual(config.catalog.overrides.frontier, { model: "gpt-frontier", effort: "max" });
  assert.deepEqual(config.verification.commands, [{ command: "npm", args: ["test", "--", "unit"] }]);
  assert.equal(config.readerGate.minPass, 4);
  assert.equal(config.readerGate.maxRounds, 2);
});

test("expandEnvironment is recursive, supports fallback and escaped dollars", () => {
  const value = expandEnvironment({
    url: "${HOST}:${PORT:-8080}",
    literal: "$${UNCHANGED}",
    list: ["${NAME}"],
  }, { env: { HOST: "localhost", NAME: "relay" } });

  assert.deepEqual(value, {
    url: "localhost:8080",
    literal: "${UNCHANGED}",
    list: ["relay"],
  });
});

test("loadConfig accepts $schema and the checked-in example matches defaults", async () => {
  const examplePath = fileURLToPath(new URL("../examples/decant.config.json", import.meta.url));
  const config = await loadConfig({ filePath: examplePath, allowMissing: false });
  const { $schema, ...example } = config;

  assert.equal($schema, "../schema/config.schema.json");
  assert.deepEqual(example, DEFAULT_CONFIG);
});

test("schema exposes the same secure catalog and verification surfaces", async () => {
  const schemaPath = fileURLToPath(new URL("../schema/config.schema.json", import.meta.url));
  const schema = JSON.parse(await readFile(schemaPath, "utf8"));
  const catalogKeys = Object.keys(schema.properties.catalog.properties);
  const commandSchema = schema.$defs.verificationCommand;

  assert.deepEqual(catalogKeys, ["overrides"]);
  assert.equal(schema.properties.$schema.type, "string");
  assert.equal(commandSchema.type, "object");
  assert.deepEqual(commandSchema.required, ["command"]);
  assert.equal(commandSchema.additionalProperties, false);
});

test("loadConfig reports invalid JSON and missing environment variables", async () => {
  await assert.rejects(
    loadConfig({
      filePath: "broken.json",
      allowMissing: false,
      readFileImpl: async () => "{not-json}",
    }),
    /Invalid JSON/,
  );
  await assert.rejects(
    loadConfig({
      readFileImpl: async () => '{"version":1,"catalog":{"overrides":{"frontier":"${MISSING}"}}}',
    }),
    /Missing environment variable: MISSING/,
  );
});

test("validator rejects missing or unsupported versions and unknown root keys", async () => {
  await assert.rejects(loadInline({}), /version: is required/);
  await assert.rejects(loadInline({ version: 2 }), /version: must equal 1/);
  await assert.rejects(
    loadInline({ version: 1, unexpected: true }),
    /root: unknown key: unexpected/,
  );
  await assert.rejects(
    loadInline(JSON.parse('{"version":1,"__proto__":{"polluted":true}}')),
    /root: unknown key: __proto__/,
  );
});

test("project config cannot override the catalog executable or arguments", async () => {
  await assert.rejects(
    loadInline({ version: 1, catalog: { command: "curl", overrides: {} } }),
    /catalog: unknown key: command/,
  );
  await assert.rejects(
    loadInline({ version: 1, catalog: { args: ["debug", "models"], overrides: {} } }),
    /catalog: unknown key: args/,
  );
});

test("validator enforces catalog role names and override structure", async () => {
  await assert.rejects(
    loadInline({ version: 1, catalog: { overrides: { admin: "gpt" } } }),
    /catalog\.overrides: unknown key: admin/,
  );
  await assert.rejects(
    loadInline({ version: 1, catalog: { overrides: { frontier: {} } } }),
    /catalog\.overrides\.frontier: model is required/,
  );
  await assert.rejects(
    loadInline({ version: 1, catalog: { overrides: { balanced: { model: "gpt", slug: "other" } } } }),
    /catalog\.overrides\.balanced: unknown key: slug/,
  );
  await assert.rejects(
    loadInline({ version: 1, catalog: { overrides: { economy: { model: "gpt", effort: "tiny" } } } }),
    /catalog\.overrides\.economy\.effort: must be one of/,
  );
});

test("validator enforces routing ranges and threshold ordering", async () => {
  await assert.rejects(
    loadInline({ version: 1, routing: { balancedThreshold: -1 } }),
    /routing\.balancedThreshold: must be between 0 and 29/,
  );
  await assert.rejects(
    loadInline({ version: 1, routing: { frontierThreshold: 31 } }),
    /routing\.frontierThreshold: must be between 1 and 30/,
  );
  await assert.rejects(
    loadInline({ version: 1, routing: { balancedThreshold: 15, frontierThreshold: 15 } }),
    /balancedThreshold must be lower than frontierThreshold/,
  );
  for (const advisorMode of ["conditional", "always", "never"]) {
    const config = await loadInline({ version: 1, routing: { advisorMode } });
    assert.equal(config.routing.advisorMode, advisorMode);
  }
  await assert.rejects(
    loadInline({ version: 1, routing: { advisorMode: "automatic" } }),
    /routing\.advisorMode: must be one of/,
  );
});

test("validator enforces stage effort keys and values", async () => {
  await assert.rejects(
    loadInline({ version: 1, effort: { planner: "max" } }),
    /effort: unknown key: planner/,
  );
  await assert.rejects(
    loadInline({ version: 1, effort: { maker: "minimal" } }),
    /effort\.maker: must be one of/,
  );
});

test("verification commands require structured executable and argument arrays", async () => {
  await assert.rejects(
    loadInline({ version: 1, verification: { commands: ["npm test"] } }),
    /verification\.commands\[0\]: must be an object/,
  );
  await assert.rejects(
    loadInline({ version: 1, verification: { commands: [{ command: "npm", args: "test" }] } }),
    /verification\.commands\[0\]\.args: must be an array/,
  );
  await assert.rejects(
    loadInline({ version: 1, verification: { commands: [{ command: "npm", shell: true }] } }),
    /verification\.commands\[0\]: unknown key: shell/,
  );
  await assert.rejects(
    loadInline({ version: 1, verification: { commands: [{ command: "npm\0evil" }] } }),
    /must not contain NUL bytes/,
  );
});

test("reader gate ranges, uniqueness, mode, and model-call budget are coherent", async () => {
  await assert.rejects(
    loadInline({ version: 1, readerGate: { minPass: 0 } }),
    /readerGate\.minPass: must be between 1 and 10/,
  );
  await assert.rejects(
    loadInline({ version: 1, readerGate: { maxRounds: 4 } }),
    /readerGate\.maxRounds: must be between 1 and 3/,
  );
  await assert.rejects(
    loadInline({ version: 1, readerGate: { concurrency: 11 } }),
    /readerGate\.concurrency: must be between 1 and 10/,
  );
  await assert.rejects(
    loadInline({ version: 1, readerGate: { mode: "live", models: ["tiny", "tiny"] } }),
    /readerGate\.models: contains duplicate model: tiny/,
  );
  await assert.rejects(
    loadInline({ version: 1, readerGate: { mode: "deterministic", models: ["tiny"] } }),
    /must be empty when readerGate\.mode is deterministic/,
  );
  await assert.rejects(
    loadInline({
      version: 1,
      readerGate: { mode: "live", maxRounds: 3 },
      limits: { maxModelCalls: 36 },
    }),
    /must be at least 37 for 3 live reader rounds/,
  );

  const live = await loadInline({
    version: 1,
    readerGate: { mode: "live", maxRounds: 3, models: ["tiny-a", "tiny-b"] },
    limits: { maxModelCalls: 37 },
  });
  assert.equal(live.readerGate.mode, "live");
  assert.equal(live.limits.maxModelCalls, 37);

  const liveWithoutAdvisor = await loadInline({
    version: 1,
    routing: { advisorMode: "never" },
    readerGate: { mode: "live", maxRounds: 3 },
    limits: { maxModelCalls: 36 },
  });
  assert.equal(liveWithoutAdvisor.limits.maxModelCalls, 36);
});

test("limits are bounded integers and reject unknown knobs", async () => {
  assert.equal((await loadInline({ version: 1, limits: { maxModelCalls: 1 } })).limits.maxModelCalls, 1);
  await assert.rejects(
    loadInline({ version: 1, limits: { maxModelCalls: 0 } }),
    /limits\.maxModelCalls: must be between 1 and 100/,
  );
  await assert.rejects(
    loadInline({ version: 1, limits: { stageTimeoutMs: 3_600_001 } }),
    /limits\.stageTimeoutMs: must be between 1000 and 3600000/,
  );
  await assert.rejects(
    loadInline({ version: 1, limits: { commandTimeoutMs: 1.5, retries: 2 } }),
    /limits: unknown key: retries/,
  );
});

test("validateConfig returns a valid config without mutating it", () => {
  const input = structuredClone(DEFAULT_CONFIG);
  assert.equal(validateConfig(input), input);
  assert.deepEqual(input, DEFAULT_CONFIG);
});
