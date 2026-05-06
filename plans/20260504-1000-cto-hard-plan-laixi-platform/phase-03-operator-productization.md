# Phase 03: Operator Productization

## Context Links
- `src/pages/MacrosPage.tsx`
- `src/pages/MacroDetailPage.tsx`
- `src/components/runs/RunWizard.tsx`
- `src/pages/RunDetailPage.tsx`
- `src/pages/RunMonitorPage.tsx`
- `src/pages/ApprovalsPage.tsx`
- `src/pages/AuditLogsPage.tsx`

## Overview
- Priority: P3
- Current status: in progress
- Brief description: turn the system from a technical operator tool into a product usable by broader operations teams.

## Key Insights
- Macro authoring now has a minimal guided path for common flat workflows, starter templates for recurring create flows, and advanced structures still remain JSON-first and power-user oriented.
- Evidence exists, failure explanation is normalized, and run detail now groups stored step evidence, but richer artifact types are still shallow.
- Approval and audit flows are present, role restrictions are explicit in UI, approval review now explains reason/risk/outcome directly, and audit entries now deep-link into related run and approval context, but broader governance UX is still basic.

## Requirements
- Common automation flows should be authorable without raw JSON.
- Advanced automation flows must retain a raw JSON escape hatch so the builder does not become a blocking abstraction.
- Operators should understand run failures from the UI alone for common cases.
- Approvals, artifacts, and audit logs must be useful as operational evidence.
- Role-based behavior should be visible in the product, not only in schema policy.
- Audit review should lead operators into the linked run, approval, and evidence context instead of forcing manual ID chasing.
- Approval reviewers should be able to decide without opening raw approval payloads or reverse-engineering step names.

## Architecture
- Add a visual macro builder backed by the existing macro contract.
- Keep builder scope constrained to common flat steps first, with JSON fallback for unsupported structures.
- Add artifact storage and preview patterns that map to run steps consistently.
- Add preflight validation before execution for targets, inputs, and required approvals.
- Add role-aware UI surfaces for operator, viewer, and admin actions.

## Related Code Files
- Files to modify:
  - `src/pages/MacrosPage.tsx`
  - `src/pages/MacroDetailPage.tsx`
  - `src/components/runs/RunWizard.tsx`
  - `src/pages/RunDetailPage.tsx`
  - `src/pages/ApprovalsPage.tsx`
  - `src/pages/AuditLogsPage.tsx`
- Files to create:
  - macro builder components
  - artifact preview components
  - `src/lib/run-preflight.ts`
- Files to delete:
  - none

## Implementation Steps
1. Define the smallest visual builder for common step types first.
2. Add preflight validation for target selection, required inputs, and sensitive steps.
3. Improve run detail evidence with previews, normalized errors, and clear summaries.
4. Add role-aware action gating across run, approval, and audit surfaces.
5. Expand templates for common QA and device operations workflows.

## Todo List
- [x] Build a minimal macro builder for common steps
- [x] Add run preflight validation
- [x] Improve artifact preview and failure explanations
- [x] Expose role-based action gating in the UI
- [x] Improve approval review context with clearer reason, risk, and outcome summaries
- [x] Improve audit review filters and deep links into related run and approval context
- [x] Publish starter templates for common workflows

## Success Criteria
- Common operators no longer need raw JSON for basic macros.
- Advanced macro authors can still fall back to JSON without losing unsupported structures.
- Run failure triage is possible from the product for common issues.
- Approval and audit flows produce usable evidence for operations review.
- Product training time drops materially for new operators.
- Approval review becomes a product-readable task instead of a raw-database interpretation task.
- Audit investigation becomes a linked workflow instead of a manual copy-paste exercise across pages.

## Risk Assessment
- Builder scope can expand too early and delay higher-value reliability work.
- Weak abstraction over macro JSON can create two incompatible authoring models.
- Guided mode can drift from the real macro contract if supported step coverage is not expanded deliberately.
- Rich evidence surfaces can become expensive if artifact storage is not settled first.

## Security Considerations
- Keep privileged step types clearly marked and approval-gated.
- Do not expose sensitive payloads or secrets in artifact previews.
- Make role-based restrictions explicit in UI and enforce them server-side.

## Next Steps
- Start with a constrained builder, not a full no-code system.
- Keep starter template coverage narrow until pilot shows which workflows are repeated often enough to deserve promotion.
- Ship broader evidence and governance improvements only after Phase 01 durability is proven.
