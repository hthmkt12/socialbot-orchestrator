---
phase: 3
title: Credential Boundary Hardening
status: completed
priority: P1
dependencies:
  - 2
effort: 1d-2d
---

# Phase 3: Credential Boundary Hardening

## Overview

Enforce the pilot-only credential boundary from `specs/006-credential-storage-boundary` and make credential risk visible without exposing plaintext.

## Requirements

- Functional: account credential save/import is blocked without valid key; plaintext is never displayed or exported.
- Non-functional: docs/UI must say browser encryption is pilot-only, not production vault.

## Architecture

Keep existing client encryption helper as the pilot boundary. Add explicit risk/status helpers and guard report/artifact outputs through existing scrubbers.

## Related Code Files

- Modify: `src/lib/account-password-crypto.ts`
- Modify: `src/lib/account-password-crypto.test.ts`
- Modify: `src/lib/account-service-helpers.ts`
- Modify: `src/lib/account-service-helpers.test.ts`
- Modify: `src/components/accounts/create-account-modal.tsx`
- Modify: `src/components/accounts/csv-import-modal.tsx`
- Modify: `src/pages/AccountsPage.tsx`
- Modify: `src/lib/readiness-report-service.ts`
- Modify: `.env.example`
- Modify: `docs/deployment-guide.md`
- Reference: `specs/006-credential-storage-boundary/spec.md`

## Implementation Steps

1. Centralize credential policy status: missing key, weak key, pilot client encrypted, production boundary required.
2. Surface policy failures inline in create/import flows before DB writes.
3. Ensure no component renders plaintext or encrypted payload previews.
4. Extend evidence scrubbing tests for nested secret/token/password/apiKey fields.
5. Add admin-readable credential risk wording without secret values.
6. Update env/deployment docs with pilot-only warning and production migration requirement.

## Success Criteria

- [x] Save/import fails without valid `VITE_ACCOUNT_PASSWORD_KEY`.
- [x] Stored password payload is encrypted and never rendered as plaintext.
- [x] Readiness evidence/report scrubbing removes secret-like fields.
- [x] Admin/operator UI copy does not imply production credential vault.
- [x] Credential tests pass plus full verification gates remain green.

## Risk Assessment

Risk: tightening key policy blocks existing pilot operators. Mitigation: fail with direct setup guidance and keep `.env.example` actionable.

## Progress Notes

- 2026-07-08: Added centralized credential policy status in `account-password-crypto`, with explicit `missing_key`, `weak_key`, and `pilot_client_encrypted` states. Account create/import UI now shows the policy inline and blocks save/import before DB writes when the key is missing or too weak.
- 2026-07-08: Added pilot-only credential boundary wording in account UI, `.env.example`, and deployment docs. The UI warns that browser encryption is not a production credential vault and does not render plaintext or encrypted payload previews in account import/list flows.
- 2026-07-08: Extended readiness evidence scrubbing tests for nested arrays containing `serviceRoleKey`, `password`, and other secret-like fields. Gates passed: lint, typecheck, unit tests, web build, worker build, gateway build, and `npm.cmd run verify:use-cases` with credential boundary PASS (`v2:` encrypted payload, 0 plaintext-like credential rows). Local UI health was down after runtime restart, but production web build passed and Phase 3 code gates are green.
