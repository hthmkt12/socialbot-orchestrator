---
title: "Three-Axis Priority Report"
date: 2026-07-08
status: agreed
scope:
  - technical-health
  - product-roadmap
  - user-experience
---

# Three-Axis Priority Report

## Summary

Decision: continue from the current pilot-ready baseline, but do not claim production-scale readiness yet.

Priority order:

1. Refactor technical hotspots that concentrate execution risk.
2. Move social credential handling toward a production boundary.
3. Simplify the operator journey around readiness, accounts, runs, monitoring, and analytics.

## Current Evidence

Fresh local gates passed on 2026-07-08:

| Gate | Result |
| --- | --- |
| `npm.cmd run typecheck` | Pass |
| `npm.cmd run lint` | Pass |
| `npm.cmd test` | Pass, 33 files / 279 tests |
| `npm.cmd run build` | Pass |
| `npm.cmd run build:worker` | Pass |
| `npm.cmd run build:gateway` | Pass |
| `python -m unittest discover -s services\mobile-mcp-bridge\tests -p "test_*.py"` | Pass, 6 tests |
| `npm.cmd run test:e2e -- tests/e2e/navigation.spec.ts` | Pass, 3 tests |

## Findings

### Technical Health

Strong:

- Verification discipline is good: static, unit, build, worker, gateway, bridge, and navigation gates are green.
- CI covers lint, typecheck, app build, worker build, gateway build, unit tests, Python bridge tests, and Python compile checks.
- Runtime boundaries are clearer than a normal MVP: frontend, worker, gateway, Mobile MCP bridge, and Supabase each have named responsibilities.

Risks:

- File-size debt remains. `services/execution-worker/src/single-device-step-runner.ts` is 783 lines; `src/pages/SchedulesPage.tsx` is 346 lines; `src/lib/readiness-report-service.ts` is 332 lines.
- Existing docs claim all source files are below 200 lines, which is not currently true.
- Mobile MCP proof depends on local device/env availability.
- Laixi live proof remains externally blocked.

### Product Roadmap

Strong:

- Roadmap separates implemented, verified, blocked, planned, and pilot-verified states.
- Scope guardrails are healthy: billing, marketplace, native mobile, offline-first, public social graph, and AI builder are excluded from MVP runtime.
- Mobile MCP is correctly treated as pilot default; Laixi remains future-compatible.

Risks:

- Do not over-sell fleet speed. Sequential multi-target execution remains acceptable for pilot unless an SLA requires parallel throughput.
- Credential storage remains pilot-only until server-side encryption/key management exists.
- Object storage policy is implemented, but scale readiness still depends on real artifact volume and retention needs.

### User Experience

Strong:

- App opens into a real operator surface, not a marketing page.
- Sidebar now exposes the core operational routes: Social Dashboard, Runs, Approvals, Devices, Device Setup, Accounts, Analytics, Readiness, Fleet Health, and System Monitor.
- Role-aware visibility exists for audit/admin routes.
- Navigation e2e is green.

Risks:

- Operator path is still broad. New users can land in too many operational screens without a single go/no-go flow.
- Analytics chunk is large enough to watch as charts/features grow.
- Readiness evidence exists, but the core workflow should surface the next best action more directly.

## Recommended Execution Plan

### Phase 1: Refactor Execution Hotspots

Goal: reduce risk in the files most likely to break worker behavior.

Targets:

- Split `single-device-step-runner.ts` by step dispatch, artifact persistence, budget/account policy, and loop/control behavior.
- Keep current worker behavior locked with existing tests before extraction.
- Update file-size docs after measuring the real result.

Acceptance gates:

- `npm.cmd test`
- `npm.cmd run build:worker`
- Relevant worker smoke if runtime/env available.

### Phase 2: Production Credential Boundary

Goal: stop treating browser-side credential encryption as anything beyond pilot.

Targets:

- Define server-side encryption/decryption ownership.
- Ensure UI never implies production vault readiness.
- Keep plaintext out of UI, docs, reports, and artifacts.
- Add migration/backward-compatibility rules for existing `v2:` pilot payloads.

Acceptance gates:

- Credential crypto tests.
- Account create/import tests.
- Role/readiness tests for secret redaction.

### Phase 3: Operator Journey Cleanup

Goal: make the daily product flow obvious.

Primary journey:

`Readiness -> Accounts -> Runs -> Monitor -> Analytics`

Targets:

- Promote go/no-go status in Social Dashboard.
- Make Readiness show the next recovery action when proof is stale/missing.
- Keep Mobile MCP/System Monitor/Execution Profiles as advanced/admin surfaces.
- Preserve route coverage and role restrictions.

Acceptance gates:

- `npm.cmd run test:e2e -- tests/e2e/navigation.spec.ts`
- Add one e2e for the primary operator journey when auth fixtures are stable.
- `npm.cmd run build` and chunk size review.

## Non-Goals

- No billing/payment/subscription.
- No marketplace/template sales.
- No public social network/social graph.
- No native mobile app.
- No anti-bot guarantee.
- No Laixi/iOS readiness claim without live proof.
- No production credential-vault claim until server-side boundary exists.

## Next Step

Convert this report into an implementation plan with three phases, starting with execution-worker refactor under test protection.

## Unresolved Questions

- Should the 200-line file target be a hard rule or a guideline for only production source files?
- What is the required production credential boundary: Supabase Edge Function, worker-owned service, or separate vault service?
- What fleet-size or runtime SLA makes sequential multi-target execution unacceptable?
