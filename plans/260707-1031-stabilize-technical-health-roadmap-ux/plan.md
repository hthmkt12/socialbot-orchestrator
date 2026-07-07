---
title: 'Stabilize Technical Health, Roadmap, and UX'
description: >-
  Fix review blockers across verification gates, account/bridge security,
  roadmap truthfulness, and operator navigation.
status: completed
priority: P1
branch: master
tags:
  - bugfix
  - security
  - frontend
  - docs
  - tech-debt
blockedBy: []
blocks: []
created: '2026-07-07T03:31:57.829Z'
createdBy: 'ck:plan'
source: skill
---

# Stabilize Technical Health, Roadmap, and UX

## Overview

This plan converts the codebase review findings into an implementation sequence. Goal: make the app safer to pilot and easier to operate by first restoring verification gates, then hardening sensitive credential/device-control paths, then aligning product docs and navigation with the real state of the system.

Scope is intentionally held, not expanded. No new social-bot features, no major redesign, no storage migration. Fix what blocks trustworthy shipping.

## Review Evidence

| Area | Evidence | Risk |
|------|----------|------|
| Typecheck | `npm run typecheck` fails at `src/components/macros/MacroDetailVersionsPanel.tsx:79` | Strict TS gate red |
| Lint | `npm run lint` scans `coverage/` and `.venv`, plus `no-explicit-any` source/test errors | CI/dev signal noisy |
| Security | `src/lib/account-password-crypto.ts:13` uses static frontend passphrase | Social account passwords weakly protected |
| Security | `services/mobile-mcp-bridge/src/bridge_server.py:20` skips auth when token missing | Device-control endpoint can be open in misconfig |
| Roadmap | `docs/project-roadmap.md:67` and later mark future phases complete | Product truth drift |
| UX | `src/App.tsx` exposes more core routes than `src/components/layout/Sidebar.tsx` | Operators cannot discover key workflows |

## Scope Challenge

- Existing code: strong test/build scripts, strict TypeScript, RLS migrations, route-level lazy loading, role-aware UI helpers.
- Minimum changes: fix verification config/types, replace unsafe credential defaults, make bridge auth fail-closed outside explicit dev mode, correct roadmap statuses, expose core navigation.
- Complexity: expected 8-12 touched files, no new service, no new database schema unless security implementation requires a narrow migration.
- Selected mode: HOLD SCOPE with TDD-style verification per phase.

## Approach Options

| Option | Pros | Cons | Decision |
|--------|------|------|----------|
| Patch gates only | Fast, low risk | Leaves security/product trust gaps | Reject |
| Security-first big refactor | Solves highest-risk area first | Hard to verify while gates are red | Reject |
| Gate-first stabilization, then security/docs/UX | Builds on green checks, keeps blast radius small | Slightly slower than hotfix | Choose |

## Phases

| Phase | Name | Status |
|-------|------|--------|
| 1 | [Repair Verification Gates](./phase-01-repair-verification-gates.md) | Completed |
| 2 | [Secure Credentials And Bridge Defaults](./phase-02-secure-credentials-and-bridge-defaults.md) | Completed |
| 3 | [Align Roadmap And Readiness Docs](./phase-03-align-roadmap-and-readiness-docs.md) | Completed |
| 4 | [Improve Operator Navigation UX](./phase-04-improve-operator-navigation-ux.md) | Completed |
| 5 | [Final Verification And Release Handoff](./phase-05-final-verification-and-release-handoff.md) | Completed |

## Dependencies

- Context only: `plans/260506-mobile-mcp-pilot-readiness-smoke/plan.md` remains blocked by local device readiness. This plan does not require that device to be online.
- Context only: `plans/20260504-1000-cto-hard-plan-laixi-platform/plan.md` explains earlier backend/runtime priorities. This plan narrows to review remediation.

## Non-Goals

- No new automation templates or social bot behavior.
- No full visual redesign.
- No production secrets migration beyond the minimum needed to remove static/pass-through unsafe defaults.
- No Laixi live-session proof unless already available during final verification.

## Global Acceptance Criteria

- `npm.cmd run typecheck` passes.
- `npm.cmd run lint` passes without scanning generated dependency/artifact folders.
- `npm.cmd test` remains green.
- `npm.cmd run build` passes.
- Security-sensitive defaults are documented and fail safe.
- Roadmap separates complete, pilot-verified, blocked, and future work.
- Primary operator workflows are reachable from the sidebar.
