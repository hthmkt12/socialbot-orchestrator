---
title: "Production Rollout Closure"
description: "TDD plan to close authorization, service-boundary, CI, dependency, proof, and release-governance gaps."
status: in-progress
priority: P0
effort: 5-7d
branch: master
tags: [release-closure, tdd, security, authorization, credential-boundary]
created: 2026-07-22
---

# Production Rollout Closure

## Objective

Create an evidence-backed release baseline for the existing Mobile MCP pilot. Preserve the React/Supabase/worker architecture; add no product scope. Source evidence and approved design: [brainstorm](../reports/260725-2011-project-state-brainstorm.md).

## Scope / non-goals

In scope: run authorization, secure browser control-plane paths, gateway/vault boundaries, Docker contracts, service CI/tests, dependency remediation, macro/protocol validation, proof integrity, docs, owner sign-off, key rotation, and clean tag.

Out of scope: new social features, Laixi live proof, fleet-scale claims, billing, and broad architecture consolidation.

## TDD sequence

1. [Phase 01 — characterization/redaction](./phase-01-characterization-redaction.md) — completed.
2. [Phase 02 — gateway/vault boundaries](./phase-02-gateway-vault-boundaries.md) — completed; preserve its tests.
3. [Phase 02B — application authorization and secure control plane](./phase-02b-authorization-control-plane.md) — completed; authorization and authenticated browser proxies verified.
4. [Phase 03 — Docker, CI, dependencies, validation](./phase-03-docker-ci-dependency.md) — pending; depends on 02B contracts.
5. [Phase 04 — proof, docs, sign-off, baseline](./phase-04-proof-docs-signoff-baseline.md) — pending; depends on 03.

## Cross-phase gates

- Characterization and redaction tests green before boundary changes.
- Authorization and token contracts green before CI/release proof.
- No live secret/device mutation in ordinary CI.
- Owner-only key rotation and production-origin decisions remain external approvals.

## Release acceptance

- Cross-tenant `execute-run` start/cancel denied; authorized flows replay-safe.
- Browser never receives bridge/gateway backend tokens.
- Compose starts production-like services with complete server-only env contract.
- Root, worker, gateway, bridge, lint, typecheck, builds, and agreed E2E gates run in CI.
- No unreviewed high dependency advisory remains.
- Proof is fresh, schema/nonce-bound, sanitized, and tied to the release commit.
- Docs/status claims match evidence; owner sign-off, key rotation, rollback, and clean tag recorded.

## Risks / unresolved decisions

- Production origin allowlist and gateway auth deployment mechanism.
- Trusted proof-harness owner/retention.
- Key-rotation window and rollback authority.
- Playwright E2E cadence and coverage threshold.

Status: in-progress
Progress: Phase 02B authorization and secure Mobile MCP/gateway browser control-plane paths completed and verified.
Next: proceed to Phase 03 Docker/CI/dependency validation.
