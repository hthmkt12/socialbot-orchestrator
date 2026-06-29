---
phase: 4
title: "Concrete Social Bots & Foreach Execution"
status: pending
priority: P1
dependencies: []
---

# Phase 4: Concrete Social Bots & Foreach Execution

## Overview
Expand the worker execution engine to support a new `foreach` step type and create concrete Instagram/TikTok social macro templates that iterate through a list of items (e.g. hashtags, usernames, posts). This builds on the foundation laid in Phase 1 MVP to enable mass-action capabilities safely.

## Requirements
- Functional:
  - Worker must support a `foreach` step type that accepts an array variable name and inner steps.
  - The worker must loop through the inner steps for every item in the array, making the current item available in variables (e.g., `{{item}}`).
  - Create or update at least two concrete social templates (e.g. "Like 5 posts from a hashtag list" and "Follow an array of usernames") utilizing the `foreach` step.
- Non-functional:
  - Iterations must be isolated in the execution engine (step state management).
  - Existing anti-detection delays must still apply between steps inside the loop.

## Architecture
- `single-device-step-runner.ts` will parse a `foreach` step, extract the target array from `ExecutionContext` or inputs, and iterate via a standard `for` loop, recursively invoking `runSteps` for the nested steps similar to how `handleLoop` and `handleGroup` operate. 
- Iteration items will be temporarily pushed into a localized context variable for template resolution during the inner steps.

## Related Code Files
- Modify: `src/contracts/macro.ts` (add `foreach` to Step types and define its params interface).
- Modify: `services/execution-worker/src/single-device-step-runner.ts` (add `handleForeachLoop` method).
- Modify: `src/contracts/social-engagement-templates.ts` (create templates utilizing `foreach`).

## Implementation Steps
1. Add `foreach` to `MacroStepType` union in `macro.ts` and define `ForeachParams` (needs `arraySourceVar`, `itemName`).
2. Update `single-device-step-runner.ts` `executeStep` to intercept `step.type === 'foreach'`.
3. Implement `handleForeachLoop` which looks up the array from `this.params.inputVariables` or `this.stepOutputs`, loop through it, assign the current item to a temporary variable inside the runner context, and invoke `runSteps(step.steps)`.
4. Create the "Instagram Mass Hashtag Liker" and "Instagram Mass Account Follower" templates using the new `foreach` logic in `social-engagement-templates.ts`.

## Success Criteria
- [ ] The engine correctly iterates through an array input variable and resolves the loop item within inner steps.
- [ ] A template utilizing `foreach` can be executed successfully without crashing the runner.
- [ ] The `foreach` loop maintains state and doesn't conflict with database state checkpoints.

## Risk Assessment
- Risk: State pollution between iterations (e.g., variables getting overwritten and failing the next loop).
- Mitigation: Properly scope the `item` variable inside the iteration execution and ensure state checkpoints inside the loop uniquely identify the iteration index to prevent database conflicts in `worker-step-store`.
