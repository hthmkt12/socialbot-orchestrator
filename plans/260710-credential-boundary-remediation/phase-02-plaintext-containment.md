---
phase: 2
title: "Plaintext Containment"
status: implemented
priority: P1
dependencies: [1]
---

# Phase 2: Plaintext Containment

## Overview

Eliminate the Mobile MCP echo/persistence path and make worker error handling redact actual decrypted values. This phase treats every bridge response and exception as untrusted sensitive material during an `input_text` credential step.

## Requirements

- Bridge `input_text` response never contains the submitted text.
- Bridge `input_text` exceptions return a fixed code/message; arbitrary driver exception text is never returned or logged.
- `MobileMcpStepBackend` never embeds raw `input_text` bridge output inside persisted output.
- Step outputs, retry messages, `error_json`, log artifacts, block-detection inputs, and worker console errors cannot retain any active sensitive literal.
- Redaction must work for a bare password in a `text` field or error string, not only JSON fields named `password`.
- Sensitive map continues to clear in `finally` after every step.

## Architecture

For `input_text`, return an acknowledgement such as `{ accepted: true }` from the bridge. Catch driver exceptions at the input handler boundary and map them to a fixed safe error code/message. Preserve safe diagnostic metadata but deliberately drop raw tool output and exception strings.

Pass the current sensitive values only to a narrow `redactSensitiveText(text, values)` helper before any persistence, artifact creation, retry decision, or account-block classification. Keep generic key-based recursive redaction as defense in depth, not the sole protection.

## Related Code Files

- Modify: `services/mobile-mcp-bridge/src/android_session_manager.py`
- Modify/create: `services/mobile-mcp-bridge/tests/test_*.py`
- Modify: `services/execution-worker/src/mobile-mcp-step-backend.ts`
- Modify: `services/execution-worker/src/single-device-step-runner.ts`
- Modify: `services/execution-worker/src/credential-redaction.ts`
- Modify: `services/execution-worker/src/credential-redaction.test.ts`
- Modify: `services/execution-worker/src/single-device-step-runner.sensitive.test.ts`
- Modify: `services/execution-worker/src/worker-run-store.ts`

## Implementation Steps

1. Add failing regression tests that emulate the real bridge `input_text` response `{ text: CANARY }` and assert no nested `bridge.text` reaches a step record.
2. Remove the bridge text echo, catch input driver exceptions locally, return fixed errors, and update Python tests/response contract.
3. Ensure the Mobile MCP backend returns a safe acknowledgement for `input_text` rather than `stripArtifacts(bridgeOutput)`.
4. Add literal-value redaction and apply it at every worker error/output/artifact boundary while the sensitive map is live.
5. Test terminal failure, retry, timeout, and storage-upload-error paths with a canary, including nested arrays/objects and non-JSON strings.
6. Search generated runtime evidence locations as part of tests/scripts; do not encode canary values in committed reports.

## Success Criteria

- [ ] Realistic bridge response cannot place the canary in `run_steps.output_json`.
- [ ] Log artifact text and `error_json` do not contain the canary on failure/retry paths.
- [ ] Bridge responses and Python logs never echo input text.
- [ ] A driver exception containing the submitted literal is converted to a fixed safe error before crossing the bridge boundary.
- [ ] Existing non-sensitive `input_text` success/error diagnostics remain usable.
- [ ] Sensitive state is cleared after all success/failure/cancellation paths.

## Risk Assessment

Over-redaction can impair debugging. Preserve structured error codes and safe context, but never preserve the submitted text. Do not attempt heuristic recovery of redacted values.

## Implementation Notes (2026-07-14)

### Files Changed

- `services/mobile-mcp-bridge/src/android_session_manager.py` — `_handle_input_text` rewritten: never echoes submitted text, catches driver exceptions locally, returns `{ accepted: true }` on success or `{ success: false, code: "INPUT_TEXT_FAILED", message: "input_text failed" }` on exception.
- `services/mobile-mcp-bridge/tests/test_bridge_guards.py` — 3 new tests: success no-echo, failure no-echo, driver exception no-leak.
- `services/execution-worker/src/mobile-mcp-step-backend.ts` — `normalizeOutput` for `input_text` returns `{ accepted: true, backend, serial }` only; no `bridge` field, no `text` field.
- `services/execution-worker/src/credential-redaction.ts` — added `redactSensitiveText(input, values)` helper that redacts actual literal values in strings, nested objects, and arrays.
- `services/execution-worker/src/credential-redaction.test.ts` — 10 new tests for `redactSensitiveText` covering bare strings, nested `output.bridge`, arrays, non-JSON strings, multiple values, non-mutation.
- `services/execution-worker/src/single-device-step-runner.ts` — imported `redactSensitiveText`, added `getActiveSensitiveValues()`, `redactSensitiveString()`, `redactSensitiveObject()` helpers; applied literal redaction at retry output, log artifact text, block detection input, error payload, exception message, and exception error payload boundaries.
- `services/execution-worker/src/single-device-step-runner.sensitive.test.ts` — 6 new canary regression tests: bridge echo, driver exception, retry message, timeout, nested structures, sensitive state clearing.
- `services/execution-worker/src/worker-run-store.ts` — `createLogArtifact` now applies `redactSensitiveJsonString` to the text field before persistence.
- `src/lib/mobile-mcp-step-backend.test.ts` — 2 new input_text containment tests; mocked anti-detection delays.

### Behavior Changes

1. **Bridge `input_text` success**: returns `{ success: true, accepted: true }` — no `text` echo, no `message` field.
2. **Bridge `input_text` exception**: returns `{ success: false, code: "INPUT_TEXT_FAILED", message: "input_text failed" }` — raw exception text never crosses the bridge.
3. **Worker `input_text` normalization**: returns `{ accepted: true, backend, serial }` — no `bridge` field, no `text` field.
4. **Worker error/retry/artifact paths**: all strings and objects passed to `persistRunStep`, `createLogArtifact`, or `handlePotentialBlock` are redacted using active sensitive literal values.
5. **Log artifact text**: `redactSensitiveJsonString` applied to the text field as defense-in-depth.

### Verification Evidence (2026-07-14)

- `git diff --check`: exit 0
- Python bridge tests: 9 tests pass (6 existing + 3 new)
- `npm.cmd run lint`: exit 0
- `npm.cmd run typecheck`: exit 0
- `npm.cmd run test`: 39 files, 380 tests pass, exit 0
  - `credential-redaction.test.ts`: 31 tests (21 existing + 10 new `redactSensitiveText` tests)
  - `single-device-step-runner.sensitive.test.ts`: 14 tests (8 existing + 6 canary regression tests)
  - `mobile-mcp-step-backend.test.ts`: 5 tests (3 existing + 2 new input_text containment tests)
- `npm.cmd run build`: exit 0
- `npm.cmd run build:worker`: exit 0

### Phase 3 Not Implemented

Phase 3 (End-to-End Credential Proof) was not implemented. No remote deployment or credential-bearing device workflow was run.

### P1 Artifact Follow-up (2026-07-14)

The post-implementation review found that successful `adb` and `run_autox` steps could create a log artifact from raw output before literal redaction. `SingleDeviceStepRunner` now computes `safeOutput` before `persistStepArtifacts` and supplies that same object to both artifact and run-step persistence. A regression test proves an active credential canary in a successful `adb` output is redacted in both the log artifact text and persisted step output.
