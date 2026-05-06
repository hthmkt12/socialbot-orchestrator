# OPS-03: Onboarding Verification Flow

Status: completed
Date: 2026-05-04
Purpose: replace the instruction-only setup page with an operator-facing verification flow that proves gateway, worker, device registration, heartbeat freshness, and permission-critical probes

## Decision
- `DeviceSetupPage` now starts on a live `Verify` tab instead of an instruction-only guide.
- The browser is allowed to call gateway and worker health endpoints directly for operator verification.
- Live onboarding probes use the existing gateway `POST /dispatch-step` path with device-level commands instead of a fake checklist.

## What Changed
- Rebuilt `src/pages/DeviceSetupPage.tsx` around four tabs: `Verify`, `Guide`, `Protocol`, and `Troubleshoot`.
- Added `src/lib/device-setup.ts` for:
  - endpoint normalization
  - websocket URL derivation for the agent script
  - live gateway and worker health fetches
  - current-app and screenshot probes
  - generated AutoJS bootstrap script and protocol example
- Added browser-consumable CORS headers plus `OPTIONS` handling in:
  - `services/laixi-gateway/src/index.ts`
  - `services/execution-worker/src/index.ts`
- The new Verify tab now checks:
  - gateway reachability
  - worker reachability
  - gateway health persistence enabled/disabled
  - device registration count from Supabase
  - fresh vs stale heartbeat availability
  - live current-app probe
  - live screenshot probe
- The page now lets the operator pick a registered device and run real probes through the gateway, including a screenshot permission path that returns a preview when successful.

## Why This Matters
- Setup no longer depends on the operator mentally translating docs into runtime truth.
- The same page now answers the most important onboarding questions: "Is the control plane reachable?", "Is the device really registered and fresh?", and "Can it actually execute a live command plus capture a screenshot?"
- CORS support makes the browser UI capable of talking to gateway and worker runtime surfaces directly in local ops setups.

## Limits Of This Step
- Screenshot and current-app probes bypass `workflow_runs`; they are onboarding checks, not audited production runs.
- HTTPS-hosted app origins can still hit browser mixed-content limits if the gateway or worker stays on plain HTTP.
- Android permission verification is still indirect: screenshot probe proves the current path works, but does not enumerate every OEM-specific permission state.

## Acceptance For OPS-03
- Device setup page is no longer instruction-only.
- Operator can verify gateway reachability, worker reachability, registration, heartbeat freshness, and at least one live device command path in one place.
- Screenshot probe gives a real signal for screen-capture readiness.
- Frontend and backend build gates plus backend smoke still pass.

## Unresolved Questions
- Should onboarding probes eventually create audited lightweight `workflow_runs`, or remain explicitly outside the run ledger?
- Do we want to proxy gateway and worker health through the main app origin to avoid mixed-content and direct-port assumptions before broader deployment?
