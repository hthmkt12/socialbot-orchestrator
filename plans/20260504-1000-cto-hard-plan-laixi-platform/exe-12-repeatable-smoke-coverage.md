# EXE-12: Repeatable Smoke Coverage

Status: completed
Date: 2026-05-04
Purpose: add a repeatable backend smoke suite that proves core run-control and approval-resume resilience without depending on browser state

## Decision
- Smoke coverage is implemented as an in-memory backend harness under `services/execution-worker`.
- The control-plane `start` and `cancel` logic now lives in a shared helper so the edge function and smoke suite exercise the same behavior.
- UI disconnect is modeled by recreating worker-side execution state between approval wait and resume instead of relying on a live browser tab.

## What Changed
- Added `packages/shared/src/workflow-run-control.ts` and exported it through `packages/shared/src/index.ts`.
- `supabase/functions/execute-run/index.ts` now delegates to the shared run-control helpers through a small Supabase adapter.
- `supabase/functions/execute-run/control-state.ts` now re-exports the shared helper module to avoid drift.
- Added `services/execution-worker/src/smoke/in-memory-backend-db.ts` as the in-memory store and fake Supabase query layer used by the smoke harness.
- Added `services/execution-worker/src/smoke/run-resilience-smoke.ts` with repeatable scenarios for:
  - start request queues a pending run
  - cancel request cleans active step, approval, and lock state
  - approval resume completes after a fresh runner instance reclaims persisted state
- Added command entrypoints:
  - root: `npm run smoke:backend`
  - worker: `npm run smoke`

## Why This Matters
- The repo now has a real command that replays the core durability paths instead of relying on source inspection alone.
- Control-plane replay semantics are less likely to drift because the smoke suite exercises the shared helper directly.
- Approval resume is now proven against persisted `run_steps` with a fresh execution instance, which is the key backend-side substitute for refresh/tab-close browser loss.

## Limits Of This Step
- The smoke suite is in-memory and does not prove live Supabase, live gateway, or real-device behavior.
- Multi-target fan-out is still not covered here.
- This suite validates backend ownership semantics, not frontend rendering or browser UX.

## Acceptance For EXE-12
- There is one repeatable command that runs the smoke suite.
- Start, cancel, and approval-resume paths fail the command if they regress.
- The approval-resume scenario recreates execution state between wait and resume, modeling browser disconnect.
- The edge function and smoke suite share the same control-plane start/cancel logic.

## Unresolved Questions
- Should the next smoke layer target live Supabase plus a fake gateway HTTP server, or jump directly to a real device path?
- Do we want multi-target partial-success coverage in this same suite, or as a separate EXE/OPS hardening step?
