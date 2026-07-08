---
phase: 1
title: Pilot Readiness Foundation
status: completed
priority: P1
dependencies: []
effort: 1d-2d
---

# Phase 1: Pilot Readiness Foundation

## Overview

Turn `specs/004-pilot-success-criteria` into the project readiness contract and re-baseline Level 1 proof from the current machine/runtime.

## Requirements

- Functional: expose/check required Level 1 evidence fields and keep `pilot_verified` proof-gated.
- Non-functional: no unsupported Laixi/iOS/social-production claims; all checks print concrete output.

## Architecture

Reuse existing readiness report service and verification scripts. The report service remains the DB/UI boundary; scripts produce evidence; admin review validates whether evidence is enough.

## Related Code Files

- Modify: `docs/project-roadmap.md`
- Modify: `docs/codebase-summary.md`
- Modify: `docs/use-case-final-coverage.md`
- Modify: `src/lib/readiness-report-service.ts`
- Modify: `src/lib/readiness-report-service.test.ts`
- Modify: `scripts/verify-mobile-mcp-local.mjs`
- Modify: `scripts/verify-use-cases-real.mjs`
- Reference: `specs/004-pilot-success-criteria/spec.md`
- Reference: `plans/260506-mobile-mcp-pilot-readiness-smoke/plan.md`

## Implementation Steps

1. Add a readiness evidence checklist helper for `pilot_level`, `backend_mode`, health, serials, run id/status, artifacts, scrub status, and claim summary.
2. Extend `validateReadinessEvidence` so Level 1 verification rejects missing required fields with concrete messages.
3. Ensure verification scripts print the evidence fields and write report artifacts without secrets.
4. Update docs to mark Mobile MCP readiness as current only when fresh evidence exists.
5. Add tests for missing field rejection and unsupported claim rejection.
6. Run local verification commands; run live Mobile MCP proof only when device/env are available.

## Success Criteria

- [x] Level 1 required evidence is codified in service/tests.
- [x] Admin cannot mark `pilot_verified` with incomplete evidence.
- [x] Verification script output includes concrete run/device/backend/artifact fields.
- [x] Docs distinguish implemented, locally verified, and live-proof-gated states.
- [x] Web/worker/gateway/Python checks remain green.
- [x] Live Mobile MCP preflight passes with expected Android serial visible to ADB/bridge.

## Risk Assessment

Risk: evidence model becomes too strict for existing reports. Mitigation: allow old reports to remain readable; enforce strict fields only for new `pilot_verified` decisions.

## Progress Notes

- 2026-07-07: Implemented Level 1 readiness evidence checklist, stricter `pilot_verified` validation, script `readinessEvidence` output, report redaction, and docs truth updates.
- 2026-07-07: Local gates passed: lint, typecheck, unit tests, web build, worker build, gateway build, Python bridge unit tests, Python compile, and `npm.cmd run verify:use-cases`.
- 2026-07-07: Live Mobile MCP preflight is blocked by runtime/device state, not code: ADB and bridge both report no devices, expected serial `97249fb5` missing. `diagnose:mobile-mcp:devices` reports Windows does not see an Android USB device.
- 2026-07-08: Live Mobile MCP proof passed with Android serial `97249fb5` / model `25053RT47C`: `npm.cmd run verify:mobile-mcp` completed runtime, device wait, operator ensure, device sync, preflight, and UI smoke. Evidence report: `plans/reports/mobile-mcp-verify-2026-07-08T02-35-27-274Z.json`; UI run `5dd4d8e4-2f97-437d-8e7c-e01ddfaafe95` completed with 4 steps.
