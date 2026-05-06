# OPS-04: Operator Diagnostics For Connectivity, Permissions, And Locks

Status: completed
Date: 2026-05-04
Purpose: expose actionable operator diagnostics for unreachable runtimes, stale devices, permission-critical probe failures, and run lock contention inside the onboarding verification flow

## Decision
- Keep diagnostics inside `DeviceSetupPage` `Verify` instead of creating a separate ops surface.
- Use real runtime and persistence signals only: gateway `/health`, worker `/health`, Supabase `devices`, Supabase `device_locks`, and live setup probes.
- Show lock contention in the same page where the operator decides whether a device is safe to trust.

## What Changed
- Added `src/lib/device-setup-diagnostics.ts` to:
  - summarize active vs expired `device_locks`
  - derive severity-ranked diagnostics from runtime health, device freshness, probe failures, and lock rows
- Extended `src/pages/DeviceSetupPage.tsx` verification snapshot to include:
  - `device_locks` query results
  - lock-query failure state
  - a new operator diagnostics panel with actionable remediation text
- The Verify tab now shows:
  - active lock count
  - expired lock count
  - derived diagnostics count
  - severity-card explanations for gateway failure, worker failure, persistence disabled, no runnable devices, device errors, probe failures, and lock contention
- Selected device summary now includes lock state with `workflow_run_id` and `expires_at` when a visible lock exists.

## Why This Matters
- Operators can now tell whether a device is blocked by transport, freshness drift, permission gaps, or an active run lease before attempting execution.
- Lock contention is no longer hidden behind silent dispatch refusal or database inspection.
- The onboarding surface now behaves more like a real operational console and less like a checklist with ambiguous failure states.

## Limits Of This Step
- Diagnostics are read-only; operators still cannot clear stale locks or force reconnects from the UI yet.
- Lock interpretation depends on `device_locks` visibility through Supabase access and current lease timestamps.
- Screenshot permission diagnosis remains indirect: the page knows the probe failed, not the OEM-specific permission screen that caused it.

## Acceptance For OPS-04
- Common onboarding failures are rendered with actionable explanations in the Verify tab.
- `device_locks` are fetched and reflected in diagnostics plus selected-device summary.
- Typecheck, frontend build, gateway build, worker build, and backend smoke still pass after the change.

## Unresolved Questions
- Should active locks become a hard preflight block for run launch in the main operator flow, or stay advisory until OPS-06 is complete?
- Do we want stale-lock cleanup guarded by role or by explicit approval once OPS-05 lands?
