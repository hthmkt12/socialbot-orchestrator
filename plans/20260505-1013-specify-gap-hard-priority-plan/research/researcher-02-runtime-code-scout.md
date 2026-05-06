# Researcher 02: Runtime Code Scout

Date: 2026-05-05
Scope: read-only implementation/runtime state

## Architecture Found
- React/Vite SPA under `src/`.
- Supabase auth/data hooks under `src/lib/` and `src/hooks/`.
- Backend control path exists through worker, gateway, Mobile MCP bridge, shared packages.
- Execution worker lives in `services/execution-worker/`.
- Laixi gateway lives in `services/laixi-gateway/`.
- Mobile MCP bridge lives in `services/mobile-mcp-bridge/`.
- Shared execution contracts live in `packages/shared/`.
- Supabase schema migrations live in `supabase/migrations/`.

## Current Verification
- `npm.cmd run typecheck`: pass.
- `npm.cmd run lint`: pass.
- `npm.cmd run build`: pass, with Vite chunk warning `756.50 kB`.
- `npm.cmd run build:worker`: pass.
- `npm.cmd run build:gateway`: pass.
- `npm.cmd run smoke:backend`: pass 3 scenarios.
- `npm.cmd run runtime:mobile-mcp:check`: pass. ADB has `QC4DKJUO6PW4FMQW`; bridge, worker, UI healthy.
- `npm.cmd run status:mobile-mcp`: healthy runtime and points to previous full verify report.
- `npm.cmd run preflight:mobile-mcp`: fail now.

## Current Preflight Failure
- `auth.operatorLogin`: `UI_SMOKE_EMAIL/UI_SMOKE_PASSWORD` missing.
- `db.macro`: missing.
- `db.devices`: `0/1 matched`.
- ADB, bridge, worker, UI, service-role env all passed in this shell.

## Code Shape Risks
- `src/pages/DeviceSetupPage.tsx`: 1225 lines.
- `src/components/runs/RunWizard.tsx`: 746 lines.
- `src/pages/DemoPage.tsx`: 564 lines.
- `src/pages/RunMonitorPage.tsx`: 525 lines.
- `src/pages/DevicesPage.tsx`: 507 lines.
- Multiple files exceed the 200-line guidance from user instructions. This is not a compile blocker but is a maintenance risk.

## Unresolved Questions
- Should current DB be repaired by seeding macro and syncing ADB device now, or only after user approves implementation?
- Should full UI smoke credentials be loaded from Windows User env, shell env, or setup script?
- Is the Vite chunk warning acceptable for pilot, or must code-splitting be planned now?
