---
phase: 2
title: First Real Social Workflow
status: completed
priority: P1
dependencies:
  - 1
effort: 1d-2d
---

# Phase 2: First Real Social Workflow

## Overview

Implement the narrow Instagram pilot workflow from `specs/005-first-real-social-workflow`: select one account, one Android device, run an approved Mobile MCP macro, persist evidence, and record action history.

## Requirements

- Functional: operator can launch the approved workflow and inspect terminal status, artifact, and account action history.
- Non-functional: no follow/like/comment/post/message scope; no anti-bot guarantee; no Laixi/iOS path.

## Architecture

Reuse the existing Run Wizard, macro templates, run preflight, worker action-history writer, and Run Detail artifact display. Add only the minimum macro/template/scope guard needed to prove the first workflow.

## Related Code Files

- Modify: `src/contracts/social-engagement-templates.ts`
- Modify: `src/contracts/sample-macros.ts`
- Modify: `src/components/runs/RunWizard.tsx`
- Modify: `src/components/runs/RunWizardAccountStep.tsx`
- Modify: `src/lib/run-preflight-target-issues.ts`
- Modify: `src/lib/run-preflight.test.ts`
- Modify: `services/execution-worker/src/single-device-step-runner.ts`
- Modify: `services/execution-worker/src/single-device-step-runner.budget.test.ts`
- Reference: `specs/005-first-real-social-workflow/spec.md`

## Implementation Steps

1. Define or mark one approved Instagram pilot macro that only opens/navigates/captures evidence.
2. Ensure Run Wizard account/device preflight blocks blocked, over-budget, missing-credential-policy, offline, stale, locked, or non-Android targets.
3. Ensure worker writes `account_action_history` only after the approved action completes.
4. Make Run Detail show the action-history/evidence link clearly enough for review.
5. Add tests proving disallowed social actions are absent or blocked for this workflow.
6. Add a scripted/manual verification path that prints account id, device serial, run id, terminal status, artifact count, and action-history row count.

## Success Criteria

- [x] First social workflow is launchable by operator/admin only.
- [x] Workflow uses one selected Instagram pilot account and one Android device.
- [x] Action history is tied to the completed run/step.
- [x] Disallowed social actions remain out of scope for the approved pilot macro.
- [x] Viewer can inspect evidence read-only.

## Risk Assessment

Risk: product copy implies real platform safety. Mitigation: keep labels as pilot evidence only and block anti-bot/production claims in readiness review.

## Progress Notes

- 2026-07-08: Added approved `instagram_pilot_open_capture` starter macro that only launches Instagram, waits, checks current app, screenshots evidence, and records `instagram_pilot_open` history via `actionHistoryType`. Added preflight guard blocking like/follow/comment/post/message/share if that pilot macro is modified out of scope, plus account-platform guard for non-Instagram accounts.
- 2026-07-08: Added account action history schema migration for `instagram_pilot_open`, `source_run_id`, and `source_step_id`; updated worker and legacy runner to record pilot history without consuming budget counters. Local gates passed: lint, typecheck, unit tests, web build, worker build, gateway build.
- 2026-07-08: Phase remains in progress until the migration is applied to the target Supabase project and a real Instagram pilot account exists; current real verification reports 0 accounts, so launch/evidence read-only proof cannot be completed yet.
- 2026-07-08: Added `npm.cmd run verify:first-social-pilot` to seed/verify the approved pilot macro, pilot account, and `instagram_pilot_open` history schema. Current remote result is blocked at schema probe: `source_run_id` is missing from `account_action_history`, confirming `supabase/migrations/20260708000001_instagram_pilot_action_history.sql` has not been applied to the target project.
- 2026-07-08: Applied `20260708000001_instagram_pilot_action_history.sql` to Supabase project `gzwwqhgvrfsqokrxfhyu` and ran first social pilot proof successfully. `npm.cmd run verify:first-social-pilot` created run `e7bbb7b8-76bd-46e0-9cb3-6c8312e66e5e` on Android serial `97249fb5`; run completed with 4/4 successful steps, 1 screenshot artifact, and 1 `instagram_pilot_open` action-history row tied to `source_run_id` and `source_step_id=capture_pilot_evidence`.
