# EXE-09: Backend Multi-Target Execution

Status: completed
Date: 2026-05-04
Purpose: move `MULTI_DEVICE` execution off the browser and close the same backend-ownership gap for group and all-device targets

## Decision
- Multi-target runs now execute from the backend worker instead of the browser.
- `MULTI_DEVICE`, `DEVICE_GROUP`, and `ALL_DEVICES` share one multi-target executor path in this phase.
- Device traversal is sequential inside one worker claim to keep approval-resume durable before introducing higher-concurrency scheduling.

## What Changed
- Added `multi-target-run-executor.ts` to execute backend-owned runs across multiple target devices and write aggregate summary data.
- Added `multi-target-run-context.ts` to resolve claimed run targets from `target_selector_json`, including group targets and persisted resolved device sets.
- Added `execute-owned-device-run.ts` so single-target and multi-target execution share the same per-device lock plus runner flow.
- `single-device-run-executor.ts` now reuses the shared per-device execution helper instead of owning lock logic inline.
- `run-claim-coordinator.ts` now claims `MULTI_DEVICE`, `DEVICE_GROUP`, and `ALL_DEVICES` runs in addition to `SINGLE_DEVICE`.
- Multi-target runs persist resolved device IDs into `summary_json.execution.resolvedDeviceIds` so approval resume keeps a stable target set after requeue.

## Why This Matters
- The UI no longer owns multi-target execution progress.
- Group and all-device runs stop being product surfaces that exist in the wizard but still depend on browser execution memory.
- This establishes one backend execution spine for every target mode before the later gateway-session phase.

## Limits Of This Step
- Multi-target traversal is sequential inside one claimed run, not fan-out parallel scheduling.
- Live Supabase plus Laixi smoke is still pending, so this is verified at source/build level only.
- The worker still talks directly to Laixi instead of a first-class gateway session manager.
- Offline filtering is resolved at target-loading time for non-persisted multi-target runs; richer operator visibility still belongs to later ops work.

## Acceptance For EXE-09
- `MULTI_DEVICE` runs complete from backend-owned execution and write summary data without browser ownership.
- `DEVICE_GROUP` and `ALL_DEVICES` use the same backend multi-target path.
- Approval waits during multi-target traversal release the claim and resume from persisted run state after approval.
- Claimed runs for every target mode are picked up by the worker claim loop.

## Unresolved Questions
- Do we want explicit per-device progress summary rows in `summary_json`, or is `run_steps` plus aggregate counters enough for pilot?
- When `EXE-10` starts, should multi-target scheduling become gateway-session-aware before introducing parallel per-device fan-out?
