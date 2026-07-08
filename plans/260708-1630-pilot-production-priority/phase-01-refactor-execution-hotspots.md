---
phase: 1
title: Refactor Execution Hotspots
status: completed
priority: P1
dependencies: []
effort: 1d-2d
---

# Phase 1: Refactor Execution Hotspots

## Overview

Reduce execution-worker maintainability risk without changing runtime behavior. The main target is `services/execution-worker/src/single-device-step-runner.ts`, which currently concentrates step execution, account budget enforcement, artifact persistence, block detection, and loop/control behavior in one large class.

## Requirements

- Functional: existing worker behavior remains unchanged for supported step types, budget enforcement, account action history, artifacts, approval resume, foreach/loop execution, and block detection.
- Non-functional: extracted modules have clear ownership and can be tested without requiring a live Mobile MCP device.

## Architecture

Keep `SingleDeviceStepRunner` as the orchestration facade. Extract policy and helper modules around it:

- Step dispatch helpers: normalize backend results and worker-local wait behavior.
- Artifact helpers: preserve screenshot/log/json artifact persistence and preview rules.
- Account policy helpers: budget checks, action history recording, and block signal handling.
- Control-flow helpers: foreach/conditional/group behavior only if extraction is low-risk and covered by tests.

Do not change database schema, run state transitions, or bridge contracts in this phase.

## Related Code Files

- Modify: `services/execution-worker/src/single-device-step-runner.ts`
- Likely create: `services/execution-worker/src/step-artifact-policy.ts`
- Likely create: `services/execution-worker/src/account-action-policy.ts`
- Likely create: `services/execution-worker/src/step-dispatch-results.ts`
- Verify: `services/execution-worker/src/single-device-step-runner.budget.test.ts`
- Verify: `services/execution-worker/src/smoke/run-resilience-smoke.ts`
- Verify: `services/execution-worker/src/smoke/mobile-mcp-db-queue-worker-smoke.ts`

## Implementation Steps

1. Capture baseline: run `npm.cmd test` and `npm.cmd run build:worker`.
2. Read `single-device-step-runner.ts` by responsibility and mark extraction seams before editing.
3. Add or extend tests around any responsibility being extracted, starting with budget/action-history/artifact/block-detection behavior.
4. Extract account budget and action-history logic first; keep public runner behavior unchanged.
5. Extract artifact preview/persistence helpers next; preserve metadata shape and redaction assumptions.
6. Extract backend dispatch result normalization only after budget/artifact tests pass.
7. Re-measure file sizes and update notes for Phase 4.
8. Run worker build and relevant unit tests after each extraction group.

## Success Criteria

- [x] `SingleDeviceStepRunner` remains the runner facade but no longer owns unrelated policy details directly.
- [x] Existing budget tests still pass.
- [x] Artifact metadata shape remains compatible with run-detail UI.
- [x] Worker build passes.
- [x] No database schema or bridge API changes.

## Review Result

Completed on 2026-07-08 after code review fixes.

Changes accepted:

- Extracted account budget/action-history policy to `services/execution-worker/src/account-action-policy.ts`.
- Extracted successful-step screenshot/log artifact persistence to `services/execution-worker/src/step-artifact-policy.ts`.
- Extracted shared record guard to `services/execution-worker/src/step-dispatch-results.ts`.
- Kept `SingleDeviceStepRunner` as the orchestration facade.

Review fixes applied:

- Removed stale unused `Account` import that caused ESLint failure.
- Restored local execution status type aliases to keep runner method signatures readable.
- Removed unused `NormalizedStepResult` export from the new dispatch-results helper.
- Rewrote a mojibake comment in the new account policy helper with ASCII text.

Verification:

- `npm.cmd run lint`: pass.
- `npm.cmd run typecheck`: pass.
- `npm.cmd test`: pass, 33 files / 279 tests.
- `npm.cmd run build:worker`: pass.
- `npx.cmd vitest run services/execution-worker/src/single-device-step-runner.budget.test.ts services/execution-worker/src/retry-backoff-policy.test.ts services/execution-worker/src/target-failure-policy.test.ts`: pass, 3 files / 12 tests.

Residual note:

- `single-device-step-runner.ts` is reduced from 783 lines to 704 lines. This is a real improvement, but not a complete hotspot cleanup. Further extraction should wait for a separate phase or a narrow follow-up task.

## Risk Assessment

Risk: subtle behavior regression in worker execution.
Mitigation: extract one responsibility at a time, keep tests green between moves, and avoid renaming persisted fields.

Risk: over-refactor expands scope.
Mitigation: no new abstractions unless they remove concrete responsibility from the hotspot file.
