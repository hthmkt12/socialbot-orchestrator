---
phase: 2
title: "Readiness Review UI"
status: complete
priority: P1
dependencies: [1]
effort: "1d"
---

# Phase 2: Readiness Review UI

## Overview

Add a focused readiness report UI that lets operators create/submit reports and admins review readiness decisions. Do not add a broad reporting suite or external sharing.

## Requirements

- Functional: list readiness reports with backend/status/evidence summary.
- Functional: allow Operator/Admin to create or submit report metadata.
- Functional: allow Admin to review with `pilot_verified`, `not_verified`, or `needs_rerun`.
- Functional: show why `pilot_verified` is blocked when evidence is incomplete.
- Non-functional: never display secrets or raw local env values.
- Non-functional: preserve existing sidebar role filtering patterns.

## Architecture

Add a single route, likely `/readiness`, and one page backed by React Query hooks.

Recommended UI placement:

- Sidebar section: `Insights`
- Label: `Readiness`
- Visibility: Viewer/Operator/Admin can read; actions are role-gated inside the page.

UI states:

| State | Behavior |
| --- | --- |
| No reports | Empty state with create action for Operator/Admin |
| Draft/submitted | Show evidence checklist and next action |
| Missing evidence | Show blocking reasons |
| Verified | Show decision, reviewer, timestamp |
| Needs rerun | Show reviewer note and rerun guidance |

## Related Code Files

- Create: `src/hooks/use-readiness-reports.ts`
- Create: `src/pages/ReadinessReportsPage.tsx`
- Create: `src/components/readiness/readiness-report-list.tsx`
- Create: `src/components/readiness/readiness-report-form.tsx`
- Create: `src/components/readiness/readiness-review-panel.tsx`
- Modify: `src/App.tsx`
- Modify: `src/components/layout/Sidebar.tsx`
- Modify: `tests/e2e/navigation.spec.ts`
- Optional create: `tests/e2e/readiness-reports.spec.ts`

## Implementation Steps

1. Add React Query hooks around phase 1 service functions.
2. Add `/readiness` lazy route in `App.tsx`.
3. Add Sidebar item under Insights with existing role-aware conventions.
4. Build list/detail page:
   - status badge
   - backend badge
   - evidence checklist
   - safe report path
   - reviewer decision panel
5. Add create/report form with manual metadata fields first:
   - backend
   - report path
   - run id
   - device serial/session
   - runtime status
   - notes
6. Add Admin-only review controls.
7. Add blocked evidence messages using the service validator output.
8. Add tests for role visibility/action availability.

## Success Criteria

- [x] Viewer can see safe report summaries only.
- [x] Operator can create/submit but cannot review.
- [x] Admin can review and receives evidence blockers before verifying.
- [x] Sidebar route is discoverable without exposing admin-only actions.
- [x] No secret-like values appear in UI test fixtures.

## Risk Assessment

Main risk: overbuilding a report builder/importer. Keep v1 manual metadata plus safe report path. JSON file parsing can be a later enhancement.
