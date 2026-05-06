# Tasks: Normalize Pilot Artifact Storage

**Input**: `specs/001-normalize-pilot-artifact/spec.md`, `specs/001-normalize-pilot-artifact/plan.md`
**Scope**: Minimal UI metadata/display + docs/tests. Inline artifact rows remain pilot default. Supabase Storage/object storage deferred.

## Dependencies

1. T001-T003 lock normalizer behavior before UI uses new fields.
2. T004-T007 depend on Phase 1 field names from `src/lib/run-artifacts.ts`.
3. T008 docs can run after T001 names are stable; no code dependency after that.
4. T009-T012 validation run last.

## File Ownership

- Normalizer/test owner: `src/lib/run-artifacts.ts`, `src/lib/run-artifacts.test.ts` if created.
- UI owner: `src/components/runs/RunArtifactPreviewCard.tsx`, `src/components/runs/run-artifacts-evidence-sections.tsx`, `src/components/runs/run-artifacts-sections.tsx`, `src/components/runs/RunArtifactsPanel.tsx` if needed.
- Docs owner: `docs/backend-capability-matrix.md`.
- No task edits Supabase migrations, `.env`, or storage config.

## Phase 1: Normalize display metadata

- [x] **T001 Add/extend normalizer unit tests**
  - File: create `src/lib/run-artifacts.test.ts` or extend nearest existing test pattern.
  - Cover current facts from `src/lib/run-artifacts.ts:36-74`:
    - SCREENSHOT + base64 -> friendly label `Screenshot`, preview kind image, inline pilot storage note.
    - LOG_BLOB + text/source -> friendly label `Log`, preview kind text.
    - JSON_RESULT + payload/json -> friendly label `JSON result`, preview kind json.
    - missing `stepId` or `device_id` -> linkage warning state.
    - missing preview payload -> degraded preview availability reason.
  - Expected: tests fail before implementation.

- [x] **T002 Extend `RunArtifactPreview` fields**
  - File: `src/lib/run-artifacts.ts:5-14`.
  - Add derived fields only, no schema change: evidence label/kind, linkage status/message, storage mode label, preview availability label.
  - Keep old fields (`artifact`, `stepId`, `timestamp`, `source`, `imageSrc`, `previewText`, `previewKind`, `rawMetadata`) for compatibility.

- [x] **T003 Implement mappings in `normalizeRunArtifact`**
  - File: `src/lib/run-artifacts.ts:36-74`.
  - Map `artifact.type` values from worker inserts (`services/execution-worker/src/worker-run-store.ts:21-29`) to operator labels.
  - Preserve existing inline preview construction for screenshot/text/json (`src/lib/run-artifacts.ts:49-63`).
  - Add explicit storage decision text: inline pilot evidence; object storage deferred.
  - Run: `npm.cmd test -- src/lib/run-artifacts.test.ts` if focused path supported, else `npm.cmd test`.

## Phase 2: Improve UI display and degraded states

- [x] **T004 Update artifact preview card labels**
  - File: `src/components/runs/RunArtifactPreviewCard.tsx:7-24`.
  - Show friendly evidence label alongside raw database type if useful.
  - Show source step/device/storage mode/created time when available.
  - Do not fetch external data; use normalized artifact fields only.

- [x] **T005 Make missing preview/linkage visible**
  - File: `src/components/runs/RunArtifactPreviewCard.tsx:26-44`.
  - For no `imageSrc` and no `previewText`, show clear message before raw metadata fallback.
  - For missing step/device linkage, show warning badge/message; do not hide artifact.

- [x] **T006 Keep step evidence grouping and unlinked section clear**
  - File: `src/components/runs/run-artifacts-evidence-sections.tsx:40-75`.
  - Ensure step sections still show step id/status/type/device/artifact count.
  - Keep unlinked copy consistent with grouping by `device_id + stepId` (`src/components/runs/RunArtifactsPanel.tsx:31-56`).

- [x] **T007 Verify stats still distinguish artifact classes**
  - Files: `src/components/runs/RunArtifactsPanel.tsx:58-68`, `src/components/runs/run-artifacts-sections.tsx:34-63`.
  - Keep screenshots/logs/JSON counts.
  - If unknown type count is added, keep it additive and concise.

## Phase 3: Documentation storage decision

- [x] **T008 Expand artifact decision docs**
  - File: `docs/backend-capability-matrix.md:31-35`.
  - State current pilot default: screenshot/text-log/JSON previews stay in `artifacts` rows with inline metadata/previews.
  - State object storage deferred until higher screenshot volume, longer retention, or external sharing.
  - Avoid numeric thresholds unless product supplies them.

## Phase 4: Validation

- [x] **T009 Run unit test suite**
  - Command: `npm.cmd test`.
  - Success: all tests pass; no snapshot/golden updates unless intentional.

- [x] **T010 Run typecheck**
  - Command: `npm.cmd run typecheck`.
  - Success: no TypeScript errors from new preview fields/component props.

- [x] **T011 Run lint**
  - Command: `npm.cmd run lint`.
  - Success: no new lint errors.

- [x] **T012 Run production build**
  - Command: `npm.cmd run build`.
  - Success: Vite build completes.

- [ ] **T013 Manual run-detail smoke**
  - Open an existing completed run with artifacts.
  - Confirm each artifact shows evidence type, step/device/source context when available, created/storage note, preview or missing-preview warning.
  - Confirm unlinked artifacts remain visible.
  - Status: deferred until a running UI session with Supabase auth and a completed artifact-bearing run is available.

## Risks & Mitigations

- **Risk**: Historical artifacts lack `stepId` or inline preview. **Mitigation**: T001 covers missing metadata; T005 shows degraded state.
- **Risk**: UI overstates Storage readiness. **Mitigation**: T008 states Storage deferred, trigger conditions only.
- **Risk**: Object storage scope creep. **Mitigation**: No tasks touch migrations/storage/env; inline remains default.
- **Risk**: Multi-device same step id confusion. **Mitigation**: preserve `device_id + stepId` key from `src/lib/run-artifacts.ts:32-34` and `RunArtifactsPanel.tsx:31-56`.

## Rollback

- Revert `src/lib/run-artifacts.ts` + its test to remove derived fields.
- Revert UI files to old labels/fallback display.
- Revert `docs/backend-capability-matrix.md` wording.
- No DB cleanup required because no schema/data migration.

## Success Criteria

- Artifact card labels distinguish screenshot/log/JSON/unknown without raw payload inspection.
- Run/device/step linkage shown when available; missing linkage shown explicitly.
- Inline pilot evidence is labeled as current default; object storage deferred.
- `npm.cmd test`, `npm.cmd run typecheck`, `npm.cmd run lint`, `npm.cmd run build` pass.

## Unresolved Questions

- Exact numeric threshold for screenshot volume/retention before object storage remains undefined.
