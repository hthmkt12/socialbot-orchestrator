# Codebase Summary

Date: 2026-05-05

## Product
Laixi Orchestration Platform controls Android automation workflows through Supabase, a backend worker, and device bridges.

## Main Areas
- `src/`: React/Vite SPA.
- `src/pages/`: app routes for devices, setup, runs, approvals, audit, demo, Mobile MCP orchestrator.
- `src/hooks/`: Supabase React Query hooks.
- `src/lib/`: Supabase client, run control fallback, role access, preflight, device setup helpers.
- `src/contracts/`: macro JSON contracts, samples, Social Macro DSL.
- `services/execution-worker/`: backend run claim, lease, execution, Mobile MCP/Laixi dispatch, smoke tests.
- `services/laixi-gateway/`: Laixi device session manager and HTTP dispatch service.
- `services/mobile-mcp-bridge/`: local Python Android bridge.
- `packages/shared/`: shared execution contracts and lifecycle helpers.
- `supabase/migrations/`: database schema and seed functions.
- `plans/`: hard plans, status reports, runtime evidence.

## Current Verification Baseline
- `npm.cmd run typecheck`: pass on 2026-05-05.
- `npm.cmd run lint`: pass on 2026-05-05.
- `npm.cmd run build`: pass on 2026-05-05, with Vite large chunk warning.
- `npm.cmd run build:worker`: pass on 2026-05-05.
- `npm.cmd run build:gateway`: pass on 2026-05-05.
- `npm.cmd run smoke:backend`: pass on 2026-05-05.
- `npm.cmd run verify:mobile-mcp`: pass on 2026-05-05 with `QC4DKJUO6PW4FMQW`.

## Current Product State
- Backend-owned run execution exists.
- Worker claim/lease path exists.
- Mobile MCP real-device UI smoke passed.
- `OPS-08` is closed for Mobile MCP proof.
- Laixi gateway live proof remains separate.

## Known Risks
- Several UI files exceed 200 lines and should be modularized only after runtime proof is stable.
- Main Vite bundle is above 500 kB after minification.
- Mobile MCP V1 does not execute `run_autox`.
- Multi-target execution is sequential inside one worker claim.
- Artifact storage strategy is still open.

## Unresolved Questions
- Is Laixi gateway needed for pilot, or only future backend compatibility?
- Should screenshots move to Supabase Storage before larger runs?
- Should Spec Kit feature specs become the primary planning source going forward?
