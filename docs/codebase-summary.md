# Codebase Summary

Date: 2026-06-27

## Product
Laixi Automation Platform orchestrates Android/iOS device automation workflows through Supabase, a backend worker, and device bridges (Mobile MCP with Mobilerun AndroidDriver/IOSDriver). Purpose-built for **social media automation teams** running 5-50 devices with anti-detection, account lifecycle tracking, and multi-app workflows (Instagram, TikTok, Facebook).

### Strategic Direction
Social media automation pivot — per `plans/brainstorm-report-social-first-roadmap.md`. Phase 0 (Foundation) in progress. See `docs/project-roadmap.md` → Social Pivot for full 6-phase plan.

## Main Areas
- `src/`: React/Vite SPA.
- `src/pages/`: app routes for devices, setup, runs, approvals, audit, demo, Mobile MCP orchestrator.
- `src/hooks/`: Supabase React Query hooks.
- `src/lib/`: Supabase client, run control fallback, role access, preflight, device setup helpers, run artifact normalization.
- `src/contracts/`: macro JSON contracts, samples, Social Macro DSL.
- `services/execution-worker/`: backend run claim, lease, execution, Mobile MCP/Laixi dispatch, smoke tests.
- `services/laixi-gateway/`: Laixi device session manager and HTTP dispatch service.
- `services/mobile-mcp-bridge/`: local Python Android/iOS bridge using Mobilerun AndroidDriver + IOSDriver.
- `packages/shared/`: shared execution contracts and lifecycle helpers.
- `supabase/migrations/`: database schema and seed functions.
- `plans/`: hard plans, status reports, runtime evidence.
- `.specify/`: Spec Kit bootstrap templates.
- `docs/`: project summary, roadmap, changelog, standards, and operational notes.

## Current Verification Baseline
- `npm.cmd test`: 5 files, 27 tests pass on 2026-06-27.
- `npm.cmd run typecheck`: pass on 2026-06-27.
- `npm.cmd run lint`: pass on 2026-06-27 (1 unused-eslint-disable warning).
- `npm.cmd run build`: 6.5s, pass on 2026-06-27; main chunk 364 kB gzip 110 kB.
- `npm.cmd run build:worker`: pass on 2026-06-27.
- `npm.cmd run build:gateway`: pass on 2026-06-27.
- `npm.cmd run smoke:backend`: pass on 2026-06-27.
- `npm.cmd run verify:mobile-mcp`: steps 1-2 pass (runtime.check, devices.wait). Steps 3-6 blocked on Supabase DNS.
- Mobile MCP local stack healthy: bridge (200), worker (200, mobile-mcp backend), Vite UI (200). Device `97249fb5` (Redmi/onyx) online.
- Evidence: `plans/260506-mobile-mcp-pilot-readiness-smoke/` (updated 2026-06-27).

## Current Product State
- Backend-owned run execution exists.
- Worker claim/lease path exists.
- Mobile MCP real-device UI smoke passed (2026-05-06 with R58MC1XNTLR).
- `OPS-08` is closed for Mobile MCP proof.
- Laixi gateway health proof is documented separately; clean-path proof is blocked by missing external Laixi VIP/API/session availability.
- Spec Kit feature `001-normalize-pilot-artifact` is implemented for artifact display normalization and storage-decision documentation.
- Run evidence UI now uses normalized artifact fields for friendly evidence labels, linkage warnings, inline preview availability, and storage status.
- Spec Kit feature `002-laixi-gateway-live-proof` is blocked/future-only until Laixi VIP/API access enables a live session.
- Spec Kit feature `003-artifact-storage-thresholds` is completed and merged; it documents numeric artifact thresholds without adding object storage.
- **Phase 1-3 (Mobilerun integration) complete**: Swapped mobile-mcp-ai driver to Mobilerun AndroidDriver. Added `DEVICE_BACKEND=mobilerun` with `ai_task` step type via MobileAgent. Added iOS support via IOSDriver with platform-aware session manager and step compatibility guards.
- **Mobile MCP local readiness**: Local stack operational with device `97249fb5` (Redmi/onyx, Android 16). 12/12 preflight checks pass. Full verify blocked on Supabase DNS (`ENOTFOUND gzwwqhgvrfsqokrxfhyu.supabase.co`). Expected serial updated from `QC4DKJUO6PW4FMQW` to `97249fb5`.

## Known Risks
- All source files are below 200 lines after the complete file-size refactor.
- Main Vite chunk is 364 kB (110 kB gzip), below the 500 kB warning threshold.
- Mobile MCP V1 does not execute `run_autox`.
- Multi-target execution is sequential inside one worker claim.
- Full Mobile MCP verify / UI smoke blocked on Supabase DNS resolution from this machine.
- No remote git remote configured; 5 local commits not pushed anywhere.
- Inline artifact storage is acceptable for small pilot volume; object storage is deferred until higher screenshot volume, longer retention, or external sharing.
- Artifact storage thresholds are explicit: inline is acceptable at or below 512,000-byte preview payloads, 10 artifacts/run, 5 screenshots/run, 30-day retention, and authenticated-app-only viewing.
- Fresh Mobile MCP artifact-producing smoke is blocked until the expected Android device is visible to ADB and Mobile MCP runtime checks pass again.
- Manual run-detail inspection for normalized artifact evidence remains deferred until an authenticated UI session can access a suitable artifact-bearing run; prior smoke run `f2bc8499-5475-4c86-ae82-55ac0c17c274` is a candidate if it still exists and is accessible.
- Laixi clean-path proof cannot run without VIP/API access and a live Laixi-compatible device session.

## Unresolved Questions
- Laixi is future-compatible for now; pilot default remains Mobile MCP until Laixi VIP/API access enables a clean-path proof.
- What is the next Spec Kit feature after artifact threshold policy?
- Is `QC4DKJUO6PW4FMQW` still the active pilot Android device serial?
- Social pivot Phase 0-5 needs user validation — is "SocialBot Orchestrator" the right product name?
- Instagram/TikTok API vs pure UI automation for account actions?
- Encrypted password storage or OAuth tokens for social account credentials?
