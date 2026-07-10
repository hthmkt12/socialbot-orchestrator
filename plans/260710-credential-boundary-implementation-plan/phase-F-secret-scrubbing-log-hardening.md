# Phase F - Secret Scrubbing And Log Hardening

## Context Links

- Parent plan: `plans/260710-credential-boundary-implementation-plan/plan.md`
- Readiness scrubber: `src/lib/readiness-report-service.ts`
- Worker stores: `services/execution-worker/src/worker-step-store.ts`, `services/execution-worker/src/worker-run-store.ts`
- Bridge: `services/mobile-mcp-bridge/src/bridge_server.py`

## Overview

Date: 2026-07-10
Priority: P1
Implementation status: Pending
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

- `DO_NOT_PERSIST_PASSWORD_123`

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

- [ ] Worker redacts sensitive variable names.
- [ ] Bridge redacts `text` when marked sensitive.
- [ ] Edge Function avoids credential logging.
- [ ] Canary search test added.

## Success Criteria

- Canary plaintext absent from DB rows, reports, artifacts, and logs.
- Existing readiness scrub tests still pass.

## Risk Assessment

- Medium risk: over-redaction can hide useful debugging info.
- Under-redaction is unacceptable for production credentials.

## Security Considerations

- Redaction must be deny-by-default for `password`, `secret`, `token`, `apiKey`, `serviceRole`, `accountPassword`.
- Avoid logging request bodies in Edge Functions.

## Next Steps

Proceed to Phase G for full verification.
