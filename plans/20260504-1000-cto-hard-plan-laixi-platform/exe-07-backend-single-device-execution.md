# EXE-07: Backend Single-Device Execution

Status: completed
Date: 2026-05-04
Purpose: make a claimed single-device run execute end-to-end from the backend worker instead of the browser

## Decision
- The worker now executes `SINGLE_DEVICE` runs directly once claimed.
- Until the first-class gateway session manager exists, the worker talks to Laixi over a direct websocket URL.
- Multi-device execution stays out of scope for this step and remains queued for later phases.

## What Changed
- Added a service-side Laixi websocket client in `services/execution-worker/src/laixi-direct-client.ts`.
- Added a service-side step executor in `services/execution-worker/src/execute-device-step.ts`.
- Added worker-side persistence modules:
  - `worker-step-store.ts`
  - `worker-device-locks.ts`
  - `worker-run-store.ts`
- Added `single-device-step-runner.ts` to execute macro steps, persist `run_steps`, handle retries, and poll approvals backend-side.
- Added `single-device-run-executor.ts` to:
  - load claimed single-device context
  - acquire and renew device locks
  - connect to Laixi
  - transition the run to `RUNNING`
  - finalize `COMPLETED`, `FAILED`, or `CANCELLED`
- Extended `RunClaimCoordinator` so:
  - only `SINGLE_DEVICE` queued runs are claimed in this phase
  - leases keep renewing for `QUEUED`, `RUNNING`, and `WAITING_APPROVAL`
  - claim success dispatches immediately into backend execution
- Updated worker package dependencies and tsconfig so service-side modules can build against shared contracts and reused engine helpers.

## Why This Matters
- A single-device run no longer needs an open browser tab to move from queued state to terminal state.
- Step persistence, lock ownership, retries, and approval waits now live in backend worker code for the single-device path.
- This creates the real execution spine that multi-device and gateway-first work can build on later.

## Limits Of This Step
- The worker currently connects directly to Laixi instead of routing through the future gateway session manager.
- Multi-device and group/all-device targets are still not executed by the worker.
- Approval waiting is backend-owned in-process now, but worker-restart resume semantics are still incomplete and belong to `EXE-08`.
- Artifact rows for screenshots are still metadata-only; full artifact storage remains later work.

## Acceptance For EXE-07
- A claimed `SINGLE_DEVICE` run can move `QUEUED -> RUNNING -> terminal` entirely from backend-owned execution.
- Worker persists `run_steps` and run summary data without browser execution ownership.
- Device lock ownership is acquired, renewed, and released from the backend worker.
- Cancelling a claimed run clears claim state and stops future backend ownership.

## Unresolved Questions
- Should the worker stop using direct Laixi websocket access as soon as `EXE-10` begins, or is a transition period acceptable?
- Should approval polling survive worker restarts via resumable execution state rather than long-lived in-process waits?
