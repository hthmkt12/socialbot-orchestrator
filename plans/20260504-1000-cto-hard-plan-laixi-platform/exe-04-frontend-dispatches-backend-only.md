# EXE-04: Frontend Dispatches Backend Only

Status: completed
Date: 2026-05-04
Purpose: stop the frontend from executing workflow steps directly and move it to create-plus-dispatch behavior only

## Decision
- Frontend run creation now ends at:
  - insert `workflow_runs`
  - call control-plane `start` action
  - navigate to monitor/detail based on returned status
- Direct browser execution through `RunOrchestrator` is removed from:
  - `useCreateRun`
  - `DemoPage` live mode

## What Changed
- `useCreateRun` no longer calls `executeRun` or `executeMultiDeviceRun`.
- `useCreateRun` now invokes `execute-run` with `{ action: 'start' }`.
- `execute-run` now supports a minimal `start` action:
  - `PENDING -> QUEUED`
  - idempotent success for `QUEUED`, `RUNNING`, `WAITING_APPROVAL`
- Demo live flow now creates a real run and requests backend dispatch only.
- UI surfaces treat `QUEUED` as a live non-terminal state instead of an error state.

## Why This Matters
- Browser tabs are no longer the execution owner for normal run creation.
- Dispatch semantics are now aligned with the EXE-01 ownership model.
- The control plane can evolve independently from execution logic in EXE-05+.

## Limits Of This Step
- Worker does not yet claim `QUEUED` runs.
- A dispatched run will remain `QUEUED` until later tasks land.
- Cancel still performs direct cleanup in the control-plane function; that is acceptable for this step and will be tightened later.

## Acceptance For EXE-04
- `useCreateRun` does not call browser execution code.
- Demo live flow does not call browser execution code.
- Frontend can create a run and receive `QUEUED` back from control plane.
- Runs UI and monitor UI treat `QUEUED` as active, not terminal failure.

## Unresolved Questions
- Should `start` also stamp dispatch metadata into `summary_json`, or is audit-only enough for now?
- Should demo live mode later auto-open the run monitor page once worker claim exists?
