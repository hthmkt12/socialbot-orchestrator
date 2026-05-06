---
title: "Specify Gap Hard Priority Plan"
description: "Re-baseline current Laixi/Mobile MCP truth, close OPS-08 honestly, then stabilize Spec Kit/docs and pilot hardening."
status: completed
priority: P1
effort: 3d
branch: master
tags: [specify, gap-analysis, mobile-mcp, ops-08, pilot-readiness]
created: 2026-05-05
---

# Specify Gap Hard Priority Plan

## Context
- Current app root: `F:\project-bolt-sb1-keyopwhy\project`.
- Current repo state: app root is a git repo on `master`.
- Current baseline commits: `4ec0de0 feat: harden agent instructions`; `881a3ac feat: add project baseline`.
- Current plan source: `plans/20260504-1000-cto-hard-plan-laixi-platform/`.
- Current blocker: none inside the 2026-05-04 hard backlog after Mobile MCP OPS-08 closure.
- Current preflight: passing after smoke operator ensure and ADB device sync.

## Phase Order
1. [Phase 01: Restore Current Preflight Baseline](./phase-01-restore-current-preflight-baseline.md)
   Status: completed
   Priority: P0
   Goal: make current shell/runtime pass preflight again before claiming readiness.
2. [Phase 02: Close OPS-08 Live Validation Gate](./phase-02-close-ops-08-live-validation-gate.md)
   Status: completed
   Priority: P1
   Goal: capture clean path and failure path against the agreed live backend/device path.
3. [Phase 03: Normalize Specify And Project Docs](./phase-03-normalize-specify-and-project-docs.md)
   Status: completed
   Priority: P1
   Goal: decide and create the canonical Spec Kit/docs workflow.
4. [Phase 04: Pilot Hardening Backlog](./phase-04-pilot-hardening-backlog.md)
   Status: completed
   Priority: P2
   Goal: address maintainability, bundle, artifact, and backend capability risks.

## Hard Priorities
- P0: current verification truth must be reproducible from current shell.
- P1: `OPS-08` must close with real evidence, not stale report.
- P1: Spec Kit/docs workflow exists on disk.
- P2: reduce code/file-size and pilot UX risks after runtime truth is stable.

## Validation Gates
- Gate A: `npm.cmd run preflight:mobile-mcp` passes from current shell. Completed.
- Gate B: `npm.cmd run verify:mobile-mcp` passes from current shell. Completed.
- Gate C: clean live onboarding path and one real failure path are captured. Completed.
- Gate D: plan/backlog/OPS-08 status updated to match evidence. Completed.

## Unresolved Questions
- Should first real Spec Kit feature create `specs/` from this baseline?
- Is separate Laixi gateway proof still needed after Mobile MCP OPS-08 closure?
