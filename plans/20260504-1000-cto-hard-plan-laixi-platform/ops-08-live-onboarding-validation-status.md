# OPS-08: Live Onboarding Validation Status

Status: completed
Date: 2026-05-05
Accepted backend: Mobile MCP
Purpose: close live onboarding validation for the accepted pilot device path.

## Decision
- Mobile MCP proof is accepted for OPS-08.
- Laixi gateway proof is not part of this closure.
- If Laixi becomes the pilot backend, create a separate Laixi live-validation task.

## Clean Path Verified
- Command: `npm.cmd run verify:mobile-mcp`
- Required runtime override:
  - `UI_SMOKE_EMAIL=codex-ui-operator@example.invalid`
  - `MOBILE_MCP_EXPECTED_SERIALS=QC4DKJUO6PW4FMQW`
- Full verify report:
  - `plans/reports/mobile-mcp-verify-2026-05-05T03-20-50-382Z.json`
- UI smoke DB evidence:
  - `plans/reports/ui-mobile-mcp-smoke-db-2026-05-05T03-20-54-496Z.json`
- Result:
  - run id `7cbf4efd-4d1d-46b3-8681-08f802149a29`
  - status `COMPLETED`
  - device serial `QC4DKJUO6PW4FMQW`
  - device model `23106RN0DA`
  - 4 steps
  - 1 screenshot artifact
  - current app `com.android.settings/.MiuiSettings`

## Failure Path Verified
- Command: `npm.cmd run wait:mobile-mcp:devices -- --timeout-ms 3000 --interval-ms 1000 --doctor-on-fail`
- Runtime override:
  - `MOBILE_MCP_EXPECTED_SERIALS=QC4DKJUO6PW4FMQW,OPS08_MISSING_SERIAL`
- Failure report:
  - `plans/reports/mobile-mcp-wait-devices-2026-05-05T03-22-05-453Z.json`
- Result:
  - expected serial `OPS08_MISSING_SERIAL` missing from both ADB and bridge
  - real device `QC4DKJUO6PW4FMQW` remained online
  - ADB doctor ran and reported ADB online
  - recovery recommendation: replug cable, unlock phone, enable USB debugging, retry wait

## Repaired Before Closure
- `ensure:mobile-mcp:operator` confirmed smoke operator login.
- `sync:mobile-mcp:devices` upserted 1 online device.
- Windows User env now persists:
  - `UI_SMOKE_EMAIL=codex-ui-operator@example.invalid`
  - `MOBILE_MCP_EXPECTED_SERIALS=QC4DKJUO6PW4FMQW`
- `preflight:mobile-mcp` passed after repair:
  - `plans/reports/mobile-mcp-preflight-2026-05-05T03-20-23-986Z.json`
  - `plans/reports/mobile-mcp-preflight-2026-05-05T03-20-53-107Z.json`
  - `plans/reports/mobile-mcp-preflight-2026-05-05T03-30-08-267Z.json`

## Honest Result
- OPS-08 is closed for Mobile MCP pilot validation.
- Current clean-device path and expected-missing-device failure path are reproducible.
- Laixi gateway remains unproven in this closure.

## Unresolved Questions
- Is Laixi gateway still required for pilot, or only future backend compatibility?
