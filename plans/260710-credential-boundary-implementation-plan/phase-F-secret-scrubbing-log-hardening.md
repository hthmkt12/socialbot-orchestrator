# Phase F - Secret Scrubbing And Log Hardening

## Context Links

- Parent plan: `plans/260710-credential-boundary-implementation-plan/plan.md`
- Readiness scrubber: `src/lib/readiness-report-service.ts`
- Worker stores: `services/execution-worker/src/worker-step-store.ts`, `services/execution-worker/src/worker-run-store.ts`
- Bridge: `services/mobile-mcp-bridge/src/bridge_server.py`

## Overview

Date: 2026-07-10
Priority: P1
Implementation status: Implemented
Review status: Not reviewed

Harden every place that could log or persist plaintext credentials after Phase E.

## Key Insights

- Existing readiness evidence scrubber is good but frontend-only.
- Worker and bridge need their own scrubbers.
- `input_text.text` can be sensitive only sometimes, so metadata is needed.

## Requirements

- Add shared scrub helper for worker logs/persistence.
- Scrub bridge request logs.
- Ensure Edge Function logs do not include credential fields.
- Add tests with canary password string.

## Architecture

Use a test canary like:

- `[REDACTED_CANARY — historical plaintext removed during Phase 3 remediation]`

Search all report/output surfaces after test runs.

## Related Code Files

- `src/lib/readiness-report-service.ts`
- `services/execution-worker/src/worker-step-store.ts`
- `services/execution-worker/src/mobile-mcp-step-backend.ts`
- `services/mobile-mcp-bridge/src/bridge_server.py`
- `scripts/verify-first-social-pilot.mjs`

## Implementation Steps

1. Add worker-side redaction utility.
2. Apply before saving step inputs/outputs/errors.
3. Apply before worker console logs.
4. Apply bridge log redaction for request params.
5. Add tests for canary absence.

## Todo List

- [x] Worker redacts sensitive variable names.
- [x] Bridge redacts `text` when marked sensitive.
- [x] Edge Function avoids credential logging.
- [x] Canary search test added.

## Success Criteria

- Canary plaintext absent from DB rows, reports, artifacts, and logs.
- Existing readiness scrub tests still pass.

## Implementation Summary

- Created `services/execution-worker/src/credential-redaction.ts` with `isSensitiveKey`, `redactSensitiveValues`, and `redactSensitiveJsonString`. Deny-by-default redaction for keys matching `password`, `secret`, `token`, `apiKey`, `serviceRole`, `accountPassword`. Allowed status keys (`secret_scrub_status`, `secretScrubStatus`, `redaction_status`, `redactionStatus`, `credential_policy_status`, `credentialPolicyStatus`) are preserved.
- Applied `redactSensitiveValues` to `output_json` and `error_json` in `worker-step-store.ts` `persistRunStep()` (defense-in-depth on top of Phase E step-runner scrubbing).
- Applied `redactSensitiveValues` to log artifact metadata in `worker-run-store.ts` `createLogArtifact()`, and wrapped both artifact-upload `console.error` calls with `redactSensitiveJsonString`.
- Added `redact_sensitive_params` and `redact_error_message` to `services/mobile-mcp-bridge/src/bridge_server.py`; applied `redact_error_message` to all `str(exc)` error responses in `_handle_result`, `_execute_step`, and `_call_tool`.
- Verified Edge Function `supabase/functions/credential-vault/index.ts` already has a catch-all generic error response and never logs plaintext, keys, or request bodies. No changes needed.
- Added `services/execution-worker/src/credential-redaction.test.ts` with unit tests for all three functions plus 5 canary tests proving the `[REDACTED_CANARY]` canary does not appear in redacted output.

## Risk Assessment

- Medium risk: over-redaction can hide useful debugging info.
- Under-redaction is unacceptable for production credentials.

## Security Considerations

- Redaction must be deny-by-default for `password`, `secret`, `token`, `apiKey`, `serviceRole`, `accountPassword`.
- Avoid logging request bodies in Edge Functions.

## Next Steps

Proceed to Phase G for full verification.
