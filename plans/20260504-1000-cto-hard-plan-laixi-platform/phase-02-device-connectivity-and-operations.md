# Phase 02: Device Connectivity And Operations

## Context Links
- `src/pages/DevicesPage.tsx`
- `src/hooks/useDevices.ts`
- `src/pages/DeviceSetupPage.tsx`
- `src/stores/laixi.ts`
- `src/adapters/laixi/client.ts`
- `ops-01-device-lifecycle-and-freshness-thresholds.md`
- `ops-02-persist-gateway-heartbeat-freshness-and-last-device-error.md`
- `ops-03-onboarding-verification-flow.md`
- `ops-04-operator-diagnostics-for-connectivity-permissions-and-locks.md`
- `ops-05-safe-recovery-actions-for-recheck-reconnect-and-stale-lock-cleanup.md`
- `ops-06-device-lock-visibility-in-devices-and-run-preflight.md`
- `ops-07-fleet-health-metrics-and-operator-counters.md`
- `supabase/migrations/20260309165454_foundation_tables.sql`

## Overview
- Priority: P2
- Current status: in progress
- Brief description: make onboarding, status, and diagnostics reliable enough for real operators.

## Key Insights
- Device sync is manual and depends on a live browser connection to Laixi.
- The product exposes setup instructions, not a hardened onboarding workflow.
- Device state is visible in UI, but freshness and fault diagnosis are still thin.
- Shared lifecycle policy now exists in code: `15s` expected heartbeat, stale after `45s`, offline after `120s`.
- Gateway can now persist freshness and last-error fields into `devices` when service-role env is present.
- Device setup page now has live verification, diagnostics, real `device_locks` visibility, and safe first-line recovery actions.
- Device list and run preflight now expose lock state before launch, but broader fleet metrics and onboarding validation are still pending.
- Devices page now acts as the operator fleet-overview surface with first-class healthy/stale/busy/error/locked counters.

## Requirements
- Operators must be able to onboard a device without developer support.
- Online/offline/busy/error states must reflect real device health.
- Heartbeat staleness and reconnect failures must be visible and actionable.
- Device locks must be understandable during run contention.

## Architecture
- Let the gateway own active device session state and heartbeat timestamps.
- Treat Supabase as the system of record for registered devices and operational history.
- Add a health-check surface for gateway reachability, permissions, and agent readiness.
- Separate setup guidance from runtime diagnostics.

## Related Code Files
- Files to modify:
  - `src/pages/DevicesPage.tsx`
  - `src/pages/DeviceSetupPage.tsx`
  - `src/hooks/useDevices.ts`
  - `src/lib/device-setup-diagnostics.ts`
- Files to create:
  - none
- Files to delete:
  - none

## Implementation Steps
1. Define canonical device lifecycle and stale-heartbeat thresholds.
2. Add gateway-reported freshness and last-error fields.
3. Build onboarding checklist and connectivity verification flow.
4. Add diagnostics for permission gaps, unreachable gateway, and lock contention.
5. Add operator-facing recovery actions where safe.

## Todo List
- [x] Define device freshness rules
- [x] Persist gateway heartbeat and last error
- [x] Build onboarding verification UI
- [x] Build diagnostics and operator hints
- [x] Add safe recovery actions
- [x] Expose device lock state in device and run surfaces
- [x] Add operational metrics for device fleet health

## Success Criteria
- A new device is onboarded quickly and predictably.
- Operators can tell why a device is unavailable.
- False-positive online status becomes rare.
- Device lock issues are visible before runs silently fail.

## Risk Assessment
- Device state may remain noisy if gateway and DB timestamps drift.
- Android permission variance can create long-tail support burden.
- Over-automation in recovery actions may hide root causes.

## Security Considerations
- Avoid exposing sensitive gateway internals directly to lower-privilege users.
- Separate read-only diagnostics from privileged recovery actions.
- Keep audit trails for lock releases and operational overrides.

## Next Steps
- Validate the lifecycle model with real device disconnect and reconnect scenarios.
- Decide whether missing gateway Supabase env should remain a warning or become a hard startup failure before broader operator rollout.
- Validate stale-lock detection against one real contention case before broadening run launch permissions.
- Validate onboarding against one clean-device path and one failure path, now that diagnostics and recovery loops are visible in UI.
- See `ops-08-live-onboarding-validation-status.md` for the current local blocker state and the exact prerequisites still missing.
