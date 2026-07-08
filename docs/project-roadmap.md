# Project Roadmap

Date: 2026-07-08

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
- Mobile MCP real-device and missing-device clean paths. Status: Pilot verified on Android serial `97249fb5`; keep expected-device checks before reruns.
- Spec Kit local bootstrap and repo-local agent instruction hardening. Status: Implemented.
- `001-normalize-pilot-artifact`. Status: Implemented and unit verified.
- `002-laixi-gateway-live-proof`. Status: Blocked for live proof; gateway health works, but live Laixi sessions require VIP/API access.
- `003-artifact-storage-thresholds`. Status: Implemented as policy; object storage is intentionally deferred.
- Mobilerun AndroidDriver bridge swap, `DEVICE_BACKEND=mobilerun`, `ai_task`, and iOS driver support. Status: Implemented; verify per backend before claiming pilot readiness.
- Foreach loop execution worker integration and loop repetition fix. Status: Unit/smoke verified.
- Testing baseline. Status: `npm.cmd test` currently covers 263 tests; CI runs on Node 24 actions.

## Now

- Keep Mobile MCP as the pilot-default backend.
- Use `specs/004-pilot-success-criteria/spec.md` as the Level 1 pilot evidence contract before claiming current readiness.
- Require `MOBILE_MCP_BRIDGE_TOKEN` for protected bridge endpoints unless `MOBILE_MCP_ALLOW_INSECURE_DEV=true` is explicitly set for isolated local development.
- Require `VITE_ACCOUNT_PASSWORD_KEY` before saving social account credentials; treat the browser key as pilot-only until credential encryption moves server-side.
- Use `docs/backend-capability-matrix.md` as the backend capability source of truth.
- Use `docs/file-size-refactor-plan.md` to sequence large-file refactors.
- Preserve the current Mobile MCP local readiness baseline: expected serial `97249fb5`, full verify report `plans/reports/mobile-mcp-verify-2026-07-08T06-50-50-734Z.json`, UI smoke run `63ce7aea-0b13-4998-a990-cc15bdfc8561`, first social pilot run `a414e519-c1ac-44df-b287-e91e845f0084`, and readiness report `76e0141b-2e23-475c-97ea-d4214d50d3d3` marked `pilot_verified`.
- Keep generated readiness evidence free of secrets and claim tokens; smoke and pilot verification scripts now redact claim tokens before writing/printing evidence.

## Next

- Keep sequential multi-target execution for small pilot validation unless fleet-speed SLA appears.
- Keep authenticated route lazy-loading in place; main Vite chunk is below the warning threshold.
- Tighten account credential handling by moving encryption/decryption server-side before production social credentials are stored at scale.
- Finish navigation cleanup so operators can reach runs, approvals, devices, setup, schedules, fleet health, and other in-scope operational screens from the primary sidebar.

## Social Pivot

Strategic direction: reposition from generic device orchestration to a social media automation platform.

### Phase 0: Foundation (Jun-Jul 2026)

Status: Unit/smoke verified, with Mobile MCP Level 1 pilot readiness verified on 2026-07-08.

- Social positioning docs and app messaging: Implemented.
- `accounts` and `account_action_history` schema: Implemented.
- Mobile MCP pilot backend proof: Verified on current workstation with Android serial `97249fb5`.
- Proof target: 5 devices on a simple workflow. Current evidence should be refreshed before claiming this again.

### Phase 1: Anti-Detection and Account Lifecycle (Q3 2026 MVP)

Status: Implemented with unit coverage; first social pilot proof completed for Instagram open/capture.

- Anti-detection helpers and worker integration: Implemented.
- Account state tracking, warm-up stages, daily limits, block detection: Implemented.
- Account input UI and CSV import: Implemented.
- Account health dashboard and warm-up auto-advancement: Implemented.
- Proof target: 5 devices x 10 Instagram follow-actions without bot detection. Status: Planned verification, not currently claimed.

### Phase 2: Social Macro Templates and Multi-App (Q4 2026)

Status: Implemented in code; Mobile MCP pilot readiness is verified for current Level 1 scope.

- Instagram/TikTok/Facebook starter templates: Implemented.
- Multi-app macro step routing: Implemented.
- Account-to-macro mapping in run wizard: Implemented.

### Phase 3: Safety Limits and Warm-Up Sequences (Q1 2027)

Status: Implemented in code; production readiness depends on current verification and product policy review.

- Action budget types and enforcement library: Implemented.
- Budget breakdown in UI: Implemented.
- Worker runtime enforcement via `params.actionBudgetType`: Implemented.
- Automated warm-up sequences and daily action reset: Implemented.

### Phase 4: Failover and Device Rotation (Q2 2027)

Status: Partially implemented.

- Account block detection: Implemented.
- Device rotation/failover policy: Planned verification.
- Fleet health dashboard, system monitor, audit logs UI: Implemented.
- Exponential backoff retry: Planned verification.

### Phase 5: Scheduling and Analytics (Q3 2027)

Status: Partially implemented.

- Cron-like scheduling: Implemented.
- Engagement analytics UI/data path: Implemented; use real persisted analytics data or explicit seed data.
- Tiered pricing page: Removed from MVP runtime scope; billing/payment/subscription remain out of scope.

### Phase 6: Object Storage (Q3 2027)

Status: Implemented for threshold policy and Supabase storage path; scale readiness remains conditional.

- Large payload extraction and signed URL flow: Implemented.
- Use storage thresholds before increasing screenshot volume, retention, exports, or external sharing.

### Phase 7: Concrete Social Bots (Q4 2027)

Status: Partially implemented through templates; real-platform proof still required.

- Concrete Instagram/TikTok macro templates: Implemented.
- `foreach` execution support: Implemented.
- Anti-detection engine in worker: Implemented.

### Phase 8: Parallel Execution (Fleet Speed)

Status: Unit/smoke verified.

- Worker thread execution boundary: Implemented.
- `MultiTargetRunExecutor` dispatcher refactor: Implemented.
- Atomic counter RPC: Implemented.
- Keep sequential multi-target execution acceptable for small pilot unless SLA requires parallelism.

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

Status: Implemented baseline.

- Playwright config and baseline navigation tests: Implemented.
- CI coverage and auth mocking: Implemented.
- Continue expanding around run wizard and account flows.

### Phase 12: Advanced Macros

Status: Implemented in code; broaden coverage before production claims.

- Conditionals, while loops, variables, and error boundaries: Implemented.

### Phase 13: AI Workflow Builder

Status: Removed from MVP runtime scope during use-case cleanup.

- Natural language macro generation, provider-backed prompt translation, and conversational editing are not part of the current MVP.

## Later

- Move social account credential encryption server-side.
- Add Laixi-specific live clean-path proof when access is available.
- Parallelize multi-target execution only when pilot fleet speed requires it.

## Unresolved Questions

- When will Laixi VIP/API access be available for clean-path proof?
- Should readiness reports expire or require periodic rerun after device/runtime changes?
- Should `97249fb5` remain the pinned pilot device for this workstation?
- Instagram/TikTok API vs UI automation for initial accounts?
- What is the required credential boundary before production social credentials are allowed?
