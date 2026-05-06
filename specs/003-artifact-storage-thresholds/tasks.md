# Tasks: Artifact Storage Thresholds

**Input**: `specs/003-artifact-storage-thresholds/spec.md` and `plan.md`<br>
**Branch**: `003-artifact-storage-thresholds`<br>
**Status**: Draft

## Phase 1: Setup & Fact Check

- [x] T001 Confirm branch is `003-artifact-storage-thresholds` and worktree starts clean.
- [x] T002 Verify current inline UI preview ceiling in `src/lib/run-artifacts.ts` is `512_000` bytes.
- [x] T003 Verify existing artifact normalization tests cover oversized preview omission.

## Phase 2: Policy Docs

- [x] T004 Update `docs/backend-capability-matrix.md` with numeric artifact thresholds and object-storage triggers.
- [x] T005 Update `docs/codebase-summary.md` with current storage threshold truth.
- [x] T006 Update `docs/project-roadmap.md` to mark artifact threshold decision made and identify future storage implementation as conditional.
- [x] T007 Update `docs/project-changelog.md` with the threshold policy decision.

## Phase 3: Verification

- [x] T008 Run `npm.cmd test -- src/lib/run-artifacts.test.ts`.
- [x] T009 Run `npm.cmd test`.
- [x] T010 Run `npm.cmd run typecheck`.
- [x] T011 Run `npm.cmd run lint`.
- [x] T012 Run `npm.cmd run build`.

## Phase 4: Finish

- [x] T013 Review diff for accidental object-storage implementation.
- [ ] T014 Commit only intended spec/docs changes after forbidden-path and sensitive-value checks pass.
- [ ] T015 Merge completed branch to `master` after verification passes.

## Notes

- Do not implement object storage in this feature.
- Do not change `MAX_INLINE_PREVIEW_BYTES` unless a separate implementation feature explicitly requires it.
- Keep thresholds easy to revise after real pilot telemetry.
