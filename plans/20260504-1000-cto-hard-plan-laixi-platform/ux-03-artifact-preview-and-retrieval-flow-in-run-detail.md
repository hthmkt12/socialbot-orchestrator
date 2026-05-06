# UX-03: Artifact Preview And Retrieval Flow In Run Detail

Status: completed
Date: 2026-05-04
Purpose: make stored screenshots and logs inspectable from run detail as step-linked operational evidence

## Decision
- Reuse the existing artifact rows written by the worker instead of inventing a separate evidence model.
- Group artifacts by `device_id + stepId` so operators can inspect evidence in the same mental model as the execution timeline.
- Keep the UI ready for `JSON_RESULT`, but optimize immediately for the artifact types that exist today: `SCREENSHOT` and `LOG_BLOB`.

## What Changed
- Added `src/lib/run-artifacts.ts` to normalize stored artifact metadata into preview-ready UI objects.
- Added `src/components/runs/RunArtifactsPanel.tsx` to render:
  - artifact summary counters
  - evidence grouped by step and device
  - screenshot preview
  - log/text preview
  - fallback raw metadata view for unrecognized payloads
  - unlinked artifact section when a stored artifact does not match a current step row
- Updated `src/pages/RunDetailPage.tsx` to:
  - show artifact counts inline on each step row
  - replace the flat artifact gallery with the grouped evidence panel

## Why This Matters
- Operators can now answer "what evidence came out of this failed or successful step?" directly from run detail.
- Evidence retrieval follows the execution order, which is faster for triage than a flat list of files.
- The UI now reflects the durable artifact path built in EXE-11 instead of only proving that artifact rows exist.

## Limits Of This Step
- Current backend writes still focus on screenshots and log blobs; `JSON_RESULT` support is UI-ready but not broadly emitted yet.
- Evidence is still stored inline in metadata payloads, not external object storage.
- Run monitor still emphasizes live execution state; the richer evidence experience remains centered on run detail.

## Acceptance For UX-03
- Run detail shows stored evidence grouped by step/device.
- Operators can preview screenshots and inspect log/text evidence from the UI.
- Step rows expose whether evidence exists before opening the evidence section.
- `npm.cmd run typecheck`
- `npm.cmd run build`
- `npm.cmd run build:gateway`
- `npm.cmd run build:worker`
- `npm.cmd run smoke:backend`

## Unresolved Questions
- Should `JSON_RESULT` artifacts become mandatory for structured steps like `get_current_app`, or stay optional through pilot?
- At what run volume do we stop storing inline base64/text metadata and move artifacts to real object storage?
