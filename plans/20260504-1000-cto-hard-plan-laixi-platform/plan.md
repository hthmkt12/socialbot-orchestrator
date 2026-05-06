# CTO Hard Plan: Laixi Platform

Status: In Progress
Date: 2026-05-04
Scope: move the product from browser-driven internal MVP to durable pilot-ready orchestration platform

## Current State
- React + Supabase app is real and usable for auth, devices, groups, macros, runs, approvals, and audit views.
- Frontend dispatch and cancel now go through a backend control-plane path instead of direct browser-owned live execution.
- Queued runs can be claimed with durable leases, single-device and multi-target execution run backend-side, approval resume is now backend-owned in code, the gateway now owns device websocket sessions plus step dispatch, screenshot/log artifacts are source/build-verified with run-detail previews, and a repeatable backend smoke suite now covers start/cancel/approval-resume resilience.
- Device surfaces and gateway session health now share one lifecycle policy for heartbeat freshness: `15s` expected cadence, stale after `45s`, offline after `120s`.
- Device rows can now persist gateway-owned freshness and last-error fields for product consumption when the gateway is started with service-role env.
- Device Setup is now a live onboarding verification surface with operator diagnostics plus first-line recovery actions for recheck, reconnect prep, and expired-lock cleanup.
- Devices and run-launch surfaces now expose `device_locks` so operators can see contention before dispatch instead of discovering it after a failed claim.
- Devices page now shows fleet counters for healthy, stale, busy, error, and locked devices, giving operators a simple first-stop health overview.
- Run launch now has a shared preflight layer that blocks bad inputs, target mismatches, unresolved references, and unapproved sensitive steps before dispatch.
- Run detail and monitor surfaces now translate structured step failures into operator-readable reasons and hints instead of dumping raw JSON only.
- Run detail now groups screenshots and log artifacts by step/device so operators can inspect stored evidence from the UI instead of a flat artifact dump.
- Runs, approvals, macros, sidebar navigation, and audit surfaces now expose role-aware action gating that matches the existing RLS intent instead of failing only at mutation time.
- Approval list, approval detail, and live run monitor now explain requested action, risk, and approve/reject outcomes without forcing reviewers into raw payload inspection.
- Audit logs now support domain-level filtering and direct links into run detail, run monitor, approval context, and focused step evidence when the audit payload carries enough linkage metadata.
- Macro create and new-version flows now include a minimal guided builder for common flat workflows while keeping raw JSON for advanced structures.
- Macro create now also offers reusable starter templates for common recurring workflows, with advanced starters routed into raw JSON when they use unsupported structure.
- OPS-08 live onboarding validation is closed for the accepted pilot backend, Mobile MCP, with a clean real-device UI smoke and an expected-missing-device failure-path report.
- Database schema is materially ahead of the execution architecture.

## Phases
1. Phase 01: [Backend Execution And Gateway](./phase-01-backend-execution-and-gateway.md)
   Status: in progress
   Goal: remove browser ownership of run lifecycle.
2. Phase 02: [Device Connectivity And Operations](./phase-02-device-connectivity-and-operations.md)
   Status: in progress
   Goal: make device onboarding and status trustworthy.
3. Phase 03: [Operator Productization](./phase-03-operator-productization.md)
   Status: in progress
   Goal: make the platform usable beyond technical power users.

## Backlog
- [Implementation Backlog](./implementation-backlog.md)

## Hard Priorities
- P1: backend worker and gateway service
- P2: device onboarding, heartbeat freshness, reconnect, diagnostics
- P3: macro builder, artifact evidence, approval and audit UX

## Key Dependencies
- Phase 02 depends on a stable gateway contract from Phase 01.
- Phase 03 depends on durable execution and trustworthy device state from Phases 01-02.
- Security and role enforcement must evolve with each phase, not at the end.

## Go/No-Go Gates
- Phase 01 Go: a run survives tab close, page refresh, and approval delay. Source/build path is implemented through gateway dispatch with inline artifact persistence plus repeatable smoke coverage; live smoke is still pending.
- Phase 02 Go: a Mobile MCP device can be onboarded, verified, and diagnosed without developer intervention.
- Phase 03 Go: common operator flows no longer require raw JSON editing or database inspection.

## Delivery Metrics
- Durable run completion rate after UI disconnect
- Device freshness accuracy vs real online state
- Median onboarding time per device
- Median time to identify run failure root cause
- Percentage of common macros created without raw JSON editing

## Constraints
- Do not market this snapshot as production orchestration before Phase 01 is complete.
- Do not invest heavily in builder UX while execution still depends on the browser.
- Keep the current UI usable while replacing the execution ownership model under it.

## Unresolved Questions
- Should the gateway be owned in this repo or as a separately deployed service?
- Should execution live in Supabase-native functions/jobs, a standalone Node worker, or both?
- What storage path should own artifacts: Supabase Storage only, or external object storage?
- Is separate Laixi gateway proof still required after Mobile MCP was accepted for pilot OPS-08?
