---
title: "Pilot Readiness Reports And Analytics Source Labels"
description: "Add a narrow pilot-readiness report workflow and make analytics data provenance explicit without expanding the MVP into billing, marketplace, AI builder, or public social features."
status: complete
priority: P2
branch: "master"
tags: [feature, frontend, database, analytics, pilot-readiness]
blockedBy: []
blocks: []
created: "2026-07-07T11:20:27.615Z"
createdBy: "ck:plan"
source: skill
---

# Pilot Readiness Reports And Analytics Source Labels

## Overview

Implement the first accepted slice of the proposed `Pilot Readiness And Safe Scale` backlog: pilot readiness reports plus analytics data-source labeling.

This plan intentionally does not implement credential rotation, failover/rotation, retry/backoff, or artifact retention yet. Those are higher-risk follow-up use cases. Phase A should make the product better at proving what is ready and preventing analytics misunderstanding, while preserving the current fully-covered MVP baseline.

## Scope Challenge

- Existing code: `scripts/verify-mobile-mcp-local.mjs` already writes verification reports under `plans/reports/`; `/analytics` already exists; `execution_profiles`, admin pages, role helpers, and out-of-scope guardrails are already covered.
- Minimum changes: add persisted/readable readiness report records, admin/operator UI around reports, and analytics provenance labels. Do not rebuild scripts, auth, macro execution, or bridge auth.
- Complexity: expected 8-12 touched files plus one migration and focused tests. No more than two new service modules.
- Selected mode: HOLD SCOPE with TDD-style verification. Keep this to Phase A only.

## Active Scope

### In Scope

- Persist pilot readiness report metadata in Supabase.
- Let operators create/import/link readiness reports from existing verification output.
- Let admins review reports and set decision: `pilot_verified`, `not_verified`, or `needs_rerun`.
- Enforce evidence gates before `pilot_verified`.
- Add read-only visibility for viewers where safe.
- Label analytics as `real persisted data`, `seed/demo data`, or `insufficient data`.
- Update use-case docs only after implementation proves the new behavior.

### Out Of Scope

- No credential rotation or server-side credential vault.
- No account/device failover or rotation policy.
- No retry/backoff worker changes.
- No billing, marketplace, public social graph, native mobile, offline-first, or AI workflow builder.
- No Laixi/iOS readiness claim without evidence.
- No external customer sharing/export audit package.

## Architecture Summary

| Area | Design |
| --- | --- |
| Data model | Add `pilot_readiness_reports` table with status, backend, report path, evidence JSON, decision fields, actor fields, timestamps, and RLS. |
| Permissions | Operator can create reports; Admin can review/decide; Viewer can read safe report summaries. No secret fields are stored. |
| Services | Add `readiness-report-service` for validation, CRUD, and decision rules. Reuse existing Supabase/client patterns. |
| UI | Add `/readiness` under Insights or Operations; show report list, evidence summary, and admin decision controls. |
| Analytics | Add source classifier helper and UI badge/state in existing analytics components. |
| Evidence gate | `pilot_verified` requires backend, report path or report JSON, runtime health, at least one device/session identifier, and completed smoke/run evidence for the backend being verified. |

## Phases

| Phase | Name | Status |
|-------|------|--------|
| 1 | [Readiness Report Foundation](./phase-01-readiness-report-foundation.md) | Complete |
| 2 | [Readiness Review UI](./phase-02-readiness-review-ui.md) | Complete |
| 3 | [Analytics Source Labels](./phase-03-analytics-source-labels.md) | Complete |
| 4 | [Verification And Coverage](./phase-04-verification-and-coverage.md) | Complete |

## Dependencies

Related but not blocking:

- `plans/260506-mobile-mcp-pilot-readiness-smoke/plan.md` provides prior smoke/evidence workflow context. This plan productizes report metadata and review, but does not require that blocked smoke plan to finish before implementation.
- `docs/use-cases-next-pilot-readiness-safe-scale.md` is the proposed use-case backlog. Promote only the Phase A use cases after implementation.

## Conflict Rules To Preserve

- Admins cannot see plaintext social passwords.
- Operators cannot mark readiness verified.
- Viewer remains read-only.
- Bridge tokens, service-role keys, smoke passwords, and local env values must never be persisted in report evidence.
- Laixi/iOS cannot be marked verified without proof matching the existing guardrails.
- Existing MVP source of truth stays stable until new feature tests pass.

## Acceptance Criteria

- [x] New report records can be created from safe report metadata without secrets.
- [x] Operator can create/request review but cannot mark verified.
- [x] Admin can mark `pilot_verified`, `not_verified`, or `needs_rerun`.
- [x] `pilot_verified` is rejected when required evidence is missing.
- [x] Viewer can read safe summaries only.
- [x] Analytics UI clearly labels real/insufficient/unknown data states; seed/demo is not guessed because `account_analytics` has no provenance field.
- [x] No out-of-scope route or ghost feature is reintroduced.
- [x] Tests cover permission boundaries, evidence validation, and analytics source classification.

## Verification Commands

- `npm.cmd run test`
- `npm.cmd run typecheck`
- `npm.cmd run build`
- Optional when touching bridge evidence: `python -m unittest discover -s services\mobile-mcp-bridge\tests -p "test_*.py"`

## Open Questions

- Resolved: `/readiness` lives under Insights.
- Resolved: Viewer can read safe report summaries only.
- Resolved: v1 uses manual metadata plus safe report path; JSON file parsing stays future scope.
