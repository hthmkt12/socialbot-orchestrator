# Implementation Plan: Artifact Storage Thresholds

**Branch**: `003-artifact-storage-thresholds`<br>
**Spec**: `specs/003-artifact-storage-thresholds/spec.md`<br>
**Status**: Draft<br>
**Created**: 2026-05-06

## Summary

Document measurable artifact storage thresholds so inline artifact rows remain an explicit pilot decision and object storage has clear entry criteria. This feature is documentation/policy only and must not implement Supabase Storage.

## Technical Context

- Artifact normalizer: `src/lib/run-artifacts.ts`.
- Current inline UI preview ceiling: `MAX_INLINE_PREVIEW_BYTES = 512_000`.
- Artifact evidence UI: `src/components/runs/RunArtifactsPanel.tsx`, `RunArtifactPreviewCard.tsx`, and related section modules.
- Artifact tests: `src/lib/run-artifacts.test.ts`.
- Backend capability source of truth: `docs/backend-capability-matrix.md`.
- Roadmap storage entry: `docs/project-roadmap.md`.

## Constitution Check

- **Simplicity**: Document thresholds only; no storage service, bucket, migration, or signed URL work.
- **Surgical Scope**: Update only spec/docs unless a factual typo is discovered.
- **Testability**: Cite current `512_000` preview ceiling and run existing artifact tests.
- **Security**: No private env reads.
- **Pilot Alignment**: Mobile MCP remains pilot default; Laixi proof remains future-only until VIP/API access exists.

## Project Structure

```text
specs/003-artifact-storage-thresholds/
  spec.md
  plan.md
  tasks.md

docs/
  backend-capability-matrix.md
  codebase-summary.md
  project-roadmap.md
  project-changelog.md
```

## Phase 1: Policy Sync

Goal: make the artifact threshold policy durable.

Updates:
- Add numeric inline/object-storage thresholds to `docs/backend-capability-matrix.md`.
- Update `docs/project-roadmap.md` so the storage-threshold item is no longer unresolved.
- Update `docs/codebase-summary.md` with current threshold truth.
- Update `docs/project-changelog.md` with the policy decision.

## Phase 2: Verification

Goal: prove docs match current code and existing artifact behavior still passes.

Commands:
- `npm.cmd test -- src/lib/run-artifacts.test.ts`
- `npm.cmd test`
- `npm.cmd run typecheck`
- `npm.cmd run lint`
- `npm.cmd run build`

## Non-Goals

- No Supabase Storage bucket.
- No migration changing `artifacts` schema.
- No signed URL or external sharing implementation.
- No artifact upload/download service.
- No change to the 512,000-byte UI preview ceiling.

## Proposed Thresholds

- Inline preview payload ceiling: 512,000 bytes.
- Inline run artifact count: 10 artifacts or fewer.
- Inline screenshot count: 5 screenshots or fewer per run.
- Inline retention: 30 days or less.
- Authenticated-app-only access: required for inline-only storage.
- Object storage required before external sharing, long-retention audit packages, or high-volume screenshot runs.

## Risks

- Thresholds are policy defaults and may need adjustment after real pilot telemetry.
- Current artifact rows may already contain historical inline payloads; future object storage must preserve backwards readability.
- External sharing can require object storage even at low artifact volume.

## Open Questions

- Should future telemetry track artifact bytes per run automatically?
- Should retention policy be enforced in app code or handled operationally after pilot?
