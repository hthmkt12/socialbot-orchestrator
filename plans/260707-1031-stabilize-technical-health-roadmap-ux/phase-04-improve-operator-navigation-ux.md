---
phase: 4
title: Improve Operator Navigation UX
status: completed
priority: P2
dependencies:
  - 1
  - 3
effort: M
---

# Phase 4: Improve Operator Navigation UX

## Overview

Make core operator workflows discoverable from the first authenticated screen. The app routes expose devices, runs, approvals, setup, schedules, and pricing, but the sidebar hides several operationally important pages.

## Requirements

- Functional: primary operator workflows are reachable from sidebar or a clearly grouped navigation surface.
- Functional: role restrictions remain intact for audit/admin-only surfaces.
- Non-functional: no landing-page redesign; keep dense operational UI.

## Architecture

Use a grouped sidebar model rather than adding every route as a flat item. Suggested groups:

- Operations: Social Dashboard, Runs, Approvals, Devices, Device Setup
- Automation: Macros, Schedules, Accounts
- Insights: Analytics, Fleet Health, System Monitor, Audit Logs
- Reference: Documentation, Pricing

Collapse/group behavior can be static if a full collapsible sidebar is too much for this phase.

## Related Code Files

- Modify: `F:\project-bolt-sb1-keyopwhy\project\src\components\layout\Sidebar.tsx`
- Modify: `F:\project-bolt-sb1-keyopwhy\project\src\App.tsx` only if route labels/default redirects need alignment
- Modify or add tests: `F:\project-bolt-sb1-keyopwhy\project\tests\e2e\navigation.spec.ts`
- Optional modify: `F:\project-bolt-sb1-keyopwhy\project\src\lib\role-access.ts`

## Implementation Steps

1. Inventory all authenticated routes from `App.tsx` and classify them into operator groups.
2. Decide which routes remain hidden intentionally:
   - `Run Detail`, `Run Monitor`, `Macro Detail`, `Account Detail` remain detail-only.
   - `Mobile MCP Orchestrator` can remain advanced/dev-only unless pilot operators need it.
3. Refactor `navItems` in `Sidebar.tsx` into grouped sections with existing lucide icons.
4. Preserve `canViewAuditLogs(profile?.role)` and add equivalent role gates only where existing policy already supports it.
5. Add Playwright navigation assertions for visible top-level routes.
6. Check mobile/desktop layout manually or with screenshots if a dev server is available.

## Tests Before

- Run current e2e navigation if auth mocking is healthy:
  - `npm.cmd run test:e2e -- tests/e2e/navigation.spec.ts`

## Refactor

- Avoid a new navigation framework.
- Avoid text-heavy in-app explanations.
- Keep route paths stable.

## Tests After

- `npm.cmd run typecheck`
- `npm.cmd run lint`
- `npm.cmd run build`
- `npm.cmd run test:e2e -- tests/e2e/navigation.spec.ts` when Playwright/auth setup is available.

## Success Criteria

- [ ] Sidebar exposes Runs, Approvals, Devices, Device Setup, Schedules, Fleet Health, and Pricing or documents why each stays hidden.
- [ ] Detail routes remain reachable by links from list/detail workflows.
- [ ] Role-gated Audit Logs behavior remains unchanged.
- [ ] Text fits at desktop and mobile sidebar states.

## Risk Assessment

- Risk: sidebar becomes noisy.
  Mitigation: grouped sections; keep detail routes hidden.
- Risk: role gates drift from route access.
  Mitigation: reuse `role-access.ts` helpers, do not duplicate policy strings.
