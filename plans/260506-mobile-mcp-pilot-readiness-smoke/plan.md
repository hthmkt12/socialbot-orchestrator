---
title: "Mobile MCP Pilot Readiness Smoke"
description: "Reproduce Mobile MCP readiness, complete artifact-bearing run-detail smoke, and sync evidence/docs without changing product architecture."
status: blocked
priority: P1
effort: 0.5d-1d
branch: master
tags: [mobile-mcp, pilot-readiness, artifact-smoke, evidence]
created: 2026-05-06
---

# Mobile MCP Pilot Readiness Smoke Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `executing-plans` or `subagent-driven-development` to execute task-by-task. Do not implement architecture changes unless a phase explicitly says so.

**Goal:** prove current Mobile MCP pilot path is reproducible from this workstation and close the deferred run-detail artifact evidence smoke.

**Architecture:** no new architecture. Use existing Mobile MCP bridge, worker queue, Supabase run/artifact tables, and Run Detail evidence UI. Keep Laixi future-compatible but not pilot-blocking.

**Tech Stack:** React/Vite/TypeScript, Supabase, execution worker, Mobile MCP bridge, Android ADB, Vitest, npm scripts.

## Current Evidence

- Static/app checks passed live on 2026-05-06: `npm.cmd test`, `typecheck`, `lint`, `build`, `build:worker`, `build:gateway`, `smoke:backend`.
- Current `status:mobile-mcp` on 2026-05-06 shows runtime down and expected serial `QC4DKJUO6PW4FMQW` offline.
- Prior Mobile MCP full verify report exists and passed on 2026-05-05.

## Phase Order

1. [Phase 01: Restore Mobile MCP Runtime Readiness](./phase-01-restore-mobile-mcp-runtime-readiness.md)
   Status: partial
   Priority: P0
   Goal: make local runtime/device readiness current again.
   Note: local stack (ADB, bridge, worker, UI) operational with Redmi `97249fb5`. Supabase DNS blocked — network issue, not code.
2. [Phase 02: Complete Artifact-Bearing Run Detail Smoke](./phase-02-complete-artifact-bearing-run-detail-smoke.md)
   Status: blocked
   Priority: P1
   Goal: produce a completed run with artifacts and manually verify Run Detail evidence UI.
3. [Phase 03: Sync Evidence And Pilot Docs](./phase-03-sync-evidence-and-pilot-docs.md)
   Status: partial
   Priority: P1
   Goal: record current blocker, limitations, and next workflow decision; final smoke evidence sync remains pending.

## Explicit Non-Goals

- No Supabase Storage/object storage.
- No parallel multi-target execution.
- No Mobile MCP `run_autox` support.
- No Laixi clean-path proof unless external Laixi session becomes available.
- No broad refactor.

## Success Criteria

- Mobile MCP status/preflight/verify reports are current and stored under `plans/reports/`.
- One authenticated artifact-bearing completed run exists and Run Detail artifact evidence is manually checked.
- Docs reflect current evidence and unresolved blockers.
- Working tree remains clean except intentional docs/plan/evidence updates.

## Execution Result

- 2026-05-06 status report: `plans/reports/mobile-mcp-status-2026-05-06T10-58-12-223Z.json`.
- 2026-05-06 device diagnosis report: `plans/reports/mobile-mcp-wait-devices-2026-05-06T10-58-27-212Z.json`.
- 2026-05-06 verification summary: `plans/260506-mobile-mcp-pilot-readiness-smoke/reports/verification-summary.md`.
- **2026-06-27 update:** Phase 01 unblocked and re-executed. Redmi device `97249fb5` connected via ADB. Bridge, worker, and Vite UI all healthy. Fixed `spawn EINVAL` (missing `shell: isWindows`) and bridge serial field mismatch (`device.id` → `device.id ?? device.serial`) in runtime/status/preflight/wait scripts.
- Current evidence:
  - Status report: `plans/reports/mobile-mcp-status-2026-06-27T01-31-37-864Z.json`.
  - Device wait report: `plans/reports/mobile-mcp-wait-devices-2026-06-27T01-37-44-527Z.json`.
  - Preflight report: `plans/reports/mobile-mcp-preflight-2026-06-27T01-39-50-568Z.json`.
  - Verify report: `plans/reports/mobile-mcp-verify-2026-06-27T01-40-03-819Z.json`.
- **Remaining blocker:** `ENOTFOUND gzwwqhgvrfsqokrxfhyu.supabase.co` — DNS cannot resolve Supabase URL from this machine. Blocks `operator.ensure`, `devices.sync`, preflight DB checks, and UI smoke.
- Fresh Mobile MCP artifact-producing smoke and manual Run Detail evidence inspection cannot proceed until Supabase DNS is reachable.
- Expected serial changed from `QC4DKJUO6PW4FMQW` to `97249fb5` (Redmi/onyx, Android 16).

## Dependencies

- Android device `QC4DKJUO6PW4FMQW` or updated expected serial must be online in `adb devices`.
- Mobile MCP bridge, execution worker, Vite UI, and Supabase env must be available.
- Operator account/env configured through existing Mobile MCP scripts.

## Unresolved Questions

- Is `QC4DKJUO6PW4FMQW` still the correct pilot device serial?
- Which real pilot macro/workflow should follow after this smoke closes?
