# Phase A - Schema/Status Preparation

## Context Links

- Parent plan: `plans/260710-credential-boundary-implementation-plan/plan.md`
- Design: `plans/260708-1630-pilot-production-priority/reports/phase-08-production-credential-boundary-design.md`
- Current schema: `supabase/migrations/20260627000001_account_tables.sql`
- Current policy helper: `src/lib/account-password-crypto.ts`

## Overview

Date: 2026-07-10
Priority: P1
Implementation status: Implemented
Review status: Reviewed with minor fixes

Prepare account credential metadata without changing runtime behavior.

## Key Insights

- Current `accounts.encrypted_password` stores `v2:` payloads only.
- Current `CredentialPolicyStatus` already includes `server_managed`, but it is inactive.
- The first implementation phase should be backward compatible and data-only.

## Requirements

- Add migration for credential metadata only.
- Preserve existing `v2:` account rows.
- No plaintext columns.
- No UI behavior change yet.

## Architecture

Proposed columns:

- `accounts.credential_policy_status text`
- `accounts.credential_key_version int`
- `accounts.credential_rotated_at timestamptz`

Allowed statuses:

- `pilot_client_encrypted`
- `server_boundary_required`
- `server_managed`
- `migration_pending`

## Related Code Files

- `supabase/migrations/*`
- `src/lib/database.types.ts`
- `src/lib/account-password-crypto.ts`
- `docs/decisions/20260708-credential-boundary.md`

## Implementation Steps

1. Add Supabase migration with nullable credential metadata columns.
2. Backfill existing `v2:` rows as `pilot_client_encrypted`.
3. Regenerate or update local database types.
4. Update docs to mark schema preparation complete only after migration exists.

## Todo List

- [x] Migration added: `supabase/migrations/20260710000001_credential_boundary_metadata.sql`
- [x] Types updated: `src/lib/database.types.ts` (`Account` interface gains 3 nullable fields)
- [x] `CredentialPolicyStatus` union updated: added `migration_pending` in `src/lib/account-password-crypto.ts`
- [x] Type test added: `src/lib/account-password-crypto.test.ts` verifies `migration_pending` is assignable
- [x] Rollback SQL documented in migration file comments
- [x] Review fix: migration constraint creation guarded against duplicate constraint names
- [x] Review fix: `credential_policy_status` typed as `AccountCredentialPolicyStatus | null`

## Files Changed

- `supabase/migrations/20260710000001_credential_boundary_metadata.sql` (created)
- `src/lib/database.types.ts` (modified: `Account` interface)
- `src/lib/account-password-crypto.ts` (modified: `CredentialPolicyStatus` union)
- `src/lib/account-password-crypto.test.ts` (modified: added type inclusion test)

## Review Notes

- Confirmed no Edge Function, UI behavior, worker decrypt behavior, or plaintext column was added.
- Tightened migration idempotency by wrapping the check constraint in a `pg_constraint` existence check.
- Tightened TypeScript surface by adding `AccountCredentialPolicyStatus` in `src/lib/database.types.ts` and reusing it in `account-password-crypto.ts`.

## Verification Commands

| Command | Status |
|---------|--------|
| `npm.cmd run lint` | PASS |
| `npm.cmd run typecheck` | PASS |
| `npm.cmd test` | PASS (284 tests, 33 files) |
| `npm.cmd run build` | PASS (built in 1.86s) |

## Success Criteria

- Existing account save/import still works exactly as before.
- Existing `v2:` rows remain readable.
- No UI changes.

## Risk Assessment

- Low risk if columns are nullable and no behavior depends on them immediately.
- Main risk is divergent status names from existing `CredentialPolicyStatus`.

## Security Considerations

- Do not add plaintext column.
- Do not weaken RLS.

## Next Steps

Proceed to Phase B only after migration and types are reviewed.
