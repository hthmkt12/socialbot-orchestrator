---
phase: 4
title: Readiness Gate Enforcement
status: completed
priority: P1
dependencies:
  - 3
effort: 1d-2d
---

# Phase 4: Readiness Gate Enforcement

## Overview

Implement the gate taxonomy from `specs/007-readiness-gate-rules`: launch blockers, verification blockers, and warnings.

## Requirements

- Functional: launch blockers stop dispatch; verification blockers stop `pilot_verified`; warnings stay visible but non-blocking.
- Non-functional: every gate has stable key, message, and recovery hint where possible.

## Architecture

Extract gate classification into reusable helpers used by Run Wizard/preflight and readiness review. Keep UI role-aware and service-side enforcement authoritative.

## Related Code Files

- Create: `src/lib/readiness-gates.ts`
- Create: `src/lib/readiness-gates.test.ts`
- Modify: `src/lib/readiness-report-service.ts`
- Modify: `src/lib/readiness-report-service.test.ts`
- Modify: `src/lib/run-preflight-target-issues.ts`
- Modify: `src/lib/run-preflight.test.ts`
- Modify: `src/pages/ReadinessReportsPage.tsx`
- Modify: `src/components/runs/run-wizard-preflight-helpers.ts`
- Reference: `specs/007-readiness-gate-rules/spec.md`

## Implementation Steps

1. Define gate keys, gate types, statuses, and messages.
2. Map current preflight failures to `launch_blocker` gates.
3. Map readiness evidence validation failures to `verification_blocker` gates.
4. Add warning classification for seed/insufficient analytics, stale proof, non-critical preview fallback.
5. Render gate results in readiness report UI and run preflight UI.
6. Test viewer/operator/admin mutation boundaries and gate classification.

## Success Criteria

- [x] Launch blockers prevent run creation/dispatch.
- [x] Verification blockers prevent `pilot_verified`.
- [x] Warnings do not block but remain visible.
- [x] Viewer cannot mutate gate/report status.
- [x] Gate tests cover at least one pass and one fail for each type.

## Completion Evidence

- Added shared gate taxonomy in `src/lib/readiness-gates.ts` with stable keys, gate type, status, message, and recovery hint.
- Run Wizard preflight summaries now include gate results and render failed launch blocker/warning gates in review.
- Readiness review now derives `pilot_verified` validation from `verification_blocker` gates; warning gates stay visible and non-blocking.
- Readiness Reports UI renders gate results for each report.
- Verification run:
  - `npm.cmd run typecheck`
  - `npm.cmd run test -- --run src/lib/readiness-gates.test.ts src/lib/readiness-report-service.test.ts src/lib/run-preflight.test.ts`
  - `npm.cmd run lint`
  - `npm.cmd run build`

## Risk Assessment

Risk: duplicated preflight and readiness validation drift. Mitigation: use shared gate types and tests for both consumers.
