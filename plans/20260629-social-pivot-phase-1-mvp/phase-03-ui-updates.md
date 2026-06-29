---
phase: 3
title: "UI Updates"
status: completed
effort: "Medium"
---

# Phase 3: UI Updates

## Context Links
- `plans/brainstorm-report-social-first-roadmap.md`

## Overview
Develop the user interface for managing social media accounts, viewing their health/status, and assigning them to workflows.

## Requirements
- Functional:
  - Account List View: Show all accounts, platform, warm-up stage, daily limit, and current action count.
  - Account Detail View: Show action history, block status, and allow editing limits.
  - Account Creation Form: Simple UI to add new accounts.
  - Integration: Allow selecting an account when initiating a workflow run.
- Non-functional: Align with existing design system and Tailwind patterns.

## Architecture
Standard React SPA architecture using React Router for navigation and the hooks created in Phase 2 for data fetching.

## Related Code Files
- Create: `src/pages/AccountsPage.tsx`
- Create: `src/pages/AccountDetailPage.tsx`
- Create: `src/components/accounts/AccountForm.tsx`
- Create: `src/components/accounts/AccountList.tsx`
- Modify: `src/App.tsx` (add routes)
- Modify: `src/components/layout/Sidebar.tsx` (add navigation link)
- Modify: `src/components/runs/RunForm.tsx` (or equivalent workflow initiation UI) to include account selection.

## Implementation Steps
1. Add routing for `/accounts` and `/accounts/:id` in `App.tsx`.
2. Add "Accounts" to the main sidebar navigation.
3. Build `AccountsPage` displaying a table/grid of accounts using `useAccounts`.
4. Build `AccountForm` for adding new accounts.
5. Build `AccountDetailPage` showing metrics and a list of recent actions using `useAccountActionHistory`.
6. Update the workflow execution UI to include a dropdown for selecting a target account for the run.

## Success Criteria
- [x] Users can navigate to the Accounts page and see their accounts.
- [x] Users can add a new account.
- [x] Workflow execution can be explicitly tied to a specific account via the UI.

## Risk Assessment
- Risk: UI becomes cluttered if a user has many accounts (e.g., 50+).
- Mitigation: Implement pagination or virtualization in the AccountList component from the start.
