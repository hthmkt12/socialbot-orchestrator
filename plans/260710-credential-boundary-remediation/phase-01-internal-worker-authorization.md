---
phase: 1
title: "Internal Worker Authorization"
status: implemented
priority: P1
dependencies: []
---

# Phase 1: Internal Worker Authorization

<!-- Updated: Validation Session 1 - handler-owned auth supports opaque Supabase service keys -->
<!-- Updated: Implementation complete 2026-07-14 - all verification gates pass -->

## Overview

Replace the invalid assumption that a service-role key can pass the Edge Function's `auth.getUser()` plus `profiles` lookup. Preserve interactive encrypt authorization while adding an explicit internal-only contract for worker decrypt.

## Requirements

- `encrypt` accepts only an authenticated OPERATOR or ADMIN JWT.
- Deploy only `credential-vault` with `verify_jwt=false`; no other Edge Function changes its gateway verification policy.
- The handler strictly parses the action and authenticates it before touching credentials or database rows.
- `decrypt` requires an Authorization bearer exactly matching `SUPABASE_SERVICE_ROLE_KEY` plus the internal worker header/token; neither factor alone is enough.
- Decrypt request takes `{ runId, claimToken, accountId }`. The function reads the run and account internally and rejects inactive, unowned, cancelled, mismatched-account, or missing records.
- `migrate` and `dry-run` require a real short-lived ADMIN user access token supplied to the runner; no service-role-as-user or permanent migration token.
- No authorization branch logs headers, tokens, JWT payloads, plaintext, ciphertext, or key material.
- `encrypt`, `migrate`, and `dry-run` validate the supplied user access token via `auth.getUser()` and enforce profile roles inside the handler.

## Architecture

```text
credential-vault gateway verify_jwt=false
Browser -- user JWT --> handler auth.getUser + profile role --> vault/encrypt
Worker -- exact service-role bearer + X-Credential-Vault-Worker-Token
       --> vault/decrypt(runId, claimToken, accountId)
       --> verify active owned run + account binding
       --> service-role DB read --> plaintext in worker memory
Migration runner -- short-lived ADMIN user token
                 --> handler auth.getUser + ADMIN profile --> vault/migrate|dry-run
```

Parse and strictly allowlist the action before choosing its auth branch; unknown actions return `400` and never fall back to encrypt. For decrypt, compare both backend secrets in constant time and never pass the opaque service key to `auth.getUser()`. For user actions, call `auth.getUser(userJwt)` explicitly. Keep token validation, run binding, and routing in small testable helpers. The function's service-role client is the only client permitted to load `accounts.encrypted_password` for decrypt.

## Related Code Files

- Modify: `supabase/functions/credential-vault/index.ts`
- Modify/create: `supabase/functions/credential-vault/*test.ts`
- Create: `supabase/config.toml` using Supabase CLI initialization, then set only `[functions.credential-vault] verify_jwt = false`; verify no other function inherits this setting.
- Modify: `services/execution-worker/src/credential-decrypt-client.ts`
- Modify: `services/execution-worker/src/credential-decrypt-client.test.ts`
- Modify: `services/execution-worker/src/run-claim-coordinator.ts`
- Modify: `services/execution-worker/src/index.ts`
- Modify: `services/execution-worker/src/single-device-step-runner.ts`
- Modify: `services/execution-worker/src/single-device-run-executor.ts`
- Modify: `services/execution-worker/src/multi-target-run-executor.ts`
- Modify: `services/execution-worker/src/execute-device-worker-thread.ts`
- Modify affected worker config/smoke tests found by `rg "WorkerConfig|supabaseServiceRoleKey" services/execution-worker src`
- Modify: `scripts/credential-migration-runner.mjs`
- Modify: `.env.example`
- Modify: `docs/codebase-summary.md`, `docs/project-roadmap.md`, `docs/use-cases.md`

## Implementation Steps

1. First downgrade the current production/full-verification claims in roadmap, use-cases, and codebase summary to `remediation_pending`.
2. Write negative authorization tests before changing routing: no auth, malformed/unknown action, missing/invalid worker token, token without exact service bearer, service bearer without token, ordinary user JWT attempting decrypt, stale/wrong claim token, inactive run, account mismatch, and valid bound request.
3. Configure only `credential-vault` with `verify_jwt=false`. Extract strict action parsing/auth helpers and prove every action fails closed inside the handler.
4. For `encrypt`, `migrate`, and `dry-run`, validate the user JWT with `auth.getUser(userJwt)` and enforce OPERATOR/ADMIN roles as specified.
5. Add internal `decrypt({ runId, claimToken, accountId })`, constant-time verify both backend secrets, verify active run ownership/account binding, then load and decrypt only accepted `s3:`/`v2:` account payloads.
6. Add `credentialVaultWorkerToken` to `WorkerConfig`, required env loading, inline execution, worker-thread data, single/multi-target executors, runner params, mocks, and smoke fixtures. Enumerate every caller with `rg` rather than relying on compile errors.
7. Change the worker client to send only bound identifiers and the internal header; delete its direct encrypted-password fetch.
8. Change migration runner to require a short-lived ADMIN user access token at invocation time. Never write the token to a report or `.env.example` value.
9. Deploy scoped config/secret, function, then worker in that order; run browser encrypt regression and the full handler auth matrix between stages.

## Success Criteria

- [ ] Valid OPERATOR/ADMIN browser user can encrypt but cannot decrypt.
- [ ] Anonymous, malformed user JWT, invalid worker token, wrong service bearer, token-only, bearer-only, and ordinary-user requests cannot decrypt.
- [ ] Valid internal worker request decrypts only the account bound to its active owned run and returns plaintext only in its HTTPS response.
- [ ] Stale claim token, cancelled/completed run, mismatched account, token-only, and bearer-only requests fail closed.
- [ ] Migration/dry-run command uses an executable documented authorization path.
- [ ] No token, key, plaintext, ciphertext, or account username appears in errors/tests reports.
- [ ] Browser encrypt remains available throughout the staged rollout.
- [ ] Both legacy JWT service-role keys and opaque `sb_secret_...` keys work for the exact-match decrypt branch without being interpreted as user JWTs.

## Risk Assessment

Disabling gateway JWT verification moves the full auth obligation into this handler. Any unguarded early return or new action becomes security-critical, so centralize strict routing/auth and test every action. Keep both backend secrets server-only, rotate them independently, compare them safely, and never expose them through Vite. Run/claim/account binding limits replay and confused-deputy requests.

## Implementation Notes (2026-07-14)

### Files Changed

- `supabase/config.toml` — **created**: `[functions.credential-vault] verify_jwt = false` only.
- `supabase/functions/credential-vault/index.ts` — **rewritten**: handler-owned auth, strict action parsing, constant-time secret comparison, run-bound decrypt.
- `supabase/functions/credential-vault/auth.test.ts` — **created**: 19 negative + positive auth tests.
- `services/execution-worker/src/run-claim-coordinator.ts` — added `credentialVaultWorkerToken` to `WorkerConfig`.
- `services/execution-worker/src/index.ts` — loads `CREDENTIAL_VAULT_WORKER_TOKEN` from env.
- `services/execution-worker/src/credential-decrypt-client.ts` — **rewritten**: sends `{ runId, claimToken, accountId }` + worker token header, no direct `encrypted_password` fetch.
- `services/execution-worker/src/credential-decrypt-client.test.ts` — **rewritten**: 7 tests for new bound decrypt client.
- `services/execution-worker/src/single-device-step-runner.ts` — added `credentialVault` to `RunnerParams`, passes it to `fetchAndDecryptCredential`.
- `services/execution-worker/src/single-device-step-runner.sensitive.test.ts` — updated all test constructions with `credentialVault` param.
- `services/execution-worker/src/single-device-run-executor.ts` — passes `credentialVault` through inline and worker-thread paths.
- `services/execution-worker/src/multi-target-run-executor.ts` — same propagation.
- `services/execution-worker/src/execute-device-worker-thread.ts` — same propagation.
- `services/execution-worker/src/smoke/mobile-mcp-db-smoke-env.ts` — loads `CREDENTIAL_VAULT_WORKER_TOKEN` in `readWorkerConfig`.
- `src/lib/workflow-schedule-trigger.test.ts` — updated `WorkerConfig` mock.
- `scripts/credential-migration-runner.mjs` — **rewritten**: requires `--admin-token <JWT>` (short-lived ADMIN user token), no service-role-as-user.
- `.env.example` — added `CREDENTIAL_VAULT_WORKER_TOKEN` secret name (commented, no value).
- `vitest.config.ts` — **created**: aliases `jsr:@supabase/functions-js/edge-runtime.d.ts` for Vitest compatibility.
- `docs/codebase-summary.md` — downgraded Phase 2 and Phase G claims to `remediation_pending`.
- `docs/project-roadmap.md` — downgraded production credential boundary claims to `remediation_pending`.
- `docs/use-cases.md` — downgraded credential vault claim to `remediation_pending`.

### Request/Auth Contracts

**encrypt** (browser user):
- Headers: `Authorization: Bearer <userJWT>`
- Body: `{ action: "encrypt", plaintext: "..." }`
- Auth: `auth.getUser(userJWT)` + OPERATOR/ADMIN profile role
- Response: `{ encryptedPayload, keyVersion }`

**decrypt** (internal worker):
- Headers: `Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>`, `X-Credential-Vault-Worker-Token: <CREDENTIAL_VAULT_WORKER_TOKEN>`
- Body: `{ action: "decrypt", runId, claimToken, accountId }`
- Auth: constant-time exact match on both secrets; no `auth.getUser()` call
- Binding: run must be RUNNING, `execution_claim_token` matches, `input_variables_json.accountId` matches
- Ciphertext: loaded from `accounts.encrypted_password` by the Edge Function (never caller-supplied)
- Response: `{ plaintext }`

**migrate/dry-run** (admin user):
- Headers: `Authorization: Bearer <adminUserJWT>`
- Body: `{ action: "migrate" | "dry-run", accountId? }`
- Auth: `auth.getUser(adminUserJWT)` + ADMIN profile role
- Response: migration stats or dry-run count

**unknown/missing action**: returns 400, no fallback to encrypt.

### Verification Evidence (2026-07-14)

- `git diff --check`: exit 0 (LF/CRLF warnings only, no whitespace errors)
- `npm.cmd run lint`: exit 0 (0 errors)
- `npm.cmd run typecheck`: exit 0
- `npm.cmd run test`: 39 files, 361 tests pass (exit 0; includes the null-body regression test)
  - `auth.test.ts`: 19 tests covering all negative matrix cases + valid bound decrypt + opaque key handling
  - `credential-decrypt-client.test.ts`: 7 tests covering bound decrypt, network errors, no ciphertext in body
  - `single-device-step-runner.sensitive.test.ts`: 8 tests with updated `credentialVault` param
  - `crypto-helper.test.ts`: 13 tests unchanged
- `npm.cmd run build`: exit 0
- `npm.cmd run build:worker`: exit 0

### Phase 2 and Phase 3 Not Implemented

Phase 2 (Plaintext Containment) and Phase 3 (End-to-End Credential Proof) were not implemented. No remote deployment or credential-bearing device workflow was run.
