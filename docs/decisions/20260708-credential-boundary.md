# Decision Note: Credential Storage Boundary & Policy Model

Date: 2026-07-08
Status: Approved

## Context
Social account passwords currently use client-side browser encryption via Web Crypto AES-GCM and a local passphrase (`VITE_ACCOUNT_PASSWORD_KEY`). While this satisfies pilot requirements, it is not a production-grade credential vault because the encryption key is shipped to/used in the browser client.

## Decision
1. We establish a 3-tier credential policy status model:
   - `pilot_client_encrypted`: Active when `VITE_ACCOUNT_PASSWORD_KEY` is present and valid (32+ chars). Save/import is allowed.
   - `server_boundary_required`: Active when `VITE_ACCOUNT_PASSWORD_KEY` is missing or weak (< 32 chars). Save/import is blocked.
   - `server_managed`: Future status reserved for server-side vault (currently inactive).
2. Defer server-side key management / vault implementation to Phase 4 or subsequent production rollout. We do not claim production readiness without a verified server-side implementation.
3. Plaintext passwords must never be stored, logged, or exposed in UI, reports, or artifacts.

## Migration Path
When moving to a server-managed boundary:
1. Provide a Supabase Edge Function or backend worker API endpoint to accept credentials over HTTPS, encrypt them server-side using a vault-held key, and write to the database.
2. Support decrypt operations strictly inside the system execution worker.
3. Preserved client-encrypted payloads prefixed with `v2:` must be migrated by checking the prefix and re-encrypting them under the server-managed vault key when the account is next run or edited.
