---
phase: 2
title: "Account Lifecycle Tracking"
status: completed
effort: "Medium"
---

# Phase 2: Account Lifecycle Tracking

## Context Links
- `project/supabase/migrations/20260627000001_account_tables.sql`
- `plans/brainstorm-report-social-first-roadmap.md`

## Overview
Build the data access layer (React Query hooks) and backend integrations to manage social media accounts, track their action history, and enforce limits based on the schema created in Phase 0.

## Requirements
- Functional:
  - Create hooks to fetch, create, update, and delete accounts.
  - Create hooks to fetch account action history.
  - Implement logic in the execution worker to check daily limits before executing social actions.
  - Implement logic to record action results (success/blocked) into `account_action_history`.
- Non-functional: Must securely handle account credentials (relying on Supabase RLS and secure storage patterns).

## Architecture
- Frontend: React Query hooks in `src/hooks/useAccounts.ts` interacting with Supabase client.
- Backend: Execution worker updates `accounts.current_action_count` and inserts into `account_action_history` during run execution.

## Related Code Files
- Create: `src/hooks/useAccounts.ts`
- Modify: `services/execution-worker/src/index.ts` (or specific run controller) to validate limits and log actions.

## Implementation Steps
1. Create `useAccounts.ts` exporting hooks: `useAccounts` (list), `useAccount` (single), `useCreateAccount`, `useUpdateAccount`, `useDeleteAccount`.
2. Create `useAccountActionHistory` hook.
3. In the execution worker, add a pre-execution check: if the run is associated with an account, verify `current_action_count < daily_action_limit`. If exceeded, fail the run or skip actions.
4. Add post-step/post-run logic in the worker to log the action outcome to `account_action_history` and increment the count.

## Success Criteria
- [x] Hooks successfully perform CRUD operations on the `accounts` table.
- [x] Worker prevents execution if an account has hit its daily limit.
- [x] Worker correctly logs action history upon success or failure.

## Risk Assessment
- Risk: High throughput of action history inserts could impact performance.
- Mitigation: Batch inserts if necessary, or ensure the DB connection pool in the worker is adequately sized. Rely on the already created indexes.
