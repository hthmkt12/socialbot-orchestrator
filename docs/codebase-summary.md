# Codebase Summary

Date: 2026-08-01

## Product
SocialBot Orchestrator orchestrates Android/iOS device automation workflows through Supabase, a backend worker, and device bridges (Mobile MCP with Mobilerun AndroidDriver/IOSDriver). Product direction targets **social media automation teams** running 5-50 devices with account lifecycle tracking and multi-app workflows (Instagram, TikTok, Facebook). Current pilot validation remains capped at five Android devices; no anti-bot guarantee is made.

### Strategic Direction
Social media automation pivot — per `plans/brainstorm-report-social-first-roadmap.md`. Phase 0 (Foundation) and Phase 1 MVP are completed. See `docs/project-roadmap.md` → Social Pivot for full 6-phase plan.
- **Phase 0 Foundation Details**:
  - Repositioned from generic device orchestration to social-first automation.
  - Implemented core database schemas: `accounts` (credential storage, warm-up stage, daily action limit, blocked status) and `account_action_history` (tracking executed automated actions per device/account).
  - Established Mobile MCP pilot backend proof to run workflows across connected Android/iOS devices.

## Main Areas
- `src/`: React/Vite SPA.
- `src/pages/`: app routes for devices, setup, runs, approvals, audit, accounts, analytics, admin, and Mobile MCP orchestrator.
- `src/hooks/`: Supabase React Query hooks.
- `src/lib/`: Supabase client, run control fallback, role access, preflight, device setup helpers, run artifact normalization.
- `src/contracts/`: macro JSON contracts, samples, and social engagement templates.
- `services/execution-worker/`: backend run claim, lease, execution, Mobile MCP/Laixi dispatch, smoke tests.
- `services/laixi-gateway/`: Laixi device session manager and HTTP dispatch service.
- `services/mobile-mcp-bridge/`: local Python Android/iOS bridge using Mobilerun AndroidDriver + IOSDriver.
- `packages/shared/`: shared execution contracts and lifecycle helpers.
- `supabase/migrations/`: database schema and seed functions.
- `plans/`: hard plans, status reports, runtime evidence.
- `.specify/`: Spec Kit bootstrap templates.
- `docs/`: project summary, roadmap, changelog, standards, and operational notes.

### Internal Gateway and Vault Boundary

- The Laixi gateway starts fail-closed unless both `GATEWAY_HTTP_TOKEN` and `GATEWAY_DEVICE_ENROLLMENT_TOKEN` are configured. `GATEWAY_ALLOW_INSECURE_DEV=true` is an explicit, local-only escape hatch.
- `/health` is public and intentionally minimal. `/sessions` and `/dispatch-step` require `Authorization: Bearer <GATEWAY_HTTP_TOKEN>`; WebSocket device registration requires the enrollment token.
- The execution worker forwards `GATEWAY_HTTP_TOKEN` for Laixi dispatches. Keep these values server-side and behind the private service network.
- The `credential-vault` Edge Function uses exact-origin CORS from `CREDENTIAL_VAULT_ALLOWED_ORIGIN` (default local origin `http://localhost:5173`); wildcard `*` is rejected.

## Current Verification Baseline
- `npm.cmd run test:all`: 66 files, 629 tests pass on 2026-10-04.
- `npm.cmd run test:services`: 18 files, 128 tests pass on 2026-10-04.
- `npm.cmd run typecheck`: pass on 2026-10-04 (0 errors).
- `npm.cmd run lint`: pass on 2026-10-04 (0 warnings, 0 errors).
- `npm.cmd run build`: pass on 2026-10-04 (client build in 1.22s).
- `npm.cmd run build:worker`: pass on 2026-10-04.
- `npm.cmd run build:gateway`: pass on 2026-07-08 (20KB).
- `python -m unittest discover -s services\mobile-mcp-bridge\tests -p "test_*.py"`: pass on 2026-10-04.
- `npm.cmd run test:e2e`: Playwright E2E suite passes across visitor auth, navigation, operator journey, warmup dashboard, analytics journey, and run wizard launch.
- Physical pilot proof verified on 2026-10-04 with attached Android 14 hardware (`QC4DKJUO6PW4FMQW` / Xiaomi Redmi 13C): Level 1-5 automation, multi-action warm-up, action budgets, anti-detection variances, automated account quarantine on checkpoint error, and clean hardware mutex lock release.
- `npm.cmd audit`: 0 vulnerabilities in root app, execution worker, and Laixi gateway workspaces.
- GitHub Actions CI: `.github/workflows/ci.yml` — lint → typecheck → build → test on push/PR.
- Docker: full-stack compose (frontend + worker + gateway) with Dockerfiles.
- Level 1 pilot readiness now requires explicit evidence fields from `specs/004-pilot-success-criteria/spec.md`; implementation status alone is not enough for a current readiness claim.

## Current Product State
- Backend-owned run execution exists.
- Worker claim/lease path exists.
- **Production rollout closure Phase 01 completed**: Credential redaction now fails closed with non-secret sentinels for excessive depth and cycles instead of returning the original branch. The log-artifact persistence boundary accepts active sensitive literals and scrubs them from text, metadata, and upload errors before Supabase writes. Readiness evidence validation accepts an explicit `now` value so the 14-day freshness policy can be tested deterministically while production calls still default to the current time. Direct canary tests cover deep structures and inline/object-storage artifact paths.
- **Phase 2: Credential Boundary — `full_verified` for controlled proof scope**: The credential-vault Edge Function and worker decrypt path were re-verified after the red-team remediation. The deployed boundary uses dedicated worker/service authentication, strict run binding, server-side `s3:` encryption, redaction checks, and real Android runtime proof. The controlled proof on 2026-07-17 passed static gates, 6/6 auth cases, valid decrypt, device execution, persistence scan, log scan, and disposable cleanup. Production rollout still requires normal operational sign-off and key rotation follow-up.
- **Phase 3: Operator Journey Cleanup implemented**: Sidebar regrouped to match primary operator flow (Operations/Automation/Diagnostics & Insights/Admin). Social Dashboard has a Go/No-Go box. Readiness page shows a stale evidence warning. Run Wizard preflight blockers link to Accounts/Devices/Readiness/Macros. Analytics badge colored by data source state.
- **Phase 4: Failover and Device Rotation verified**: Account block detection and automated quarantine on social platform restriction indicators (`is_blocked = true`), with one-click operator checkpoint unblock mutation and hardware lock mutex.
- **Phase 5: Scheduling and Analytics verified**: Background cron workflow schedule triggers and live aggregation of account action history into daily rollups, distribution charts, and error logs.
- **Phase 7: Concrete Social Bots verified**: Real physical execution on Android 14 hardware combining app launch, human-like reading pauses (2000ms+), natural feed scrolling variance, budgeted action execution (`like`), and proof screenshot capture.
- **Phase 8: Parallel Execution** — Worker-per-device topology via Node.js `worker_threads`. Race condition fix (`accounts.current_action_count` → PostgreSQL RPC). Concurrent device execution uses bounded chunks of 10. Offline tests/builds pass; no fleet-speed SLA is claimed.
- **Phase 9: Laixi Clean-path Proof** — `LaixiGatewayClient` with `AbortController` timeout, 502/504 error handling. Mock Gateway Server (port 8080) for E2E smoke testing.
- **Phase 10: User Documentation** — Removed from runtime scope during use-case cleanup; operational guidance now lives in focused in-app setup panels and repo docs.
- **Phase 11: Playwright E2E Testing Suite verified**: Full multi-step run wizard operator journey verified in browser with real UI transitions, anti-detection account selection, input parameters, preflight validation gates, and run dispatch redirection.
- **Phase 12: Advanced Macros unit verified**: Branch execution & skip verification (`conditional`), iterative loop cache isolation (`loop`), error boundaries (`try_catch`), foreach iteration (`foreach`), and grouping containers (`group`) verified with 100% test pass.
- MVP runtime scope is implemented for the current use-case set; docs/pricing/AI builder are intentionally out of runtime scope.
- **CI pipeline** — GitHub Actions workflow (lint → typecheck → build → test).
- **Docker** — Multi-stage Dockerfiles for worker + gateway, 3-service docker-compose.yml.
- Historical Mobile MCP real-device UI smoke passed on 2026-07-08 with device `97249fb5`; evidence is expired under the 14-day freshness rule and requires rerun for current readiness.
- `OPS-08` is closed for Mobile MCP proof.
- Laixi gateway health proof is documented separately; clean-path proof is blocked by missing external Laixi VIP/API/session availability.
- Spec Kit feature `001-normalize-pilot-artifact` is implemented for artifact display normalization and storage-decision documentation.
- Spec Kit feature `002-laixi-gateway-live-proof` is blocked/future-only until Laixi VIP/API access enables a live session.
- Spec Kit feature `003-artifact-storage-thresholds` is completed and merged.
- **Mobile MCP local readiness evidence**: Historical local proof used device `97249fb5` (Redmi/onyx, Android 16). Full `npm.cmd run verify:mobile-mcp` passed on 2026-07-10 with browser UI smoke run `96ae236c-fcbd-4eb9-bc3b-7673e11cd84d`; evidence is expired and not current readiness authority.
- **First social pilot evidence**: Historical Instagram open/capture proof run `f8e94b1d-34bc-4e3c-8b59-ecdf4d5f7955` completed with screenshot artifact `a9c4cc2f-7afb-418c-b698-039735282683`; readiness report `86622b49-5876-4152-bfcb-f09c9b7ad090` was `pilot_verified` at capture time and is expired for current claims.
- **Phase 6: Pilot Beta Hardening implemented**: Hardened operator loop (Readiness -> Accounts -> Macro -> Run -> Artifact -> Report) with automated DB inserts for pilot readiness reports. Stuck queued run `cb7b7c01-3a61-4d7f-809f-2890668ff152` was safely transitioned to CANCELLED.
- **Phase 7: Concrete Social Bots implemented**: Seeded concrete templates (`instagram_warmup`, `instagram_hashtag_engage`, `tiktok_view_bot`) using nested loop, conditional steps, and anti-detection settings. Updated UI step type configurations for `foreach`, `while_loop`, `try_catch`, and `extract_var`.
- **Production credential boundary design completed (no implementation)**: Evaluated 3 architecture options (Supabase Edge Function vault, worker-owned credential service, external KMS). Recommended Option A (Supabase Edge Function vault) with `s3:` payload prefix and `v2:` migration path. Design report at `plans/260708-1630-pilot-production-priority/reports/phase-08-production-credential-boundary-design.md`. No code, schema, or runtime changes made.
- **Production credential boundary implementation plan created (no implementation)**: Plan directory `plans/260710-credential-boundary-implementation-plan/` sequences schema/status prep, Edge Function encrypt-only, UI switch, `v2:` migration, worker decrypt path, scrub hardening, and runtime proof.
- **Credential boundary Phase A schema/status prep implemented**: Added migration `20260710000001_credential_boundary_metadata.sql` with nullable columns `credential_policy_status`, `credential_key_version`, `credential_rotated_at` on `accounts` table. Backfilled existing `v2:` rows as `pilot_client_encrypted`. Updated `Account` TypeScript interface and `CredentialPolicyStatus` union (added `migration_pending`). No Edge Function, no UI behavior change, no worker decrypt change, no plaintext column. Not production-ready.
- **Credential boundary Phase B Edge Function encrypt-only implemented**: Added `supabase/functions/credential-vault/index.ts` (encrypt-only, POST, JWT auth, OPERATOR/ADMIN role check, AES-GCM 256-bit with `SERVER_CREDENTIAL_KEY`, `s3:1:` payload format). Testable crypto helper at `supabase/functions/credential-vault/crypto-helper.ts` with 6 unit tests. No decrypt, no DB writes, no UI change, no worker change. Not production-ready.
- **Credential boundary Phase C UI create/import server encryption implemented**: Added `src/lib/account-credential-vault-client.ts` calling the credential-vault Edge Function. Updated `create-account-modal.tsx` and `AccountsPage.tsx` CSV import to use `encryptCredentialViaVault` instead of client-side `encryptPassword`. Removed `credentialPolicy` gates from create/import UI (no longer requires `VITE_ACCOUNT_PASSWORD_KEY`). `encryptPassword` and `VITE_ACCOUNT_PASSWORD_KEY` preserved as legacy. Existing `v2:` accounts still render. Not production-ready.
- **Credential boundary Phase D v2: to s3: migration implemented**: Extended `supabase/functions/credential-vault/crypto-helper.ts` with `decryptLegacyCredential` (v2: decrypt), `decryptServerCredential` (s3: decrypt), `deriveLegacyKey`, and legacy constants matching `src/lib/account-password-crypto.ts`. Updated `deriveServerKey` to support both encrypt and decrypt. Added `action: 'migrate'` (ADMIN-only, service-role DB writes, decrypts v2: with `LEGACY_PILOT_KEY`, re-encrypts as s3:, never overwrites original until both succeed, marks failures as `migration_pending`) and `action: 'dry-run'` (ADMIN-only, counts v2: rows) routes to `index.ts`. Added 7 decrypt/migration tests (13 total in crypto-helper.test.ts). Created `scripts/credential-migration-runner.mjs` for CLI batch/single-account migration with JSON report output. Updated `.env.example` with `LEGACY_PILOT_KEY` documentation. `v2:` decrypt support retained. Not production-ready.
- **Credential boundary Phase E worker decrypt login path implemented**: Added `action: 'decrypt'` (ADMIN-only) to `supabase/functions/credential-vault/index.ts` - detects `s3:`/`v2:` prefix, returns plaintext to caller, never logs plaintext/ciphertext/keys, returns generic `Decrypt failed.` on error. Created `services/execution-worker/src/credential-decrypt-client.ts` - worker-side client that reads `accounts.encrypted_password`, invokes the Edge Function decrypt action, throws safe errors (no plaintext in messages). Added `sensitiveInputVariables` in-memory map to `single-device-step-runner.ts` - resolves `{{accountPassword}}` before retry loop via dynamic import of decrypt client, overlays decrypted value onto resolved params from raw step params (not inputVariables), clears in `finally` block after step execution. Added `scrubSensitiveOutput` method that redacts `text` field to `[REDACTED]` for `input_text` steps before persistence. Updated `mobile-mcp-step-backend.ts` `normalizeOutput` to return `text: '[REDACTED]'` for `input_text` steps instead of leaking plaintext via `...resolvedParams`. Added 7 unit tests in `credential-decrypt-client.test.ts` and 8 tests in `single-device-step-runner.sensitive.test.ts` proving no plaintext in `output_json`, `input_json`, or error messages. Not production-ready.
- **Credential boundary Phase F secret scrubbing and log hardening implemented**: Created `services/execution-worker/src/credential-redaction.ts` with `isSensitiveKey`, `redactSensitiveValues` (recursive, deny-by-default for `password`/`secret`/`token`/`apiKey`/`serviceRole`/`accountPassword`, preserves allowed status keys), and `redactSensitiveJsonString` (JSON-parse or pattern-based redaction for log messages). Applied `redactSensitiveValues` to `output_json`/`error_json` in `worker-step-store.ts` `persistRunStep()` and to log artifact metadata in `worker-run-store.ts` `createLogArtifact()`; wrapped both artifact-upload `console.error` calls with `redactSensitiveJsonString`. Added `redact_sensitive_params` and `redact_error_message` to `services/mobile-mcp-bridge/src/bridge_server.py`; applied `redact_error_message` to all `str(exc)` error responses in `_handle_result`, `_execute_step`, and `_call_tool`. Verified Edge Function already uses a catch-all generic error response and never logs plaintext/keys/bodies (no changes needed). Added `services/execution-worker/src/credential-redaction.test.ts` with unit tests for all three functions plus 5 canary tests proving `[REDACTED_CANARY]` does not appear in redacted output. Not production-ready.
- **Credential boundary Phase G verification — `full_verified` for controlled proof scope**: The earlier claim was invalidated by red-team review, then re-established after remediation. A fresh controlled credential login run on 2026-07-17 passed strict worker auth, run binding, valid decrypt, real Android execution, persistence/log scans, and cleanup. Production rollout still requires operational sign-off and key rotation follow-up.
- `scripts/verify-mobile-mcp-local.mjs` writes a `readinessEvidence` object containing pilot level, backend mode, bridge/worker/Supabase health, serials, run id/status, artifact refs, scrub status, `verified_at`, and claim summary.
- `/readiness` uses `readiness-report-form-helpers` for tested evidence defaults, labels, backend-specific proof fields, comma-separated serial/artifact conversion, and blocker-aware admin verification affordances.
- Foreach loop execution integration in backend worker (`handleForeachLoop` in `single-device-step-runner.ts`) along with a critical bug fix resolving loop step repetition/skipping defects across all loop types.
- Extended unit testing suite with 100% line coverage for `anti-detection-helpers.ts` and `account-service-helpers.ts`.

## Known Risks
- `single-device-step-runner.ts` was refactored during Phase 1 but several source files still exceed 200 lines (e.g. `single-device-step-runner.ts` at 704 lines, `SchedulesPage.tsx` at 346 lines, `ReadinessReportsPage.tsx` at 329 lines, `worker-run-store.ts` at 331 lines, `gateway-session-manager.ts` at 308 lines). The earlier claim "All source files are below 200 lines" is no longer accurate; continued file-size refactoring is tracked in `docs/file-size-refactor-plan.md`.
- Main Vite chunk remains below the 500 kB warning threshold.
- Mobile MCP V1 does not execute `run_autox`.
- Full Mobile MCP verify / UI smoke passed on the connected Android device; keep `MOBILE_MCP_EXPECTED_SERIALS` aligned with the attached serial before rerunning.
- Git remote is configured at `origin`; `master` is pushed and CI passes on GitHub Actions.
- Inline artifact storage is acceptable for small pilot volume; object storage is deferred until higher screenshot volume, longer retention, or external sharing.
- Fresh Mobile MCP artifact-producing smoke requires the expected Android device to be visible to ADB.
- Laixi clean-path proof cannot run without VIP/API access and a live Laixi-compatible device session.

## Current Decisions
- Laixi is future-compatible for now; pilot default remains Mobile MCP until Laixi VIP/API access enables a clean-path proof.
- Keep `MOBILE_MCP_EXPECTED_SERIALS` pinned to `97249fb5` for this workstation while it remains the active pilot device.

## Unresolved Questions
- What is the next Spec Kit feature after artifact threshold policy?
- Social pivot Phase 0-5 needs user validation — is "SocialBot Orchestrator" the right product name?
- Instagram/TikTok API vs pure UI automation for account actions?
- Encrypted password storage or OAuth tokens for social account credentials?
