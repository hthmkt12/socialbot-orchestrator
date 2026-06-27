# Phase 0: Social-First Platform Reorientation

**Date:** 2026-06-27
**Status:** planning
**Priority:** P1
**Branch:** master

## Context

Strategic decision per `plans/brainstorm-report-social-first-roadmap.md`: pivot from generic device orchestration → social media automation platform.

Phase 0 is foundation: rename, reposition docs, add account schema, verify Mobile MCP stability.

## Current Baseline

- Mobile MCP stack healthy: bridge (200), worker (200, mobile-mcp), Vite UI (200)
- Device `97249fb5` (Redmi/onyx, Android 16) online via ADB
- 12/12 preflight checks pass locally
- Full verify blocked on Supabase DNS (`ENOTFOUND gzwwqhgvrfsqokrxfhyu.supabase.co`)
- All source files under 200 lines, tests/typecheck/lint/build pass

## Phase Order

1. [Phase 01: Reposition Docs & Messaging](./phase-01-reposition-docs.md)
   Status: pending
   Priority: P1
   Goal: update README, project-overview-pdr, roadmap to reflect social positioning
   Note: no DB needed, fully doable now

2. [Phase 02: Account Schema & Migrations](./phase-02-account-schema.md)
   Status: pending
   Priority: P1
   Goal: create `accounts` + `account_action_history` tables; write migration SQL
   Note: can write SQL now; running migration needs Supabase DNS

3. [Phase 03: Account API & Hooks](./phase-03-account-api-hooks.md)
   Status: pending
   Priority: P2
   Goal: account CRUD hooks, service helpers, React Query integration
   Note: can write code now; end-to-end test needs Supabase

4. [Phase 04: Verify Mobile MCP Stability](./phase-04-verify-stability.md)
   Status: pending
   Priority: P1
   Goal: document current stability evidence; run smoke when Supabase is back
   Note: evidence exists (12/12 preflight); full smoke blocked on DNS

## Dependencies

- Supabase DNS resolution for migration execution and full verification
- No external API/Laixi dependencies for Phase 0

## Success Criteria

- README, project-overview-pdr, roadmap updated with social positioning
- `accounts` and `account_action_history` migration SQL written and reviewed
- Account CRUD hooks implemented
- Mobile MCP stability evidence documented
- `npm.cmd test`, `npm.cmd run typecheck`, `npm.cmd run lint`, `npm.cmd run build` pass after each code change

## Unresolved Questions

- Final platform name: "SocialBot Orchestrator" vs "Account Automation Platform" vs other?
- Instagram/TikTok API vs UI automation for initial accounts?
- Encrypted password storage or OAuth tokens?
