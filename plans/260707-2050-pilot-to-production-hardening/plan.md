---
title: Pilot-to-Production Hardening
description: >-
  Turn the current fully-covered MVP into a truthful pilot-to-production path
  with evidence gates, credential boundaries, safe fleet behavior, artifact
  policy, and release verification.
status: completed
priority: P1
branch: master
tags:
  - feature
  - security
  - backend
  - frontend
  - database
  - pilot-readiness
blockedBy: []
blocks: []
created: '2026-07-07T13:50:53.187Z'
createdBy: 'ck:plan'
source: skill
---

# Pilot-to-Production Hardening

## Overview

Harden SocialBot Orchestrator from a working MVP into a pilot-to-production candidate without adding marketplace, billing, native mobile, AI builder, or unsupported social-platform claims.

Scope is HOLD: implement only the accepted `004..009` specs. Current baseline is healthy: lint, typecheck, unit tests, web build, worker build, gateway build, and Python bridge tests all pass on 2026-07-07.

## Scope Challenge

- Existing code: readiness reports, role access, account encryption guard, Mobile MCP bridge auth, retry/backoff, target failure policy, artifact preview/storage helpers, CI, and verification scripts already exist.
- Minimum changes: formalize evidence gates, narrow first social workflow, harden credential/status boundaries, connect policy to launch/review surfaces, expand release gates. Do not rebuild auth, worker claim loop, macro engine, or bridge architecture.
- Complexity: six sequential phases, each tied to one accepted spec. Touchpoints are broad but bounded by existing modules and tests.
- Selected mode: HOLD SCOPE with hard planning. No new product bets; convert current capability into proveable readiness.

## Source Specs

- `specs/004-pilot-success-criteria/spec.md`
- `specs/005-first-real-social-workflow/spec.md`
- `specs/006-credential-storage-boundary/spec.md`
- `specs/007-readiness-gate-rules/spec.md`
- `specs/008-fleet-scale-failure-policy/spec.md`
- `specs/009-artifact-retention-object-storage/spec.md`

## Current Evidence

- Final local web checks pass on 2026-07-08: `npm.cmd run lint`, `npm.cmd run typecheck`, `npm.cmd run test` (`250 passed`), `npm.cmd run build`.
- Service checks pass: `npm.cmd run build:worker`, `npm.cmd run build:gateway`.
- Bridge checks pass: `python -m unittest discover -s services\mobile-mcp-bridge\tests -p "test_*.py"` and Python compile checks.
- Real Supabase/use-case verification passes with `19 PASS / 2 WARN / 1 SKIP`.
- Real Mobile MCP proof passes on Android serial `97249fb5`; latest verified run `5de2e8f8-357c-4848-91c6-a9c7b82aefc8` completed with 4 steps.
- CI covers web lint/typecheck/build/test, worker build, gateway build, Python bridge tests, and Python bridge compile checks.

## Non-Goals

- No billing/payment/subscription.
- No marketplace/template sales.
- No public social graph.
- No native mobile app.
- No anti-bot guarantee.
- No Laixi/iOS readiness claim without live proof.
- No production credential-vault claim until server-side boundary is specified and built.

## Phases

| Phase | Name | Status |
|-------|------|--------|
| 1 | [Pilot Readiness Foundation](./phase-01-pilot-readiness-foundation.md) | Completed |
| 2 | [First Real Social Workflow](./phase-02-first-real-social-workflow.md) | Completed |
| 3 | [Credential Boundary Hardening](./phase-03-credential-boundary-hardening.md) | Completed |
| 4 | [Readiness Gate Enforcement](./phase-04-readiness-gate-enforcement.md) | Completed |
| 5 | [Safe Fleet Failure Policy](./phase-05-safe-fleet-failure-policy.md) | Completed |
| 6 | [Artifact Retention And Release Gates](./phase-06-artifact-retention-and-release-gates.md) | Completed |

## Dependencies

- Related completed plans: `plans/260707-1031-stabilize-technical-health-roadmap-ux`, `plans/260707-1805-pilot-readiness-reports-analytics-labels`.
- Related blocked evidence plan: `plans/260506-mobile-mcp-pilot-readiness-smoke`; this plan supersedes its readiness proof path by re-baselining evidence in Phase 1.
- Required runtime dependency for live proof: an expected Android serial visible to ADB and valid Supabase/Mobile MCP env.

## Final Gates

- `npm.cmd run lint`
- `npm.cmd run typecheck`
- `npm.cmd run test`
- `npm.cmd run build`
- `npm.cmd run build:worker`
- `npm.cmd run build:gateway`
- `python -m unittest discover -s services\mobile-mcp-bridge\tests -p "test_*.py"`
- `python -m py_compile services\mobile-mcp-bridge\src\android_session_manager.py services\mobile-mcp-bridge\src\bridge_server.py services\mobile-mcp-bridge\src\json_response.py`
- `npm.cmd run verify:use-cases`
- Mobile MCP live proof commands when device/env are available: `npm.cmd run preflight:mobile-mcp`, `npm.cmd run verify:mobile-mcp`

## Open Questions

- Canonical Level 1 pilot device for the latest proof: `97249fb5`.
- First social proof remains Instagram open/screenshot/action-history only until a new approved spec promotes real engagement actions.
- CI worker/gateway/Python checks are now included as required jobs.
