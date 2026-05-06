# EXE-01: Run State Machine And Execution Ownership

Status: completed
Date: 2026-05-04
Purpose: define one canonical owner for run lifecycle and one allowed transition model before backend extraction work starts

## Scope
- Covers `workflow_runs`, `run_steps`, `approvals`, and device-lock interaction.
- Covers target architecture rules, not just current implementation behavior.
- Keeps current status enums unless a later task proves expansion is necessary.

## Current Observations
- `workflow_runs` supports `PENDING`, `QUEUED`, `RUNNING`, `COMPLETED`, `FAILED`, `CANCELLED`, `PARTIAL_SUCCESS`, `WAITING_APPROVAL`.
- `run_steps` supports `PENDING`, `RUNNING`, `SUCCESS`, `FAILED`, `SKIPPED`, `RETRYING`, `CANCELLED`, `WAITING_APPROVAL`.
- Browser code currently owns execution start and most run-state mutation.
- Approval code and cancel code currently mutate run state outside a single execution owner.
- `QUEUED` exists in types but is not used in the current execution path.

## Hard Rules
- Exactly one execution owner may control a run at any moment.
- Frontend may create runs, request cancel, and display state. Frontend must not execute steps.
- Gateway owns device sessions and command transport. Gateway must not own run-state transitions.
- Approval service may write approval decisions. Approval service must not be the long-term owner of run completion logic.
- Terminal run states are immutable except explicit admin recovery tooling added later.

## Execution Owners
- Control plane owner:
  - creates run records
  - dispatches work to backend execution
  - requests cancellation
- Execution owner:
  - claims runnable work
  - transitions run and step states
  - acquires and releases device locks
  - handles retries, approval pause, resume, and finalization
- Gateway:
  - maintains device connection state
  - delivers commands and returns step results
  - reports heartbeat and transport errors

## Canonical Run States

| State | Meaning | Owner allowed to enter | Terminal |
|---|---|---|---|
| `PENDING` | Run exists but has not been accepted for execution yet | control plane | no |
| `QUEUED` | Run accepted for backend processing but not actively executing yet | control plane or execution owner claim loop | no |
| `RUNNING` | At least one device execution path is active under backend ownership | execution owner | no |
| `WAITING_APPROVAL` | Execution is paused on a manual approval gate | execution owner | no |
| `COMPLETED` | All required device paths ended successfully | execution owner | yes |
| `FAILED` | Run reached unrecoverable failure and did not meet success criteria | execution owner | yes |
| `CANCELLED` | Run was intentionally stopped and cleanup finished | execution owner | yes |
| `PARTIAL_SUCCESS` | Multi-device run finished with mixed success and failure outcomes | execution owner | yes |

## Canonical Step States

| State | Meaning | Terminal |
|---|---|---|
| `PENDING` | Step record created but not started yet | no |
| `RUNNING` | Step is executing now | no |
| `RETRYING` | A failed attempt will be retried | no |
| `WAITING_APPROVAL` | Step cannot continue until manual decision exists | no |
| `SUCCESS` | Step completed successfully | yes |
| `FAILED` | Step exhausted retries or hit unrecoverable failure | yes |
| `SKIPPED` | Step intentionally not executed because branch not taken or policy skipped it | yes |
| `CANCELLED` | Step did not finish because run was cancelled | yes |

## Allowed Run Transitions
- `PENDING -> QUEUED`
- `PENDING -> RUNNING` only for a temporary migration bridge; target model should prefer `QUEUED`
- `QUEUED -> RUNNING`
- `RUNNING -> WAITING_APPROVAL`
- `WAITING_APPROVAL -> RUNNING`
- `RUNNING -> COMPLETED`
- `RUNNING -> FAILED`
- `RUNNING -> CANCELLED`
- `RUNNING -> PARTIAL_SUCCESS`
- `WAITING_APPROVAL -> CANCELLED`
- `WAITING_APPROVAL -> FAILED` only if the owner treats approval timeout or transport failure as hard failure

Not allowed:
- any terminal state back to non-terminal state
- frontend direct transition into `RUNNING`, `WAITING_APPROVAL`, `COMPLETED`, `FAILED`, `PARTIAL_SUCCESS`
- gateway direct transition of `workflow_runs`

## Allowed Step Transitions
- `PENDING -> RUNNING`
- `RUNNING -> SUCCESS`
- `RUNNING -> FAILED`
- `RUNNING -> RETRYING`
- `RETRYING -> RUNNING`
- `RUNNING -> WAITING_APPROVAL`
- `WAITING_APPROVAL -> RUNNING`
- `WAITING_APPROVAL -> CANCELLED`
- `PENDING -> SKIPPED`
- `RUNNING -> CANCELLED`
- `PENDING -> CANCELLED`

Not allowed:
- `SUCCESS` back to any non-terminal state
- `FAILED` back to `RUNNING` without a new attempt record or new run
- `SKIPPED` back to active execution

## Timestamp Rules
- `started_at` on `workflow_runs` is set once on first entry to `RUNNING`.
- `finished_at` on `workflow_runs` is set once on first terminal transition.
- `cancelled_at` is set only when final state is `CANCELLED`.
- `started_at` on `run_steps` is set on first entry to `RUNNING`.
- `finished_at` on `run_steps` is set on terminal step state only.

## Approval Rules
- Approval creation may set current run and step to `WAITING_APPROVAL`.
- Approval decision writes only approval outcome plus reviewer metadata.
- Execution owner consumes approval outcome and performs the next run-state transition.
- Conservative rule for Phase 01: device lock remains held while the run is `WAITING_APPROVAL`.
- Rejected approval maps to `CANCELLED` for the run in the near-term model to match current product semantics.
- Approval timeout may map to `CANCELLED` first; changing that to `FAILED` requires explicit product decision later.

## Cancellation Rules
- UI creates a cancel request. UI does not finalize cleanup.
- Execution owner performs cancellation cleanup:
  - stop future step dispatch
  - mark active and pending steps `CANCELLED` where appropriate
  - release device locks
  - expire pending approvals
  - finalize run as `CANCELLED`
- Immediate direct `CANCELLED` writes from control plane are migration behavior, not target behavior.

## Multi-Device Rules
- Run state is global. Step state is per device and per step.
- `COMPLETED` means every targeted device path succeeded.
- `FAILED` means no targeted device path succeeded and the run has no partial win.
- `PARTIAL_SUCCESS` means at least one device path succeeded and at least one device path failed or was cancelled.
- Summary aggregation happens only after all device paths are terminal.

## Lock Rules
- A device lock belongs to one run only.
- A run must not dispatch device steps without an active lock for that device.
- Lock release happens on terminal run cleanup or explicit admin recovery tooling.
- Lock state is operational data, not a replacement for run ownership.

## Current Code Violations Against Target Model
- `useCreateRun` calls execution in the browser directly.
- `approval-service.ts` can finalize run outcome on rejection.
- `execute-run` performs direct cancel-side status mutation and cleanup from control plane.
- Run ownership is held in browser memory via `activeTokens`.

## Migration Implications
- `useCreateRun` must stop calling in-browser execution directly.
- `approval-service.ts` must stop finalizing run completion on rejection in the long-term model.
- `execute-run` Edge Function must evolve from cancel-only direct mutation into control-plane request handling.
- `QUEUED` should become real once backend dispatch exists.

## Acceptance For EXE-01
- One written source of truth exists for run and step transitions.
- Browser, backend worker, gateway, and approval logic boundaries are explicit.
- The spec preserves current enums and identifies where current code violates target ownership.
- EXE-02 and EXE-03 can proceed without re-opening lifecycle semantics.

## Unresolved Questions
- Should approval timeout map to `CANCELLED` or `FAILED` in the long-term model?
- Should device lock remain held through long approval waits after Phase 01, or be made resumable later?
- Do we want `CANCELLING` in the future, or is out-of-band cancel request metadata enough?
