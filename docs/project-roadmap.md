# Project Roadmap

Date: 2026-06-27

## Completed
- Backend-owned run execution path.
- Worker claim and lease handling.
- Gateway and Mobile MCP bridge integration.
- Mobile MCP real-device clean path.
- Mobile MCP missing-device failure path.
- `OPS-08` closure for Mobile MCP pilot backend.
- Spec Kit local bootstrap.
- Repo-local agent instruction hardening with common-issue logging, bug-fix rules, Karpathy coding principles, and verified plan rules.
- Project baseline commit.
- 2026-05-05 hard-priority plan and Phase 04 pilot hardening backlog.
- First Spec Kit feature completed: `001-normalize-pilot-artifact` normalized pilot artifact labels, linkage warnings, preview availability copy, and storage-decision documentation without adding object storage.
- Spec Kit feature `002-laixi-gateway-live-proof` created and current outcome recorded: gateway health OK, no Laixi sessions, clean-path proof blocked until Laixi VIP/API access is available.
- Spec Kit feature `003-artifact-storage-thresholds` completed to define numeric inline artifact and object-storage trigger policy without implementing storage.
- **Phase 1** — Swapped mobile-mcp-ai driver to Mobilerun AndroidDriver (ADB + Portal APK) in the bridge.
- **Phase 2** — Added `DEVICE_BACKEND=mobilerun` with `ai_task` step type via MobileAgent (LLM-driven goals).
- **Phase 3** — Added iOS support via Mobilerun IOSDriver with platform-aware session manager, device discovery (ADB + Portal probe), and step compatibility guards.

## Now
- Keep Mobile MCP as pilot-default backend while Laixi remains future-compatible until VIP/API access and a live session are available.
- Use `docs/backend-capability-matrix.md` as the pilot backend capability source of truth.
- Use `docs/file-size-refactor-plan.md` to sequence large-file refactors.
- Run manual run-detail smoke for `001-normalize-pilot-artifact` when an authenticated UI session and artifact-bearing completed run are available.
- Restore current Mobile MCP local readiness by making expected Android serial `QC4DKJUO6PW4FMQW` visible to ADB/Windows, then rerun preflight/verify/fresh UI smoke.
- If UI/auth/Supabase are available before the device returns, manually inspect prior artifact-bearing run `f2bc8499-5475-4c86-ae82-55ac0c17c274` to close the Run Detail evidence UI check.
- Use the artifact storage thresholds before approving larger screenshot volume, longer retention, or external sharing.

## Next
- Normalize docs/spec workflow around `specs/` for new work.
- Modularize oversized UI files after runtime proof remains stable.
- Implement object storage only if artifact thresholds are exceeded or external sharing/audit packages become required.
- Keep sequential multi-target execution for small pilot validation unless fleet-speed SLA appears.
- Keep authenticated route lazy-loading in place; main Vite chunk is now below warning threshold.

## Social Pivot (Strategic Direction)

Strategic decision per `plans/brainstorm-report-social-first-roadmap.md`: reposition from generic device orchestration → **social media automation platform**.

### Phase 0: Foundation (Jun-Jul 2026)
- Update docs/messaging to reflect social positioning
- Set up `accounts` + `account_action_history` schema
- Verify Mobile MCP backend stable (12/12 preflight passes)
- Proof: Mobile MCP runs stable for 5 consecutive devices on simple workflow

### Phase 1: Anti-Detection & Account Lifecycle (Q3 2026) — MVP
- Anti-detection engine: random delays, scroll variance, device fingerprinting
- Account state tracking: warm-up stages, daily action limits, block detection
- Account input UI: form + CSV import, Supabase RLS per team
- Account health dashboard (engagement rate, risk score)
- Warm-up auto-advancement engine + scheduler
- Proof: 5 devices × 10 Instagram follow-actions without bot detection

### Phase 2: Social Macro Templates & Multi-App (Q4 2026)
- Pre-built Instagram (like/follow/comment on hashtag), TikTok, Facebook templates ✅
- Multi-app macro step routing (detect app in focus, adapt commands) ✅
- Account-to-macro mapping in run wizard ✅

### Phase 3: Safety Limits & Warm-Up Sequences (Q1 2027)
- Action budget types + enforcement library created ✅ (per-type budgets, checkActionBudget, getBudgetUsages)
- Budget breakdown in health cards and account form ✅
- Worker runtime enforcement (check budget before social step execution) ✅
- Automated warm-up sequences ✅ (gradual action increase over 7-21 days)
- Account health dashboard ✅
- Daily action count reset ✅ (per-calendar-day reset + limit adjustment)

### Phase 4: Failover & Device Rotation (Q2 2027)
- Account block detection + auto-rotate to healthy device
- Exponential backoff retry
- Fleet health dashboard

### Phase 5: Scheduling & Analytics (Q3 2027)
- Cron-like scheduling (daily 9am, weekdays only, etc.)
- Engagement analytics (followers gained, likes per post, 30-day trending)
- Tiered pricing: Free/Pro/Enterprise

## Later
- Parallelize multi-target execution if pilot requires fleet speed.
- Add Laixi-specific clean-path proof if VIP/API access becomes available or that backend becomes mandatory.

## Unresolved Questions
- When will Laixi VIP/API access be available for clean-path proof?
- What is the next real Spec Kit feature branch after artifact threshold policy?
- What authenticated artifact-bearing run should be used for the deferred run-detail smoke?
- Is `QC4DKJUO6PW4FMQW` still the pilot device, or should `MOBILE_MCP_EXPECTED_SERIALS` be updated?
- Instagram/TikTok API vs UI automation for initial accounts?
- Encrypted password storage or OAuth tokens for social accounts?
