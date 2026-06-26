# Codebase Summary

Date: 2026-05-06

## Product
Laixi Orchestration Platform controls Android automation workflows through Supabase, a backend worker, and device bridges.

## Main Areas
- `src/`: React/Vite SPA.
- `src/pages/`: app routes for devices, setup, runs, approvals, audit, demo, Mobile MCP orchestrator.
- `src/hooks/`: Supabase React Query hooks.
- `src/lib/`: Supabase client, run control fallback, role access, preflight, device setup helpers, run artifact normalization.
- `src/contracts/`: macro JSON contracts, samples, Social Macro DSL.
- `services/execution-worker/`: backend run claim, lease, execution, Mobile MCP/Laixi dispatch, smoke tests.
- `services/laixi-gateway/`: Laixi device session manager and HTTP dispatch service.
- `services/mobile-mcp-bridge/`: local Python Android bridge.
- `packages/shared/`: shared execution contracts and lifecycle helpers.
- `supabase/migrations/`: database schema and seed functions.
- `plans/`: hard plans, status reports, runtime evidence.
- `.specify/`: Spec Kit bootstrap templates.
- `docs/`: project summary, roadmap, changelog, standards, and operational notes.

## Current Verification Baseline
- `npm.cmd run typecheck`: pass on 2026-05-05.
- `npm.cmd run lint`: pass on 2026-05-05.
- `npm.cmd run build`: pass on 2026-05-05; route lazy-loading later removed the main-chunk warning per changelog.
- `npm.cmd run build:worker`: pass on 2026-05-05.
- `npm.cmd run build:gateway`: pass on 2026-05-05.
- `npm.cmd run smoke:backend`: pass on 2026-05-05.
- `npm.cmd run verify:mobile-mcp`: pass on 2026-05-05 with `QC4DKJUO6PW4FMQW`.
- `npm.cmd test`: pass on 2026-05-06 after `001-normalize-pilot-artifact`.
- `npm.cmd run typecheck`: pass on 2026-05-06 after `001-normalize-pilot-artifact`.
- `npm.cmd run lint`: pass on 2026-05-06 after `001-normalize-pilot-artifact`.
- `npm.cmd run build`: pass on 2026-05-06 after `001-normalize-pilot-artifact`.
- `npm.cmd test`: pass on 2026-05-06 during Mobile MCP pilot-readiness review.
- `npm.cmd run typecheck`: pass on 2026-05-06 during Mobile MCP pilot-readiness review.
- `npm.cmd run lint`: pass on 2026-05-06 during Mobile MCP pilot-readiness review.
- `npm.cmd run build`: pass on 2026-05-06 during Mobile MCP pilot-readiness review.
- `npm.cmd run build:worker`: pass on 2026-05-06 during Mobile MCP pilot-readiness review.
- `npm.cmd run build:gateway`: pass on 2026-05-06 during Mobile MCP pilot-readiness review.
- `npm.cmd run smoke:backend`: pass on 2026-05-06 during Mobile MCP pilot-readiness review.
- Evidence summary: `plans/260506-mobile-mcp-pilot-readiness-smoke/reports/verification-summary.md`.

## Current Product State
- Backend-owned run execution exists.
- Worker claim/lease path exists.
- Mobile MCP real-device UI smoke passed.
- `OPS-08` is closed for Mobile MCP proof.
- Laixi gateway health proof is documented separately; clean-path proof is blocked by missing external Laixi VIP/API/session availability.
- Spec Kit feature `001-normalize-pilot-artifact` is implemented for artifact display normalization and storage-decision documentation.
- Run evidence UI now uses normalized artifact fields for friendly evidence labels, linkage warnings, inline preview availability, and storage status.
- Spec Kit feature `002-laixi-gateway-live-proof` is blocked/future-only until Laixi VIP/API access enables a live session.
- Spec Kit feature `003-artifact-storage-thresholds` is completed and merged; it documents numeric artifact thresholds without adding object storage.
- Mobile MCP current local readiness is blocked on 2026-05-06 because ADB/Windows does not see expected serial `QC4DKJUO6PW4FMQW`; see `plans/reports/mobile-mcp-status-2026-05-06T10-58-12-223Z.json` and `plans/reports/mobile-mcp-wait-devices-2026-05-06T10-58-27-212Z.json`.

## Known Risks
- Several UI files exceed 200 lines and should be modularized only after runtime proof is stable.
- Main Vite chunk is below the 500 kB warning threshold after authenticated route lazy-loading.
- Mobile MCP V1 does not execute `run_autox`.
- Multi-target execution is sequential inside one worker claim.
- Inline artifact storage is acceptable for small pilot volume; object storage is deferred until higher screenshot volume, longer retention, or external sharing.
- Artifact storage thresholds are explicit: inline is acceptable at or below 512,000-byte preview payloads, 10 artifacts/run, 5 screenshots/run, 30-day retention, and authenticated-app-only viewing.
- Fresh Mobile MCP artifact-producing smoke is blocked until the expected Android device is visible to ADB and Mobile MCP runtime checks pass again.
- Manual run-detail inspection for normalized artifact evidence remains deferred until an authenticated UI session can access a suitable artifact-bearing run; prior smoke run `f2bc8499-5475-4c86-ae82-55ac0c17c274` is a candidate if it still exists and is accessible.
- Laixi clean-path proof cannot run without VIP/API access and a live Laixi-compatible device session.

## Unresolved Questions
- Laixi is future-compatible for now; pilot default remains Mobile MCP until Laixi VIP/API access enables a clean-path proof.
- What is the next Spec Kit feature after artifact threshold policy?
- Is `QC4DKJUO6PW4FMQW` still the active pilot Android device serial?
