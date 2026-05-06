# UX-07: Improve Approvals UX With Clearer Reason Risk And Outcome Summary

Status: completed
Date: 2026-05-04
Purpose: let reviewers approve or reject a waiting step without reading raw approval payloads or guessing what each decision will do to the run

## Decision
- Reuse the current approval schema and derive product-facing context from fields already present in UI data:
  - `reason`
  - `step_type`
  - `step_id`
  - `reviewer_notes`
  - `payload_json`
  - `metadata`
- Translate approval context once in shared frontend logic so approvals list, detail modal, and live run monitor all explain the same request in the same words.
- Keep the scope product-facing. Do not expand backend payload requirements unless current fields are proven insufficient.

## What Changed
- Added `src/lib/approval-insights.ts` to map approval status and step type into:
  - requested action summary
  - risk framing
  - approve vs reject outcome summaries
  - resolved outcome summaries
- Added `src/components/runs/ApprovalSummaryPanel.tsx` as the shared approval context renderer used across approval surfaces.
- Updated `src/pages/ApprovalsPage.tsx` so each approval card now shows:
  - what action is being requested
  - why review is required
  - what happens next after the decision
- Updated the approval detail modal to show a fuller decision summary before raw metadata.
- Updated `src/components/runs/ApprovalDialog.tsx` so the live approval dialog now receives the full approval object and shows the same reason/risk/outcome framing before the reviewer acts.
- Updated `src/pages/RunMonitorPage.tsx` so a waiting run now exposes an inline approval review block instead of only a generic pending-approval button.

## Why This Matters
- Reviewers can decide faster because the UI now explains the requested action and the consequence of approving or rejecting it.
- The product no longer relies on reviewers knowing what `adb`, `run_autox`, or a generic approval checkpoint implies operationally.
- Approval governance now looks like an intentional product surface instead of a thin database record viewer.

## Limits Of This Step
- Approval context still depends on the quality of the existing `reason`, `payload_json`, and `metadata` payloads. Sparse upstream payloads will still produce sparse summaries.
- Multi-approval runs still highlight the first pending request in the live monitor instead of providing a richer queue-management surface.
- This slice does not change approval routing, SLA, escalation, or timeout policy.

## Acceptance For UX-07
- Approval reviewers can see requested action, risk, and likely run outcome from the UI alone.
- Live run monitor surfaces the current pending approval with enough context to decide.
- The approval list and approval dialog no longer force reviewers to infer behavior from raw step names.
- `npm.cmd run typecheck`
- `npm.cmd run build`
- `npm.cmd run build:gateway`
- `npm.cmd run build:worker`
- `npm.cmd run smoke:backend`

## Unresolved Questions
- Should pilot reviewers also see requester identity and device identity more prominently on approval cards, not only in detail views?
- Do we want explicit severity policy levels beyond `adb` and `run_autox`, or is step-type-based framing enough for pilot?
