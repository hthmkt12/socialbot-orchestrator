# OPS-06: Device Lock Visibility In Devices And Run Preflight

Status: completed
Date: 2026-05-04
Purpose: expose lock contention directly in device surfaces and run launch preflight so operators can understand blocked devices before dispatch

## Decision
- Keep `device_locks` visibility in the same operator surfaces already used for device inspection and run launch.
- Use one shared lock snapshot helper so device cards, drawers, setup diagnostics, and run preflight all read contention the same way.
- For explicit run targets, preflight should only dispatch to runnable and unlocked devices; for group targets, keep group semantics but warn about lock contention before launch.

## What Changed
- Added `src/lib/device-locks.ts` for:
  - active vs expired lock classification
  - per-device lock lookup
  - reusable lock descriptions and timestamps
- Added `src/components/devices/DeviceLockBadge.tsx` for a shared `Locked` / `Expired lock` badge.
- Extended `src/hooks/useDevices.ts` with `useDeviceLocks()`.
- Updated `src/pages/DevicesPage.tsx` to show:
  - locked device count in the fleet stats row
  - lock badges and lock detail text on device cards
  - lock state, run id, and expiry detail in the device drawer
  - a banner when lock visibility fails
- Updated `src/components/runs/RunWizard.tsx` to show:
  - lock badges and lock detail during target selection
  - dispatch-ready count plus locked-target count in review
  - warnings when targets are locked or only partly dispatchable
  - a hard block when every runnable target device is currently locked
  - explicit-target dispatch narrowed to runnable, unlocked devices only

## Why This Matters
- Operators no longer have to infer contention from a later execution failure or inspect the database manually.
- The device list now doubles as a fast "can I use this device now?" surface.
- Run launch now has a real preflight concept for lock contention, not just online/offline status.

## Limits Of This Step
- Group launches still preserve group semantics, so locked devices inside a group are warned about rather than removed from the group target.
- Preflight depends on current `device_locks` query success; when that query fails, lock safety messaging degrades visibly but cannot guarantee contention awareness.
- This step does not yet add fleet dashboard counters or empirical onboarding validation.

## Acceptance For OPS-06
- Operators can see lock state in device list and device detail.
- Run launch surfaces show lock contention before dispatch and block the all-locked case.
- Typecheck, frontend build, gateway build, worker build, and backend smoke still pass after the change.

## Unresolved Questions
- Should group launches eventually resolve to an explicit unlocked device set at submit time, or keep pure group semantics plus warnings?
- Do we want lock ownership deep-links from badges into run detail once operator evidence UX is improved?
