---
date: 2026-07-11
type: red-team-plan-review
status: applied
---

# Credential Boundary Remediation Red Team Review

## Summary

Three hostile lenses reviewed the remediation plan: security adversary, assumption destroyer, and failure-mode analyst. Eight evidence-backed findings were accepted and applied. No implementation code was changed.

## Findings

| # | Severity | Finding | Evidence | Resolution |
|---|----------|---------|----------|------------|
| 1 | Critical | Process token allowed arbitrary `accountId` decrypt with no run binding | `single-device-run-context.ts:26`, `single-device-step-runner.ts:553`, `credential-decrypt-client.ts:23` | Require active `{runId, claimToken, accountId}` binding in the function. |
| 2 | High | New token was absent from worker config and worker-thread propagation plan | `run-claim-coordinator.ts:5`, `index.ts:16`, `single-device-run-executor.ts:12`, `multi-target-run-executor.ts:39` | Enumerate and update config, thread data, executors, runner params, mocks, and smoke fixtures. |
| 3 | High | Custom token behavior at the hosted gateway was unspecified | `credential-vault/index.ts:274`, `credential-decrypt-client.ts:48` | Validation superseded the initial resolution: use function-scoped `verify_jwt=false`; handler requires exact service bearer plus worker token. |
| 4 | High | Migration auth offered two incompatible options | `credential-migration-runner.mjs:93`, `credential-vault/index.ts:291` | Choose a short-lived real ADMIN user access token. |
| 5 | High | Removing the bridge echo did not cover driver exceptions containing input | `android_session_manager.py:139`, `bridge_server.py:151` | Catch input exceptions locally and return a fixed safe code/message. |
| 6 | High | Product docs still assert production/full verification during remediation | `docs/codebase-summary.md:49`, `docs/project-roadmap.md:49`, `docs/use-cases.md:337` | Downgrade claims as the first implementation step; restore only after Phase 3. |
| 7 | Medium | Runtime proof promised log scanning without defining captured logs | `verify-credential-boundary.mjs:239`, `verify-credential-boundary.mjs:339` | Capture worker/bridge stdout and stderr to ignored temporary files and scan them. |
| 8 | Medium | Cleanup and rollback order could destroy evidence or restore leaking code | `worker-run-store.ts:107`, `verify-credential-boundary.mjs:358` | Capture evidence before cleanup; verify cleanup; use staged forward-fix deployment. |

## Adjudication

Accepted: 8. Rejected: 0. All findings had direct codebase evidence and materially changed requirements, implementation steps, or release gates.

## Unresolved Questions

None.

## Validation Follow-Up

Session 1 confirmed handler-owned authentication for `credential-vault` so both legacy JWT and opaque `sb_secret_...` backend keys are supported. The function-specific gateway bypass does not apply to other Edge Functions.
