import assert from "node:assert/strict";
import test from "node:test";

import { judgeTask } from "../src/jev.mjs";

const ENDPOINT = "https://api.typesafe.ai/v1/systemone";
const SECRET = "test-private-typesafe-key";
const env = { TYPESAFE_API_KEY: SECRET };

// Wire fixture follows https://docs.typesafe.ai/api and
// https://docs.typesafe.ai/primitives/noul. These are synthetic test answers,
// not a claim that an authenticated inference was performed.
function fixture() {
  return {
    model: "jev-1.13.0",
    answers: {
      route: {
        type: "choice",
        choice: "balanced",
        probabilities: { economy: 0.04, balanced: 0.94, frontier: 0.02 },
        confidence: 0.9,
      },
      risk: { type: "noul", noul: 0.1 },
      clarification: { type: "noul", noul: 0.2 },
    },
    usage: { input_tokens: 400, output_tokens: 70 },
  };
}

function response(body = fixture()) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function assertUnavailable(result, reasonCode, requestCount = 1) {
  assert.equal(result.provider, "jev");
  assert.equal(result.status, "unavailable");
  assert.equal(result.reasonCode, reasonCode);
  assert.equal(result.requestCount, requestCount);
  for (const key of ["role", "confidence", "risk", "clarificationProbability"]) {
    assert.equal(result[key], null, key);
  }
  assert.equal(Object.hasOwn(result, "usage"), false);
  assert.equal(JSON.stringify(result).includes(SECRET), false);
  assert.ok(Number.isInteger(result.latencyMs) && result.latencyMs >= 0);
}

test("Jev sends one official state/questions request and returns only typed advice", async () => {
  const task = "Fix the test failure in the CLI";
  const calls = [];
  const result = await judgeTask(task, {
    env: { ...env, TYPESAFE_BASE_URL: "https://untrusted.example", OTHER_SECRET: "unrelated" },
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return response();
    },
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, ENDPOINT);
  const { options } = calls[0];
  assert.equal(options.method, "POST");
  assert.equal(options.redirect, "error");
  assert.equal(options.headers.Authorization, `Bearer ${SECRET}`);
  assert.equal(options.headers["Content-Type"], "application/json");
  assert.ok(options.signal instanceof AbortSignal);
  const wire = JSON.parse(options.body);
  assert.deepEqual(Object.keys(wire).sort(), ["model", "questions", "state"]);
  assert.equal(wire.model, "jev-1.13.0");
  assert.equal(wire.state, task);
  assert.deepEqual(Object.keys(wire.questions).sort(), ["clarification", "risk", "route"]);
  assert.equal(wire.questions.route.type, "choice");
  assert.deepEqual(Object.keys(wire.questions.route.criteria).sort(), ["balanced", "economy", "frontier"]);
  for (const key of ["risk", "clarification"]) {
    assert.equal(wire.questions[key].type, "noul");
    assert.deepEqual(Object.keys(wire.questions[key].criteria).sort(), ["false", "true"]);
  }
  for (const question of Object.values(wire.questions)) {
    assert.equal(typeof question.instructions, "string");
    assert.ok(Object.values(question.criteria).every((value) => typeof value === "string"));
  }
  assert.equal(options.body.includes(SECRET), false);
  assert.equal(options.body.includes("unrelated"), false);
  assert.deepEqual({ ...result, latencyMs: 0 }, {
    provider: "jev", status: "ok", model: "jev-1.13.0", role: "balanced",
    confidence: 0.9, risk: 0.1, clarificationProbability: 0.2,
    usage: { input_tokens: 400, output_tokens: 70 },
    reasonCode: "accepted", latencyMs: 0, requestCount: 1,
  });
});

test("missing credentials and unsupported input do not make a request", async () => {
  let calls = 0;
  const fetchImpl = async () => { calls++; return response(); };
  for (const missingEnv of [{}, { TYPESAFE_API_KEY: "  " }, { OPENROUTER_API_KEY: SECRET }]) {
    assertUnavailable(await judgeTask("Fix a test", { env: missingEnv, fetchImpl }), "missing_api_key", 0);
  }
  for (const task of ["", "  ", null, {}, "a".repeat(64_001)]) {
    assertUnavailable(await judgeTask(task, { env, fetchImpl }), "invalid_task", 0);
  }
  for (const options of [
    { model: SECRET }, { timeoutMs: 0 }, { timeoutMs: Infinity }, { timeoutMs: 60_001 },
    { minConfidence: NaN }, { minConfidence: -0.1 }, { minConfidence: 1.1 },
  ]) {
    assertUnavailable(await judgeTask("Fix a test", { env, fetchImpl, ...options }), "invalid_config", 0);
  }
  assertUnavailable(await judgeTask("Fix a test", { env, fetchImpl: null }), "fetch_unavailable", 0);
  assert.equal(calls, 0);
});

test("low confidence preserves measurements but abstains from selecting a role", async () => {
  const body = fixture();
  body.answers.route.confidence = 0.79;
  const result = await judgeTask("Fix a test", { env, fetchImpl: async () => response(body) });
  assert.equal(result.status, "ok");
  assert.equal(result.role, null);
  assert.equal(result.confidence, 0.79);
  assert.equal(result.reasonCode, "low_confidence");
  const accepted = await judgeTask("Fix a test", {
    env, minConfidence: 0.79, model: "jev-latest",
    fetchImpl: async () => response(body),
  });
  assert.equal(accepted.role, "balanced");
  assert.equal(accepted.model, "jev-1.13.0");
});

test("HTTP failures return metadata without reading bodies or retrying", async () => {
  for (const status of [401, 422, 429, 500, 502, 503, 529]) {
    let calls = 0;
    const result = await judgeTask("Fix a test", {
      env,
      fetchImpl: async () => {
        calls++;
        return { status, json: () => { throw new Error(SECRET); } };
      },
    });
    assertUnavailable(result, "http_error");
    assert.equal(calls, 1);
  }
});

test("network and JSON failures never expose request headers or remote error text", async () => {
  const network = await judgeTask("Fix a test", {
    env, fetchImpl: async () => { throw new Error(`Authorization: Bearer ${SECRET}`); },
  });
  assertUnavailable(network, "network_error");
  const malformedJson = await judgeTask("Fix a test", {
    env, fetchImpl: async () => ({ status: 200, json: async () => { throw new SyntaxError(SECRET); } }),
  });
  assertUnavailable(malformedJson, "invalid_response");
});

test("the deadline bounds fetch and body consumption even when abort is ignored", async () => {
  for (const hangBody of [false, true]) {
    let signal;
    const result = await judgeTask("Fix a test", {
      env, timeoutMs: 15,
      fetchImpl: async (_url, options) => {
        signal = options.signal;
        if (hangBody) return { status: 200, json: () => new Promise(() => {}) };
        return new Promise(() => {});
      },
    });
    assertUnavailable(result, "timeout");
    assert.equal(signal.aborted, true);
    assert.ok(result.latencyMs < 1_000);
  }
});

test("redirects cannot cause a second credential-bearing request", async () => {
  for (const remote of [
    { status: 302 },
    { status: 200, redirected: true },
    { status: 200, url: "https://untrusted.example/v1/systemone" },
  ]) {
    let calls = 0;
    const result = await judgeTask("Fix a test", {
      env,
      fetchImpl: async (url, options) => {
        calls++;
        assert.equal(url, ENDPOINT);
        assert.equal(options.redirect, "error");
        return { ...remote, json: () => { throw new Error("Must not consume redirect body"); } };
      },
    });
    assertUnavailable(result, "redirect_rejected");
    assert.equal(calls, 1);
  }
});

test("malformed choices, distributions, Noul answers, and usage fail closed", async () => {
  const corruptions = [
    (body) => { body.model = SECRET; },
    (body) => { delete body.answers.risk; },
    (body) => { body.answers.route.type = "score"; },
    (body) => { body.answers.route.choice = "execute_shell"; },
    (body) => { body.answers.route.choice = "economy"; },
    (body) => { body.answers.route.confidence = 1.1; },
    (body) => { body.answers.route.confidence = "0.9"; },
    (body) => { delete body.answers.route.probabilities.economy; },
    (body) => { body.answers.route.probabilities.extra = 0; },
    (body) => { body.answers.route.probabilities.economy = -0.1; },
    (body) => { body.answers.route.probabilities.balanced = 0.2; },
    (body) => { body.answers.route.probabilities.frontier = Infinity; },
    (body) => { body.answers.route.probabilities = []; },
    (body) => { body.answers.risk.type = "choice"; },
    (body) => { body.answers.risk.noul = true; },
    (body) => { body.answers.risk.noul = NaN; },
    (body) => { body.answers.clarification.noul = 1.1; },
    (body) => { delete body.usage; },
    (body) => { body.usage.input_tokens = -1; },
    (body) => { body.usage.output_tokens = 1.5; },
  ];
  for (const corrupt of corruptions) {
    const body = fixture();
    corrupt(body);
    // A transport double keeps non-JSON values (NaN/Infinity) observable to
    // ensure runtime validation does not accidentally coerce them.
    const result = await judgeTask("Fix a test", {
      env, fetchImpl: async () => ({ status: 200, json: async () => body }),
    });
    assertUnavailable(result, "invalid_response");
  }
});

test("only allowlisted metadata reaches the judgment record", async () => {
  const body = fixture();
  body.debug = SECRET;
  body.usage.secret = SECRET;
  body.answers.route.explanation = SECRET;
  const result = await judgeTask("Fix a test", { env, fetchImpl: async () => response(body) });
  assert.equal(result.status, "ok");
  assert.equal(JSON.stringify(result).includes(SECRET), false);
  assert.deepEqual(Object.keys(result).sort(), [
    "clarificationProbability", "confidence", "latencyMs", "model", "provider",
    "reasonCode", "requestCount", "risk", "role", "status", "usage",
  ]);
  body.usage.input_tokens = 99;
  assert.equal(result.usage.input_tokens, 400);
});
