---
title: "Credential Boundary Remediation"
description: "Close the post-implementation P0/P1 credential-boundary findings before restoring any production verification claim."
status: complete
priority: P1
branch: "master"
tags: [security, credentials, edge-functions, mobile-mcp, verification]
blockedBy: [controlled-runtime-proof-prerequisites]
blocks: [260710-credential-boundary-implementation-plan]
created: "2026-07-10T12:12:50.810Z"
createdBy: "ck:plan"
source: skill
---

# Credential Boundary Remediation

## Overview

Remediate the four findings from the review of `fc30260..af37600`: service-role callers cannot satisfy the current user/profile authorization path; Mobile MCP can persist an echoed password under `output.bridge`; error artifacts can retain sensitive text; and the verification evidence overstates what was tested.

This is a correction plan, not a feature expansion. The existing `s3:` format, account schema, browser encrypt flow, and `v2:` compatibility remain in place.

## Scope Challenge

- Existing code: the vault, worker, bridge, redaction helper, and verification script already exist. The remediation should strengthen those seams rather than introduce a separate credential service or key-management provider.
- Minimum changes: introduce one explicit internal-worker authorization path, remove password echoes from the bridge/output path, redact secret literals from error persistence, and require a real credential-login proof before restoring status claims.
- Complexity: approximately 10-14 files across Edge Function, worker, Python bridge, scripts, tests, and truthful documentation. Three sequential phases are necessary because proof depends on the security fixes.
- Selected mode: HOLD SCOPE with tests-first implementation.

## Security Decisions

1. Interactive `encrypt` remains JWT + `OPERATOR`/`ADMIN` authorization.
2. Deploy only `credential-vault` with gateway JWT verification disabled because backend keys may be opaque `sb_secret_...` values. The handler owns authentication for every action and must fail closed before business logic.
3. Internal `decrypt` is not authorized by pretending the worker service-role key is an `auth.users` identity. It requires two values compared without timing leaks: `Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>` and a distinct server-only `X-Credential-Vault-Worker-Token` matching `CREDENTIAL_VAULT_WORKER_TOKEN`.
4. Decrypt accepts `{ runId, claimToken, accountId }`, then verifies the run is active, the claim token still owns it, and its persisted `input_variables_json.accountId` matches before loading ciphertext. Possession of the process token alone must not decrypt arbitrary accounts.
5. Interactive `encrypt` and admin `migrate`/`dry-run` still require a real user JWT validated with `auth.getUser()` plus the appropriate profile role. Migration uses a short-lived ADMIN access token and introduces no long-lived migration backdoor.
6. For `input_text`, the bridge must not echo text, and worker persistence/logging must scrub actual in-memory sensitive literals, not only values beneath suspicious JSON keys.
7. No document may say `full_verified` until the controlled login run, database/artifact/log scan, cleanup verification, and negative authorization tests all pass.

## Non-Goals

- No new KMS, key rotation, or credential format migration.
- No change to account UI workflow except error wording required by the new endpoint contract.
- No broad worker refactor or changes to social macro behavior.
- No use of a real customer credential for verification.

## Phases

| Phase | Name | Status |
|-------|------|--------|
| 1 | [Internal Worker Authorization](./phase-01-internal-worker-authorization.md) | Implemented |
| 2 | [Plaintext Containment](./phase-02-plaintext-containment.md) | Implemented |
| 3 | [End-to-End Credential Proof](./phase-03-end-to-end-credential-proof.md) | Completed: controlled runtime proof passed 2026-07-17 |

## Dependencies

- Corrects the completed-but-invalidated verification claim in `plans/260710-credential-boundary-implementation-plan/`.
- Requires deployment secrets for runtime proof but must keep all secret values out of source, reports, and committed `.env` files.

## Deployment Order

1. Immediately downgrade current roadmap, use-case, and codebase-summary claims to `remediation_pending`.
2. Set `CREDENTIAL_VAULT_WORKER_TOKEN` in both the hosted Edge Function and worker runtime without printing it. Confirm `SUPABASE_SERVICE_ROLE_KEY` is available to the function and worker, regardless of whether it is a legacy JWT or `sb_secret_...` key.
3. Configure only `credential-vault` with `verify_jwt=false`, deploy the backward-compatible function, then verify that its handler rejects unauthenticated/partial-auth requests and preserves browser encrypt.
4. Deploy worker auth/config changes, then deploy bridge/worker containment changes. Do not run a credential-bearing device step between these deployments.
5. Run the first controlled credential login only after both authorization and containment versions are confirmed live.
6. Use forward-fix rollback only. Do not redeploy the known-leaking bridge/backend or the known-broken decrypt authorization path.

## Release Gates

- `git diff --check`
- Targeted Edge Function authorization/crypto tests, worker sensitive-runner tests, and Python bridge tests.
- `npm.cmd run lint`, `npm.cmd run typecheck`, `npm.cmd test`, `npm.cmd run build`, `npm.cmd run build:worker`.
- A remote negative-auth matrix: anonymous, ordinary user JWT, missing/wrong service bearer, missing/wrong worker token, stale claim, account mismatch, and fully valid bound worker request.
- A disposable-account login run on Mobile MCP that proves password input succeeded and proves the canary is absent from `workflow_runs`, `run_steps`, artifacts, bridge logs, reports, and source-controlled evidence.

## Completion Evidence (2026-07-17)

- Controlled real proof verdict: `full_verified`.
- Static gates: lint, typecheck, test, build, and worker build passed.
- Runtime gates: 6/6 authorization cases passed, valid bound decrypt passed, disposable login completed, persistence/log scans were clean, and cleanup was verified.
- Device proof used the approved online Android device `043cba48`.
- Remaining operational follow-up: rotate the exposed legacy `service_role` key through Supabase Dashboard.

## Red Team Review

### Session - 2026-07-11

**Findings:** 8 (8 accepted, 0 rejected)
**Severity breakdown:** 1 Critical, 5 High, 2 Medium

| # | Finding | Severity | Disposition | Applied To |
|---|---------|----------|-------------|------------|
| 1 | Decrypt token was not bound to an active owned run | Critical | Accept | Phase 1 |
| 2 | Worker token propagation omitted config/thread consumers | High | Accept | Phase 1 |
| 3 | Hosted gateway and dual-auth behavior was unspecified | High | Accept | Phase 1 |
| 4 | Migration authorization remained an unresolved alternative | High | Accept | Phase 1 |
| 5 | `input_text` exception path could still return a literal | High | Accept | Phase 2 |
| 6 | Current public docs remain falsely production-ready during remediation | High | Accept | Plan, Phase 1, Phase 3 |
| 7 | Runtime proof had no defined capture surface for process logs | Medium | Accept | Phase 3 |
| 8 | Test-account cleanup and rollback sequencing were underspecified | Medium | Accept | Plan, Phase 3 |

### Verification Results

- **Tier:** Standard
- **Claims checked:** 12
- **Verified:** 12 | **Failed:** 0 | **Unverified:** 0
- **Evidence:** `run-claim-coordinator.ts:5`, `index.ts:16`, `single-device-run-context.ts:26`, `credential-decrypt-client.ts:23`, `credential-vault/index.ts:274`, `android_session_manager.py:139`, `bridge_server.py:151`, `mobile-mcp-step-backend.ts:203`, `single-device-step-runner.ts:743`, `worker-run-store.ts:306`, `verify-credential-boundary.mjs:339`, `docs/codebase-summary.md:49`.

### Whole-Plan Consistency Sweep

- Files reread: `plan.md` and all three phase files.
- Decision deltas checked: run-bound decrypt contract, dual auth, migration auth, config propagation, generic input errors, evidence capture, cleanup, deployment order.
- Reconciled stale references: 11.
- Unresolved contradictions: 0.

## Validation Log

### Session 1 - 2026-07-11

**Trigger:** Post-red-team validation of the hosted Edge Function authentication contract.
**Questions asked:** 1

#### Questions & Answers

1. **[Architecture]** Backend configuration permits opaque `sb_secret_...` service keys, so should `credential-vault` disable gateway JWT verification and authenticate every action inside the handler, or keep gateway JWT verification and require a legacy JWT service key?
   - Options: handler-owned auth with function-scoped `verify_jwt=false` (Recommended) | require legacy JWT service-role key and keep gateway verification | introduce a separate credential service
   - **Answer:** Handler-owned auth with function-scoped `verify_jwt=false`.
   - **Rationale:** Supports both current Supabase secret-key formats while preserving explicit action-level authorization and dual-secret decrypt checks.

#### Confirmed Decisions

- Only `credential-vault` disables gateway JWT verification; other functions are unchanged.
- The handler parses/allowlists the action, then authenticates before any encryption, decryption, or DB operation.
- User actions validate a real user token with `auth.getUser()` and profile role.
- Worker decrypt requires exact service-role bearer plus worker token, followed by active run/claim/account binding.

#### Impact on Phases

- Phase 1: replace the gateway-JWT assumption with function-scoped handler-owned authentication, add scoped deploy/config changes and a complete partial-auth matrix.
- Phases 2-3: no architecture change; runtime proof must verify the final handler-owned auth matrix.

### Verification Results

- **Tier:** Standard
- **Claims checked:** 8
- **Verified:** 8 | **Failed:** 0 | **Unverified:** 0
- **Resolved mismatch:** `.env.example:26` permits opaque `sb_secret_...` keys while no `supabase/config.toml` currently defines function verification behavior. The accepted decision removes dependence on a JWT-shaped service key.

### Whole-Plan Consistency Sweep

- Files reread: `plan.md`, all three phase files, and the red-team report.
- Decision deltas checked: function-scoped `verify_jwt=false`, handler-owned auth, dual-secret decrypt, user-token auth, deployment order, negative-auth matrix.
- Reconciled stale references: 9.
- Unresolved contradictions: 0.
