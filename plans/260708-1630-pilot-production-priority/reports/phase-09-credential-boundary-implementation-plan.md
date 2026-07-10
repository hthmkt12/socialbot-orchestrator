# Phase 09 Credential Boundary Implementation Plan

Date: 2026-07-10
Status: Planning only. No implementation performed.

## Source

- Design report: `plans/260708-1630-pilot-production-priority/reports/phase-08-production-credential-boundary-design.md`
- Plan directory: `plans/260710-credential-boundary-implementation-plan/`

## Recommendation

Implement the Phase 08 recommendation in seven guarded phases. Start with metadata/schema preparation, then prove Edge Function encrypt-only before moving UI writes, migration, worker decrypt, log hardening, and runtime proof.

## Phase Order

| Phase | Purpose | Main risk |
|-------|---------|-----------|
| A | Add credential metadata columns/status prep | Status names drift from current model |
| B | Add Supabase Edge Function encrypt-only vault | Auth/logging mistakes around plaintext |
| C | Switch create/import to server encryption | Partial imports and plaintext UI errors |
| D | Migrate `v2:` payloads to `s3:` | Wrong old key or destructive overwrite |
| E | Add worker decrypt path for login macros | Plaintext leaks into persistence/logs |
| F | Harden scrubbing/logging across worker/bridge/functions | Under-redaction |
| G | Run final verification and runtime proof | Device/runtime unavailable |

## Files Likely Touched

- `supabase/migrations/*`
- `supabase/functions/credential-vault/*`
- `src/lib/account-password-crypto.ts`
- `src/components/accounts/create-account-modal.tsx`
- `src/components/accounts/csv-import-modal.tsx`
- `src/pages/AccountsPage.tsx`
- `services/execution-worker/src/single-device-run-context.ts`
- `services/execution-worker/src/single-device-step-runner.ts`
- `services/execution-worker/src/mobile-mcp-step-backend.ts`
- `services/execution-worker/src/worker-step-store.ts`
- `services/mobile-mcp-bridge/src/bridge_server.py`
- `scripts/verify-mobile-mcp-local.mjs`
- `scripts/verify-first-social-pilot.mjs`

## Acceptance Criteria Summary

- New credentials store as `s3:` server-encrypted payloads.
- Existing `v2:` credentials either migrate or remain explicitly legacy-supported.
- `VITE_ACCOUNT_PASSWORD_KEY` is removed from normal production save/import path.
- Worker can use credentials only through transient sensitive variables.
- No plaintext credentials appear in `workflow_runs`, `run_steps`, readiness evidence, artifacts, reports, worker logs, bridge logs, or Edge Function logs.
- Production credential boundary is not claimed until runtime proof passes.

## What Not To Do

- Do not add plaintext password columns.
- Do not pass decrypted passwords through `workflow_runs.input_variables_json`.
- Do not log Edge Function request bodies.
- Do not remove `v2:` compatibility before migration evidence exists.
- Do not implement KMS unless Supabase Edge Function boundary fails requirements.

## Verification Commands

Minimum across implementation:

- `git diff --check`
- `npm.cmd run lint`
- `npm.cmd run typecheck`
- `npm.cmd test`
- `npm.cmd run build`
- `npm.cmd run build:worker`
- Edge Function auth/integration checks
- Runtime proof with `npm.cmd run preflight:mobile-mcp` and credential login macro

## Open Questions

1. Store `credential_policy_status` or derive it from payload prefix?
2. Cache decrypted credential per run or decrypt per step?
3. How should bridge distinguish sensitive `input_text.text` from normal text?
4. Should `s3:` include key version in the prefix, for example `s3:1:<iv>:<ciphertext>`?
