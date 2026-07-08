---
phase: 2
title: "Production Credential Boundary"
status: completed
priority: P1
dependencies: [1]
effort: "1d-2d"
---

# Phase 2: Production Credential Boundary

## Overview

Define and implement the next credential boundary so the app no longer relies on browser-side social account password encryption as its only future path. This phase should preserve current pilot behavior while making production migration explicit and technically enforceable.

## Requirements

- Functional: account create/import flows keep working for pilot mode with `VITE_ACCOUNT_PASSWORD_KEY`, while production credential handling has an explicit server-owned interface or migration path.
- Non-functional: plaintext credentials are never shown in UI, logs, readiness reports, artifacts, or docs.
- Compatibility: existing `v2:` pilot encrypted payloads are not silently broken.

## Architecture

Preferred direction: introduce a narrow server-side credential boundary instead of broad auth redesign.

Candidate implementation options to evaluate during this phase:

- Supabase Edge Function for encrypt/decrypt/write operations with service-side key ownership.
- Existing execution worker endpoint for credential operations, if deployment ownership is clearer.
- Deferred implementation with strict policy model and migration spec, if runtime service ownership is not yet settled.

Hard rule: do not claim production credential-vault readiness until the selected server-owned path is implemented and verified.

## Related Code Files

- Modify: `src/lib/account-password-crypto.ts`
- Modify: `src/components/accounts/create-account-modal.tsx`
- Modify: `src/components/accounts/csv-import-modal.tsx`
- Modify: `src/lib/account-csv-import-parser.ts`
- Modify: `src/lib/readiness-report-service.ts`
- Modify: `docs/deployment-guide.md`
- Modify: `docs/backend-capability-matrix.md`
- Verify: `src/lib/account-password-crypto.test.ts`
- Verify: `src/lib/account-csv-import-parser.test.ts`
- Verify: `src/lib/readiness-report-service.test.ts`

## Implementation Steps

1. Audit every account credential touchpoint and confirm where plaintext can enter memory.
2. Add a credential boundary decision note inside this phase or `docs/decisions/` if implementation ownership is not obvious.
3. Add or update tests proving missing/weak browser key blocks pilot save/import before DB writes.
4. Add tests proving readiness evidence and artifacts reject or scrub secret-like fields.
5. Introduce a production-boundary status model: `pilot_client_encrypted`, `server_boundary_required`, and future `server_managed`.
6. If server-side implementation is selected now, add the smallest service/API boundary and migration compatibility for existing `v2:` payloads.
7. Update UI copy to state capability without exposing implementation details or plaintext.
8. Update deployment and roadmap docs so production credential claims match the implemented boundary.

## Success Criteria

- [ ] Existing pilot account credential flow remains usable with a valid key.
- [ ] Missing/weak key still blocks save/import.
- [ ] No UI/report/artifact surface prints plaintext or encrypted payload previews.
- [ ] Production credential status is explicit and not overstated.
- [ ] Tests cover the boundary and redaction rules.

## Risk Assessment

Risk: introducing a half-built credential service creates false security.
Mitigation: if server ownership is not ready, ship a precise policy boundary and migration plan, not a production claim.

Risk: breaking existing pilot accounts.
Mitigation: preserve `v2:` payload compatibility or provide an explicit migration path before changing storage format.
