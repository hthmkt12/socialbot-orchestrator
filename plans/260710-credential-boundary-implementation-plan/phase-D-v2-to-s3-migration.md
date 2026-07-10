# Phase D - `v2:` to `s3:` Migration

## Context Links

- Parent plan: `plans/260710-credential-boundary-implementation-plan/plan.md`
- Current crypto helper: `src/lib/account-password-crypto.ts`
- Account schema: `supabase/migrations/20260627000001_account_tables.sql`

## Overview

Date: 2026-07-10
Priority: P1
Implementation status: Pending
Review status: Not reviewed

Migrate existing pilot client-encrypted `v2:` payloads to server-managed `s3:` payloads.

## Key Insights

- Migration requires access to the old `VITE_ACCOUNT_PASSWORD_KEY`.
- Migration must be resumable and auditable.
- Do not delete `v2:` decrypt support until all rows migrate.

## Requirements

- Add migration endpoint or admin script.
- Migrate by account id or batch.
- Preserve rollback path.
- Mark failed rows as `migration_pending` or equivalent.

## Architecture

Preferred:

- Edge Function route `credential-vault/migrate`.
- Input: `{ accountId }`
- Reads `accounts.encrypted_password`.
- If prefix `v2:`, decrypt with old pilot key supplied as server secret.
- Re-encrypt with `SERVER_CREDENTIAL_KEY`.
- Update payload to `s3:`.

## Related Code Files

- `supabase/functions/credential-vault/index.ts`
- `scripts/*` migration runner (proposed)
- `src/lib/database.types.ts`
- `docs/project-roadmap.md`

## Implementation Steps

1. Add migrate route with admin/service-role requirements.
2. Add dry-run mode to count `v2:` rows.
3. Add migration runner script.
4. Add report output under `plans/reports/credential-migration-*.json`.
5. Run on test dataset before real data.

## Todo List

- [ ] Dry-run migration count.
- [ ] Batch migration script.
- [ ] Per-row success/failure report.
- [ ] `v2:` compatibility retained.

## Success Criteria

- Existing rows migrate to `s3:` without plaintext persistence.
- Failed migrations are reported and do not corrupt original payloads.
- Reverse migration procedure is documented.

## Risk Assessment

- High risk: wrong old key makes payload unrecoverable if update is not guarded.
- Must never overwrite original payload until decrypt + encrypt both succeed.

## Security Considerations

- Do not print old key.
- Do not print plaintext.
- Redact account usernames if reports may leave local workspace.

## Next Steps

Proceed to Phase E only after a clean migration report.
