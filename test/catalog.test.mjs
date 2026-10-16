import assert from "node:assert/strict";
import test from "node:test";

import {
  buildCatalog,
  discoverCatalog,
  parseModelCatalog,
  snapEffort,
} from "../src/catalog.mjs";

const FIXTURE = {
  models: [
    {
      slug: "gpt-sol",
      display_name: "Sol",
      description: "Latest frontier agentic coding model.",
      visibility: "list",
      priority: 1,
      default_reasoning_level: "low",
      supported_reasoning_levels: ["low", "medium", "high", "xhigh", "max"].map((effort) => ({ effort })),
    },
    {
      slug: "gpt-terra",
      display_name: "Terra",
      description: "Balanced model for everyday work.",
      visibility: "list",
      priority: 2,
      supported_reasoning_levels: [{ effort: "low" }, { effort: "medium" }, { effort: "high" }],
    },
    {
      slug: "gpt-luna-mini",
      display_name: "Luna",
      description: "Fast affordable cost-efficient model.",
      visibility: "list",
      priority: 3,
      supported_reasoning_levels: [{ effort: "low" }, { effort: "medium" }],
    },
    {
      slug: "internal-review",
      description: "Hidden reviewer.",
      visibility: "hide",
      priority: 0,
      supported_reasoning_levels: [{ effort: "high" }],
    },
  ],
};

test("parseModelCatalog normalizes Codex JSON and sorts by priority", () => {
  const models = parseModelCatalog(JSON.stringify(FIXTURE));
  assert.deepEqual(models.map((model) => model.id), [
    "internal-review",
    "gpt-sol",
    "gpt-terra",
    "gpt-luna-mini",
  ]);
  assert.equal(models[0].visible, false);
  assert.deepEqual(models[1].supportedEfforts, ["low", "medium", "high", "xhigh", "max"]);
});

test("buildCatalog maps visible models to frontier, balanced, and economy", () => {
  const catalog = buildCatalog(FIXTURE);
  assert.deepEqual(catalog.models.map((model) => model.id), ["gpt-sol", "gpt-terra", "gpt-luna-mini"]);
  assert.equal(catalog.roles.frontier.model, "gpt-sol");
  assert.equal(catalog.roles.frontier.effort, "max");
  assert.equal(catalog.roles.balanced.model, "gpt-terra");
  assert.equal(catalog.roles.balanced.effort, "medium");
  assert.equal(catalog.roles.economy.model, "gpt-luna-mini");
  assert.equal(catalog.roles.economy.effort, "low");
});

test("explicit role overrides win and validate supported effort", () => {
  const catalog = buildCatalog(FIXTURE, {
    overrides: { balanced: { model: "gpt-sol", effort: "xhigh" } },
  });
  assert.equal(catalog.roles.balanced.model, "gpt-sol");
  assert.equal(catalog.roles.balanced.effort, "xhigh");
  assert.equal(catalog.roles.balanced.source, "override");

  assert.throws(() => buildCatalog(FIXTURE, {
    overrides: { economy: { model: "gpt-luna-mini", effort: "max" } },
  }), /does not support reasoning effort max/);
});

test("snapEffort keeps advertised levels and lowers max to the Grok 4.7 ceiling", () => {
  const menu = ["low", "medium", "high", "xhigh"];
  assert.equal(snapEffort("low", menu), "low");
  assert.equal(snapEffort("medium", menu), "medium");
  assert.equal(snapEffort("high", menu), "high");
  assert.equal(snapEffort("xhigh", menu), "xhigh");
  assert.equal(snapEffort("max", menu), "xhigh");
  assert.equal(snapEffort("ultra", menu), "xhigh");
  assert.equal(snapEffort("max", []), "max");
  assert.throws(() => snapEffort("deep", menu), /unknown effort level: deep/);
});

test("discoverCatalog injects execution and passes the configured invocation", async () => {
  const calls = [];
  const catalog = await discoverCatalog({
    command: "/custom/codex",
    args: ["debug", "models", "--bundled"],
    execute: async (...args) => {
      calls.push(args);
      return { stdout: JSON.stringify(FIXTURE) };
    },
  });

  assert.deepEqual(calls, [["/custom/codex", ["debug", "models", "--bundled"]]]);
  assert.equal(catalog.roles.frontier.model, "gpt-sol");
});

