# Phase E - Worker Decrypt Path For Login Macros

## Context Links

- Parent plan: `plans/260710-credential-boundary-implementation-plan/plan.md`
- Single run context: `services/execution-worker/src/single-device-run-context.ts`
- Step runner: `services/execution-worker/src/single-device-step-runner.ts`
- Bridge backend: `services/execution-worker/src/mobile-mcp-step-backend.ts`

## Overview

Date: 2026-07-10
Priority: P1
Implementation status: Pending
Review status: Not reviewed

Allow login macros to use decrypted credentials in worker memory only.

## Key Insights

- Current run input variables intentionally exclude passwords.
- Decrypted credential must not be persisted to `workflow_runs` or `run_steps`.
- Bridge payload may briefly contain plaintext for `input_text`; logs must be scrubbed before this phase is complete.

## Requirements

- Add worker credential client for Edge Function decrypt.
- Add transient sensitive variable map.
- Resolve `{{accountPassword}}` from transient map only.
- Never write transient values to DB.

## Architecture

Worker flow:

1. Load run context with `accountId`.
2. Detect macro step references `{{accountPassword}}`.
3. Call `credential-vault/decrypt` with service-role auth.
4. Store plaintext in in-memory `sensitiveInputVariables`.
5. Resolve template for the specific step.
6. Scrub before persistence/logging.
7. Clear plaintext at run end or after step depending on chosen policy.

## Related Code Files

- `services/execution-worker/src/single-device-run-context.ts`
- `services/execution-worker/src/single-device-step-runner.ts`
- `services/execution-worker/src/mobile-mcp-step-backend.ts`
- `services/execution-worker/src/worker-step-store.ts`
- `services/execution-worker/src/worker-run-store.ts`

## Implementation Steps

1. Add credential decrypt client module.
2. Add sensitive variable support to step runner.
3. Update template resolution to consult sensitive values without persisting them.
4. Add unit tests proving plaintext is not in saved steps/run summary.
5. Add negative tests for decrypt failure.

## Todo List

- [ ] Decrypt endpoint requires service-role.
- [ ] `{{accountPassword}}` resolves only at execution time.
- [ ] Step persistence stores template or redacted marker, not plaintext.
- [ ] Decrypt failure produces safe operator-facing error.

## Success Criteria

- Login macro can type password on device.
- No plaintext in `workflow_runs.input_variables_json`.
- No plaintext in `run_steps.input_json`, `run_steps.output_json`, logs, artifacts, or readiness evidence.

## Risk Assessment

- High risk: this is the first phase where plaintext enters worker/bridge memory.
- Requires careful code review and targeted tests.

## Security Considerations

- Prefer per-step decrypt unless performance proves unacceptable.
- Clear plaintext references after use.
- Redact sensitive params before bridge logging.

## Next Steps

Proceed to Phase F before claiming this path is safe.
