---
phase: 5
title: Safe Fleet Failure Policy
status: completed
priority: P2
dependencies:
  - 4
effort: 1d-2d
---

# Phase 5: Safe Fleet Failure Policy

## Overview

Make the Level 3 fleet policy from `specs/008-fleet-scale-failure-policy` enforceable and reviewable without claiming fleet speed SLA.

## Requirements

- Functional: default Level 3 target is 5 Android devices, dispatch excludes unsafe targets, policy is either `fail_fast` or `skip_failed_target`.
- Non-functional: sequential execution remains acceptable; no throughput/SLA promise.

## Architecture

Reuse existing execution profile policy, multi-target run context, target failure policy helper, and run summary UI. Add missing max-count and dispatchability checks at preflight/resolution boundaries.

## Related Code Files

- Modify: `src/lib/execution-profile-service.ts`
- Modify: `src/lib/execution-profile-service.test.ts`
- Modify: `src/pages/AdminExecutionProfilesPage.tsx`
- Modify: `src/lib/run-preflight-target-issues.ts`
- Modify: `src/lib/run-preflight.test.ts`
- Modify: `services/execution-worker/src/target-failure-policy.ts`
- Modify: `services/execution-worker/src/target-failure-policy.test.ts`
- Modify: `services/execution-worker/src/multi-target-run-context.ts`
- Modify: `services/execution-worker/src/multi-target-run-executor.ts`
- Modify: `src/components/runs/RunDetailSummaryView.tsx`
- Reference: `specs/008-fleet-scale-failure-policy/spec.md`

## Implementation Steps

1. Add or confirm max pilot target count policy with default 5.
2. Ensure preflight/resolution excludes offline, stale, locked, or incompatible devices.
3. Persist selected target failure policy in run context/summary.
4. Make `fail_fast` and `skip_failed_target` outcomes explicit in run summary.
5. Keep original failure details when continuing/skipping targets.
6. Add tests for max count, invalid policy, fail-fast stop, and skip-failed continuation.

## Success Criteria

- [x] Multi-target launch states target count and policy before dispatch.
- [x] Unsafe targets are excluded or block launch with concrete reason.
- [x] Run summary shows completed, failed, skipped, and original failure reason.
- [x] Invalid policy cannot be saved or executed.
- [x] No UI/docs copy claims fleet speed SLA.

## Completion Evidence

- Added bounded `execution_profiles.max_pilot_target_count` migration with default 5 and range 1..10.
- Admin execution profile service/UI now validates and displays max pilot target count.
- Run preflight blocks multi-target/device-group/all-devices launches above the configured/default pilot target count.
- Worker context validates configured target failure policy and fails before dispatch on invalid policy or target count overflow.
- Multi-target run summary persists target count, max pilot target count, failure policy, skipped count, and target failure decisions with original failure.
- Verification run:
  - `npm.cmd run typecheck`
  - `npx.cmd vitest run src/lib/execution-profile-service.test.ts src/lib/run-preflight.test.ts services/execution-worker/src/target-failure-policy.test.ts`
  - `npm.cmd run build:worker`

## Risk Assessment

Risk: policy behavior differs between UI preflight and worker runtime. Mitigation: worker remains authoritative; UI mirrors reasons for operator clarity.
