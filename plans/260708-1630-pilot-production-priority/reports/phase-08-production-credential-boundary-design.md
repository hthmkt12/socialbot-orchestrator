# Phase 08: Production Credential Boundary Design

Date: 2026-07-10
Status: Design only. No implementation performed.

## Problem Statement

The current pilot stores social account credentials encrypted with a browser-side AES-GCM key derived from `VITE_ACCOUNT_PASSWORD_KEY`. This satisfies pilot requirements but cannot serve as a production credential vault because:

1. The encryption key is shipped to the browser client and derivable by anyone with page access.
2. No server-side decrypt path exists; `decryptPassword` has zero production callers.
3. No mechanism injects decrypted credentials into macro execution for login flows.
4. The `server_managed` status tier is modelled but unimplemented.
5. CSV import and manual entry both encrypt client-side, meaning the plaintext transits the browser before encryption.

Before real social account credentials enter the system, a production-grade server-side boundary must be designed.

## Current State

### Encryption Mechanism
- **File**: `src/lib/account-password-crypto.ts`
- **Algorithm**: AES-GCM 256-bit, PBKDF2 key derivation (100,000 iterations, SHA-256), 12-byte random IV.
- **Key source**: `VITE_ACCOUNT_PASSWORD_KEY` (browser env var, must be 32+ chars).
- **Payload format**: `v2:<base64(iv)>:<base64(ciphertext)>`.
- **Encryption call sites**: `src/components/accounts/create-account-modal.tsx`, `src/components/accounts/csv-import-modal.tsx` (via `AccountsPage.tsx`).
- **Decryption call sites**: None in production code. `decryptPassword` is exported but only called in `account-password-crypto.test.ts`.

### Policy Model
- **File**: `src/lib/account-password-crypto.ts` (`getCredentialPolicyStatus`)
- **3-tier model**: `pilot_client_encrypted` (key valid), `server_boundary_required` (key missing/weak, blocks save/import), `server_managed` (future, inactive).
- **Decision note**: `docs/decisions/20260708-credential-boundary.md` (status: Approved).
- **Spec**: `specs/006-credential-storage-boundary/spec.md` (status: draft).

### Database Schema
- **Table**: `accounts` (migration `20260627000001_account_tables.sql`)
- **Credential column**: `encrypted_password` text (stores `v2:` payload).
- **RLS**: SELECT for owners and ADMIN; INSERT/UPDATE/DELETE restricted to owner ADMIN/OPERATOR.
- No plaintext password column exists.

### Credential Flow During Run Execution
- **UI submission** (`src/components/runs/run-wizard-submit.ts`): Only `accountId`, `accountUsername`, `accountPlatform` are injected into `inputVariables`. The `encrypted_password` field is never read, decrypted, or passed.
- **Worker** (`services/execution-worker/src/single-device-run-context.ts`): Loads `input_variables_json` from `workflow_runs` table. No password field is present.
- **Budget/block checks** (`services/execution-worker/src/account-action-policy.ts`): Uses `accountId` (UUID) only. `SELECT *` loads the full row (including `encrypted_password`) but only `is_blocked`, `detected_block_reason`, and budget fields are accessed.
- **Bridge HTTP payload** (`services/execution-worker/src/mobile-mcp-step-backend.ts`): Sends `resolvedParams` to bridge. No password is ever resolved because `password` is not in `inputVariables`.
- **Step persistence** (`services/execution-worker/src/worker-step-store.ts`): Stores raw macro template params (`{{password}}`), not resolved values.
- **Readiness evidence** (`src/lib/readiness-report-service.ts`): `sanitizeReadinessEvidence` recursively strips keys matching `/password/i`, `/secret/i`, `/token/i`, `/api[_-]?key/i`, `/service[_-]?role/i`. `secret_scrub_status === 'passed'` is enforced as a readiness gate.

### Credential Exposure Surface

| Surface | Exposed? | Details |
|---------|----------|---------|
| `workflow_runs.input_variables_json` | No password | Contains `accountId`, `accountUsername`, `accountPlatform`, user inputs |
| `run_steps.input_json` | No password | Stores raw macro template params, not resolved values |
| `run_steps.output_json` | No password | Step outputs from bridge; `{{password}}` resolves to empty string |
| Bridge HTTP payload | No password | `resolvedParams` sent to bridge; no password in `inputVariables` |
| Log artifacts | No password | Error messages and bridge output only |
| Readiness evidence | Scrubbed | `sanitizeReadinessEvidence` strips all secret-like keys |
| Worker memory | No password | Only `accountId`, `accountUsername`, `accountPlatform` |
| `accounts.encrypted_password` | Encrypted only | `v2:` AES-GCM payload |
| UI display | Never shown | `AccountsPage.tsx` never decrypts or displays passwords |

### Key Gap

The system has no mechanism to inject decrypted passwords into macro execution for login flows. If a future macro needs to type a password into a login field, there is no code path that decrypts `encrypted_password` and passes it as an `inputVariable`. This is intentional for the pilot phase (spec `006` lists "Server-side decrypt workflow" as out of scope), but must be solved for production.

## Threat Model Summary

| Threat | Current Mitigation | Gap |
|--------|-------------------|-----|
| Browser-side key extraction | Key is in client env; anyone with DevTools or page access can derive it | No server-side key boundary |
| Plaintext transit during CSV import | Plaintext enters browser memory before `encryptPassword()` | Browser memory is exposed to XSS / extensions |
| Credential leakage in logs/artifacts | `sanitizeReadinessEvidence` scrubs secret-like keys; worker never receives passwords | No scrub at worker-level `resolvedParams` if future code adds password to `inputVariables` |
| DB row exposure | `encrypted_password` is AES-GCM encrypted; RLS restricts access | No column-level encryption beyond app-layer; no DB-level vault |
| Macro template injection | `{{password}}` resolves to empty string (not in `inputVariables`) | No controlled path exists to inject credentials when needed |
| Key rotation | No mechanism | `v2:` payloads cannot be re-encrypted without decrypt + re-encrypt |
| Supply chain | `VITE_ACCOUNT_PASSWORD_KEY` shipped in build config | Key visible in build artifacts / env files |

## Evaluated Options

### Option A: Supabase Edge Function Credential Vault

**Architecture**: A Supabase Edge Function (`credential-vault`) holds the encryption key server-side. The UI sends plaintext credentials over HTTPS to the Edge Function, which encrypts them with a server-held key and writes the encrypted payload to `accounts.encrypted_password`. The execution worker calls a separate Edge Function (`credential-decrypt`) to retrieve plaintext credentials for macro login steps, injecting them into a restricted `inputVariables` scope that is never persisted.

**Pros**:
- Key never ships to browser.
- Leverages existing Supabase infrastructure (no new service to operate).
- Edge Functions run in Supabase's managed runtime with automatic scaling.
- RLS already restricts direct table access; Edge Functions can enforce additional auth.
- Migration path is straightforward: Edge Function can accept `v2:` payloads, decrypt them with the old key (passed once during migration), and re-encrypt with the server key.

**Cons**:
- Supabase Edge Functions have cold-start latency (~200-500ms), which adds delay to credential operations.
- Key storage inside Edge Functions relies on Supabase secrets (env vars in Deno runtime); not as strong as a dedicated KMS.
- Deno runtime limitations: no native KMS SDK, must use Web Crypto API with a server-side passphrase.
- Edge Function logs could inadvertently expose credentials if not carefully scrubbed.

**Security boundary**: Key held in Supabase project secrets (Deno env). Plaintext transits HTTPS only. Decryption available only to authenticated worker calls with service-role key.

**Operational complexity**: Low. No new infrastructure beyond Supabase Edge Functions.

**Migration path from `v2:`**:
1. Deploy `credential-vault` Edge Function with server-held key.
2. Deploy `credential-migrate` Edge Function that accepts `v2:` payloads, decrypts with old `VITE_ACCOUNT_PASSWORD_KEY`, re-encrypts with server key, updates `accounts.encrypted_password` with new prefix `s3:`.
3. Run migration for all existing accounts in a batch.
4. Remove `VITE_ACCOUNT_PASSWORD_KEY` from client env.

**Impact on UI/import/run wizard/worker**:
- UI: `create-account-modal.tsx` and `csv-import-modal.tsx` send plaintext over HTTPS to Edge Function instead of encrypting client-side.
- Run wizard: May optionally call `credential-decrypt` to inject password into a restricted `inputVariables` field marked as `sensitive: true` that is scrubbed from persistence.
- Worker: Calls `credential-decrypt` Edge Function to get plaintext for login steps; plaintext lives only in memory for the duration of the step.

**Testing strategy**: Unit test Edge Function encryption/decryption; integration test with Supabase local dev; E2E test login macro with decrypted credential; verify no plaintext in logs/outputs.

**Rollback strategy**: Revert to client-side encryption by restoring `VITE_ACCOUNT_PASSWORD_KEY` in client env and reverting UI to call `encryptPassword` locally. `s3:` payloads can be decrypted by Edge Function and re-encrypted as `v2:`.

---

### Option B: Execution Worker-Owned Credential Service

**Architecture**: The execution worker gains a credential service module that holds the encryption key. The UI still sends plaintext credentials over HTTPS to a worker API endpoint (`POST /credentials/encrypt`), which encrypts and writes to the database. During run execution, the worker decrypts `accounts.encrypted_password` internally and injects the plaintext into a restricted `inputVariables` scope for the current step only. No separate service is needed; the worker is the vault.

**Pros**:
- Decryption happens in-process; no network call for credential retrieval during execution.
- Worker already has Supabase service-role key and runs in a trusted runtime.
- No cold-start latency for credential operations.
- Credential plaintext scope is tightly controlled: worker memory only, never persisted.

**Cons**:
- The worker becomes a single point of failure for credential operations. If the worker is compromised, all credentials are exposed.
- The worker must expose an HTTP endpoint for credential encryption (UI needs to send plaintext somewhere), expanding its attack surface.
- Key management inside the worker relies on env vars (`WORKER_CREDENTIAL_KEY`); no hardware-backed key store.
- Worker is a Node.js process; secrets in env vars are visible in process listings and core dumps.
- Horizontal scaling: if multiple worker instances run, they must all share the same key, increasing exposure.

**Security boundary**: Key held in worker env. Plaintext transits HTTPS to worker API. Decryption in-process, plaintext in worker memory only.

**Operational complexity**: Medium. Worker must gain HTTP endpoints for credential encrypt/decrypt and a key management module.

**Migration path from `v2:`**:
1. Add `WORKER_CREDENTIAL_KEY` to worker env.
2. Deploy worker credential service with encrypt/decrypt endpoints.
3. UI switches from client-side `encryptPassword` to worker `POST /credentials/encrypt`.
4. Batch migration: worker reads all `v2:` accounts, decrypts with old key, re-encrypts with new key, updates rows.
5. Remove `VITE_ACCOUNT_PASSWORD_KEY` from client env.

**Impact on UI/import/run wizard/worker**:
- UI: Sends plaintext over HTTPS to worker endpoint instead of encrypting locally.
- Run wizard: No change; worker handles decryption internally during execution.
- Worker: Gains credential service module, decrypt endpoint, and restricted `inputVariables` injection logic.

**Testing strategy**: Unit test credential service encryption/decryption; integration test with worker; E2E test login macro; verify no plaintext in step persistence or logs.

**Rollback strategy**: Revert UI to client-side encryption; restore `VITE_ACCOUNT_PASSWORD_KEY`; revert worker to ignore credential service.

---

### Option C: External KMS / Secrets Manager Boundary

**Architecture**: A dedicated secrets manager (AWS Secrets Manager, Google Secret Manager, HashiCorp Vault) holds the master encryption key. The UI sends plaintext to a thin API (Edge Function or worker proxy) that calls the KMS to encrypt and store. The worker calls the KMS to decrypt during execution. The `accounts.encrypted_password` column stores KMS-encrypted ciphertext with a `kms:` prefix.

**Pros**:
- Strongest key isolation: master key never leaves the KMS hardware/HSM.
- Key rotation, audit logging, and access policies are managed by the KMS.
- Industry-standard pattern for production credential management.
- Supports per-account encryption keys (data encryption keys wrapped by master key).

**Cons**:
- Introduces a new external dependency (AWS/GCP/Vault) that must be provisioned, configured, and billed.
- KMS API calls add latency (~50-100ms per encrypt/decrypt) to every credential operation.
- Operational complexity is highest: IAM policies, KMS access from worker, network configuration.
- Over-engineered for a pilot platform with 5-50 devices and single-tenant deployment.
- Requires cloud provider account setup that may not align with the current Supabase-only infrastructure.

**Security boundary**: Master key in KMS HSM. Plaintext transits HTTPS to API proxy. KMS returns ciphertext; plaintext never stored. Decryption requires KMS API call with IAM credentials.

**Operational complexity**: High. Requires KMS provisioning, IAM configuration, network routing, and SDK integration.

**Migration path from `v2:`**:
1. Provision KMS and create master key.
2. Deploy API proxy (Edge Function or worker) with KMS SDK.
3. Batch migration: decrypt `v2:` payloads with old key, encrypt with KMS, update rows with `kms:` prefix.
4. Remove `VITE_ACCOUNT_PASSWORD_KEY` from client env.

**Impact on UI/import/run wizard/worker**:
- UI: Sends plaintext over HTTPS to API proxy.
- Run wizard: No change; worker handles KMS decrypt internally.
- Worker: Gains KMS SDK integration, decrypt call, and restricted `inputVariables` injection.

**Testing strategy**: Unit test with KMS mock; integration test against KMS sandbox; E2E test login macro; verify no plaintext in persistence; audit log verification.

**Rollback strategy**: Decrypt `kms:` payloads via KMS, re-encrypt as `v2:` with old key, revert UI to client-side encryption.

## Recommended Architecture

**Option A: Supabase Edge Function Credential Vault**

### Rationale

1. **Infrastructure alignment**: The repo is already Supabase-first (auth, RLS, migrations, Edge Functions for other features). No new cloud provider or service is introduced.
2. **Operational simplicity**: Edge Functions deploy via `supabase functions deploy` with no additional infrastructure management. The team already operates Supabase.
3. **Adequate security boundary**: Moving the key from browser env to Supabase project secrets is a significant improvement. While not HSM-backed, it prevents client-side key extraction, which is the primary pilot-era threat.
4. **Lowest migration friction**: The `v2:` to `s3:` migration can be done with a single Edge Function that accepts old payloads and re-encrypts. No SDK integration, no IAM configuration.
5. **YAGNI principle**: For a pilot platform with 5-50 devices and single-tenant deployment, a full KMS (Option C) is over-engineered. Option B adds worker attack surface without leveraging existing infrastructure.

### Trade-offs (stated honestly)

- Supabase project secrets are env vars in Deno runtime, not hardware-backed. A Supabase platform compromise would expose the key. This is acceptable for the current scale and is strictly better than shipping the key to every browser client.
- Edge Function cold starts add ~200-500ms latency to credential operations. Since credential encrypt/decrypt is not on the hot path (occurs during account save and run setup, not per-step), this is acceptable.
- Edge Function logs in Supabase's observability layer could expose plaintext if `console.log` is used carelessly. The Edge Function must be written with strict no-log policies for credential fields.
- If the platform scales to multi-tenant or enterprise deployments, Option C (KMS) should be revisited. Option A is the right next step, not the final destination.

## Data Model Changes Proposed

No schema migration in this phase. Proposed for future implementation:

| Change | Description |
|--------|-------------|
| `accounts.encrypted_password` prefix | New prefix `s3:` for server-encrypted payloads; `v2:` retained for legacy until migration completes |
| `accounts.credential_policy_status` | New enum column aligned with the current model: `pilot_client_encrypted`, `server_boundary_required`, `server_managed`, `migration_pending` |
| `accounts.credential_rotated_at` | Timestamp of last server-side re-encryption |
| `accounts.credential_key_version` | Integer tracking which server key version encrypted this payload (supports key rotation) |

No plaintext password column. No column-level DB encryption beyond app-layer.

## API / Function Boundary Proposed

| Function | Method | Input | Output | Caller |
|----------|--------|-------|--------|--------|
| `credential-vault/encrypt` | POST | `{ plaintext, accountId? }` | `{ encryptedPayload: 's3:...' }` | UI (create/import; `accountId` exists for updates/migration, not first create) |
| `credential-vault/decrypt` | POST | `{ accountId }` | `{ plaintext }` | Worker (run execution) |
| `credential-vault/migrate` | POST | `{ accountId }` | `{ migrated: true }` | Admin (batch migration) |
| `credential-vault/rotate` | POST | `{ keyVersion }` | `{ rotatedCount }` | Admin (key rotation) |

**Auth model**:
- `encrypt`: Requires authenticated Supabase session (OPERATOR or ADMIN).
- `decrypt`: Requires service-role key (worker only). Never exposed to browser.
- `migrate`/`rotate`: Requires ADMIN role + service-role key.

**Scrubbing requirements**:
- Edge Function must never `console.log` plaintext.
- Edge Function response must not include plaintext in any field other than the explicit `plaintext` field in `decrypt`.
- Worker must not persist the `plaintext` field into `inputVariables` that get saved to `workflow_runs.input_variables_json`. Instead, a transient `sensitiveInputVariables` map should exist only in worker memory for the current step.

## UI Behavior Changes Proposed

| Area | Current | Proposed |
|------|---------|----------|
| Create account modal | Encrypts password client-side with `encryptPassword()` | Sends plaintext over HTTPS to `credential-vault/encrypt` Edge Function |
| CSV import modal | Encrypts each row password client-side | Sends batch plaintext over HTTPS to `credential-vault/encrypt` |
| Credential policy status | Shows `pilot_client_encrypted` or `server_boundary_required` | Adds `server_managed` status when server vault is active |
| Account detail page | Never shows password | No change; still never shows password |
| Run wizard | Passes `accountId` only | No change; worker decrypts internally via Edge Function |

## Migration Plan

### Phase 1: Deploy Edge Functions (no UI change)
1. Write `credential-vault` Edge Function with encrypt/decrypt/migrate endpoints.
2. Set `SERVER_CREDENTIAL_KEY` in Supabase project secrets (32+ chars, generated via `openssl rand -base64 32`).
3. Deploy Edge Function to Supabase.
4. Test encrypt/decrypt round-trip with unit tests.

### Phase 2: Batch migrate existing `v2:` payloads
1. Run `credential-vault/migrate` for all accounts with `v2:` prefix.
2. Verify all accounts now have `s3:` prefix.
3. Update `credential_policy_status` to `server_managed` for migrated accounts.

### Phase 3: Switch UI to server-side encryption
1. Update `create-account-modal.tsx` to call Edge Function instead of `encryptPassword()`.
2. Update `csv-import-modal.tsx` to call Edge Function for batch encryption.
3. Remove `VITE_ACCOUNT_PASSWORD_KEY` from `.env.example` and client env.
4. Deploy updated UI.

### Phase 4: Wire worker decrypt path
1. Add credential decrypt call in worker when a macro step references `{{accountPassword}}`.
2. Inject decrypted password into transient `sensitiveInputVariables` (not persisted).
3. Scrub `sensitiveInputVariables` from step outputs and persistence.
4. Test login macro end-to-end.

### Rollback at each phase:
- Phase 1-2: No UI change; revert Edge Function deployment.
- Phase 3: Revert UI to `encryptPassword()`; restore `VITE_ACCOUNT_PASSWORD_KEY`.
- Phase 4: Revert worker decrypt call; `{{accountPassword}}` resolves to empty string (current behavior).

## Verification Plan

| Check | Method | Pass Criteria |
|-------|--------|---------------|
| Server key not in client env | Inspect build output / `.env.example` | `VITE_ACCOUNT_PASSWORD_KEY` absent from client bundle |
| Plaintext not persisted | Grep `run_steps` and `workflow_runs` for plaintext patterns | No plaintext password in any DB row |
| Edge Function no-log policy | Code review of Edge Function | No `console.log` with credential fields |
| Scrub in readiness evidence | Existing `sanitizeReadinessEvidence` test | All `/password/i` keys stripped |
| Decrypt requires service-role | Integration test with anon key | 401/403 on `decrypt` without service-role |
| Migration completeness | Query `accounts` for `v2:` prefix | Zero `v2:` rows after migration |
| Login macro E2E | Run macro with `{{accountPassword}}` on device | Step succeeds, password typed, no plaintext in logs |

## Rollback Plan

1. Re-deploy `VITE_ACCOUNT_PASSWORD_KEY` to client env.
2. Revert UI to call `encryptPassword()` locally.
3. Run reverse migration: decrypt `s3:` payloads via Edge Function, re-encrypt as `v2:` with old key.
4. Deactivate Edge Functions.
5. Update `credential_policy_status` back to `pilot_client_encrypted`.

No data loss: `encrypted_password` column retains encrypted payloads throughout rollback. Plaintext is recoverable through the appropriate decrypt function for either prefix.

## Out of Scope

- Implementation of any Edge Function, worker module, or UI change.
- Schema migration or column additions.
- OAuth/session-cookie management for social accounts.
- Multi-tenant key isolation.
- Hardware security module (HSM) integration.
- Credential sharing across workspaces.
- Password recovery or reveal functionality.
- Social platform API token management (separate from password credentials).

## Open Questions

1. Should the `credential-vault/decrypt` endpoint enforce per-run rate limiting to prevent credential exfiltration if the worker is compromised?
2. Should `s3:` payloads include a key version identifier to support future key rotation without a full re-encryption batch?
3. Should the worker cache decrypted credentials in memory across steps within a single run, or decrypt per-step to minimize plaintext lifetime?
4. Is Supabase Edge Function observability (log streaming) configured to automatically redact secret-like fields, or must the Edge Function code enforce no-log policies alone?
5. Should `credential_policy_status` be a database column or derived from the payload prefix (`v2:` vs `s3:`) at query time?
6. When a login macro types a password into a device, the bridge HTTP payload (`resolvedParams.text`) will contain plaintext. Should the bridge (`mobile-mcp-bridge`) scrub `text` params from its own logs?
