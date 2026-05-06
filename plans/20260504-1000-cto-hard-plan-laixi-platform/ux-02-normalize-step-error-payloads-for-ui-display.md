# UX-02: Normalize Step Error Payloads For UI Display

Status: completed
Date: 2026-05-04
Purpose: make common run failures understandable from the product UI without forcing operators to inspect raw `error_json`

## Decision
- Keep structured error payloads as the source of truth, but add one UI-side normalization layer that converts codes into readable titles, details, and operator hints.
- Reuse the same error renderer across `RunDetailPage` and `RunMonitorPage` so failure copy does not drift between surfaces.
- Preserve access to the raw payload in expanded monitor view for debugging, while defaulting the main UI to human-readable summaries.

## What Changed
- Added `src/lib/run-step-errors.ts` to normalize step error payloads from known codes such as:
  - `STEP_TIMEOUT`
  - `STEP_EXCEPTION`
  - `STEP_FAILED`
  - `DEVICE_LOCKED`
  - `RUNNER_CRASH`
  - `APPROVAL_REJECTED`
- Added `src/components/runs/RunStepErrorPanel.tsx` as the shared UI for compact and expanded error rendering.
- Updated `src/pages/RunDetailPage.tsx` to show normalized failure summaries inline in the execution step list.
- Updated `src/pages/RunMonitorPage.tsx` to show the same compact summary in collapsed step rows and a richer expanded panel with hints plus raw payload.

## Why This Matters
- Operators can now triage common failures from UI copy instead of reading raw JSON blobs.
- Approval rejection, lock contention, timeout, worker crash, and adapter failures now point to the next operational action directly.
- The product keeps technical depth available for debugging without making raw payloads the default operator experience.

## Limits Of This Step
- This is UI normalization only; backend error codes and payload structure are still lightweight and could be enriched further later.
- Artifact previews are still limited, so operators may still need `UX-03` for richer screenshot/log evidence around a failure.
- Older or custom error shapes outside the known structured pattern fall back to generic display.

## Acceptance For UX-02
- Run detail no longer relies on raw JSON as the primary failure message.
- Run monitor shows normalized failure summaries in collapsed and expanded step views.
- Raw payload remains available in expanded monitor mode for debugging.
- `npm.cmd run typecheck`
- `npm.cmd run build`
- `npm.cmd run build:gateway`
- `npm.cmd run build:worker`
- `npm.cmd run smoke:backend`

## Unresolved Questions
- Do we want a stricter shared error-code contract between worker, gateway, and UI before pilot?
- Should failure hints also appear in approvals and audit surfaces once those pages get their role-aware pass?
