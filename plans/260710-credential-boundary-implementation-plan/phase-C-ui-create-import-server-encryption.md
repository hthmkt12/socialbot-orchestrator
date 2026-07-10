# Phase C - UI Create/Import Server Encryption

## Context Links

- Parent plan: `plans/260710-credential-boundary-implementation-plan/plan.md`
- Account modal: `src/components/accounts/create-account-modal.tsx`
- Account page CSV flow: `src/pages/AccountsPage.tsx`
- CSV modal: `src/components/accounts/csv-import-modal.tsx`

## Overview

Date: 2026-07-10
Priority: P1
Implementation status: Pending
Review status: Not reviewed

Switch create/import from browser encryption to the Edge Function encrypt endpoint.

## Key Insights

- Keep the same account table write shape: `encrypted_password` remains text.
- UI should show `server_managed` only after server encrypt succeeds.
- Do not remove `v2:` compatibility yet.

## Requirements

- Create client helper for server encryption.
- Update create account flow.
- Update CSV import flow.
- Preserve role gates.
- Keep client-side `encryptPassword` as rollback/legacy until Phase D completes.

## Architecture

Add a small helper:

- `src/lib/account-credential-vault-client.ts` (proposed)
- Calls Supabase Edge Function `credential-vault/encrypt`.
- Returns `encrypted_password` plus key version metadata when available.

## Related Code Files

- `src/components/accounts/create-account-modal.tsx`
- `src/pages/AccountsPage.tsx`
- `src/components/accounts/csv-import-modal.tsx`
- `src/hooks/use-accounts.ts`
- `src/lib/account-password-crypto.ts`

## Implementation Steps

1. Add vault client helper.
2. Update create account modal to call helper before submit.
3. Update CSV import loop to batch or serially call helper.
4. Surface clear error if Edge Function unavailable.
5. Keep fallback disabled by default unless rollback flag is explicitly set.

## Todo List

- [ ] Create flow stores `s3:` payload.
- [ ] CSV import stores `s3:` payloads.
- [ ] UI copy says server-managed credential boundary.
- [ ] Tests cover encrypt helper success/failure.

## Success Criteria

- New accounts save with `s3:` payload.
- No `VITE_ACCOUNT_PASSWORD_KEY` needed for new saves.
- Existing `v2:` accounts still render safely.

## Risk Assessment

- Medium risk: UI now sends plaintext over HTTPS to Edge Function.
- Bad batch handling could partially import rows.

## Security Considerations

- Never put plaintext in toast messages.
- Never log CSV row passwords.
- Avoid storing plaintext in component state longer than necessary.

## Next Steps

Proceed to Phase D after new account creation/import is verified.
