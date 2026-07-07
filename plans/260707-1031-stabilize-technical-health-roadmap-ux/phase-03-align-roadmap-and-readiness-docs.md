---
phase: 3
title: Align Roadmap And Readiness Docs
status: completed
priority: P2
dependencies:
  - 1
effort: S
---

# Phase 3: Align Roadmap And Readiness Docs

## Overview

Make product documentation truthful and decision-grade. The current roadmap marks future phases as complete, which damages prioritization and can hide readiness gaps.

## Requirements

- Functional: roadmap reflects real state as of 2026-07-07.
- Functional: capabilities distinguish implemented, smoke-tested, pilot-verified, blocked, and future.
- Non-functional: docs stay concise; no marketing inflation.

## Related Code Files

- Modify: `F:\project-bolt-sb1-keyopwhy\project\docs\project-roadmap.md`
- Modify: `F:\project-bolt-sb1-keyopwhy\project\docs\backend-capability-matrix.md`
- Modify: `F:\project-bolt-sb1-keyopwhy\project\README.md`
- Optional modify: `F:\project-bolt-sb1-keyopwhy\project\docs\project-changelog.md`

## Implementation Steps

1. Replace future-phase checkmarks with status labels:
   - `Implemented`
   - `Unit/smoke verified`
   - `Pilot verified`
   - `Blocked`
   - `Planned`
2. Move speculative 2027-2029 items into a future roadmap section unless there is code and verification evidence.
3. Add a short "Readiness Legend" to explain status terms.
4. Update capability matrix to match the selected pilot backend and security changes from Phase 2.
5. Update README "Current backend execution notes" so it does not overpromise Laixi, AutoX, object storage, or parallel fleet guarantees.
6. Add a changelog note summarizing the roadmap correction.

## Tests Before

- Search for inconsistent status language:
  - `rg -n "Completed|Pilot|Q[1-4] 202[7-9]|Laixi|Mobile MCP" docs README.md`

## Refactor

- Keep docs as product truth, not implementation wishlist.
- Do not delete useful future ideas; demote them to planned/future with explicit evidence gaps.

## Tests After

- `rg -n "Q[1-4] 202[7-9].*Completed|âœ…" docs README.md` should not show misleading future completion claims.

## Success Criteria

- [ ] Roadmap no longer marks future-dated phases as completed unless backed by evidence and explained.
- [ ] "Now/Next/Later" is actionable for July 7, 2026.
- [ ] Blockers and unresolved questions are concrete.
- [ ] README and backend matrix agree on backend support and pilot limits.

## Risk Assessment

- Risk: correcting docs feels like regression.
  Mitigation: phrase as readiness taxonomy, not feature removal.
- Risk: future work disappears from stakeholder view.
  Mitigation: keep future section but strip false completion marks.
