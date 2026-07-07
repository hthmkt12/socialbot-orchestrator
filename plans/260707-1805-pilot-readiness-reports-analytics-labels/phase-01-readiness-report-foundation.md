---
phase: 1
title: "Readiness Report Foundation"
status: complete
priority: P1
dependencies: []
effort: "0.5d-1d"
---

# Phase 1: Readiness Report Foundation

## Overview

Create the persistence and service boundary for pilot readiness reports. This phase adds the minimum backend/data contract needed by the UI without changing runtime execution.

## Requirements

- Functional: store safe report metadata and evidence needed for readiness decisions.
- Functional: validate report decisions, especially `pilot_verified`.
- Functional: support role-specific service calls for create/read/review.
- Non-functional: never store secrets, raw env dumps, bridge tokens, service-role keys, or smoke passwords.
- Non-functional: follow existing Supabase + service helper patterns.

## Architecture

Add a `pilot_readiness_reports` table and service module.

Proposed fields:

| Field | Purpose |
| --- | --- |
| `id` | Primary key |
| `backend` | `mobile_mcp`, `laixi`, `ios_portal`, or `unknown` |
| `status` | `draft`, `submitted`, `pilot_verified`, `not_verified`, `needs_rerun` |
| `report_path` | Optional repo-local report path, no absolute private path required in UI |
| `evidence_json` | Redacted evidence: runtime health, device serial/session, run id, artifact summary, timestamps |
| `created_by_user_id` | Operator/Admin who created report |
| `reviewed_by_user_id` | Admin who reviewed report |
| `reviewed_at` | Review timestamp |
| `review_notes` | Human-readable decision notes |
| timestamps | `created_at`, `updated_at` |

Decision rule:

```ts
pilot_verified requires:
- backend is not unknown
- evidence_json has runtime health or report status
- evidence_json has device serial/session id
- evidence_json has run id or smoke result reference
- backend-specific proof is present for laixi or ios_portal
```

## Related Code Files

- Create: `supabase/migrations/<timestamp>_pilot_readiness_reports.sql`
- Create: `src/lib/readiness-report-service.ts`
- Create: `src/lib/readiness-report-service.test.ts`
- Modify: `src/lib/database.types.ts`
- Modify: `src/lib/role-access.ts`
- Modify: `src/lib/role-access.test.ts`
- Optional modify: `docs/use-cases-next-pilot-readiness-safe-scale.md` only if wording needs clarification.

## Implementation Steps

1. Add status/backend types to `database.types.ts`.
2. Add permissions:
   - `readiness_reports.read`
   - `readiness_reports.create`
   - `readiness_reports.review`
3. Map permissions:
   - Viewer: read safe summaries.
   - Operator: read + create/submit.
   - Admin: read + create + review.
4. Add Supabase migration with RLS:
   - Authenticated read for safe fields.
   - Operator/Admin insert.
   - Admin-only review/status update to terminal decision statuses.
5. Implement service functions:
   - `fetchReadinessReports()`
   - `createReadinessReport(input)`
   - `submitReadinessReport(id)`
   - `reviewReadinessReport(id, decision)`
   - `validateReadinessEvidence(report, decision)`
6. Add unit tests for:
   - Operator create allowed.
   - Operator review blocked.
   - Admin review allowed.
   - `pilot_verified` rejected without required evidence.
   - Secret-like evidence keys rejected or stripped.

## Success Criteria

- [x] Migration creates table with RLS and no secret fields.
- [x] Service tests prove role/evidence boundaries.
- [x] Existing role tests still pass.
- [x] No existing auth or run execution behavior changes.

## Risk Assessment

Main risk: accidentally storing secrets from report JSON. Mitigation: sanitize evidence input and add tests for forbidden keys like `SUPABASE_SERVICE_ROLE_KEY`, `MOBILE_MCP_BRIDGE_TOKEN`, `UI_SMOKE_PASSWORD`, `VITE_ACCOUNT_PASSWORD_KEY`.
