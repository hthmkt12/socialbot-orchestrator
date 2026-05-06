# Implementation Backlog

Status: proposed
Source: `plan.md` and phase files in this folder

## Sequencing Rules
- Execute lowest unblocked ID first inside the active phase.
- Do not start Phase 02 platform tasks until Phase 01 run ownership is durable.
- Do not start builder-heavy Phase 03 work until Phase 01 and core Phase 02 health checks are proven.

## Completed
- EXE-01
- EXE-02
- EXE-03
- EXE-04
- EXE-05
- EXE-06
- EXE-07
- EXE-08
- EXE-09
- EXE-10
- EXE-11
- EXE-12
- OPS-01
- OPS-02
- OPS-03
- OPS-04
- OPS-05
- OPS-06
- OPS-07
- OPS-08
- UX-01
- UX-02
- UX-03
- UX-06
- UX-07
- UX-08
- UX-04
- UX-05

## Closed With Mobile MCP Live Evidence
- OPS-08 is closed for the accepted pilot backend: Mobile MCP.
- Clean path evidence: `plans/reports/mobile-mcp-verify-2026-05-05T03-20-50-382Z.json` and `plans/reports/ui-mobile-mcp-smoke-db-2026-05-05T03-20-54-496Z.json`.
- Failure path evidence: `plans/reports/mobile-mcp-wait-devices-2026-05-05T03-22-05-453Z.json`.
- Laixi gateway proof is not covered by this closure. Track it separately if Laixi becomes the pilot backend.

## Now
- no open task remains inside this hard backlog after accepting Mobile MCP as the live validation backend

## Next
- normalize Specify/docs workflow, then decide pilot hardening scope

## Later
- The gateway-to-worker contract no longer drops artifact refs on the floor.
- Optional: run a separate Laixi gateway live proof if Laixi must be supported as a pilot backend.

## Unresolved Questions
- Should screenshots stay inline through pilot, or should we move directly to Supabase Storage before any larger run volume?
- Do we want structured `JSON_RESULT` artifacts for steps like `get_current_app`, or are screenshot plus text logs enough for the pilot scope?
- Is Laixi gateway proof still needed, or is Mobile MCP the only pilot device backend?

## Phase 01 Backlog

| ID | Task | Depends On | Acceptance |
|---|---|---|---|
| EXE-01 | Freeze canonical run state machine and execution ownership rules | none | Documented transitions for `PENDING`, `RUNNING`, `WAITING_APPROVAL`, `COMPLETED`, `FAILED`, `CANCELLED`, `PARTIAL_SUCCESS` with one execution owner only |
| EXE-02 | Decide backend execution location and bootstrap service skeleton | EXE-01 | Chosen runtime and folder layout committed, with worker start command and local config story |
| EXE-03 | Extract shared execution contract from current frontend/gateway command shapes | EXE-01 | One shared contract module defines command payloads, step result payloads, and gateway message version |
| EXE-04 | Change run start flow so frontend creates run and dispatches backend work only | EXE-02, EXE-03 | `useCreateRun` no longer calls in-browser execution directly |
| EXE-05 | Extend backend API path for start, cancel, and status-safe replay | EXE-04 | Backend API supports durable dispatch and cancel without relying on UI memory |
| EXE-06 | Add claim, lease, and idempotency rules for run execution | EXE-02, EXE-05 | Duplicate worker claims do not create duplicate step execution |
| EXE-07 | Port single-device execution path from browser runner to backend worker | EXE-03, EXE-06 | Single-device run completes entirely from backend-owned execution |
| EXE-08 | Move approval wait and resume logic to backend-owned polling loop | EXE-07 | Approval can be granted after page refresh or tab close and run still resumes |
| EXE-09 | Port multi-device execution path to backend worker | EXE-07, EXE-08 | Multi-device runs complete without browser ownership and write correct summary data |
| EXE-10 | Stand up first-class gateway session manager | EXE-03, EXE-07 | Gateway owns device sessions, heartbeats, and command dispatch with explicit error states |
| EXE-11 | Add durable artifact write path for screenshots and logs | EXE-07 | Screenshot and log evidence are persisted and visible after run completion |
| EXE-12 | Add end-to-end smoke coverage for start, cancel, approval, refresh, tab-close | EXE-09, EXE-10, EXE-11 | Repeatable smoke suite proves no run loss during UI disconnect |

## Phase 02 Backlog

| ID | Task | Depends On | Acceptance |
|---|---|---|---|
| OPS-01 | Define device lifecycle and freshness thresholds | EXE-10 | Product and platform share one definition for `ONLINE`, `OFFLINE`, `BUSY`, `ERROR`, stale heartbeat |
| OPS-02 | Persist gateway heartbeat freshness and last device error | EXE-10, OPS-01 | Device records expose freshness and last error fields usable by UI |
| OPS-03 | Replace instruction-only setup page with onboarding verification flow | OPS-01, OPS-02 | Operator can verify gateway reachability, permissions, and registration in one flow |
| OPS-04 | Add diagnostics panel for unreachable gateway, missing permissions, stale devices, and lock contention | OPS-02 | Common connectivity failures are visible with actionable explanations |
| OPS-05 | Add safe recovery actions for recheck, reconnect, and stale lock cleanup | OPS-04 | Operator can perform basic recovery without raw DB intervention |
| OPS-06 | Expose device lock state in device and run surfaces | EXE-06, OPS-04 | Operators can see why a device is blocked before launching a run |
| OPS-07 | Add fleet health metrics and operator dashboard counters | OPS-02 | UI shows counts for healthy, stale, busy, and error devices |
| OPS-08 | Validate onboarding against at least one clean-device path and one failure path | OPS-03, OPS-04 | Measured onboarding time and known-failure recovery steps are documented |

## Phase 03 Backlog

| ID | Task | Depends On | Acceptance |
|---|---|---|---|
| UX-01 | Add run preflight validation for inputs, targets, and sensitive steps | EXE-09, OPS-06 | Bad runs are blocked before dispatch with operator-readable reasons |
| UX-02 | Normalize step error payloads for UI display | EXE-07 | Common failures render human-readable reasons without raw JSON digging |
| UX-03 | Add artifact preview and retrieval flow in run detail | EXE-11 | Operators can preview screenshots and inspect stored evidence from UI |
| UX-04 | Build minimal macro builder for common steps | UX-01 | Common steps can be authored without raw JSON |
| UX-05 | Add macro templates for the top recurring workflows | UX-04 | Operators can start from reusable templates instead of blank JSON |
| UX-06 | Add role-aware UI action gating for run, approval, macro, and audit actions | EXE-05 | Viewer/operator/admin action differences are visible and enforced in UI |
| UX-07 | Improve approvals UX with clearer reason, risk, and outcome summary | EXE-08, UX-02 | Approval reviewers can decide without opening raw database fields |
| UX-08 | Improve audit log filtering and evidence linkage to runs and approvals | UX-03, UX-06 | Audit entries link cleanly to the relevant run, artifact, or approval context |

## Suggested First Sprint
- EXE-01
- EXE-02
- EXE-03
- EXE-04
- Write one architecture note that picks worker runtime and gateway ownership boundary

## Suggested Second Sprint
- EXE-05
- EXE-06
- EXE-07
- EXE-08
- Prove single-device durable execution under refresh and tab-close

## Suggested Third Sprint
- EXE-09
- EXE-10
- EXE-11
- EXE-12
- OPS-01
- OPS-02

## Unresolved Questions
- Will the backend worker live beside the frontend repo or as a separate service repo?
- Is Supabase Edge the control API only, or also part of the execution plane?
- Which artifact store is mandatory before pilot: Supabase Storage only, or pluggable object storage?
