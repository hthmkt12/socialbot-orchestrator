# Phase 13: AI Workflow Builder

## Context
The platform currently provides a manual GUI builder for `MacroDefinition` creation. Phase 13 introduces the AI Workflow Builder, enabling users to generate complex device automation macros from natural language prompts. This significantly lowers the barrier to entry, especially for generating advanced workflows containing `conditional`, `while_loop`, `extract_var`, and `try_catch` structural nodes.

## Objectives
1. **LLM Translation Layer**: A secure backend endpoint that accepts a user prompt and translates it into a valid `MacroDefinition` JSON object adhering to the schema.
2. **Prompt Engineering Strategy**: Provide the LLM with the strict `MacroStep` JSON schema, capabilities, limitations, and few-shot examples (especially for loops and variables).
3. **Conversational Interface**: A chat-like or prompt-box UI integrated into the Macro Builder page that takes user intent, streams the loading state, and populates the Guided Builder with the generated macro for final review.
4. **Validation Pipeline**: Ensure the AI output is passed through the existing `validateMacroDefinition` contract before rendering.

## Architecture

### 1. Backend Service (Edge Function)
Instead of exposing OpenAI keys directly in the Vite frontend, we will use a Supabase Edge Function (`ai-macro-generator`).
- **Input**: `{ prompt: "Like 5 posts on Instagram and stop", existingMacro: {...} }`
- **Logic**:
  - Authenticate the user via Supabase JWT.
  - Call an LLM provider (e.g., OpenAI `gpt-4o` or Claude `claude-3-5-sonnet`) using Structured Outputs / JSON Schema mode.
  - Inject the system prompt.
- **Output**: A partial or complete `MacroDefinition`.

### 2. Prompt Engineering & System Context
The system prompt will define the rules of the engine:
```markdown
You are an expert mobile automation engineer mapping user requests to a JSON automation macro.
The macro runs on Android/iOS via ADB/UI accessibility trees.

Available steps:
- wait { ms: number }
- launch_app { appName: string }
- tap { x: number, y: number }
- swipe { fromX, fromY, toX, toY, durationMs }
- input_text { text: string, clear: boolean }
- extract_var { source: 'adb'|'ui_tree', command?: string, regex?: string, variableName: string }
- while_loop { left, operator, right, maxIterations, steps: MacroStep[] }
- conditional { left, operator, right, then: MacroStep[], else: MacroStep[] }
- try_catch { steps: MacroStep[], catch: MacroStep[] }
- ai_task { goal: string } (Use this when the logic is too complex for basic taps/swipes, delegates to an on-device VLM)

Rules:
1. Return strictly valid JSON.
2. Use {{varName}} syntax for variable interpolation in text/conditional fields.
3. Coordinates are normalized 0.0 to 1.0.
4. If the user asks for a loop, always provide a realistic `maxIterations` limit.
```

### 3. Frontend Integration
Create a new component `AiMacroGeneratorPanel.tsx`:
- A textarea for the user's prompt.
- A "Generate" button.
- Loading states (shimmer/skeleton).
- Error handling (e.g., if the LLM hallucinated invalid JSON).

**Workflow**:
1. User types: "Check battery, if it's less than 20% stop the macro, else open tiktok."
2. Frontend calls Supabase Edge Function `/ai-macro-generator`.
3. Function returns JSON.
4. Frontend passes JSON through `validateMacroDefinition(def)`.
5. If valid, update the `useMacroDefinitionAuthoringState` context with the new steps.
6. The user is transitioned to the Guided Builder to review and fine-tune coordinates or text.

## Implementation Steps

| Step | Component | Description |
|------|-----------|-------------|
| 1 | Supabase Edge Function | Create `supabase/functions/ai-macro-generator/index.ts`. Implement auth validation, LLM API call using `openai` SDK or direct fetch, and strictly enforce JSON output format matching `MacroStep[]`. |
| 2 | System Prompt Construction | Write the detailed system prompt mapping out the `StepType` definitions, anti-detection policies, and variable interpolation syntax (`{{var}}`). Include 3-4 robust few-shot examples of advanced logic. |
| 3 | Frontend API Client | Add a method to the Supabase client wrapper to POST to the edge function. |
| 4 | Chat UI Component | Build `AiMacroPromptBox.tsx` with a textarea, generate button, and loading animation. Place it prominently above or alongside the Guided Builder in `MacroDefinitionAuthoringModal.tsx`. |
| 5 | Validation & Hydration | Wire the generator output to the authoring state. Catch validation errors (`validateMacroDefinition`) and display them gracefully to the user, perhaps offering a "Retry" button. |

## Risks & Mitigations
- **Hallucinations**: The LLM might invent step types (e.g., `scroll_down`). **Mitigation**: Use strict JSON schema enforcement at the API level (e.g., OpenAI's `response_format: { type: "json_schema" }`) and validate heavily on the client.
- **Coordinate Guessing**: The LLM doesn't know exact app coordinates. **Mitigation**: Have the LLM default to center `(0.5, 0.5)` or use the `ai_task` step for dynamic vision-based interaction instead of hardcoded `tap` steps.
- **Token Costs**: Long system prompts and complex outputs can be expensive. **Mitigation**: Keep the context window tight. Do not send the entire `SAMPLE_MACROS` file, only minimal, dense structural examples.