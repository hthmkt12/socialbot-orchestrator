# UX-01: Run Preflight Validation For Inputs Targets And Sensitive Steps

Status: completed
Date: 2026-05-04
Purpose: stop obviously bad or unsafe run launches before dispatch, with operator-readable blocking reasons and warnings

## Decision
- Centralize launch validation in one shared helper so review UI and submit gating do not drift.
- Treat invalid inputs, target-contract mismatches, empty target resolution, unresolved template refs, and unapproved sensitive steps as blocking issues.
- Keep stale devices, partial lock contention, expired lock history, degraded lock visibility, and duplicate approval patterns as warnings instead of hard stops.
- Auto-align the wizard target mode to the selected macro contract so operators do not accidentally build an invalid launch config.

## What Changed
- Added `src/lib/run-preflight.ts` to build one preflight summary from macro definition, target selection, input values, lock state, and operator role.
- Updated `src/components/runs/RunWizard.tsx` to:
  - enforce the macro target contract in the target-step UI
  - show blocking issues and warnings in the review step
  - disable `Execute Run` when blocking issues exist
  - short-circuit submit on the same shared preflight result
- Fixed boolean input handling in the wizard so unchecked values resolve to the literal string `false` instead of being misread through JavaScript truthiness.

## Why This Matters
- Operators now see why a run cannot start before it reaches backend dispatch.
- Sensitive `adb` and `run_autox` macros are no longer launchable without visible approval gating.
- Target and lock safety messaging now uses one source of truth instead of several ad-hoc UI conditions.

## Limits Of This Step
- `OPS-08` still remains open because live onboarding validation needs a real Laixi-connected device and a verified failure path.
- Group launches still preserve group semantics at dispatch time; preflight explains contention but does not rewrite the backend group selector.
- Review logic is richer, but `RunWizard.tsx` is still a large component and may need modularization in a later cleanup pass.

## Acceptance For UX-01
- Run review shows operator-readable blocking issues and warnings before dispatch.
- Invalid required inputs, target mismatches, unresolved refs, and unsafe sensitive steps are blocked before run creation.
- `Execute Run` stays disabled while blocking issues exist.
- `npm.cmd run typecheck`
- `npm.cmd run build`
- `npm.cmd run build:gateway`
- `npm.cmd run build:worker`
- `npm.cmd run smoke:backend`

## Unresolved Questions
- Should target-mode selection become fully read-only once a macro is chosen, or do we still want to expose the disabled alternatives for discoverability?
- Do we want step-reference validation to understand deeper nested output paths beyond simple prior-step existence in a later pass?
