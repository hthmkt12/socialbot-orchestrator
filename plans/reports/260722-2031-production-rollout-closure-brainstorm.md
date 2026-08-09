---
title: "Production Rollout Closure Brainstorm"
description: "Evidence-backed current-state audit and recommended release-closure path for SocialBot Orchestrator."
status: approved
created: 2026-07-22
tags: [brainstorm, release-closure, credential-boundary, mobile-mcp, pilot-readiness]
---

# Production Rollout Closure Brainstorm

## Summary

The project has a credible pilot architecture, but it is not release-ready. The correct next move is production-rollout closure: freeze new features, close credential-boundary and verification gaps, create a clean committed baseline, then refresh pilot evidence.

No source code was changed during this audit.

## Problem Statement

The repository contains a broad React/Supabase/worker/gateway/bridge platform and substantial credential-boundary work, but implementation status, deployment contracts, evidence freshness, CI coverage, and the Git baseline are not aligned. Continuing feature work before closing these gaps increases the chance of shipping an unverifiable or insecure release.

## Exact Requirements

- Expected output: a release-closure plan and evidence checklist; no implementation in this brainstorm.
- Acceptance: all P0 gates are explicit, independently verifiable, and tied to repository evidence.
- Scope: credential boundary, artifact/log redaction, verification determinism, deployment contract, CI gates, operational sign-off, docs/status alignment.
- Out of scope: new social features, Laixi live proof, fleet-scale parallelism, billing, AI workflow builder.
- Constraints: preserve existing React 18/Vite/TypeScript/Supabase stack; do not expose secrets; keep Mobile MCP as pilot-default backend.
- Touchpoints: `services/execution-worker`, `supabase/functions/credential-vault`, `services/laixi-gateway`, `docker-compose.yml`, `.github/workflows/ci.yml`, readiness tests, roadmap/deployment docs, and `plans/` status metadata.

## Current Evidence

- Typecheck, lint, frontend build, worker build, gateway build passed in the fresh audit.
- Python bridge tests passed 9/9.
- Root unit suite failed 1/492 at `src/lib/readiness-report-service.test.ts:320`; the fixture is older than the 14-day freshness window implemented at `src/lib/readiness-report-service.ts:58`.
- High-confidence secret patterns found no matches in scanned source; `.env` is not tracked.
- `npm audit` reported one high transitive `brace-expansion` vulnerability with an available fix.
- Working tree contains 38 modified tracked files plus untracked remediation/proof files; the verified state is not represented by a clean commit.
- Current docs still contain deployment and product claims that exceed or lag current evidence.

## P0 Release Blockers

1. Redaction fails open beyond depth 10 at `services/execution-worker/src/credential-redaction.ts:40-45`. Replace unchanged passthrough with a redacted sentinel/truncation or a hard failure; add a deeply nested regression test.
2. Artifact persistence does not enforce literal-value scrubbing at `services/execution-worker/src/worker-run-store.ts:306-333`. Make the persistence boundary scrub both structured keys and sensitive literals; test direct artifact callers.
3. Make readiness tests deterministic by injecting/faking `now` or using relative fixtures. The current test is time-dependent and keeps CI red as evidence ages.
4. Complete production operational sign-off and rotate the legacy backend key. Roadmap and remediation documents still describe this follow-up as open.
5. Produce one clean commit/tag containing code, docs, sanitized proof artifacts, and the exact verification commands/results.

## P1 Release Work

- Add explicit gateway authentication/network isolation/rate limiting for `/sessions`, `/dispatch-step`, and WebSocket paths.
- Replace credential-vault wildcard CORS with configured application origins and document the threat model.
- Pass `CREDENTIAL_VAULT_WORKER_TOKEN` through the Docker worker contract; document Mobile MCP bridge and Supabase as external dependencies if they remain outside Compose.
- Add worker and gateway test execution to CI; add Playwright E2E and a stated coverage policy.
- Treat external runtime-proof JSON as untrusted input: validate schema, bind proof to a nonce/canary/hash, and document the trusted-harness assumption.
- Update the lockfile to resolve the transitive `brace-expansion` vulnerability without broad dependency upgrades.

## P2 Follow-ups

- Deprecate or remove the legacy in-process orchestrator after caller inventory; retain one canonical execution path.
- Align README/PDR/roadmap/deployment claims with verified scope: scale, anti-detection, failover, device identity, and credential flow.
- Mark obsolete blocked plans as superseded and create one current P0 production-rollout-closure plan.
- Split large UI/credential files and optimize large lazy-loaded bundles after release closure.

## Alternatives Considered

### A. Production rollout closure (recommended)

Pros: reduces security and governance risk first; produces an auditable baseline; preserves pilot momentum after gates close.

Cons: delays new feature work; requires coordinated docs, CI, deployment, and operational decisions.

### B. Pilot evidence first

Pros: fastest path to another demo and fresh device evidence.

Cons: repeats verification on top of a dirty baseline and leaves deployment/security contract gaps unresolved.

### C. Architecture consolidation first

Pros: best long-term simplification of execution/state ownership.

Cons: broad refactor with high regression risk; not justified before release blockers are closed.

## Recommendation

Approve option A. Sequence the work as: (1) characterize and fix redaction/test failures, (2) harden persistence and service boundaries, (3) close Docker/CI/dependency contracts, (4) obtain operational sign-off and rotate keys, (5) align docs and plan metadata, (6) create a clean baseline, and (7) refresh Level-1 pilot evidence.

## Success Metrics

- Root unit suite: 0 failures; worker/gateway tests run in CI.
- Typecheck, lint, frontend/worker/gateway builds: green.
- Deep nesting, direct artifact writes, thrown driver errors, and screenshot/log paths have redaction tests.
- No wildcard credential CORS in production configuration; gateway dispatch requires authenticated access or a documented private network boundary.
- Docker worker has the complete credential-vault environment contract.
- Key rotation and operational sign-off recorded.
- Clean tag/baseline contains sanitized proof and identifies the canonical pilot device and evidence expiry.

## Handoff

Recommended next skill: `ck:plan --tdd`, because the work modifies security-sensitive persistence and critical execution behavior and must preserve existing behavior through characterization tests first.
