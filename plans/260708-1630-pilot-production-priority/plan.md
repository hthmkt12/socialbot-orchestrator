---
title: Pilot Production Priority Implementation
description: >-
  Execute the agreed three-axis priority path: reduce execution-worker
  maintainability risk, define a production credential boundary, simplify the
  operator journey, and re-verify the pilot-ready baseline without expanding MVP
  scope.
status: completed
priority: P1
branch: master
tags:
  - tech-debt
  - security
  - frontend
  - product-roadmap
  - pilot-readiness
blockedBy: []
blocks: []
created: '2026-07-08T09:32:51.889Z'
createdBy: 'ck:plan'
source: skill
---

# Pilot Production Priority Implementation

## Overview

This plan turns `plans/reports/260708-1629-three-axis-priority-report.md` into an implementation sequence.

Goal: keep the current pilot-ready baseline honest while preparing the codebase for the next production-readiness step. The first move is not a new feature; it is reducing execution risk in the worker, then tightening the credential boundary, then making the daily operator path easier to follow.

## Scope Challenge

- Existing baseline is healthy: `typecheck`, `lint`, app build, worker build, gateway build, unit tests, Python bridge tests, and navigation e2e passed on 2026-07-08.
- Biggest technical mismatch: docs claim all source files are below 200 lines, but `single-device-step-runner.ts` is 783 lines and several page/service files are still 300+ lines.
- Biggest security/product boundary: browser-side `VITE_ACCOUNT_PASSWORD_KEY` is explicitly pilot-only, not a production credential vault.
- Biggest UX issue: the app has the right operational surfaces, but the operator journey is still broad instead of presenting a crisp go/no-go path.
- Scope decision: refactor and harden existing surfaces. No billing, marketplace, native mobile, AI builder, social graph, anti-bot guarantee, Laixi readiness claim, or production-vault claim without proof.

## Source Evidence

- Three-axis report: `plans/reports/260708-1629-three-axis-priority-report.md`
- Completed stabilization plan: `plans/260707-1031-stabilize-technical-health-roadmap-ux/plan.md`
- Completed pilot hardening plan: `plans/260707-2050-pilot-to-production-hardening/plan.md`
- Current roadmap: `docs/project-roadmap.md`
- Backend capability matrix: `docs/backend-capability-matrix.md`
- Deployment credential warning: `docs/deployment-guide.md`

## Phases

| Phase | Name | Status |
|-------|------|--------|
| 1 | [Refactor Execution Hotspots](./phase-01-refactor-execution-hotspots.md) | Completed |
| 2 | [Production Credential Boundary](./phase-02-production-credential-boundary.md) | Completed |
| 3 | [Operator Journey Cleanup](./phase-03-operator-journey-cleanup.md) | Completed |
| 4 | [Verification And Documentation](./phase-04-verification-and-documentation.md) | Completed |

## Dependencies

- Context only: `plans/260506-mobile-mcp-pilot-readiness-smoke/plan.md` remains historically blocked by runtime/device/env conditions. This plan should not block on it.
- Context only: `plans/20260504-1000-cto-hard-plan-laixi-platform/plan.md` describes the earlier broad platform direction. This plan narrows to current pilot-production priorities.
- Completed predecessor: `plans/260707-2050-pilot-to-production-hardening/plan.md`.

## Global Acceptance Criteria

- `npm.cmd run typecheck`
- `npm.cmd run lint`
- `npm.cmd test`
- `npm.cmd run build`
- `npm.cmd run build:worker`
- `npm.cmd run build:gateway`
- `python -m unittest discover -s services\mobile-mcp-bridge\tests -p "test_*.py"`
- `npm.cmd run test:e2e -- tests/e2e/navigation.spec.ts`
- Runtime-only gates, when device/env are available: `npm.cmd run preflight:mobile-mcp` and `npm.cmd run verify:mobile-mcp`

## Non-Goals

- No billing/payment/subscription work.
- No marketplace/template sales.
- No public social graph/network.
- No native mobile app.
- No AI workflow builder.
- No anti-bot guarantee.
- No Laixi/iOS readiness claim without live proof.
- No broad database rewrite.

## Handoff Notes

- Use TDD/regression-safe extraction for Phase 1. Refactor behavior only after relevant tests are green.
- Prefer narrow modules over new architecture. Keep worker queue, run claim, macro execution, and bridge dispatch semantics intact.
- Treat docs as claims. If implementation changes file-size or readiness status, update docs in Phase 4.
