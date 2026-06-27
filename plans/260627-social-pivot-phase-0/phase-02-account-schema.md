---
title: "Phase 02: Account Schema & Migrations"
status: in_progress
priority: P1
created: 2026-06-27
---

# Phase 02: Account Schema & Migrations

## Context Links
- Brainstorm report: `plans/brainstorm-report-social-first-roadmap.md` (db schema section)
- Plan: `plans/260627-social-pivot-phase-0/plan.md`
- Existing migrations: `supabase/migrations/`

## Overview
Priority: P1. Create database schema for social media account lifecycle tracking. Write SQL migration, account CRUD hooks, and TypeScript types.

## Requirements
- Create `accounts` table with platform, warm-up, action limit fields
- Create `account_action_history` table for per-action tracking
- Enable RLS on both tables
- Add account CRUD hooks (React Query)

## Files to Modify/Create
| File | Action |
|------|--------|
| `supabase/migrations/20260627000000_accounts.sql` | Create |
| `src/lib/database.types.ts` | Modify — add account types |
| `src/hooks/use-accounts.ts` | Create |
| `src/lib/account-service-helpers.ts` | Create |

## Implementation Steps

- [ ] Step 1: Write migration SQL for `accounts` + `account_action_history`
- [ ] Step 2: Add TypeScript types to `database.types.ts`
- [ ] Step 3: Create `use-accounts.ts` React Query hooks
- [ ] Step 4: Create `account-service-helpers.ts` for CRUD operations
- [ ] Step 5: Verify `npm.cmd test`, `npm.cmd run typecheck`, `npm.cmd run lint`, `npm.cmd run build`

## Success Criteria
- Migration SQL is syntactically valid PostgreSQL
- Account types compile in TypeScript
- React Query hooks have correct type signatures
- All static checks pass

## Risks
- Migration cannot be applied until Supabase DNS resolves — SQL is pre-written and reviewed
- Account password storage strategy (encrypted vs OAuth) not yet decided — use encrypted text field for now, migrate to OAuth later
