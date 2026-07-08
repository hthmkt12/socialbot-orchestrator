---
phase: 6
title: Artifact Retention And Release Gates
status: completed
priority: P2
dependencies:
  - 5
effort: 1d-2d
---

# Phase 6: Artifact Retention And Release Gates

## Overview

Enforce artifact retention/storage policy from `specs/009-artifact-retention-object-storage` and finish release gates so pilot-to-production claims are backed by CI/local proof.

## Requirements

- Functional: storage mode is explicit, large payloads are not inline by default, preview fallback is safe, and release checks cover web/worker/gateway/bridge.
- Non-functional: no public artifact sharing; no unlimited inline DB retention.

## Architecture

Reuse artifact normalization/UI and Supabase storage metadata. Add threshold decisions where missing, then expand CI/local verification without changing runtime architecture.

## Related Code Files

- Modify: `src/lib/run-artifacts.ts`
- Modify: `src/components/runs/RunArtifactPreviewCard.tsx`
- Modify: `src/components/runs/RunArtifactsPanel.tsx`
- Modify: `src/hooks/use-artifact-url.ts`
- Modify: `services/execution-worker/src/execute-device-step.ts`
- Modify: `services/mobile-mcp-bridge/src/android_session_manager.py`
- Modify: `scripts/verify-use-cases-real.mjs`
- Modify: `.github/workflows/ci.yml`
- Modify: `docs/deployment-guide.md`
- Reference: `specs/009-artifact-retention-object-storage/spec.md`

## Implementation Steps

1. Add/confirm artifact storage mode labels: inline, object storage, external ref, omitted.
2. Enforce inline preview threshold for JSON/text and omit large screenshot/base64 payloads from DB rows by default.
3. Render metadata/expired/unavailable states without crashing Run Detail.
4. Add redaction blocker to readiness verification when artifact/evidence contains secret-like fields.
5. Expand CI to include worker build, gateway build, and Python bridge unit/compile checks.
6. Add final release checklist docs and run all final gates.

## Success Criteria

- [x] Large payloads are not written inline by default.
- [x] Artifact previews show safe fallback for unavailable/expired/unparseable evidence.
- [x] Readiness cannot verify redaction-blocked evidence.
- [x] CI covers web, worker, gateway, and Python bridge checks.
- [x] Final local gate suite passes.

## Completion Evidence

- Worker artifact policy now uses a 64 KB inline threshold, omits screenshot/base64 payloads by default, and writes explicit `storage_mode`, `artifact_kind`, `byte_size`, `retention_expires_at`, and `redaction_status` metadata.
- Artifact preview normalization supports `inline`, `object_storage`, `external_ref`, `omitted`, expired retention states, and legacy `object` storage mode.
- Readiness verification blocks `pilot_verified` when evidence/artifact metadata has `redaction_status: blocked` or secret-like fields.
- CI now covers web checks, worker build, gateway build, Python bridge unit tests, and Python bridge compile check.
- Remote Supabase migration applied for Phase 5 fleet policy schema and verified against real `execution_profiles.max_pilot_target_count`.
- Live Mobile MCP verification passed with real device `97249fb5`; run `96353263-661a-4688-9cc1-117fe33c1fa2` completed with 4 steps.
- Verification run:
  - `npm.cmd run lint`
  - `npm.cmd run typecheck`
  - `npm.cmd run test`
  - `npm.cmd run build`
  - `npm.cmd run build:worker`
  - `npm.cmd run build:gateway`
  - `python -m unittest discover -s services\mobile-mcp-bridge\tests -p "test_*.py"`
  - `python -m py_compile services\mobile-mcp-bridge\src\android_session_manager.py services\mobile-mcp-bridge\src\bridge_server.py services\mobile-mcp-bridge\src\json_response.py`
  - `npm.cmd run verify:use-cases`
  - `npm.cmd run verify:mobile-mcp`

## Risk Assessment

Risk: CI Python environment differs from local Windows. Mitigation: keep Python bridge CI tests dependency-light and compile-only unless setup script is explicitly added.
