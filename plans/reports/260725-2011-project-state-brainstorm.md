---
title: "Project State Brainstorm — Release Closure"
date: 2026-07-25
status: approved
mode: markdown
scope: "read-only architecture, quality, security, and verification audit"
---

# Project State Brainstorm — Release Closure

## Summary

The project is a mature Mobile MCP pilot, not yet a production release. Core orchestration, server-side credential vaulting, gateway hardening, evidence tooling, and bounded worker concurrency exist. Release risk is concentrated in authorization, deploy configuration, CI coverage, secure browser-to-control-plane paths, dependency remediation, and sign-off/documentation closure.

Approval: proceed with Option A — production release closure, no new product scope.

## Evidence baseline

- Stack: React 18/Vite/TypeScript SPA, Supabase Auth/Postgres/RLS, Node execution worker, Laixi gateway, Python Mobile MCP bridge.
- Worktree: 85 existing changes (53 modified, 31 untracked, 1 deleted); branch ahead of origin by 17 commits. No clean release baseline exists yet.
- Local verification:
  - `npm.cmd run typecheck`: pass
  - `npm.cmd run lint`: pass
  - `npm.cmd run build`: pass
  - `npm.cmd run build:worker`: pass
  - `npm.cmd run build:gateway`: pass
  - root Vitest: 49 files / 514 tests pass
  - worker Vitest: 9 files / 77 tests pass
  - gateway Vitest: 2 files / 12 tests pass
  - bridge pytest: 9 tests pass
  - Total observed: 612 tests pass
- Not run: authenticated Playwright E2E, live Supabase proof, real-device smoke.
- `npm audit`: 4 high advisories (PostCSS, React Router, brace-expansion); worker and gateway audits clean.

## Current state

### Implemented / evidenced

- SPA → Supabase → worker → gateway/bridge execution topology.
- Queue claim/lease, run lifecycle, artifacts, approvals, audit records.
- Server-side credential vault with controlled proof for the defined scope:
  `supabase/functions/credential-vault/index.ts:109-202`.
- Gateway fail-closed token policy and bounded multi-target worker concurrency.
- Readiness evidence model that distinguishes implemented, unit/smoke verified, pilot verified, blocked, and planned:
  `docs/project-roadmap.md:5-13`.

### In progress / not release-closed

- Production rollout plan remains `in-progress`; Phases 03–04 are pending:
  `plans/260722-2031-production-rollout-closure/plan.md:38-49`.
- Docker secret propagation, service test CI, E2E/coverage policy, dependency remediation, proof nonce/schema binding, owner sign-off, key rotation, documentation alignment, and clean tag remain open.
- Laixi live proof is externally blocked by VIP/API/session availability.

## Findings

### P0 — authorize `execute-run`

`supabase/functions/execute-run/index.ts:118-135` creates a service-role client and accepts caller-controlled `runId` without checking identity, role, ownership, or run-to-user relationship. Gateway JWT validation does not replace application authorization.

Recommendation: call `auth.getUser()`, load the caller profile, require the allowed role, and authorize the run against its owner/triggering user unless ADMIN. Add negative tests for viewer, unrelated operator, unknown run, and cross-tenant IDs. Remove wildcard CORS.

### P0 — complete Docker security contract

`docker-compose.yml:16-40` omits `CREDENTIAL_VAULT_WORKER_TOKEN` and gateway HTTP/enrollment token configuration while current services fail closed when those values are absent.

Recommendation: wire environment names consistently, add a non-secret compose contract check, and verify startup without printing secrets.

### P1 — secure browser control-plane paths

`src/hooks/useDevices.ts:53-96` calls Mobile MCP `/devices` without `X-Bridge-Token` and silently falls back to Laixi. `src/lib/mobile-mcp-orchestrator.ts:58-63` confirms no auth header is sent; the bridge protects `/devices` at `services/mobile-mcp-bridge/src/bridge_server.py:71-105`.

Recommendation: add a backend/Edge proxy; never expose `MOBILE_MCP_BRIDGE_TOKEN` through `VITE_*`. Apply the same design to gateway setup probes and enrollment provisioning.

### P1 — validate macro definitions completely

`src/contracts/macro.ts:98-162` does not require `inputs`, `target`, `execution`, or `step.params`, while `src/lib/run-preflight.ts:64-70` dereferences `definition.target.mode`.

Recommendation: validate the complete schema before persistence or dereference; add malformed-definition tests.

### P1 — make service tests part of CI

`.github/workflows/ci.yml:32-61` builds worker/gateway but only runs root tests. Service package manifests have no test scripts despite 89 service test cases.

Recommendation: add explicit worker/gateway test commands, an aggregate verification command, and a deterministic E2E policy (PR vs nightly).

### P1 — dependency and release governance

`npm audit` reports four high advisories. The release plan also requires fresh proof, sanitized evidence, owner sign-off, legacy key rotation, documentation alignment, and one clean tag.

Recommendation: patch the narrowest safe dependency set, run full gates, obtain deployment-owner approval, rotate legacy keys in a maintenance window, then tag only the verified baseline.

### P2 — integrity and maintainability debt

- `seed_demo_macros()` is `SECURITY DEFINER` and selects an arbitrary profile without visible caller authorization:
  `supabase/migrations/20260429075058_fix_seed_demo_macros_template_format.sql:15-20,243-275`.
- Signed device-event guard does not validate `protocolVersion`:
  `packages/shared/src/execution-contract.ts:286-302`.
- Large hotspots include the step runner, gateway session manager, readiness service, and schedules UI. Refactor only when release gates are closed.
- README, roadmap, deployment guide, and codebase summary contain stale scale, credential, and test-count claims.

## Options evaluated

### Option A — Production release closure (recommended)

Freeze features; fix authorization, deployment contracts, secure proxies, validation, CI, dependencies, evidence, docs, sign-off, and clean tag.

Pros: shortest path to a defensible release; preserves current architecture; reduces risk before more scope.

Cons: requires temporary feature freeze and deployment-owner/security decisions.

### Option B — Pilot-only containment

Fix only the highest authorization issue and document local/private-network limits.

Pros: fastest.

Cons: not production-ready; Docker, CI, token provisioning, and governance remain open.

### Option C — Architecture consolidation first

Unify run-control, remove browser mutation fallback, and refactor large modules before release.

Pros: cleaner long-term design.

Cons: larger regression surface; delays concrete release blockers; violates YAGNI for this milestone.

## Recommended sequence

1. Authorization and tenant/role tests for `execute-run`.
2. Docker and service-token contract.
3. Backend proxy for Mobile MCP/gateway browser flows.
4. Complete macro and protocol validation.
5. Service test scripts, CI matrix, E2E cadence, dependency fixes.
6. Fresh controlled proof and sanitized evidence.
7. Documentation normalization, owner sign-off, key rotation, clean commit/tag.
8. Only afterward evaluate fleet parallelism, Laixi live proof, and broad refactors.

## Acceptance criteria

- Unauthorized/cross-owner `execute-run` requests return a safe denial; authorized flows remain replay-safe.
- Compose supplies the complete secret contract; services start in production-like mode.
- Browser never receives backend bridge/gateway tokens.
- Malformed macros are rejected before save/preflight/worker execution.
- CI runs root, worker, gateway, bridge, and agreed E2E gates.
- No unreviewed high dependency advisory remains in the release dependency graph.
- Proof is fresh, schema/nonce-bound, sanitized, and linked to the exact commit/tag.
- Docs distinguish implemented, verified, pilot-verified, blocked, and planned claims.
- Owner sign-off and legacy key rotation are recorded with rollback evidence.

## Out of scope

New social features, billing, Laixi live proof, fleet-scale claims, and broad architecture consolidation.

## Unresolved decisions

- Production origin allowlist and gateway auth deployment mechanism.
- Trusted proof-harness owner and retention location.
- Key-rotation maintenance window and rollback authority.
- Whether Playwright E2E runs on every PR or nightly; target coverage threshold.

## Next step

Handoff to `/ck:plan --tdd` using this report as the design baseline. No source files were modified by this brainstorm.
