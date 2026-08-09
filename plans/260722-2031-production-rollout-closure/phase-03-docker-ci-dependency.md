---
title: "Phase 03 — Docker, CI, dependencies, and validation"
status: in-progress
---

# Phase 03 — Docker, CI, dependencies, and validation

## Context links

Parent: [plan.md](./plan.md); depends on [Phase 02B](./phase-02b-authorization-control-plane.md). CI: `.github/workflows/ci.yml:9-76`; Compose: `docker-compose.yml:16-40`.

## Overview

Date: 2026-07-25. Description: make the release contract executable and auditable in CI. Priority: P1. Implementation status: CI/service aggregation, Compose env contract, deterministic E2E, macro/protocol guards, and ESLint 10 remediation completed; React Router and Tailwind dependency decisions remain. Review status: CI/security owner review required.

## Key Insights

- Root test command excludes worker/gateway tests: `package.json:11`.
- CI builds but does not test worker/gateway: `.github/workflows/ci.yml:32-61`.
- Current npm audit reports four high advisories; worker/gateway audits are clean.
- Macro and shared protocol guards have validation gaps: `src/contracts/macro.ts:98-162`, `packages/shared/src/execution-contract.ts:286-302`.

## Requirements

- Add explicit worker/gateway test scripts and aggregate verification.
- Run root, worker, gateway, bridge, lint, typecheck, and builds in CI.
- Add deterministic E2E policy without live devices in ordinary CI.
- Add Compose env-contract/startup checks using server-only variables.
- Patch the narrowest dependency set and rerun audits.
- Reject malformed macros and unsupported/missing signed-event protocol versions.

## Architecture

Keep separate frontend, service, and bridge jobs; inject secrets only at runtime; isolate live-device verification to a protected workflow.

## Related code files

`.github/workflows/ci.yml:9-76`; `package.json:11`; `services/execution-worker/package.json:6-16`; `services/laixi-gateway/package.json:6-10`; `docker-compose.yml:16-40`; `src/contracts/macro.ts:98-162`; `packages/shared/src/execution-contract.ts:286-302`.

## Implementation Steps

1. Add characterization commands and capture current test counts.
2. Add service test scripts and CI jobs.
3. Add Compose contract tests and deterministic E2E job/cadence.
4. Fix dependency advisories with lockfile review.
5. Add macro/protocol negative tests and guards.
6. Run complete matrix on Windows and CI.

## Todo list

- [x] Worker/gateway test scripts
- [x] Aggregate verification command
- [x] CI service matrix
- [x] Compose env contract
- [x] E2E/coverage policy (deterministic visitor-auth smoke in CI; live-device journeys remain protected/manual)
- [ ] Dependency remediation (PostCSS patched; React Router remains advisory-blocked because fixed 8.3 requires React 19, while the app is React 18; ESLint 10 is also a breaking upgrade)
- [x] Macro/protocol guard tests

## Success Criteria

CI reports each layer independently; Compose production-like startup has complete env contract; no high dependency finding remains; all negative tests pass.

## Risk Assessment

CI expansion may expose flaky tests or missing service dependencies; keep jobs isolated and do not make live devices a PR prerequisite.

## Security Considerations

Mask secrets, never echo expanded Compose values, and ensure backend tokens never enter frontend build args or artifacts.

## Next steps

Pass green CI artifacts and exact commands to Phase 04.
