---
description: 'Normalize pilot artifact metadata/display while keeping inline storage as pilot default'
scripts:
  sh: scripts/bash/update-agent-context.sh __AGENT__
  ps: scripts/powershell/update-agent-context.ps1 -AgentType __AGENT__
---

# Implementation Plan: Normalize Pilot Artifact Storage

**Branch**: `001-normalize-pilot-artifact` | **Date**: 2026-05-06 | **Spec**: `specs/001-normalize-pilot-artifact/spec.md`
**Input**: Feature specification from `specs/001-normalize-pilot-artifact/spec.md`

## Summary

Normalize how pilot artifacts are labeled, linked, previewed, and documented. Keep current artifact-row inline storage as the pilot default; defer Supabase Storage/object storage until higher screenshot volume, long retention, or external sharing needs.

## Technical Context

**Language/Version**: TypeScript + React 18 + Vite; Node worker TypeScript.<br>
**Primary Dependencies**: React Query/Supabase data reads, existing run artifact helpers/components.<br>
**Storage**: Existing Supabase `artifacts` rows queried by `workflow_run_id` (`src/hooks/run-query-helpers.ts:49-56`); inline metadata/previews remain pilot default.<br>
**Testing**: Vitest/unit tests plus full app gates: `npm.cmd test`, `npm.cmd run typecheck`, `npm.cmd run lint`, `npm.cmd run build`.<br>
**Target Platform**: Browser run-detail UI + execution worker artifact metadata docs.<br>
**Performance Goals**: No new remote fetch path; keep artifact grouping in-memory over current run artifacts (`src/components/runs/RunArtifactsPanel.tsx:21-69`).<br>
**Constraints**: No Supabase Storage migration; no schema/RLS changes; no execution-path change unless metadata display needs it; code files near 200 lines per `docs/code-standards.md:25-27`.<br>
**Scale/Scope**: Small pilot volume. Move to object storage before larger screenshot volume, long retention, or external sharing (`docs/backend-capability-matrix.md:31-35`).

## Current Code Facts

- Artifact query loads all artifacts for one run, ordered by creation time: `src/hooks/run-query-helpers.ts:49-56`.
- Normalization currently extracts `stepId`, `base64`, `text`, `timestamp`, `source`, and JSON payload from `metadata_json`: `src/lib/run-artifacts.ts:36-74`.
- Evidence grouping uses `device_id + stepId`; unlinked artifacts are surfaced when key missing or no matching step: `src/components/runs/RunArtifactsPanel.tsx:26-56`.
- Stats distinguish screenshots/logs/JSON by database `type`: `src/components/runs/RunArtifactsPanel.tsx:58-68` and render labels in `src/components/runs/run-artifacts-sections.tsx:34-63`.
- Preview card displays raw artifact type, source, storage key, timestamp, image/text/raw metadata fallback: `src/components/runs/RunArtifactPreviewCard.tsx:7-44`.
- Step evidence displays step id/status/type/device snippet plus artifact count: `src/components/runs/run-artifacts-evidence-sections.tsx:40-51`.
- Worker writes screenshot metadata inline with `stepId`, base64, timestamp: `services/execution-worker/src/worker-run-store.ts:193-213`.
- Worker writes log metadata inline with `stepId`, text, timestamp, caller metadata: `services/execution-worker/src/worker-run-store.ts:216-237`.
- Runner creates screenshot artifacts from backend screenshot payloads and logs from output/error/exception sources: `services/execution-worker/src/single-device-step-runner.ts:277-340`.
- Backend docs already declare artifact decision: inline screenshot/text-log rows now, Storage later: `docs/backend-capability-matrix.md:31-35`.

## Constitution Check

- **YAGNI**: PASS. No object storage, schema migration, or new artifact service.
- **KISS**: PASS. Extend existing normalization/rendering path only.
- **DRY**: PASS. Centralize labels/storage status in `src/lib/run-artifacts.ts`; UI consumes fields.
- **Compatibility**: PASS if old artifacts with missing metadata still render as unknown/unlinked with raw metadata fallback.
- **Security**: PASS if existing Supabase/RLS artifact reads remain unchanged; no service key exposure.

## Data Flow

1. Worker/device result enters `createScreenshotArtifact`/`createLogArtifact` as base64/text + run/device/step ids (`worker-run-store.ts:193-237`).
2. Artifact row exits worker into Supabase `artifacts` table with `workflow_run_id`, `device_id`, `type`, `storage_key`, `content_type`, `size`, `metadata_json`.
3. UI fetches artifacts by run id (`run-query-helpers.ts:49-56`).
4. UI transforms each row through `normalizeRunArtifact` (`run-artifacts.ts:36-74`) into display metadata: evidence type, source linkage, preview kind, preview availability, storage mode.
5. `RunArtifactsPanel` groups normalized artifacts by `device_id + stepId`, computes stats, and separates unlinked rows (`RunArtifactsPanel.tsx:21-69`).
6. Evidence sections/cards render operator labels, storage decision, linkage, and degraded states (`run-artifacts-evidence-sections.tsx:40-51`, `RunArtifactPreviewCard.tsx:7-44`).

## Project Structure

### Documentation (this feature)

```
specs/001-normalize-pilot-artifact/
├── spec.md
├── plan.md
└── tasks.md
```

### Source Code (implementation target, not changed by this plan task)

```
src/lib/run-artifacts.ts
src/components/runs/RunArtifactPreviewCard.tsx
src/components/runs/RunArtifactsPanel.tsx
src/components/runs/run-artifacts-evidence-sections.tsx
src/components/runs/run-artifacts-sections.tsx
docs/backend-capability-matrix.md
```

## Implementation Phases

### Phase 1: Normalize display metadata

**Depends on**: Current artifact helper (`src/lib/run-artifacts.ts:36-74`).
**Files owned**: `src/lib/run-artifacts.ts`, new/updated focused unit test file if added.
**Work**:
- Add derived evidence label: screenshot/log/JSON result/unknown from artifact `type`.
- Add source linkage status: linked when run id + device id + step id present; missing-step/missing-device when absent.
- Add storage mode text: `Inline pilot evidence`; external storage status: `Deferred`.
- Add preview availability reason for image/text/json/binary/missing inline payload.
**Risk**: Medium likelihood / medium impact if type mapping breaks existing cards. **Mitigation**: unit tests for SCREENSHOT, LOG_BLOB, JSON_RESULT, unknown/missing metadata.
**Rollback**: Revert helper fields/tests only; existing callers still use old fields.
**Success**: Normalized object exposes labels without changing artifact fetch or worker writes.

### Phase 2: Improve run evidence UI copy/degraded states

**Depends on**: Phase 1 fields.
**Files owned**: `src/components/runs/RunArtifactPreviewCard.tsx`, `src/components/runs/run-artifacts-evidence-sections.tsx`, maybe `src/components/runs/run-artifacts-sections.tsx` for stats copy.
**Work**:
- Card shows friendly evidence label instead of raw database type only.
- Card shows run/device/step/source/timestamp/storage-mode summary when available.
- Missing linkage/preview is explicit: no silent complete-looking artifact.
- Keep raw metadata fallback for diagnosis (`RunArtifactPreviewCard.tsx:40-44`).
**Risk**: Medium likelihood / low impact visual clutter. **Mitigation**: concise badges/rows, no new routes.
**Rollback**: Revert component-only changes; no data migration.
**Success**: Acceptance scenarios 1, 2, 4 visible in run detail.

### Phase 3: Documentation storage decision

**Depends on**: Phase 1/2 settled labels.
**Files owned**: `docs/backend-capability-matrix.md`; optional changelog/roadmap only if implementation changes product status.
**Work**:
- Expand `Artifact Decision` with explicit triggers: higher screenshot volume, long retention, external sharing.
- State inline artifact rows remain pilot default for small validation runs.
- State object storage is deferred; not blocker for current pilot.
**Risk**: Low likelihood / medium impact if docs overpromise thresholds. **Mitigation**: phrase as trigger conditions, not hard numeric SLA until product decides.
**Rollback**: Revert docs only.
**Success**: FR-004/FR-005 satisfied and consistent with existing matrix (`docs/backend-capability-matrix.md:31-35`).

### Phase 4: Validation and evidence

**Depends on**: Phases 1-3.
**Files owned**: test files + no overlapping UI/source ownership during same task.
**Work**:
- Run `npm.cmd test`.
- Run `npm.cmd run typecheck`.
- Run `npm.cmd run lint`.
- Run `npm.cmd run build`.
- Manual UI check: completed run evidence panel shows labels/linkage/storage note/degraded missing preview.
**Risk**: Medium likelihood / high impact if unrelated test baseline fails. **Mitigation**: capture exact failing command/output; do not mask failures.
**Rollback**: Revert implementation/docs task changes as one feature diff.
**Success**: Commands pass or documented pre-existing failures with repro; no code syntax/type errors.

## Backwards Compatibility

- Existing artifact rows remain readable because normalization tolerates non-record metadata (`src/lib/run-artifacts.ts:36-38`) and raw metadata fallback already exists (`RunArtifactPreviewCard.tsx:40-44`).
- Existing run query and RLS path unchanged (`src/hooks/run-query-helpers.ts:49-56`).
- Existing worker artifact inserts remain accepted; metadata enrichment, if any, must be additive (`worker-run-store.ts:207-212`, `worker-run-store.ts:231-236`).
- No schema migration; no object storage URLs required.

## Test Matrix

| Area | Unit | Integration/UI | E2E/Manual |
| --- | --- | --- | --- |
| Normalizer | type label, storage mode, preview availability, missing metadata | `RunArtifactsPanel` grouping consumes fields | Run detail with screenshot/log/json artifacts |
| Linkage | `buildRunArtifactStepKey` and missing device/step cases | unlinked artifacts visible | historical/incomplete artifact row shown clearly |
| Docs | n/a | docs mention pilot default + deferred storage triggers | maintainer can decide no Storage migration now |
| Regression | `npm.cmd test` | `npm.cmd run typecheck`, `npm.cmd run lint` | `npm.cmd run build` |

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
| --- | --- | --- |
| None | n/a | n/a |

## Task Planning Approach

- TDD first for `src/lib/run-artifacts.ts` normalization because it is small and central.
- Then component copy/render changes using derived fields.
- Then docs storage decision.
- Then full validation commands.
- Parallel work allowed only when file ownership does not overlap: docs task can run separate from UI only after Phase 1 field names are locked.

## Progress Tracking

**Phase Status**:

- [x] Phase 0: Current code facts collected
- [x] Phase 1: Design scoped
- [x] Phase 2: Tasks generated in `tasks.md`
- [x] Phase 3: Implementation complete
- [x] Phase 4: Automated validation passed

**Gate Status**:

- [x] Initial Constitution Check: PASS
- [x] All NEEDS CLARIFICATION resolved
- [x] Complexity deviations documented
- [x] Implementation validation commands passed

## Unresolved Questions

- No numeric screenshot-volume/retention threshold chosen yet; plan uses trigger conditions only.
