# EXE-06: Worker Claim And Lease Rules

Status: completed
Date: 2026-05-04
Purpose: give backend workers a durable, replay-safe way to reserve queued runs before step execution is ported

## Decision
- Claim state lives on `workflow_runs`, not only in in-memory worker state.
- A claim does not yet flip the run out of `QUEUED`; that transition stays for actual execution ownership in `EXE-07`.
- One worker instance owns one claim token at a time, renewed by heartbeat and reclaimable after lease expiry.

## What Changed
- Added `workflow_runs` lease columns through `supabase/migrations/20260504114000_add_workflow_run_execution_leases.sql`:
  - `execution_owner`
  - `execution_claim_token`
  - `execution_lease_expires_at`
  - `execution_heartbeat_at`
- Extended `WorkflowRun` typing to include lease fields.
- Extended shared execution contract with `claim` metadata shape under control summary.
- Reworked `services/execution-worker`:
  - `run-claim-coordinator.ts` polls queued runs, claims free ones, and reclaims expired leases
  - `run-claim-summary.ts` stamps durable claim metadata into `summary_json.control.claim`
  - `/health` now exposes worker instance id and active claim snapshot
- Updated `execute-run` cancel handling so cancelling a run clears any active lease ownership fields.

## Claim Rules
- Fresh claim:
  - eligible when `status = QUEUED` and `execution_lease_expires_at IS NULL`
- Reclaim:
  - eligible when `status = QUEUED` and `execution_lease_expires_at < now()`
- Ownership:
  - worker writes `execution_owner`, `execution_claim_token`, lease expiry, and heartbeat atomically
- Renewal:
  - only the worker holding the matching claim token can extend the lease
- Local idempotency:
  - one worker process keeps an in-memory active-claim map so the same run is not launched twice inside the same poll loop

## Why This Matters
- Duplicate workers now race on durable lease state instead of browser memory.
- `EXE-07` can reuse the same claim token and ownership metadata when moving actual step execution backend-side.
- Cancel now explicitly tears down claim state, so stale reservations do not survive a legitimate cancel request.

## Limits Of This Step
- Claimed runs stay `QUEUED` until execution is ported.
- No backend step execution happens yet.
- No separate observability sink exists yet beyond worker logs and `/health`.

## Acceptance For EXE-06
- Duplicate workers cannot both acquire the same queued run lease.
- A stale queued lease can be reclaimed after expiry.
- Worker health exposes claimed-run ownership state.
- Cancelling a run clears active claim metadata.

## Unresolved Questions
- Should `EXE-07` move `QUEUED -> RUNNING` at claim time or only once the first step starts?
- Should lease ownership eventually move from columns plus `summary_json` into a dedicated execution-attempt table?
