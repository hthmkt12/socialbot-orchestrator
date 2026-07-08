---
phase: 3
title: "Operator Journey Cleanup"
status: completed
priority: P2
dependencies: [1, 2]
effort: "1d-2d"
---

# Phase 3: Operator Journey Cleanup

## Overview

Make the daily operator path obvious without redesigning the whole app. The target journey is `Readiness -> Accounts -> Runs -> Monitor -> Analytics`, with advanced diagnostics still available but not competing with the primary flow.

## Requirements

- Functional: operators can quickly see whether the pilot runtime is ready, whether accounts are usable, how to launch/monitor a run, and where to inspect results.
- Non-functional: no new marketing page, no large visual redesign, no hidden role changes.
- Accessibility: route labels and action states remain readable and discoverable for viewer/operator/admin roles.

## Architecture

Keep the existing routes and role-aware sidebar. Improve information scent and next-action summaries:

- Social Dashboard: show go/no-go summary and next operational action.
- Readiness: surface stale/missing proof and recovery action before raw evidence details.
- Runs: keep launch path clear, with account/device blockers linked to relevant recovery pages.
- Analytics: keep data source labeling visible so seed/insufficient data is not mistaken for pilot success.

Do not remove advanced screens. Reclassify or de-emphasize Mobile MCP, System Monitor, and Execution Profiles if needed.

## Related Code Files

- Modify: `src/components/layout/Sidebar.tsx`
- Modify: `src/pages/social-dashboard-page.tsx`
- Modify: `src/pages/ReadinessReportsPage.tsx`
- Modify: `src/components/runs/RunWizard.tsx`
- Modify: `src/components/runs/run-wizard-target-notices.tsx`
- Modify: `src/pages/AnalyticsPage.tsx`
- Verify: `tests/e2e/navigation.spec.ts`
- Likely create: `tests/e2e/operator-journey.spec.ts`

## Implementation Steps

1. Map the current sidebar groups against the primary operator journey.
2. Add a concise go/no-go block to Social Dashboard using existing readiness/account/run data where possible.
3. Update Readiness copy and layout so stale/missing evidence shows the next recovery action first.
4. Ensure run wizard blockers link or point to Accounts, Devices, Device Setup, or Readiness when applicable.
5. Keep advanced tools available but visually subordinate to the daily path.
6. Add or update Playwright coverage for the primary operator route chain.
7. Run app build and inspect chunk sizes for Analytics/Schedules regressions.

## Success Criteria

- [ ] Operator can follow the primary journey without opening docs.
- [ ] Viewer/admin role boundaries remain unchanged.
- [ ] Navigation e2e passes.
- [ ] No new out-of-scope routes are introduced.
- [ ] App build passes and no new oversized main chunk warning appears.

## Risk Assessment

Risk: UX cleanup becomes a broad redesign.
Mitigation: keep route structure and page styling mostly intact; improve hierarchy and next actions only.

Risk: dashboard data becomes misleading.
Mitigation: reuse existing readiness/analytics labels and show unknown/stale states honestly.
