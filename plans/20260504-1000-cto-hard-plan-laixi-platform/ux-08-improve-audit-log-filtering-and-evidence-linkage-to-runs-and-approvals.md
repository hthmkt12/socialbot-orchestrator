# UX-08: Improve Audit Log Filtering And Evidence Linkage To Runs And Approvals

Status: completed
Date: 2026-05-04
Purpose: make audit review operationally useful by letting an operator filter the trail faster and jump from an audit event into the exact run, approval, or step-evidence context behind it

## Decision
- Keep the audit schema unchanged for this slice and derive reviewer-facing context from the existing `action`, `resource_type`, `resource_id`, and `metadata_json` fields.
- Add one shared audit-insight layer in the frontend so search, summaries, and deep links are generated consistently instead of each audit surface improvising its own parsing.
- Treat run detail plus focused step evidence as the artifact destination for audit links, rather than adding a separate artifact route first.

## What Changed
- Added `src/lib/audit-log-insights.ts` to classify audit events into product-facing domains, generate readable summaries, and build related links from metadata already present in the trail.
- Added `src/components/audit/AuditLogRow.tsx` so audit rows now show:
  - clearer action summary
  - domain grouping
  - important metadata badges such as step, outcome, target, and count
  - direct links into run detail, run monitor, step evidence, macro, and approval context where available
- Updated `src/pages/AuditLogsPage.tsx` to improve filtering with:
  - domain pills
  - richer free-text search across metadata-derived terms
  - clearer result counts and linked-context coverage
- Updated `src/pages/ApprovalsPage.tsx` so audit links can open the page in a focused state and automatically surface the relevant approval context.
- Updated `src/pages/RunDetailPage.tsx` and `src/components/runs/RunArtifactsPanel.tsx` so audit links can focus a specific step and highlight its stored evidence directly in the run detail surface.

## Why This Matters
- Audit review is now a navigation surface, not just a text ledger.
- Operators can move from “something happened” to “show me the exact run/approval/evidence behind it” without manual ID hunting.
- This makes governance and post-run review materially faster before a broader artifact/audit redesign.

## Limits Of This Step
- Audit still depends on the quality of upstream `metadata_json`; thin payloads still produce thinner deep-link coverage.
- Approval links focus the approval context inside the existing approvals page rather than a dedicated approval-details route.
- Artifact linkage currently focuses by `stepId` in run detail, not by individual artifact ID.

## Acceptance For UX-08
- Audit entries can be filtered faster by domain, action, resource, and metadata-backed search terms.
- Audit entries link cleanly to the relevant run, approval, or step evidence context when metadata supports it.
- Reviewers no longer need to manually copy IDs from audit rows into other pages for common run and approval investigations.
- `npm.cmd run typecheck`
- `npm.cmd run build`
- `npm.cmd run build:gateway`
- `npm.cmd run build:worker`
- `npm.cmd run smoke:backend`

## Unresolved Questions
- Do we want a dedicated approval-details route later, or is focused modal state enough through pilot?
- Should artifact-level audit events be added later so evidence links can target one stored artifact rather than a focused step context?
