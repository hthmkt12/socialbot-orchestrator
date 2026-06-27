---
title: "Phase 02 Complete Artifact-Bearing Run Detail Smoke"
status: blocked
priority: P1
created: 2026-05-06
---

# Phase 02: Complete Artifact-Bearing Run Detail Smoke

## Context Links

- Deferred smoke gap: `docs/codebase-summary.md` Known Risks and `docs/project-changelog.md` Unresolved Questions.
- Artifact UI normalization: `src/lib/run-artifacts.ts:7`, `src/lib/run-artifacts.ts:84-104`, `src/lib/run-artifacts.ts:127-173`.
- Artifact policy: `docs/backend-capability-matrix.md:33-55`.
- UI smoke script: `package.json:39`.
- Run Detail evidence surface: `src/pages/RunDetailPage.tsx`, `src/components/runs/RunArtifactsPanel.tsx`, `src/components/runs/run-artifacts-sections.tsx`.

## Overview

Priority: P1. Produce one fresh completed Mobile MCP run with artifact rows, then verify the user-facing Run Detail evidence UI. If fresh run generation is blocked by device availability, a prior artifact-bearing completed run can still be inspected when authenticated UI/Supabase access and that run remain available.

## Requirements

- Use existing Mobile MCP runtime from Phase 01 for fresh run generation.
- Create a fresh authenticated completed run that includes at least one screenshot artifact when device/runtime are ready.
- Reuse a prior authenticated completed run only for manual Run Detail inspection if fresh run generation is blocked.
- Verify artifact evidence labels, linkage, preview availability, and storage status in UI.
- Capture run ID and evidence report path.
- Do not change artifact storage architecture.

## Related Files

- Read only: `src/lib/run-artifacts.ts`.
- Read only: `src/components/runs/RunArtifactsPanel.tsx`.
- Read only: `scripts/smoke-mobile-mcp-ui-run.mjs`.
- Evidence output: `plans/reports/ui-mobile-mcp-smoke-db-*.json`.
- No source code changes expected unless smoke reveals a bug.

## Implementation Steps

- [ ] **Step 1: Confirm Phase 01 gates passed**

  Required evidence before continuing:

  ```text
  preflight ok: true
  verify ok: true
  runtime bridge: up
  worker: up
  ui: up
  adb expected serial: online
  ```

  Expected: all true. If any false, return to Phase 01.

- [ ] **Step 2: Run DB-backed UI smoke**

  Run:

  ```powershell
  npm.cmd run smoke:mobile-mcp:ui
  ```

  Expected: exit code 0 and report like:

  ```json
  {
    "ok": true,
    "runId": "<uuid>",
    "status": "COMPLETED",
    "stepCount": 4,
    "screenshotCount": 1
  }
  ```

  Save the `runId` and report path.

- [ ] **Step 3: If UI smoke fails, classify the failure before changing code**

  Classify into one bucket:

  ```text
  env/auth missing
  runtime down
  device offline
  Supabase DB/RLS issue
  worker queue/claim issue
  artifact creation issue
  UI navigation/render issue
  ```

  Expected: a concrete bucket. If it is operational/env/device, do not modify code. If it is a real code bug, stop and create a separate bug-fix plan after checking `docs/common-issues.md`.

- [ ] **Step 4: Open Run Detail for the completed run**

  In browser:

  ```text
  http://127.0.0.1:5173/runs/<runId>
  ```

  Expected: authenticated user can access Run Detail page for the completed run.

- [ ] **Step 5: Manually verify artifact evidence UI**

  Check these UI facts:

  ```text
  [ ] Artifact section is visible.
  [ ] Screenshot artifact has friendly screenshot label.
  [ ] Artifact is linked to run/device/step when linkage data exists.
  [ ] Inline preview availability/status is shown.
  [ ] Storage status reflects pilot inline/metadata policy.
  [ ] No misleading external storage/download promise appears.
  [ ] Unlinked/degraded artifact messaging appears only when applicable.
  ```

  Expected: all applicable checks pass. Record any deviation with screenshot/manual note.

- [ ] **Step 6: Optional focused regression check**

  Run only if artifact UI/source changed due a discovered bug:

  ```powershell
  npm.cmd test -- src/lib/run-artifacts.test.ts
  npm.cmd run typecheck
  npm.cmd run lint
  npm.cmd run build
  ```

  Expected: all pass. If no code changed, this step can be skipped because the pre-plan static gates already passed live on 2026-05-06.

- [ ] **Step 7: Record smoke evidence**

  Capture:

  ```text
  ui smoke report: <plans/reports/ui-mobile-mcp-smoke-db-...json>
  run id: <uuid>
  screenshot count: <number>
  manual Run Detail result: pass/fail
  operator account: <non-secret email only if already printed by scripts>
  ```

## Success Criteria

- `npm.cmd run smoke:mobile-mcp:ui` passes.
- Completed run has at least one screenshot artifact.
- Run Detail evidence UI passes manual checklist.

## Execution Result

- Fresh run generation is blocked before Step 1 because Phase 01 did not pass.
- Current evidence: `plans/reports/mobile-mcp-wait-devices-2026-05-06T10-58-27-212Z.json` reports expected serial `QC4DKJUO6PW4FMQW` missing from ADB and bridge checks.
- `npm.cmd run smoke:mobile-mcp:ui` was not run because it depends on bridge, worker, UI, Supabase login, and an online Android device.
- Manual Run Detail inspection of the prior artifact-bearing run `f2bc8499-5475-4c86-ae82-55ac0c17c274` remains a separate possible follow-up if UI/auth/Supabase access is available and the run still exists.

## Risks

- Authenticated UI session unavailable.
- Smoke run completes but artifact row missing.
- Browser route requires login state not present in current profile.

## Unresolved Questions

- Which run ID should become canonical evidence for future demos?
