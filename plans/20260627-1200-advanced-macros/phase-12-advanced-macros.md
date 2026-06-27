# Phase 12: Advanced Macros

## Context

The Laixi platform executes sequences of device actions defined by a JSON structure (`MacroDefinition` in `src/contracts/macro.ts`). Currently, macros support linear sequences of basic actions (tap, swipe, input_text, adb) plus `ai_task` (added in Phase 2) and some structural nodes (`group`, `foreach_device`).

We need to implement Advanced Macros, specifically focusing on:
1. **Variables**: Extracting values from the device and reusing them in subsequent steps.
2. **Conditionals (If/Else)**: Evaluating expressions (often using variables) and branching logic.
3. **While Loops**: Repeating a sequence of steps until a condition is met (or a timeout/max iterations is reached).
4. **Error Boundaries**: Try/catch-like behavior to handle failures gracefully without aborting the entire macro run.

These features require state management during execution. Currently, the execution worker loops over steps linearly. We need an execution context that holds variables and a stack for structural control flow.

## Requirements

1. **Variables**:
   - `extract_var` step: e.g., run an `adb` command or `get_ui_tree` check and store the result in a variable namespace.
   - Variable interpolation: Using `{{var_name}}` in parameters of other steps (e.g., typing text that was read).
   - Global macro inputs should initialize the variable namespace.

2. **Conditionals (`conditional`)**:
   - Evaluate `left`, `operator`, `right`.
   - Operators: `equals`, `not_equals`, `contains`, `starts_with`, `ends_with`, `gt`, `lt`, `exists`.
   - Support variable interpolation in `left` and `right`.
   - Branch into `then` array or `else` array.

3. **While Loops (`while_loop`)**:
   - Similar condition evaluation to `conditional`.
   - Executes a `steps` array as long as the condition holds.
   - Must have a hard limit (e.g., `maxIterations`) to prevent infinite loops from hanging the worker.

4. **Error Boundaries (`try_catch`)**:
   - Execute a `steps` array.
   - If any step fails, catch the error.
   - Execute an optional `catch` array of steps.
   - Continue execution after the block (overrides global `onError` policy for that specific failure).

## Architecture & Data Flow

**Execution Context:**
The execution worker currently processes steps in `run-claim-coordinator.ts` or delegating to step handlers. We need to thread an `ExecutionContext` through the step executor.
```typescript
interface ExecutionContext {
  variables: Record<string, any>;
  macroId: string;
  runId: string;
}
```

**Variable Interpolation:**
Before executing any step's `params`, we recursively traverse the params object and replace `{{key}}` with `context.variables.key`.

**Worker Engine Refactor:**
Instead of a flat loop, the step executor needs to handle nested structures recursively (it already partially does for `group` and `foreach_device`, but this needs formalizing).
```typescript
async function executeStepList(steps: MacroStep[], context: ExecutionContext): Promise<void> {
  for (const step of steps) {
    await executeStep(step, context);
  }
}
```

## Files to Modify

| File | Action |
|------|--------|
| `src/contracts/macro.ts` | Update `StepType`, add `try_catch`, `while_loop`, `extract_var`. Expand `ConditionalOperator`. Define `MacroVariable` types. |
| `services/execution-worker/src/engine/execution-context.ts` | **Create:** Class to hold variable state and perform interpolation. |
| `services/execution-worker/src/mobile-mcp-step-backend.ts` | Refactor to accept/use `ExecutionContext` for step params interpolation. |
| `services/execution-worker/src/run-claim-coordinator.ts` | Update step dispatching to thread the context and handle the new structural nodes. |

## Implementation Steps

### Step 1: Update Contracts (`src/contracts/macro.ts`)

Add new step types and validate them in `validateMacroDefinition`.

```typescript
export type StepType =
  // ... existing ...
  | 'conditional'
  | 'while_loop'
  | 'try_catch'
  | 'extract_var';

export type ConditionalOperator = 'equals' | 'not_equals' | 'contains' | 'starts_with' | 'ends_with' | 'gt' | 'lt' | 'exists';

// Update validation logic to check `catch` arrays on try_catch, etc.
```

### Step 2: Build the Execution Context

Create `services/execution-worker/src/engine/execution-context.ts`.

```typescript
export class ExecutionContext {
  public variables: Record<string, any> = {};

  constructor(initialVars: Record<string, any> = {}) {
    this.variables = { ...initialVars };
  }

  public set(key: string, value: any) {
    this.variables[key] = value;
  }

  public get(key: string): any {
    return this.variables[key];
  }

  // Helper to replace {{var}} in strings/objects
  public interpolate(obj: any): any {
    if (typeof obj === 'string') {
      return obj.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
        const val = this.get(key.trim());
        return val !== undefined ? String(val) : match;
      });
    }
    if (Array.isArray(obj)) return obj.map(v => this.interpolate(v));
    if (obj !== null && typeof obj === 'object') {
      const res: any = {};
      for (const [k, v] of Object.entries(obj)) {
        res[k] = this.interpolate(v);
      }
      return res;
    }
    return obj;
  }
}
```

### Step 3: Implement `extract_var` in Backend

In `mobile-mcp-step-backend.ts`, when handling `extract_var`:
- It needs to execute a subcommand (like `adb` or `get_ui_tree`) and parse the result based on a regex or jsonpath.
- This is tricky because the backend currently doesn't mutate the coordinator's state easily.
- Alternatively, handle `extract_var` in the coordinator: coordinator calls the backend to get data, then updates the `ExecutionContext`.

### Step 4: Implement Structural Nodes in Coordinator

In `run-claim-coordinator.ts` (or extract to `macro-executor.ts`):

```typescript
async function evaluateCondition(params: any, context: ExecutionContext): boolean {
  const left = context.interpolate(params.left);
  const right = context.interpolate(params.right);
  switch (params.operator) {
    case 'equals': return left == right;
    // ... implement others ...
  }
  return false;
}

// Inside executeStep:
if (step.type === 'conditional') {
  const isTrue = await evaluateCondition(step.params, context);
  if (isTrue && step.then) await executeStepList(step.then, context);
  else if (!isTrue && step.else) await executeStepList(step.else, context);
  return;
}

if (step.type === 'while_loop') {
  const maxIter = step.params.maxIterations || 100;
  let iter = 0;
  while (await evaluateCondition(step.params, context) && iter < maxIter) {
    if (step.steps) await executeStepList(step.steps, context);
    iter++;
  }
  return;
}

if (step.type === 'try_catch') {
  try {
    if (step.steps) await executeStepList(step.steps, context);
  } catch (err) {
    if (step.catch) await executeStepList(step.catch, context);
  }
  return;
}
```

### Step 5: Update the Worker Run Loop

Initialize `ExecutionContext` using the run's input values (`macro_run.input_values`). Thread this context through all step executions. Interpolate step parameters *before* passing them to the device backend.

## Success Criteria

1. **Interpolation**: Variables injected via `{{var}}` resolve correctly in `adb` or `input_text` steps.
2. **Conditionals**: Macro branches down `then` or `else` based on runtime variable state.
3. **While Loops**: Macro repeats steps. Max iteration limit prevents hangs.
4. **Error Boundaries**: A failing step inside a `try_catch` does not fail the run; the `catch` block executes and execution continues.

## Risks & Considerations

- **Infinite Loops**: A `while_loop` without a `maxIterations` limit will hang the worker. Must default to a safe limit (e.g., 50).
- **Variable Injection Security**: If variables are pulled from untrusted app UI and injected into `adb` shell commands, command injection is possible. Must warn users in docs, or sanitize `adb` arguments.
- **Worker Refactor Scope**: The execution worker currently interleaves status updates to Supabase with step execution. Moving to a recursive evaluation strategy requires careful handling of the `RunEvent` logging so the UI still sees progress accurately.
