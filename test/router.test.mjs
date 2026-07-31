import assert from "node:assert/strict";
import test from "node:test";

import { assessTask, routeTask } from "../src/router.mjs";

test("simple read-only work stays economy and disables mutation stages", () => {
  const route = routeTask("Read package.json and summarize the scripts.");
  assert.equal(route.assessment.role, "economy");
  assert.equal(route.assessment.readOnly, true);
  assert.equal(route.byId.scout.modelRole, "economy");
  assert.equal(route.byId.architect.modelRole, "frontier");
  assert.equal(route.byId.architect.effort, "max");
  assert.equal(route.byId.architect.activation, "conditional");
  assert.equal(route.byId.architect.checkpoint, "after-scout");
  assert.equal(route.byId.maker.enabled, false);
  assert.equal(route.byId.reviewer.enabled, true);
});

test("security, deployment, and deletion language deterministically escalates risk", () => {
  const security = assessTask("Implement OAuth credential rotation and permission checks.");
  assert.equal(security.risk, 2);
  assert.equal(security.role, "balanced");

  const deploy = assessTask("Deploy the database schema migration to production.");
  assert.equal(deploy.risk, 3);
  assert.equal(deploy.blastRadius, 2);
  assert.equal(deploy.reversibility, 1);
  assert.equal(deploy.role, "frontier");

  const deletion = assessTask("운영 데이터베이스의 모든 사용자 데이터를 삭제해줘.");
  assert.equal(deletion.risk, 3);
  assert.equal(deletion.blastRadius, 3);
  assert.equal(deletion.reversibility, 0);
  assert.equal(deletion.role, "frontier");
});

test("explicit dimensions override heuristics and are validated", () => {
  const assessment = assessTask("Delete production data", {
    dimensions: {
      complexity: 0,
      risk: 0,
      blastRadius: 0,
      verifiability: 3,
      reversibility: 3,
    },
  });
  assert.equal(assessment.score, 0);
  assert.equal(assessment.role, "economy");
  assert.throws(() => assessTask("Task", { risk: 4 }), /risk must be an integer from 0 to 3/);
});

test("routeTask emits all six stage contracts and a 10-reader clarity jury", () => {
  const route = routeTask("Refactor authentication across multiple services and add tests.");
  assert.deepEqual(route.stages.map((stage) => stage.id), [
    "scout",
    "architect",
    "maker",
    "reviewer",
    "explainer",
    "reader",
  ]);
  assert.equal(route.byId.maker.modelRole, "balanced");
  assert.equal(route.byId.reviewer.modelRole, "frontier");
  assert.equal(route.byId.reader.modelRole, "economy");
  assert.equal(route.byId.reader.fanout, 10);
  assert.equal(route.byId.reader.quorum, 9);
  assert.equal(route.byId.reader.maxRounds, 2);
});

test("conditional advisor mode invokes upfront only for non-economy work", () => {
  const easy = routeTask("Implement a small helper and add a test.");
  assert.equal(easy.assessment.role, "economy");
  assert.equal(easy.byId.architect.activation, "conditional");
  assert.equal(easy.byId.architect.decision, "pending");

  const hard = routeTask("Deploy a database schema migration to production.");
  assert.equal(hard.assessment.role, "frontier");
  assert.equal(hard.byId.architect.activation, "always");
  assert.equal(hard.byId.architect.decision, "invoke");
});

test("advisor mode can restore always-on routing or disable the advisor", () => {
  const always = routeTask("Implement a small helper.", { advisorMode: "always" });
  assert.equal(always.byId.architect.enabled, true);
  assert.equal(always.byId.architect.activation, "always");

  const never = routeTask("Deploy a database schema migration to production.", { advisorMode: "never" });
  assert.equal(never.byId.architect.enabled, false);
  assert.equal(never.byId.architect.activation, "never");
  assert.throws(
    () => routeTask("Implement a helper.", { advisorMode: "sometimes" }),
    /advisorMode must be one of/,
  );
});

test("report and jury options adjust reader contracts without changing assessment", () => {
  const noReport = routeTask("Implement a small helper", { report: false });
  assert.equal(noReport.byId.explainer.enabled, false);
  assert.equal(noReport.byId.reader.enabled, false);

  const custom = routeTask("Implement a small helper", { jurySize: 5, quorum: 4, maxRounds: 1 });
  assert.equal(custom.byId.reader.fanout, 5);
  assert.equal(custom.byId.reader.quorum, 4);
  assert.equal(custom.byId.reader.maxRounds, 1);
  assert.throws(() => routeTask("Task", { jurySize: 2, quorum: 3 }), /quorum cannot exceed jurySize/);
});

test("a short, reversible task with a primary artifact uses the fast lane", () => {
  const route = routeTask("Implement a small local CLI and add a smoke check.", {
    lane: "auto",
    timeBudgetMinutes: 10,
    firstArtifact: "src/cli.mjs",
  });

  assert.equal(route.policy.requestedLane, "auto");
  assert.equal(route.policy.lane, "fast");
  assert.equal(route.policy.timeBudgetMinutes, 10);
  assert.equal(route.policy.firstArtifact, "src/cli.mjs");
  assert.equal(route.policy.reasonCode, "short-safe-budget");
  assert.equal(route.policy.advisorMode, "never");
  assert.equal(route.byId.scout.enabled, false);
  assert.equal(route.byId.architect.enabled, false);
  assert.equal(route.byId.maker.enabled, true);
  assert.equal(route.byId.maker.effortCap, "medium");
  assert.equal(route.byId.reviewer.effortCap, "medium");
  assert.equal(route.byId.explainer.enabled, false);
  assert.equal(route.byId.reader.enabled, true);
});

test("short budgets do not weaken high-risk work", () => {
  const automatic = routeTask("Deploy a database schema migration to production.", {
    lane: "auto",
    timeBudgetMinutes: 10,
    firstArtifact: "migrations/001.sql",
  });
  assert.equal(automatic.policy.lane, "full");
  assert.equal(automatic.policy.reasonCode, "safety-requires-full-lane");
  assert.equal(automatic.byId.scout.enabled, true);
  assert.equal(automatic.byId.architect.enabled, true);

  assert.throws(
    () => routeTask("Delete production data.", {
      lane: "fast",
      timeBudgetMinutes: 10,
      firstArtifact: "scripts/delete.mjs",
    }),
    /fast lane is unavailable for this task's safety profile/,
  );
});

test("fast-lane inputs are explicit and strictly validated", () => {
  assert.throws(() => routeTask("Implement a helper.", { lane: "quick" }), /lane must be one of/);
  assert.throws(
    () => routeTask("Implement a helper.", { lane: "fast", firstArtifact: "src/helper.mjs" }),
    /fast lane requires timeBudgetMinutes/,
  );
  assert.throws(
    () => routeTask("Implement a helper.", { lane: "fast", timeBudgetMinutes: 10 }),
    /fast lane requires firstArtifact/,
  );
  assert.throws(
    () => routeTask("Implement a helper.", { timeBudgetMinutes: "10m" }),
    /timeBudgetMinutes must be a positive integer/,
  );
  assert.throws(
    () => routeTask("Implement a helper.", {
      lane: "fast", timeBudgetMinutes: 10, firstArtifact: "../outside.mjs",
    }),
    /firstArtifact must stay inside the workspace/,
  );
  assert.throws(
    () => routeTask("Implement a helper.", {
      lane: "fast", timeBudgetMinutes: 10, firstArtifact: ".RELAY10/workspace.lock",
    }),
    /firstArtifact must stay inside the workspace/,
  );
  assert.throws(
    () => routeTask("Implement a helper.", {
      lane: "fast", timeBudgetMinutes: 16, firstArtifact: "src/helper.mjs",
    }),
    /no greater than 15/,
  );
  assert.throws(
    () => routeTask("Implement a helper.", {
      lane: "fast", timeBudgetMinutes: 10, firstArtifact: "C:outside.mjs",
    }),
    /firstArtifact must stay inside the workspace/,
  );
});
