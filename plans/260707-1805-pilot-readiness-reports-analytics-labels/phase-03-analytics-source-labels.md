---
phase: 3
title: "Analytics Source Labels"
status: complete
priority: P2
dependencies: []
effort: "0.5d"
---

# Phase 3: Analytics Source Labels

## Overview

Make analytics provenance explicit so users can distinguish real persisted metrics from seed/demo/insufficient data. This phase should not create a new analytics product surface.

## Requirements

- Functional: classify analytics data source for the selected account.
- Functional: display one clear badge/state in `/analytics`.
- Functional: show `insufficient data` when there are no persisted analytics rows.
- Functional: avoid implying growth/engagement is real when data is absent or seeded.
- Non-functional: preserve current charts and account selector.

## Architecture

Add a small classifier helper.

Suggested source states:

| State | Meaning |
| --- | --- |
| `real_persisted` | There are real `account_analytics` rows for the selected account. |
| `seed_or_demo` | Rows are identified as seed/demo by metadata or known invalid marker if available. |
| `insufficient_data` | No rows or too few rows to calculate trend safely. |
| `unknown` | Data exists but provenance cannot be confidently classified. |

V1 can implement `real_persisted` and `insufficient_data` immediately. `seed_or_demo` should be supported only if the current schema or metadata can prove it. Do not invent fake seed detection.

## Related Code Files

- Create: `src/lib/analytics-source.ts`
- Create: `src/lib/analytics-source.test.ts`
- Modify: `src/lib/analytics-service.ts`
- Modify: `src/hooks/use-analytics.ts`
- Modify: `src/components/analytics/EngagementAnalytics.tsx`
- Optional modify: `src/pages/AnalyticsPage.tsx`

## Implementation Steps

1. Add `classifyAnalyticsSource(analyticsRows, growth)` helper.
2. Add unit tests:
   - no rows -> `insufficient_data`
   - rows present -> `real_persisted`
   - impossible/malformed metrics -> `unknown` or `insufficient_data`
3. Update `EngagementAnalytics`:
   - show source badge near title
   - change empty copy to explicitly say no persisted analytics yet
   - avoid "Good" health claim when data is insufficient
4. Keep chart behavior unchanged when data is real.
5. Add regression tests for the helper and, if practical, component state.

## Success Criteria

- [x] Analytics page never presents empty/unknown data as real performance.
- [x] Existing chart still renders for real rows.
- [x] No new route is added.
- [x] Unit tests cover source classification.

## Risk Assessment

Main risk: detecting seed/demo data without schema support. Mitigation: do not guess. Label only what can be proven; use `unknown` or `insufficient_data` for ambiguous cases.
