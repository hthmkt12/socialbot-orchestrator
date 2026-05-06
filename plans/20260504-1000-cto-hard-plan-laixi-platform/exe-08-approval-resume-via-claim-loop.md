# EXE-08: Approval Resume Via Claim Loop

Status: completed
Date: 2026-05-04
Purpose: remove in-memory approval waiting so a run can pause, survive worker exit, and resume from persisted state after approval

## Decision
- Approval waiting now stops the worker attempt instead of polling inside process memory.
- The worker persists `WAITING_APPROVAL`, releases execution ownership, and resumes later by reclaiming the run from `QUEUED`.
- Resume state is reconstructed from persisted `run_steps` and the latest approval record for each gated step.

## What Changed
- `single-device-step-runner.ts` now hydrates prior `run_steps`, restores prior step outputs, and resumes from persisted state.
- Approval gates no longer use a long-lived polling loop; they create or reuse approval rows, mark the run `WAITING_APPROVAL`, and exit cleanly.
- Approval checkpoint and approval-required steps now branch on latest approval state:
  - `PENDING` keeps the run parked in `WAITING_APPROVAL`
  - `APPROVED` resumes execution
  - `REJECTED` or `EXPIRED` stop resumption
- `worker-step-store.ts` now loads persisted step state for resume decisions.
- `worker-run-store.ts` now loads the latest approval per step and clears ownership when finalizing `WAITING_APPROVAL`.
- `single-device-run-executor.ts` now preserves `WAITING_APPROVAL` instead of flattening it into `FAILED`.
- `run-claim-coordinator.ts` now renews active claims after a run leaves `QUEUED`, so worker concurrency tracking no longer drops a live claim early.
- `src/lib/approval-service.ts` now re-queues a waiting run on approve and prevents stale approve actions from resurrecting cancelled work.

## Why This Matters
- Approval can now be granted after page refresh, tab close, or worker attempt exit without losing the run.
- Resume semantics are tied to durable database state instead of a promise loop in one worker process.
- This closes the main durability gap left after backend single-device execution landed in `EXE-07`.

## Limits Of This Step
- This is source-level durability only until a live Supabase plus Laixi smoke proves the full path.
- Multi-device approval resume is still future work because multi-device worker execution is not implemented yet.
- Gateway-first session ownership is still pending, so the worker continues using direct Laixi websocket access in this phase.

## Acceptance For EXE-08
- A waiting approval no longer requires an open browser tab or a long-lived worker poll loop.
- Approving a waiting run moves it back to `QUEUED` so the claim loop can reclaim it.
- Resume uses persisted `run_steps` so already completed steps are not re-executed.
- Stale approve actions do not revive runs that were already cancelled or expired.

## Unresolved Questions
- Should approval resume emit explicit summary counters for wait cycles and resume attempts, or is step plus audit evidence enough for pilot?
- Do we want a dedicated smoke harness for approval resume before starting `EXE-09`, or is manual live proof enough?
