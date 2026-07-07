# Codebase Summary

Date: 2026-07-07 (updated)

## Product
SocialBot Orchestrator orchestrates Android/iOS device automation workflows through Supabase, a backend worker, and device bridges (Mobile MCP with Mobilerun AndroidDriver/IOSDriver). Purpose-built for **social media automation teams** running 5-50 devices with anti-detection, account lifecycle tracking, and multi-app workflows (Instagram, TikTok, Facebook).

### Strategic Direction
Social media automation pivot — per `plans/brainstorm-report-social-first-roadmap.md`. Phase 0 (Foundation) and Phase 1 MVP are completed. See `docs/project-roadmap.md` → Social Pivot for full 6-phase plan.

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

## Current Verification Baseline
- `npm.cmd run test`: 24 files, 203 tests pass on 2026-07-07.
- `npm.cmd run typecheck`: pass on 2026-07-07.
- `npm.cmd run lint`: pass on 2026-07-07.
- `npm.cmd run build`: pass on 2026-07-07.
- `npm.cmd run build:worker`: pass on 2026-07-07.
- `npm.cmd run build:gateway`: pass on 2026-07-07.
- `npm.cmd run smoke:backend`: last documented pass on 2026-06-29 (6 scenarios pass, TypeError artifact storage warning resolved).
- GitHub Actions CI: `.github/workflows/ci.yml` — lint → typecheck → build → test on push/PR.
- Docker: full-stack compose (frontend + worker + gateway) with Dockerfiles.

## Current Product State
- Backend-owned run execution exists.
- Worker claim/lease path exists.
- **Phase 8: Parallel Execution** — Worker-per-device topology via Node.js `worker_threads`. Race condition fix (`accounts.current_action_count` → PostgreSQL RPC). Concurrent device execution with `MAX_CONCURRENT_DEVICES = 10`. Smoke test passes.
- **Phase 9: Laixi Clean-path Proof** — `LaixiGatewayClient` with `AbortController` timeout, 502/504 error handling. Mock Gateway Server (port 8080) for E2E smoke testing.
- **Phase 10: User Documentation** — Removed from runtime scope during use-case cleanup; operational guidance now lives in focused in-app setup panels and repo docs.
- MVP runtime scope is implemented for the current use-case set; docs/pricing/AI builder are intentionally out of runtime scope.
- **ESLint cleanup** — 17 type/lint errors resolved; 0 errors across the codebase.
- **CI pipeline** — GitHub Actions workflow (lint → typecheck → build → test).
- **Docker** — Multi-stage Dockerfiles for worker + gateway, 3-service docker-compose.yml.
- Mobile MCP real-device UI smoke passed on 2026-07-07 with device `97249fb5`.
- `OPS-08` is closed for Mobile MCP proof.
- Laixi gateway health proof is documented separately; clean-path proof is blocked by missing external Laixi VIP/API/session availability.
- Spec Kit feature `001-normalize-pilot-artifact` is implemented for artifact display normalization and storage-decision documentation.
- Spec Kit feature `002-laixi-gateway-live-proof` is blocked/future-only until Laixi VIP/API access enables a live session.
- Spec Kit feature `003-artifact-storage-thresholds` is completed and merged.
- **Mobile MCP local readiness**: Local stack operational with device `97249fb5` (Redmi/onyx, Android 16). Full `npm.cmd run verify:mobile-mcp` passed on 2026-07-07 with browser UI smoke run `ec7f6fab-81fc-4dfd-8ceb-8a98e1835fff`.
- Foreach loop execution integration in backend worker (`handleForeachLoop` in `single-device-step-runner.ts`) along with a critical bug fix resolving loop step repetition/skipping defects across all loop types.
- Extended unit testing suite with 100% line coverage for `anti-detection-helpers.ts` and `account-service-helpers.ts`.

## Known Risks
- All source files are below 200 lines after the complete file-size refactor.
- Main Vite chunk remains below the 500 kB warning threshold.
- Mobile MCP V1 does not execute `run_autox`.
- Full Mobile MCP verify / UI smoke passed on the connected Android device; keep `MOBILE_MCP_EXPECTED_SERIALS` aligned with the attached serial before rerunning.
- No remote git remote configured; 8 local commits not pushed anywhere.
- Inline artifact storage is acceptable for small pilot volume; object storage is deferred until higher screenshot volume, longer retention, or external sharing.
- Fresh Mobile MCP artifact-producing smoke requires the expected Android device to be visible to ADB.
- Laixi clean-path proof cannot run without VIP/API access and a live Laixi-compatible device session.

## Unresolved Questions
- Laixi is future-compatible for now; pilot default remains Mobile MCP until Laixi VIP/API access enables a clean-path proof.
- What is the next Spec Kit feature after artifact threshold policy?
- Should `MOBILE_MCP_EXPECTED_SERIALS` stay pinned to `97249fb5` for this workstation?
- Social pivot Phase 0-5 needs user validation — is "SocialBot Orchestrator" the right product name?
- Instagram/TikTok API vs pure UI automation for account actions?
- Encrypted password storage or OAuth tokens for social account credentials?
