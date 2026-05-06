# OPS-07: Fleet Health Metrics And Operator Counters

Status: completed
Date: 2026-05-04
Purpose: give operators a simple fleet-overview surface that summarizes healthy, stale, busy, error, and locked device counts

## Decision
- Use `DevicesPage` as the practical operator dashboard because it is already the default authenticated route.
- Compute fleet metrics from the same shared lifecycle and lock helpers used elsewhere so counts do not drift from setup or run-launch surfaces.
- Keep total and offline counts as supporting context, while making `healthy`, `stale`, `busy`, `error`, and `locked` the primary counters.

## What Changed
- Added `src/lib/device-fleet-metrics.ts` to compute fleet counters from `devices` plus the current lock snapshot.
- Updated `src/pages/DevicesPage.tsx` to show top-of-page counters for:
  - healthy
  - stale
  - busy
  - error
  - locked
- Added supporting context text below the counters for total and offline device counts.
- Reused the shared lock snapshot from OPS-06 so the locked counter matches device-card and run-preflight lock visibility.

## Why This Matters
- Operators now get a quick answer to "is the fleet healthy enough to launch work?" without opening setup diagnostics or reading raw tables.
- The counters make stale-heartbeat drift and error-state growth visible at a glance.
- This lays the groundwork for broader pilot metrics without inventing a separate dashboard surface too early.

## Limits Of This Step
- Counters are UI-level summaries, not historical metrics or time-series telemetry.
- There is still no empirical onboarding success/failure measurement in the product yet.
- The operator dashboard is still the Devices route, not a dedicated analytics page.

## Acceptance For OPS-07
- UI shows healthy, stale, busy, error, and locked fleet counters.
- Counters follow the shared lifecycle policy and current device-lock snapshot.
- Typecheck, frontend build, gateway build, worker build, and backend smoke still pass after the change.

## Unresolved Questions
- Should the next fleet metrics surface stay on `DevicesPage`, or do we want a dedicated home/overview route before pilot?
- Do we want historical trend counters, or is point-in-time fleet health enough for pilot scope?
