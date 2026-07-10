# Phase B - Edge Function Vault Encrypt Only

## Context Links

- Parent plan: `plans/260710-credential-boundary-implementation-plan/plan.md`
- Design Option A: `plans/260708-1630-pilot-production-priority/reports/phase-08-production-credential-boundary-design.md`
- Current helper: `src/lib/account-password-crypto.ts`

## Overview

Date: 2026-07-10
Priority: P1
Implementation status: Implemented
Review status: Not reviewed

Introduce the Supabase Edge Function encryption boundary without changing UI writes yet.

## Key Insights

- Encrypt-only is safer before decrypt/migration.
- Edge Function must never log plaintext.
- Use `s3:` prefix for server-encrypted payloads.

## Requirements

- Add Edge Function `credential-vault` with encrypt route only.
- Use `SERVER_CREDENTIAL_KEY` Supabase secret.
- Authenticate caller as OPERATOR or ADMIN.
- Return only encrypted payload and metadata.

## Architecture

Endpoint:

- `POST /credential-vault/encrypt`
- Input: `{ plaintext: string, accountId?: string }`
- Output: `{ encryptedPayload: "s3:<keyVersion>:<iv>:<ciphertext>", keyVersion: number }`

Encryption:

- AES-GCM via Web Crypto.
- Random IV per payload.
- Key derived or imported from `SERVER_CREDENTIAL_KEY`.

## Related Code Files

- `supabase/functions/credential-vault/index.ts` (proposed)
- `supabase/functions/_shared/*` (proposed helpers if local pattern exists)
- `src/lib/account-password-crypto.ts` (reference only)

## Implementation Steps

1. Add Edge Function with strict request validation.
2. Add no-log credential handling policy in comments/tests.
3. Add unit tests or local invocation checks.
4. Add `.env.example` documentation for `SERVER_CREDENTIAL_KEY`.

## Todo List

- [x] Function validates auth role (OPERATOR/ADMIN via JWT + profiles lookup)
- [x] Function rejects missing/empty plaintext (400)
- [x] Function rejects missing/weak `SERVER_CREDENTIAL_KEY` (500)
- [x] Function emits no plaintext logs (generic 500 error, no console.log of body)
- [x] Function returns `s3:1:` payload with random IV per call
- [x] Unit tests added (6 tests in `crypto-helper.test.ts`)
- [x] `.env.example` documents `SERVER_CREDENTIAL_KEY` (commented out, server-only)

## Files Changed

- `supabase/functions/credential-vault/index.ts` (created) - Edge Function, encrypt-only
- `supabase/functions/credential-vault/crypto-helper.ts` (created) - Testable crypto module
- `supabase/functions/credential-vault/crypto-helper.test.ts` (created) - 6 Vitest tests
- `.env.example` (modified) - Added `SERVER_CREDENTIAL_KEY` documentation
- `package.json` (modified) - Test script includes `supabase/functions/credential-vault`

## Verification Commands

| Command | Status |
|---------|--------|
| `npm.cmd run lint` | PASS |
| `npm.cmd run typecheck` | PASS |
| `npm.cmd test` | PASS (290 tests, 34 files) |
| `npm.cmd run build` | PASS |
| `git diff --check` | PASS (exit 0) |

## Success Criteria

- An authenticated OPERATOR/ADMIN can encrypt a test secret.
- Anonymous caller cannot encrypt.
- Plaintext does not appear in function logs or response except request body in transit.

## Risk Assessment

- Medium risk: Edge Function auth mistakes could expose encrypt endpoint.
- Encrypt endpoint is less dangerous than decrypt, but still handles plaintext.

## Security Considerations

- No `console.log(req.body)`.
- Do not return plaintext.
- Do not write DB rows in this phase.

## Next Steps

Proceed to Phase C after encrypt endpoint has negative auth tests.
