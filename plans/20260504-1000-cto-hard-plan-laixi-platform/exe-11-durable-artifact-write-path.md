# EXE-11: Durable Artifact Write Path

Status: completed
Date: 2026-05-04
Purpose: make screenshot and text-log evidence survive run completion and become visible from the operator UI instead of creating artifact rows with empty payloads

## Decision
- Artifact persistence now uses the existing `artifacts` table as the durable source of truth.
- Screenshot payloads are stored inline in `metadata_json.base64` for now.
- Text outputs and failure messages are stored as `LOG_BLOB` artifacts with inline `metadata_json.text`.

## What Changed
- `packages/shared/src/execution-contract.ts` now lets command responses carry optional artifact refs.
- `services/laixi-gateway/src/gateway-session-manager.ts` now forwards gateway `step_result.artifacts` back to the worker response.
- `services/execution-worker/src/execute-device-step.ts` now preserves response artifacts and resolves screenshot base64 from either response data or screenshot artifact refs.
- `services/execution-worker/src/worker-run-store.ts` now has a shared artifact-record helper plus:
  - inline screenshot persistence
  - inline text-log persistence
- `services/execution-worker/src/single-device-step-runner.ts` now writes:
  - screenshot artifacts for successful screenshot steps
  - log artifacts for successful `adb` / `run_autox` outputs
  - log artifacts for failed steps, timeouts, and exceptions
- `src/pages/RunDetailPage.tsx` now previews inline screenshots and log text directly from artifact metadata.

## Why This Matters
- Artifact rows now hold usable evidence, not just a path-shaped placeholder.
- Operators can inspect proof of execution from the UI without opening raw database rows.
- This closes the main product gap before a later move to object storage or richer artifact lifecycle management.

## Limits Of This Step
- Payloads are stored inline in `metadata_json`, which is practical for MVP proof but may be too heavy for larger pilot volumes.
- There is still no external object storage upload/download path.
- Live device smoke is still pending, so this is source/build verified rather than runtime-proven.

## Acceptance For EXE-11
- Successful screenshot steps persist an artifact row with retrievable screenshot data.
- Relevant command outputs and step failures persist log artifacts.
- Run detail can preview persisted screenshot and text-log evidence.
- The gateway-to-worker contract no longer drops artifact refs on the floor.

## Unresolved Questions
- Should screenshots stay inline through pilot, or should we move directly to Supabase Storage before any larger run volume?
- Do we want structured `JSON_RESULT` artifacts for steps like `get_current_app`, or are screenshot plus text logs enough for the pilot scope?
