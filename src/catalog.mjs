import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export const MODEL_ROLES = Object.freeze(["frontier", "balanced", "economy"]);

const ROLE_HINTS = Object.freeze({
  frontier: /frontier|latest|most capable|complex|research|ambitious|flagship|pro/i,
  balanced: /balanced|everyday|strong|general|daily|standard/i,
  economy: /economy|economic|fast|affordable|cheap|small|mini|cost[- ]?efficient|light/i,
});

export const EFFORT_RANK = Object.freeze(["low", "medium", "high", "xhigh", "max", "ultra"]);

const EFFORT_PREFERENCES = Object.freeze({
  frontier: ["max", "ultra", "xhigh", "high", "medium", "low"],
  balanced: ["medium", "high", "low", "xhigh", "max", "ultra"],
  economy: ["low", "medium", "high", "xhigh", "max", "ultra"],
});

/**
 * Map a requested effort onto a model's menu.
 *
 * An empty menu means the provider did not advertise levels, so the request
 * passes through. A level the menu lacks becomes the nearest advertised level
 * at or below it. `max` and `ultra` on Grok 4.7 therefore become `xhigh`.
 * A request below every advertised level uses the lowest one.
 */
export function snapEffort(requested, supported = []) {
  if (!requested) return null;
  const menu = [...new Set((supported ?? []).filter((level) => EFFORT_RANK.includes(level)))];
  if (menu.length === 0) return requested;
  if (menu.includes(requested)) return requested;
  const requestedIndex = EFFORT_RANK.indexOf(requested);
  if (requestedIndex === -1) {
    throw new RangeError(`unknown effort level: ${requested}`);
  }
  const atOrBelow = menu
    .filter((level) => EFFORT_RANK.indexOf(level) <= requestedIndex)
    .sort((left, right) => EFFORT_RANK.indexOf(right) - EFFORT_RANK.indexOf(left));
  if (atOrBelow.length > 0) return atOrBelow[0];
  return [...menu].sort((left, right) => EFFORT_RANK.indexOf(left) - EFFORT_RANK.indexOf(right))[0];
}

function asJson(value) {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch (error) {
    throw new SyntaxError(`Codex model catalog is not valid JSON: ${error.message}`, { cause: error });
  }
}

function extractModels(raw) {
  const parsed = asJson(raw);
  if (Array.isArray(parsed)) return parsed;
  if (Array.isArray(parsed?.models)) return parsed.models;
  if (Array.isArray(parsed?.data)) return parsed.data;
  throw new TypeError("Codex model catalog must be an array or contain a models/data array");
}

function isVisible(model) {
  if (typeof model?.visible === "boolean") return model.visible;
  if (model?.hidden === true) return false;
  if (model?.visibility === undefined || model?.visibility === null) return true;
  return ["list", "visible", "public"].includes(String(model.visibility).toLowerCase());
}

function normalizeEfforts(model) {
  const levels = model.supported_reasoning_levels
    ?? model.supportedReasoningLevels
    ?? model.reasoning_efforts
    ?? model.supported_efforts
    ?? [];

  return [...new Set(levels.map((level) => (
    typeof level === "string" ? level : level?.effort ?? level?.name
  )).filter(Boolean).map(String))];
}

function normalizeModel(model, index) {
  const id = model?.slug ?? model?.id ?? model?.model ?? model?.name;
  if (!id) return null;
  const priority = Number(model.priority);
  return {
    id: String(id),
    name: String(model.display_name ?? model.displayName ?? model.name ?? id),
    description: String(model.description ?? ""),
    priority: Number.isFinite(priority) ? priority : index + 1,
    defaultEffort: model.default_reasoning_level ?? model.defaultReasoningLevel ?? null,
    supportedEfforts: normalizeEfforts(model),
    visible: isVisible(model),
    raw: model,
  };
}

export function parseModelCatalog(raw) {
  return extractModels(raw)
    .map(normalizeModel)
    .filter(Boolean)
    .sort((a, b) => a.priority - b.priority || a.id.localeCompare(b.id));
}

function roleScore(model, role) {
  const identity = `${model.id} ${model.name}`;
  const described = ROLE_HINTS[role].test(model.description);
  let score = described ? 1_000 : 0;
  if (!described && ROLE_HINTS[role].test(identity)) score += 100;
  score -= model.priority / 1_000;
  return score;
}

function selectEffort(model, role, requested) {
  if (requested) {
    if (model?.supportedEfforts?.length && !model.supportedEfforts.includes(requested)) {
      throw new RangeError(`Model ${model.id} does not support reasoning effort ${requested}`);
    }
    return requested;
  }
  if (!model?.supportedEfforts?.length) return model?.defaultEffort ?? EFFORT_PREFERENCES[role][0];
  return EFFORT_PREFERENCES[role].find((effort) => model.supportedEfforts.includes(effort))
    ?? model.defaultEffort
    ?? model.supportedEfforts[0];
}

function normalizeOverride(override) {
  if (typeof override === "string") return { model: override };
  if (override && typeof override === "object") {
    return {
      model: override.model ?? override.id ?? override.slug,
      effort: override.effort,
    };
  }
  return null;
}

function roleSelection(role, model, source, requestedEffort) {
  return {
    role,
    model: model.id,
    name: model.name,
    description: model.description,
    priority: model.priority,
    effort: selectEffort(model, role, requestedEffort),
    supportedEfforts: [...model.supportedEfforts],
    source,
  };
}

export function buildCatalog(raw, { overrides = {} } = {}) {
  const models = parseModelCatalog(raw);
  const visibleModels = models.filter((model) => model.visible);
  if (visibleModels.length === 0) throw new Error("Codex model catalog has no visible models");

  const roles = {};
  const unused = new Set(visibleModels.map((model) => model.id));

  for (const role of MODEL_ROLES) {
    const override = normalizeOverride(overrides[role]);
    if (!override?.model) continue;
    const model = models.find((candidate) => candidate.id === override.model) ?? {
      id: String(override.model),
      name: String(override.model),
      description: "Explicit model override",
      priority: Number.POSITIVE_INFINITY,
      defaultEffort: null,
      supportedEfforts: [],
    };
    roles[role] = roleSelection(role, model, "override", override.effort);
    unused.delete(model.id);
  }

  for (const role of MODEL_ROLES) {
    if (roles[role]) continue;
    const pool = visibleModels.filter((model) => unused.has(model.id));
    const candidates = pool.length > 0 ? pool : visibleModels;
    const selected = [...candidates].sort((a, b) => (
      roleScore(b, role) - roleScore(a, role)
      || a.priority - b.priority
      || a.id.localeCompare(b.id)
    ))[0];
    roles[role] = roleSelection(role, selected, "catalog", null);
    unused.delete(selected.id);
  }

  return {
    models: visibleModels.map(({ raw: _raw, visible: _visible, ...model }) => model),
    roles,
  };
}

export async function executeCodexModels(command = "codex", args = ["debug", "models"]) {
  const { stdout } = await execFileAsync(command, args, {
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
  });
  return stdout;
}

export async function discoverCatalog({
  execute = executeCodexModels,
  command = "codex",
  args = ["debug", "models"],
  overrides = {},
} = {}) {
  const result = await execute(command, args);
  const raw = typeof result === "object" && result !== null && "stdout" in result
    ? result.stdout
    : result;
  return buildCatalog(raw, { overrides });
}
