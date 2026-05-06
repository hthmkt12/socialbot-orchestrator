# EXE-05: Control Plane Replay-Safe Actions

Status: completed
Date: 2026-05-04
Purpose: make backend `start` and `cancel` durable enough for retries, refreshes, and replay without depending on UI memory

## Decision
- `execute-run` remains the control-plane entry for `start` and `cancel`.
- Both actions now return explicit outcomes instead of only raw status.
- Control metadata is persisted under `workflow_runs.summary_json.control`.

## What Changed
- Added shared control-plane response types in `packages/shared/src/execution-contract.ts`.
- Added typed control helpers in `src/hooks/useRuns.ts`:
  - `requestRunStart`
  - `requestRunCancel`
- Updated frontend callsites to use the shared control path instead of ad hoc function invokes.
- Refactored `supabase/functions/execute-run/index.ts` so:
  - `start` transitions `PENDING -> QUEUED`
  - replay against `QUEUED`, `RUNNING`, `WAITING_APPROVAL`, and terminal states returns success with an explicit replay outcome
  - `cancel` is replay-safe for already-cancelled or already-finished runs
  - accepted and replayed control requests stamp `summary_json.control.*`
- Split control-state helpers into `supabase/functions/execute-run/control-state.ts` to keep the edge function under the repo size guideline.

## Why This Matters
- UI retries no longer need in-memory knowledge of whether the last control request succeeded.
- Later worker logic can inspect durable dispatch and cancel metadata from the run row itself.
- Frontend and backend now share a clearer control-plane contract for EXE-06 and EXE-07.

## Limits Of This Step
- Worker still does not claim `QUEUED` runs.
- Cancel still performs direct cleanup in the control-plane function rather than worker-owned interruption.
- No new database columns were added; control metadata currently lives inside `summary_json`.

## Acceptance For EXE-05
- Backend API accepts replayed `start` without duplicate queue semantics.
- Backend API accepts replayed `cancel` without relying on an open tab or browser memory.
- Control-plane response includes status plus replay outcome.
- Dispatch and cancel intent are durably written to the run record.

## Unresolved Questions
- Should EXE-06 move from `summary_json.control` to dedicated claim/control columns once lease ownership lands?
- Should the worker eventually own cancel finalization for `RUNNING` runs while the control plane only records cancel intent?
