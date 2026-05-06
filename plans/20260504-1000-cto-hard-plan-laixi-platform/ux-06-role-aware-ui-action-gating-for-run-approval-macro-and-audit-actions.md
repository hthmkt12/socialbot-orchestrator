# UX-06: Role-Aware UI Action Gating For Run Approval Macro And Audit Actions

Status: completed
Date: 2026-05-04
Purpose: make `VIEWER`, `OPERATOR`, and `ADMIN` action differences visible in the UI instead of relying on RLS failures alone

## Decision
- Reuse the existing role model and Supabase RLS intent as the source of truth instead of inventing a new permission matrix.
- Gate actions at the UI entrypoint and at the action handler so buttons are visibly restricted and still safe if a path is reached indirectly.
- Treat `audit_logs` differently from the other surfaces because its read scope already differs by role:
  - `VIEWER`: no audit access
  - `OPERATOR`: own audit activity only
  - `ADMIN`: full audit trail

## What Changed
- Added `src/lib/role-access.ts` as the shared role-permission helper for:
  - run control
  - approval resolution
  - macro management
  - audit access
- Added `src/components/ui/RoleAccessNotice.tsx` for explicit role-scope messaging in read-only surfaces.
- Updated `src/components/layout/Sidebar.tsx` to:
  - hide the audit-log nav item for `VIEWER`
  - show the current role in the sidebar footer
- Updated `src/pages/RunsPage.tsx` so `VIEWER` can inspect runs but cannot open the launch wizard.
- Updated `src/pages/RunDetailPage.tsx` and `src/pages/RunMonitorPage.tsx` so live run control is clearly read-only for `VIEWER`.
- Updated `src/components/runs/ApprovalDialog.tsx` and `src/pages/ApprovalsPage.tsx` so `VIEWER` can inspect approval context but cannot approve or reject.
- Updated `src/pages/MacrosPage.tsx` and `src/pages/MacroDetailPage.tsx` so `VIEWER` can inspect macro definitions and versions but cannot create, seed, version, or activate macros.
- Updated `src/pages/AuditLogsPage.tsx` and `src/hooks/useAuditLogs.ts` so:
  - `VIEWER` sees an explicit access restriction instead of a failing query path
  - `OPERATOR` sees scope messaging that the page is limited to their own events
  - `ADMIN` sees that the page is a full-platform audit surface

## Why This Matters
- The product now communicates role boundaries before an operator hits a failed mutation or hidden backend policy.
- `VIEWER` becomes a credible read-only role instead of a role that still sees write affordances everywhere.
- Governance surfaces now better match the intended security model already present in the schema.

## Limits Of This Step
- This is UI gating only; route-level redirect rules are still lightweight and rely on page-level access handling.
- Audit scope remains constrained by current RLS and actor-based logging, so operators still do not get a broader operational audit view.
- Role management itself is not yet exposed in the product.

## Acceptance For UX-06
- Run, approval, macro, and audit actions now show explicit role-based restrictions in UI.
- `VIEWER` can inspect read surfaces without seeing unrestricted write paths.
- Audit access no longer degrades into a raw query failure path for `VIEWER`.
- `npm.cmd run typecheck`
- `npm.cmd run build`
- `npm.cmd run build:gateway`
- `npm.cmd run build:worker`
- `npm.cmd run smoke:backend`

## Unresolved Questions
- Do we want route-level redirects for restricted pages, or is explicit read-only/access-denied messaging enough for pilot?
- Should operators eventually get broader audit visibility than actor-only logs, or should that remain admin-only?
