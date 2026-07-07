---
phase: 4
title: "Verification And Coverage"
status: complete
priority: P1
dependencies: [1, 2, 3]
effort: "0.5d"
---

# Phase 4: Verification And Coverage

## Overview

Verify the new feature against role boundaries, evidence gates, and existing no-drift rules. Only after tests pass, promote the accepted Phase A use cases into the main use-case source of truth.

## Requirements

- Functional: every new use case has test or enforcement evidence.
- Functional: every anti-use-case has a code rule.
- Functional: no ghost route/feature is introduced.
- Non-functional: keep current MVP coverage green.

## Architecture

Use the same coverage loop that worked for the prior MVP pass:

1. Add tests first for new boundaries.
2. Run verification commands.
3. Update `docs/use-cases.md` only for implemented Phase A behavior.
4. Update `docs/use-cases-architecture-spec.md` with IDs and mappings.
5. Update `docs/use-case-final-coverage.md`.
6. Run ghost check against old removed routes and new accidental routes.

## Related Code Files

- Modify: `docs/use-cases.md`
- Modify: `docs/use-cases-architecture-spec.md`
- Modify: `docs/use-case-final-coverage.md`
- Modify: `docs/use-case-coding-sequence.md` if a new implementation round is needed.
- Modify: `docs/project-changelog.md`
- Test files from phases 1-3.

## Implementation Steps

1. Run focused tests:
   - readiness service tests
   - role access tests
   - analytics source tests
   - navigation/readiness route tests if added
2. Run full checks:
   - `npm.cmd run test`
   - `npm.cmd run typecheck`
   - `npm.cmd run build`
3. Run ghost scan:
   - no billing/marketplace/social-network/native/offline routes
   - no AI builder resurrection
   - no plaintext credential display
4. Promote only implemented Phase A use cases into `docs/use-cases.md`.
5. Add stable IDs to architecture spec:
   - Admin readiness review
   - Operator readiness report creation
   - Viewer safe report read
   - Analytics source labeling
6. Update final coverage counts.
7. Add changelog summary.

## Success Criteria

- [x] New use cases are DONE/covered immediately after promotion.
- [x] No new PARTIAL/MISSING/VIOLATED states are introduced.
- [x] No old ghost feature returns.
- [x] Verification commands pass.
- [x] Final report clearly distinguishes implemented Phase A from remaining backlog items.

## Risk Assessment

Main risk: promoting backlog use cases before implementation. Mitigation: docs promotion is last step, after code/tests pass.
