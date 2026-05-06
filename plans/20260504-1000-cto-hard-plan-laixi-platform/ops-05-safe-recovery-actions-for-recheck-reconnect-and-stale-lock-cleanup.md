# OPS-05: Safe Recovery Actions For Recheck, Reconnect, And Stale-Lock Cleanup

Status: completed
Date: 2026-05-04
Purpose: let operators perform first-line recovery inside the verification flow instead of falling back to raw database cleanup or guesswork

## Decision
- Keep recovery actions inside `DeviceSetupPage` `Verify` so diagnostics and remediation stay on the same operational surface.
- Only automate actions that are safe from the browser:
  - full verification recheck
  - reconnect preparation by copying the current AutoJS bootstrap
  - cleanup of expired `device_locks` only
- Do not auto-clear active locks or hide RLS failures; those remain explicit operator signals.

## What Changed
- Extended `src/pages/DeviceSetupPage.tsx` with a new `Recovery actions` panel in the Verify tab.
- Added three operator actions:
  - `Recheck now` reruns gateway, worker, devices, and lock queries
  - `Copy script + open guide` prepares a selected-device reconnect using the current gateway websocket bootstrap
  - `Clear expired locks` deletes only `device_locks` rows whose `expires_at` is already in the past
- Added toast feedback for reconnect prep, lock cleanup success, empty cleanup, and permission failures.
- Cleared probe result state when the selected device changes so probe evidence is not silently carried onto another device.
- Updated expired-lock diagnostics to point operators to the new cleanup action instead of telling them to use raw operational workarounds.

## Why This Matters
- Operators now have a low-risk path to recover from common onboarding failures without switching tools.
- Expired lock cleanup is visible and constrained, which reduces the chance of broad manual deletion when the real problem is just abandoned stale leases.
- Reconnect guidance now uses the current gateway websocket URL instead of forcing the operator to manually rebuild or guess the agent bootstrap.

## Limits Of This Step
- Reconnect is still guided, not remote-controlled; the operator must rerun the agent on the Android device.
- Active locks are intentionally not cleared from this UI because they may belong to a real in-flight run.
- Cleanup depends on current authenticated role and existing `device_locks` RLS policies.

## Acceptance For OPS-05
- Verify tab exposes safe recovery actions for recheck, reconnect prep, and expired-lock cleanup.
- Cleanup is blocked for unauthenticated or read-only users and does not touch active leases.
- Typecheck, frontend build, gateway build, worker build, and backend smoke still pass after the change.

## Unresolved Questions
- Should stale-lock cleanup write an explicit audit log entry before broader operator rollout?
- Do we want a gateway-side reconnect helper endpoint later, or is guided bootstrap copy enough for pilot scope?
