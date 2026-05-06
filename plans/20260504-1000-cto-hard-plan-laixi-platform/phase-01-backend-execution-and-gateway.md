# Phase 01: Backend Execution And Gateway

## Context Links
- `README.md`
- `exe-01-run-state-machine-and-execution-ownership.md`
- `exe-02-runtime-and-service-boundary.md`
- `exe-03-shared-execution-contract.md`
- `exe-04-frontend-dispatches-backend-only.md`
- `exe-05-control-plane-replay-safe-actions.md`
- `exe-06-worker-claim-and-lease-rules.md`
- `exe-07-backend-single-device-execution.md`
- `exe-08-approval-resume-via-claim-loop.md`
- `exe-09-backend-multi-target-execution.md`
- `exe-10-first-class-gateway-session-manager.md`
- `exe-11-durable-artifact-write-path.md`
- `exe-12-repeatable-smoke-coverage.md`
- `src/hooks/useRuns.ts`
- `src/engine/orchestrator.ts`
- `src/engine/runner.ts`
- `src/pages/DeviceSetupPage.tsx`
- `supabase/functions/execute-run/index.ts`

## Overview
- Priority: P1
- Current status: in progress
- Brief description: replace browser-owned execution with durable backend execution and a first-class gateway service.

## Key Insights
- Run execution is triggered directly from the UI layer.
- `execute-run` only supports cancel, not execution dispatch.
- Approval resume is now coded against persisted `run_steps` plus claim-loop requeue, but still needs live smoke proof.
- Multi-target execution is now backend-owned too, but still uses one worker claim with sequential device traversal.
- The worker now dispatches live steps to the gateway over HTTP instead of owning the device websocket directly.
- Gateway sessions are keyed by external `laixi_device_id`, not internal database row IDs.
- Device setup documentation now needs to stay aligned to `dispatch_step` and `step_result` instead of legacy message names.
- Artifact rows now carry inline screenshot and log payloads so the operator UI can preview evidence without a separate object-store path yet.
- A repeatable in-memory smoke suite can now replay start, cancel, and approval-resume paths without needing browser state.

## Requirements
- Runs continue after tab close, refresh, logout, or approval delay.
- Cancel, retry, and approval outcomes must be durable and replay-safe.
- Multi-device execution must not share UI memory as a control plane.
- Gateway protocol must be explicit, versioned, and testable.

## Architecture
- Introduce a backend execution worker that claims `workflow_runs` and writes `run_steps`.
- Introduce a gateway service that maintains device sessions, heartbeats, and command dispatch.
- Keep the frontend as control surface plus monitor only.
- Use persistent queues or claim-based polling to avoid duplicate execution ownership.

## Related Code Files
- Files to modify:
  - `src/hooks/useRuns.ts`
  - `src/engine/orchestrator.ts`
  - `supabase/functions/execute-run/index.ts`
- Files to create:
  - backend worker entrypoint
  - gateway service entrypoint
  - shared execution contract module
- Files to delete:
  - none yet; deprecate browser execution after backend parity

## Implementation Steps
1. Define canonical run state transitions and ownership rules.
2. Move run start from direct browser execution to backend dispatch.
3. Move approval resume and cancellation cleanup into backend-owned flow.
4. Stand up gateway session manager for device registration, heartbeat, and command routing.
5. Add integration tests for start, cancel, approval wait, approval resume, and tab-close resilience.

## Todo List
- [x] Freeze the gateway message contract and version it
- [x] Implement backend worker claim loop
- [x] Implement run ownership and idempotency rules for control-plane start/cancel replay
- [x] Wire frontend start/cancel actions to backend APIs only
- [x] Implement claim, lease, and reclaim-safe worker reservation rules
- [x] Port single-device execution to backend worker ownership
- [x] Move approval wait and resume to backend-owned persisted state
- [x] Port multi-target execution to backend worker ownership
- [x] Put the gateway in the primary live-dispatch path with explicit session/error handling
- [x] Persist screenshot and text-log artifacts from backend-owned execution
- [x] Add repeatable backend smoke coverage for start, cancel, approval, refresh, and tab-close semantics
- [ ] Add backend execution observability and failure logs
- [ ] Run live approval smoke against Supabase plus Laixi

## Success Criteria
- A run survives UI disconnects.
- Approval no longer depends on an open tab.
- Cancel always cleans run state, approvals, and device locks.
- Single-device and multi-device runs complete from backend ownership only.

## Risk Assessment
- Highest risk is split-brain ownership between browser and backend during migration.
- Gateway protocol drift can break device compatibility quickly.
- Artifact writes may create partial run evidence if not transactionally coordinated.

## Security Considerations
- Treat ADB and AutoJS execution as privileged operations end-to-end.
- Lock down service-role usage and avoid leaking command payloads to the client.
- Preserve auditability for run creation, claim, dispatch, approval, cancel, and failure.

## Next Steps
- Run live gateway plus device smoke for start, approval wait/resume, and disconnect handling.
- Decide whether inline artifact metadata is sufficient for pilot or if the next step should move to Supabase Storage/object storage.
