---
title: "Phase 01 — Characterization and redaction"
status: completed
---

# Phase 01 — Characterization and redaction

## Goal

Make persistence and readiness validation deterministic and fail-closed before changing service boundaries.

## TDD tasks

1. Add tests covering >10-level nested objects, arrays, non-string sensitive values, circular/unsupported values, and no mutation for `redactSensitiveValues` [services/execution-worker/src/credential-redaction.ts:40-73](../../services/execution-worker/src/credential-redaction.ts#L40-L73).
2. Add direct `createLogArtifact` tests for structured metadata, literal `password=...` text, screenshot/log paths, and thrown upload errors [services/execution-worker/src/worker-run-store.ts:306-333](../../services/execution-worker/src/worker-run-store.ts#L306-L333).
3. Add characterization tests for `persistRunStep` output/error and all artifact callers; assert plaintext never reaches Supabase payloads.
4. Freeze readiness time via an injected clock or explicit `now` argument; repair the stale fixture around the 14-day policy [services/execution-worker/src/credential-redaction.ts:44](../../services/execution-worker/src/credential-redaction.ts#L44), [src/lib/readiness-report-service.ts:58-60](../../src/lib/readiness-report-service.ts#L58-L60), [src/lib/readiness-report-service.test.ts:304-320](../../src/lib/readiness-report-service.test.ts#L304-L320).
5. Implement the minimum fix: replace depth passthrough with a redacted sentinel/truncation or hard failure; scrub literal values at the persistence boundary, including upload errors.

## Acceptance gate

Root and worker tests pass with deterministic time; deep nesting and direct artifact tests prove no sensitive literal is persisted or logged; no redaction path returns the original secret-bearing object.

## Dependencies / risks

Depends on existing redaction utility and worker store contracts. Risk of breaking diagnostic metadata is mitigated by preserving allow-listed status keys [services/execution-worker/src/credential-redaction.ts:18-25](../../services/execution-worker/src/credential-redaction.ts#L18-L25).

## Security notes

Do not print real credentials while constructing fixtures. Use unique canary strings and assert absence from serialized Supabase calls.

## Context links
Parent: [plan.md](./plan.md); [code standards](../../docs/code-standards.md#L14-L23); [brainstorm](../reports/260722-2031-production-rollout-closure-brainstorm.md#L33-L52).

## Overview
Date: 2026-07-22. Priority: P0. Implementation status: completed. Review status: PASS after independent code review.

## Key Insights
Depth guard fails open [credential-redaction.ts:40-45](../../services/execution-worker/src/credential-redaction.ts#L40-L45); freshness is 14 days [readiness-report-service.ts:58-60](../../src/lib/readiness-report-service.ts#L58-L60).

## Requirements
Fail closed, preserve allow-listed status keys, and make readiness time deterministic.

## Architecture
Redaction precedes worker persistence; readiness accepts an injected clock.

## Related code files
`services/execution-worker/src/credential-redaction.ts:40-73`; `services/execution-worker/src/worker-run-store.ts:306-333`; `src/lib/readiness-report-service.test.ts:304-320`.

## Implementation Steps
Add regression tests, implement sentinel/hard failure, scrub literal text, freeze clock, run tests/build.

## Todo list
- [x] Deep nesting and canary tests
- [x] Fail-closed implementation
- [x] Deterministic readiness fixture

## Success Criteria
Root/worker tests and build pass; canary absent from DB payloads, artifacts, and errors.

## Risk Assessment
Diagnostic metadata may change; retain allow-list and characterize consumers.

## Security Considerations
Use synthetic canaries only; never log real credentials.

## Next steps
Phase 01 gate is green. Start Phase 02 only after owner confirms gateway auth/origin decisions.
