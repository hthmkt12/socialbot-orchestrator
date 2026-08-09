---
title: "Phase 02B authorization slice"
date: 2026-07-25
status: in-progress
---

# Phase 02B Authorization Slice

## Context

The release-closure plan identified a service-role authorization gap in `execute-run`: the function accepted a caller-controlled run ID while bypassing RLS.

## What happened

- Added shared run-control authorization with ADMIN and owner-OPERATOR policy.
- Validated bearer identity with `auth.getUser()` and profile role/id.
- Matched ownership against `workflow_runs.triggered_by_user_id` (`profiles.id`).
- Added exact-origin CORS handling and malformed JSON 400 response.
- Added 13 focused authorization tests, including cross-owner and profile/auth ID mismatch cases.
- Updated deployment and architecture docs; added common-issues guidance.

## Verification

- Focused Vitest: 13/13 pass.
- Root Vitest: 520/520 pass.
- Typecheck and lint: pass.
- Worker and gateway builds: pass.

## Decision

Keep service-role mutation behind server-side authorization. Do not expose bridge or gateway tokens to the browser. Treat the secure backend proxy as the remaining Phase 02B gate.

## Next

Implement the Mobile MCP/gateway server-side proxy, add token non-disclosure tests, run a fresh security review, then continue to Phase 03 CI/dependency closure.

## Concerns

Production origin must be explicitly configured; the worktree contains mixed historical changes and is not ready for one broad commit.
