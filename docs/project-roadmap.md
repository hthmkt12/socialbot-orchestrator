# Project Roadmap

Date: 2026-08-01

## Readiness Legend

| Status | Meaning |
|--------|---------|
| Implemented | Code exists in the repo. |
| Unit/smoke verified | Automated local tests or smoke scripts cover the behavior. |
| Pilot verified | Verified against the intended pilot runtime, device, and auth context. |
| Blocked | Work cannot be truthfully completed until an external/runtime dependency is available. |
| Planned | Product direction exists, but implementation or verification is incomplete. |

## Completed

- Backend-owned run execution path. Status: Unit/smoke verified.
- Worker claim and lease handling. Status: Unit/smoke verified.
- Gateway and Mobile MCP bridge integration. Status: Implemented.
- Mobile MCP real-device and missing-device clean paths. Historical pilot evidence exists for Android serial `97249fb5`; evidence freshness expires after 14 days, so rerun before any current readiness claim.
- Spec Kit local bootstrap and repo-local agent instruction hardening. Status: Implemented.
- `001-normalize-pilot-artifact`. Status: Implemented and unit verified.
- `002-laixi-gateway-live-proof`. Status: Blocked for live proof; gateway health works, but live Laixi sessions require VIP/API access.
- `003-artifact-storage-thresholds`. Status: Implemented as policy; object storage is intentionally deferred.
- Mobilerun AndroidDriver bridge swap, `DEVICE_BACKEND=mobilerun`, `ai_task`, and iOS driver support. Status: Implemented; verify per backend before claiming pilot readiness.
- Foreach loop execution worker integration and loop repetition fix. Status: Unit/smoke verified.
- Production rollout closure Phase 01: fail-closed deep/cyclic credential redaction, literal scrubbing at the log-artifact persistence boundary, and deterministic readiness freshness validation. Status: Unit verified.
- Production rollout closure Phase 02: fail-closed Laixi gateway bearer/enrollment tokens, request limits, and exact-origin credential-vault CORS. Status: Unit/typecheck/build verified; deployment still requires environment wiring.
- Testing baseline. Status: `npm.cmd run test:all` covers 542 tests as of 2026-08-01; CI runs on Node 24 actions.

## Now

- Keep Mobile MCP as the pilot-default backend.
- Use `specs/004-pilot-success-criteria/spec.md` as the Level 1 pilot evidence contract before claiming current readiness.
- Require `MOBILE_MCP_BRIDGE_TOKEN` for protected bridge endpoints unless `MOBILE_MCP_ALLOW_INSECURE_DEV=true` is explicitly set for isolated local development.
- Server-side credential encryption implemented via the `credential-vault` Edge Function. UI uses `encryptCredentialViaVault` instead of client-side `encryptPassword`. `VITE_ACCOUNT_PASSWORD_KEY` is only needed for legacy `v2:` decrypt/migration, not for new credential creation.
- Use `docs/backend-capability-matrix.md` as the backend capability source of truth.
- Use `docs/file-size-refactor-plan.md` to sequence large-file refactors.
- Preserve historical Mobile MCP evidence for audit traceability: expected serial `97249fb5`, full verify report `plans/reports/mobile-mcp-verify-2026-07-10T04-48-02-006Z.json`, UI smoke run `96ae236c-fcbd-4eb9-bc3b-7673e11cd84d`, first social pilot run `f8e94b1d-34bc-4e3c-8b59-ecdf4d5f7955`, and readiness report `86622b49-5876-4152-bfcb-f09c9b7ad090`; these July records are expired under the 14-day freshness rule and are not current readiness authority.
- Added Phase 6 Pilot Beta Hardening. The Readiness -> Accounts -> Macro -> Run -> Artifact -> Report operator loop has a repeatable script path with database inserts; runtime reruns require Mobile MCP bridge, worker, and expected device serial to be healthy. Queued run `cb7b7c01-3a61-4d7f-809f-2890668ff152` was safely transitioned to CANCELLED during runtime re-validation.
- Keep generated readiness evidence free of secrets and claim tokens; smoke and pilot verification scripts now redact claim tokens before writing/printing evidence.
- Treat Level 1 readiness evidence as fresh for 14 days from `verified_at`; rerun verification before admin `pilot_verified` if the evidence expires or the pilot device, runtime backend, bridge token/auth mode, Supabase project, or workflow proof changes.
- Keep credential-bearing artifact callers responsible for forwarding active sensitive literals to `createLogArtifact`; depth-limit or cycle detection must remain fail-closed and persist only a non-secret blocked sentinel.
- Configure `GATEWAY_HTTP_TOKEN`, `GATEWAY_DEVICE_ENROLLMENT_TOKEN`, and `CREDENTIAL_VAULT_ALLOWED_ORIGIN` per environment before enabling Laixi or browser vault flows. Never enable insecure gateway mode outside isolated local development.
- Phase 04 production safety closure: owner matrix, secret-name inventory, token separation, placeholder-only rotation rehearsal, and evidence invalidation policy documented. Static gate output and external security-owner decision remain pending; this is not production-readiness approval.

## Next

- Keep pilot validation capped at five Android devices; current runtime dispatches multi-target runs concurrently in bounded chunks of 10, without a fleet-speed SLA.
- Keep authenticated route lazy-loading in place; main Vite chunk is below the warning threshold.
- Tighten account credential handling by supporting a 3-tier status model (`pilot_client_encrypted`, `server_boundary_required`, and `server_managed`). Implemented in Phase 2 with server-side vault: the credential-vault Edge Function encrypts new credentials via `encryptCredentialViaVault`, producing `s3:` server-managed payloads. Stored credentials migrate from `v2:` client-encrypted format. Browser-side `VITE_ACCOUNT_PASSWORD_KEY` encryption is pilot-only and used solely for legacy `v2:` decrypt/migration. Secret keys are automatically scrubbed from readiness reports and evidence.
- Phase 3 operator journey cleanup implemented: sidebar regrouped to match primary operator flow (Readiness -> Accounts -> Runs -> Devices -> Analytics), Social Dashboard Go/No-Go box, Readiness stale evidence warning, Run Wizard preflight blockers linked to recovery pages, Analytics badge colored by data source state.
- Finish navigation cleanup so operators can reach runs, approvals, devices, setup, schedules, fleet health, and other in-scope operational screens from the primary sidebar.
- Production credential boundary design and implementation completed (phases A-G plus remediation). The controlled end-to-end proof passed on 2026-07-17: static gates, strict worker auth, run binding, valid decrypt, real Android execution, persistence/log scans, and cleanup. Status: **full_verified for the controlled proof scope**. Production rollout still requires operational sign-off and key rotation follow-up. Recommended architecture remains Supabase Edge Function credential vault with server-held key, `s3:` payload prefix, and `v2:` migration path.
- Production credential boundary remediation plan at `plans/260710-credential-boundary-remediation/plan.md` is complete for the verified scope. Keep generated evidence free of secrets and treat legacy service-role key rotation as a release follow-up.

## Social Pivot

Strategic direction: reposition from generic device orchestration to a social media automation platform.

### Phase 0: Foundation (Jun-Jul 2026)

Status: Unit/smoke verified; refreshed on 2026-10-04 on attached Android 14 hardware (Xiaomi Redmi 13C / 23106RN0DA, serial `QC4DKJUO6PW4FMQW`).

- Social positioning docs and app messaging: Implemented.
- `accounts` and `account_action_history` schema: Implemented.
- Mobile MCP pilot backend proof: Verified on current workstation with Android serial `QC4DKJUO6PW4FMQW` (report `mobile-mcp-first-social-pilot-2026-10-04T03-58-15-776Z.json`).
- Proof target: Real physical device execution on Level 1-5 automation flows.

### Phase 1: Anti-Detection and Account Lifecycle (Q3 2026 MVP)

Status: Pilot verified on physical device `QC4DKJUO6PW4FMQW` on 2026-10-04.

- Anti-detection helpers and worker integration: Implemented and verified with natural duration variance (650ms-750ms), reading delays, coordinate jitter, and cooldown periods.
- Account state tracking, warm-up stages, daily limits, block detection: Implemented and verified.
- Account input UI and CSV import: Implemented.
- Account health dashboard and warm-up auto-advancement: Implemented.
- Proof target: Level 2 & Level 4 multi-action warm-up flow executed on physical hardware with dual screenshot evidence capture.

### Phase 2: Social Macro Templates and Multi-App (Q4 2026)

Status: Implemented in code and pilot verified on physical hardware on 2026-10-04.

- Instagram/TikTok/Facebook starter templates: Implemented.
- Multi-app macro step routing: Implemented.
- Account-to-macro mapping in run wizard: Implemented.
- Multi-action 12-step composite macro executed to completion on physical device (run `a7f437a7-a60d-49a0-95e9-e47d365aba58`).

### Phase 3: Safety Limits and Warm-Up Sequences (Q1 2027)

Status: Pilot verified on physical hardware on 2026-10-04 (`scripts/verify-level3-action-budget.mjs`, `scripts/verify-warmup-campaign-progression.mjs`, and `tests/e2e/operator-warmup-dashboard.spec.ts`).

- Action budget types and enforcement library: Implemented.
- Budget breakdown in UI: Implemented.
- Operator Web UI Dashboard & Warm-Up Progression: Implemented and verified via Playwright E2E (`tests/e2e/operator-warmup-dashboard.spec.ts`) testing `SocialDashboardPage`, `WarmUpAdvancementPanel`, `AccountHealthCard` budget badges, and one-click advancement mutations with toast notifications.
- Worker Background Warm-Up Scheduler: Implemented `AccountWarmupScheduler` in execution worker (`services/execution-worker/src/account-warmup-scheduler.ts`) running periodic background polling for stage auto-advancement and daily action counter reset, integrated into worker health server and verified with 100% passing unit tests (`services/execution-worker/src/account-warmup-scheduler.test.ts`).
- Worker runtime enforcement via `params.actionBudgetType`: Verified with pre-execution cutoff `BUDGET_EXCEEDED` before hardware touch events occur.
- Automated warm-up sequences, stage auto-advancement, and daily action reset: Implemented and verified on physical hardware (`QC4DKJUO6PW4FMQW`) with dynamic stage advancement (Stage 2 -> Stage 3), daily action limit ramp (5 -> 15), counter reset (5 -> 0), and budgeted execution under newly unlocked limits. Supabase RPC `increment_account_action_count` verified.

### Phase 4: Failover and Device Rotation (Q2 2027)

Status: Pilot verified for resilience, error recovery, checkpoint block detection, and hardware mutex on 2026-10-04 (`scripts/verify-level5-resilience-recovery.mjs` and `scripts/verify-concrete-social-bots.mjs`).

- Account block detection and automated quarantine: Implemented and verified via unit tests (`src/lib/account-block-detector.test.ts`) and live physical execution (`scripts/verify-concrete-social-bots.mjs`). Detects social platform restriction keywords (`'action blocked'`, `'try again later'`, `'we restrict certain activity'`, etc.), updates database flag `is_blocked = true` with reason, and triggers immediate fail-closed pre-execution cutoffs.
- Operator Checkpoint Resolution & Unblock Journey: Implemented and verified via Playwright E2E (`tests/e2e/operator-warmup-dashboard.spec.ts`). `AccountHealthCard` surfaces platform restriction alerts and `detected_block_reason`, with one-click "Resolve & Unblock Account" mutation resetting `is_blocked = false` and clearing `detected_block_reason = null` with instant toast notification.
- Hardware lock mutex: Verified single-device mutual exclusion (`DEVICE_LOCKED`) prevents overlapping runs.
- Step failure automatic lock release: Verified runs that fail mid-execution cleanly release device locks in `finally` block.
- Stale lock auto-cleanup: Verified worker deletes expired locks and safely recovers device execution.
- Fleet health dashboard, system monitor, audit logs UI: Implemented.
- Exponential backoff retry: Implemented and unit tested.

### Phase 5: Scheduling and Analytics (Q3 2027)

Status: Pilot verified for background schedule trigger (`scripts/verify-scheduled-workflow-trigger.mjs`) and engagement analytics rollup (`tests/e2e/analytics-journey.spec.ts` & `src/lib/analytics-service.test.ts`) on 2026-10-04.

- Cron-like scheduling: Implemented and verified via `WorkflowScheduleTrigger` background loop in execution worker; automated dispatch to physical device without operator intervention.
- Engagement analytics UI/data path: Implemented live aggregation of `account_action_history` events into daily action rollups, action type distribution, live success rates, and recent device error logs with Playwright E2E verification on `AnalyticsPage`.
- Tiered pricing page: Removed from MVP runtime scope; billing/payment/subscription remain out of scope.

### Phase 6: Object Storage (Q3 2027)

Status: Implemented for threshold policy and Supabase storage path; scale readiness remains conditional.

- Large payload extraction and signed URL flow: Implemented.
- Use storage thresholds before increasing screenshot volume, retention, exports, or external sharing.

### Phase 7: Concrete Social Bots (Q4 2027)

Status: Implemented and verified on physical Android hardware (`QC4DKJUO6PW4FMQW` / Xiaomi Redmi 13C) on 2026-10-04 (`scripts/verify-concrete-social-bots.mjs`).

- Concrete Instagram/TikTok macro templates: Implemented and registered (`instagram_warmup`, `instagram_hashtag_engage`, `tiktok_view_bot`).
- Physical social engagement execution: Verified real execution combining app launch, human-like reading pauses (2000ms+), natural feed scrolling variance, budgeted action execution (`like`), and proof screenshot capture.
- Checkpoint block detection and fail-closed isolation: Verified automated account isolation upon detecting platform error indicators, preventing further gesture dispatch while maintaining 0 residual hardware locks.
- `foreach` execution support: Implemented.
- Anti-detection engine in worker: Implemented.

### Phase 8: Parallel Execution (Fleet Speed)

Status: Unit/smoke verified; multi-target concurrency & hardware mutex isolation verified on 2026-10-04 (`scripts/verify-fleet-parallel-dispatch.mjs`).

- Worker thread execution boundary: Implemented.
- `MultiTargetRunExecutor` dispatcher refactor: Implemented.
- Atomic counter RPC: Implemented.
- Hardware Device Mutex & Fleet Isolation: Verified parallel acquisition of multiple device locks simultaneously under parent `MULTI_DEVICE` run, strict mutual exclusion rejecting conflicting runs, and 100% clean-path release leaving 0 residual locks.
- Keep pilot validation capped at five Android devices; current runtime dispatches multi-target runs concurrently in bounded chunks of 10, without a fleet-speed SLA.

### Phase 9: Laixi Clean-Path Proof

Status: Mock verified; live proof blocked.

- `laixi-step-backend.ts` mappings and HTTP wrapper: Implemented.
- Mock gateway server: Implemented.
- Live proof requires Laixi VIP/API access and a live session.

### Phase 10: User Documentation System

Status: Implemented.

- In-app markdown docs viewer: Removed from runtime scope during use-case cleanup.
- Operational guidance remains in focused setup panels and repo docs.

### Phase 11: Playwright E2E Testing Suite

Status: Implemented and verified on 2026-10-04 (`tests/e2e/run-wizard-journey.spec.ts`).

- Playwright config and baseline navigation tests: Implemented.
- CI coverage and auth mocking: Implemented.
- Run wizard multi-step dynamic navigation: Implemented and unit tested (`src/components/runs/run-wizard-navigation.test.ts`).
- Run wizard submission & account safety checks: Implemented and unit tested (`src/components/runs/run-wizard-submit.test.ts`).
- Full operator workflow run launch E2E: Verified in browser with real UI transitions, anti-detection account selection, input parameters, preflight validation gates, and run dispatch redirection to `/runs/{id}/monitor`.

### Phase 12: Advanced Macros

Status: Unit verified on 2026-10-04 (`services/execution-worker/src/single-device-step-runner.advanced-control-flow.test.ts`).

- Conditionals, while loops, variables, and error boundaries: Implemented and unit tested.
- Branch execution & skip verification: Verified `conditional` step evaluates templated expressions, dispatches active branch, and records inactive branch as `SKIPPED`.
- Iterative loop cache isolation: Verified `loop` step repetition clears persisted step cache across iterations and halts cleanly on step failure.
- Try/Catch error boundaries: Verified `try_catch` step intercepts inner failures, executes recovery steps in `catch` block, and marks parent step `SUCCESS` with `output.caughtError: true`. Catch block failures propagate to `FAILED`.
- Foreach iteration & context injection: Verified dynamic unpacking of comma-separated strings and JSON arrays into iteration context.
- Grouping containers: Verified composite `group` step execution across all inner steps.

### Phase 13: AI Workflow Builder

Status: Removed from MVP runtime scope during use-case cleanup.

- Natural language macro generation, provider-backed prompt translation, and conversational editing are not part of the current MVP.

### Phase 14: Fleet Soak & Memory Integrity Characterization

Status: Pilot verified on physical Android hardware (`QC4DKJUO6PW4FMQW` / Xiaomi Redmi 13C) on 2026-10-04 (`scripts/verify-fleet-soak-integrity.mjs`, report `plans/reports/fleet-soak-integrity-report-1791115558368.json`).

- Multi-cycle sequential execution: Verified 3 continuous automation cycles executing app launch, human pauses, multi-point feed swipe gestures, budgeted interactions (`like`), and screenshot artifacts to `COMPLETED`.
- 100% clean hardware lock lifecycle: Verified `device_locks` acquired per run and cleanly released with 0 residual locks across every consecutive cycle.
- Fault resilience lock release: Verified intentional step failure terminates with `FAILED` while releasing device locks unconditionally in worker `finally` block (0 lingering locks).
- Account action count & daily reset: Verified atomic counter increments via RPC and daily counter rollover to 0.
- Memory stability & bounded heap: Worker process memory observed in real-time via `/health` endpoint; heap growth bounded at +2.53 MB across full multi-run sequence (threshold < 25 MB). Zero leaks.

## Later

- Add Laixi-specific live clean-path proof when access is available.
- Parallelize multi-target execution only when pilot fleet speed requires it.

## Unresolved Questions

- When will Laixi VIP/API access be available for clean-path proof?
- Should `97249fb5` remain the pinned pilot device for this workstation?
- Instagram/TikTok API vs UI automation for initial accounts?
