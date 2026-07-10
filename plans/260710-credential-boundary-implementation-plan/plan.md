---
title: "Production Credential Boundary Implementation"
description: "Plan server-managed account credential storage using the Phase 08 Supabase Edge Function vault design."
status: pending
priority: P1
effort: 18h
branch: master
tags: [security, credentials, supabase, edge-functions, production-readiness]
created: 2026-07-10
---

# Production Credential Boundary Implementation

## Context

- Design: `plans/260708-1630-pilot-production-priority/reports/phase-08-production-credential-boundary-design.md`
- Current client helper: `src/lib/account-password-crypto.ts`
- Account UI: `src/components/accounts/create-account-modal.tsx`, `src/pages/AccountsPage.tsx`, `src/components/accounts/csv-import-modal.tsx`
- Account schema: `supabase/migrations/20260627000001_account_tables.sql`
- Worker run context: `services/execution-worker/src/single-device-run-context.ts`

## Goal

Move from pilot-only browser encryption to a planned server-managed credential boundary using Supabase Edge Functions, `s3:` payloads, and a controlled `v2:` migration path.

## Non-Goals

- Do not implement in this plan phase.
- Do not claim production readiness until all phases are implemented and verified.
- Do not add plaintext password storage.

## Phase Order

| Phase | Status | Effort | File |
|-------|--------|--------|------|
| A - Schema/status preparation | Completed | 2h | `phase-A-schema-status-preparation.md` |
| B - Edge Function vault encrypt only | Completed | 3h | `phase-B-edge-function-vault-encrypt-only.md` |
| C - UI create/import server encryption | Completed | 3h | `phase-C-ui-create-import-server-encryption.md` |
| D - `v2:` to `s3:` migration | Completed | 3h | `phase-D-v2-to-s3-migration.md` |
| E - Worker decrypt path for login macros | Completed | 4h | `phase-E-worker-decrypt-login-path.md` |
| F - Secret scrubbing and log hardening | Completed | 2h | `phase-F-secret-scrubbing-log-hardening.md` |
| G - Verification and runtime proof | Pending | 1h | `phase-G-verification-runtime-proof.md` |

## Gates

- Each phase must run `git diff --check`.
- Code phases must run targeted unit tests plus `npm.cmd run lint` and `npm.cmd run typecheck`.
- Worker/Edge Function phases must include negative auth tests.
- Runtime proof requires no plaintext in `workflow_runs`, `run_steps`, readiness reports, artifacts, or logs.

## Open Questions

- Should `credential_policy_status` be stored or derived from `encrypted_password` prefix?
- Should decrypt cache plaintext per run or per step?
- Should bridge redact all `input_text.text` params or only sensitive-labeled params?
