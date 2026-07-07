# Phase 3 Gap Analysis

Date: 2026-07-07

Scope: all use cases in `docs/use-cases.md`, including the new pilot readiness report and analytics data source label use cases.

## Counts

| Category | Total | DONE/ENFORCED | PARTIAL | MISSING | BROKEN | VIOLATED |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Positive use cases | 80 | 80 | 0 | 0 | 0 | - |
| Anti-use cases | 52 | 52 | - | - | - | 0 |
| Error cases | 51 | 51 | 0 | 0 | 0 | - |
| Out-of-scope guardrails | 16 | 16 | 0 | 0 | 0 | 0 |

## Regression Check

| Area | Status | Evidence |
| --- | --- | --- |
| Visitor auth boundary | DONE | No route changes to unauthenticated access; `/readiness` stays inside `AuthGate`. |
| Viewer read-only access | ENFORCED | `canCreateReadinessReports('VIEWER') === false`; `canReviewReadinessReports('VIEWER') === false`; UI disables submit/review. |
| Operator readiness submit | DONE | `createReadinessReport` allows operator/admin, persists `submitted`, scrubs secret-like evidence keys, and writes audit. |
| Operator cannot verify readiness | ENFORCED | `reviewReadinessReport` requires `readiness_reports.review`, granted only to admin. |
| Admin readiness review | DONE | Admin can mark `pilot_verified`, `not_verified`, or `needs_rerun`; `pilot_verified` requires evidence. |
| Analytics source labels | DONE | `classifyAnalyticsSource` labels empty rows as `Insufficient data`, impossible rows as `Unknown source`, and sane persisted rows as `Real persisted data`. |
| Retry/backoff policy | DONE | Execution profiles configure retry limits/delays; worker uses bounded backoff and persists retry reason, attempt, next delay, and terminal failure reason. |
| Target failure policy | DONE | Execution profiles configure `fail_fast` or `skip_failed_target`; multi-target worker records target failure decisions and skipped count without hiding original failures. |
| Existing scheduling/runs/macros/accounts | DONE | No service changes in these domains. |
| Out-of-scope routes/features | ENFORCED | No new marketplace, billing, social graph, native mobile, offline-first, failover, credential rotation, or artifact export features added. |

## Ghost Check

| Item | Status |
| --- | --- |
| New `/readiness` route | Matches new Viewer/Operator/Admin readiness use cases. |
| `pilot_readiness_reports` table | Matches new readiness report data model. |
| `analytics-source` classifier | Matches new analytics source label use case. |
| Retry/backoff policy fields and helper | Matches promoted Admin/Operator/Viewer/System Worker retry use cases. |
| Target failure policy field/helper | Matches promoted Admin/Operator/System Worker target-failure use cases; does not implement backup target rotation. |
| Unrequested feature additions | None found in this patch. |
