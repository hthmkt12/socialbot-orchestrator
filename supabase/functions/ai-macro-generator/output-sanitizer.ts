/**
 * Sanitizes LLM-generated macro output to ensure it conforms to
 * the MacroDefinition contract before sending to the frontend.
 */

const VALID_STEP_TYPES = new Set([
  "wait", "launch_app", "input_text", "tap", "swipe", "screenshot",
  "get_current_app", "adb", "run_autox", "approval_checkpoint",
  "conditional", "foreach_device", "group", "stop", "ai_task",
  "loop", "while_loop", "try_catch", "extract_var",
]);

const VALID_OPERATORS = new Set([
  "equals", "not_equals", "contains", "starts_with",
  "ends_with", "gt", "lt", "exists",
]);

/**
 * Takes raw LLM JSON output and normalizes it into a valid MacroDefinition.
 * Fixes common LLM mistakes: invalid step types, missing IDs, bad coordinates.
 */
export function sanitizeLlmMacroOutput(
  raw: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {
    version: 1,
    meta: sanitizeMeta(raw.meta),
    inputs: raw.inputs && typeof raw.inputs === "object" ? raw.inputs : {},
    target: { mode: "single_device" },
    execution: sanitizeExecution(raw.execution),
    steps: [],
  };

  if (raw.steps && Array.isArray(raw.steps)) {
    const idCounter = { value: 0 };
    result.steps = sanitizeSteps(raw.steps, idCounter);
  }

  return result;
}

function sanitizeMeta(meta: unknown): Record<string, unknown> {
  if (!meta || typeof meta !== "object") {
    return { key: "ai_generated", name: "AI Generated Macro" };
  }

  const m = meta as Record<string, unknown>;
  return {
    key: typeof m.key === "string" && m.key ? m.key : "ai_generated",
    name: typeof m.name === "string" && m.name ? m.name : "AI Generated Macro",
    description: typeof m.description === "string" ? m.description : undefined,
    tags: Array.isArray(m.tags) ? m.tags.filter((t) => typeof t === "string") : [],
  };
}

function sanitizeExecution(exec: unknown): Record<string, unknown> {
  if (!exec || typeof exec !== "object") {
    return { defaultTimeoutMs: 15000, maxRetries: 0, onError: "stop" };
  }

  const e = exec as Record<string, unknown>;
  return {
    defaultTimeoutMs: typeof e.defaultTimeoutMs === "number" ? e.defaultTimeoutMs : 15000,
    maxRetries: typeof e.maxRetries === "number" ? e.maxRetries : 0,
    onError: ["stop", "continue", "skip"].includes(e.onError as string)
      ? e.onError
      : "stop",
  };
}

function sanitizeSteps(
  steps: unknown[],
  idCounter: { value: number },
): Record<string, unknown>[] {
  const result: Record<string, unknown>[] = [];

  for (const raw of steps) {
    if (!raw || typeof raw !== "object") continue;
    const step = raw as Record<string, unknown>;

    const type = String(step.type ?? "wait");
    if (!VALID_STEP_TYPES.has(type)) continue; // drop invalid step types

    idCounter.value++;
    const id = typeof step.id === "string" && step.id
      ? step.id
      : `${type}_${idCounter.value}`;

    const sanitized: Record<string, unknown> = {
      id,
      type,
      params: sanitizeParams(type, step.params),
    };

    // Nested step arrays
    if (step.then && Array.isArray(step.then)) {
      sanitized.then = sanitizeSteps(step.then, idCounter);
    }
    if (step.else && Array.isArray(step.else)) {
      sanitized.else = sanitizeSteps(step.else, idCounter);
    }
    if (step.steps && Array.isArray(step.steps)) {
      sanitized.steps = sanitizeSteps(step.steps, idCounter);
    }
    if (step.catch && Array.isArray(step.catch)) {
      sanitized.catch = sanitizeSteps(step.catch, idCounter);
    }

    result.push(sanitized);
  }

  return result;
}

function sanitizeParams(
  type: string,
  params: unknown,
): Record<string, unknown> {
  const p = (params && typeof params === "object"
    ? params
    : {}) as Record<string, unknown>;

  switch (type) {
    case "tap":
      return {
        x: clampCoord(p.x),
        y: clampCoord(p.y),
      };
    case "swipe":
      return {
        fromX: clampCoord(p.fromX),
        fromY: clampCoord(p.fromY),
        toX: clampCoord(p.toX),
        toY: clampCoord(p.toY),
      };
    case "wait":
      return { ms: typeof p.ms === "number" ? Math.max(0, p.ms) : 1000 };
    case "conditional":
    case "while_loop":
      return {
        left: String(p.left ?? ""),
        operator: VALID_OPERATORS.has(String(p.operator)) ? p.operator : "equals",
        right: String(p.right ?? ""),
        ...(type === "while_loop"
          ? { maxIterations: clampIterations(p.maxIterations) }
          : {}),
      };
    case "extract_var":
      return {
        source: p.source === "ui_tree" ? "ui_tree" : "adb",
        variableName: String(p.variableName ?? "var1"),
        ...(p.command ? { command: String(p.command) } : {}),
        ...(p.regex ? { regex: String(p.regex) } : {}),
      };
    default:
      return p;
  }
}

function clampCoord(val: unknown): number {
  if (typeof val !== "number") return 0.5;
  return Math.max(0, Math.min(1, val));
}

function clampIterations(val: unknown): number {
  if (typeof val !== "number") return 10;
  return Math.max(1, Math.min(100, Math.round(val)));
}
