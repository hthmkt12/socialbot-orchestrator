# Phase 01: Restore Current Preflight Baseline

## Context Links
- Parent plan: `./plan.md`
- Gap report: `./reports/current-state-gap-report.md`
- Latest failing report: `plans/reports/mobile-mcp-preflight-2026-05-05T03-12-37-430Z.json`

## Overview
- Date: 2026-05-05
- Priority: P0
- Implementation status: completed
- Review status: evidence captured
- Purpose: make current verification reproducible before any pilot claim.

## Key Insights
- Runtime is healthy: ADB, bridge, worker, UI.
- Preflight fails only at operator login env, DB macro, DB device mapping.
- Previous full verify pass is stale unless it can be rerun now.

## Requirements
- Do not read or print secret values.
- Load or set UI smoke credentials through approved local env path.
- Seed or restore required smoke macro.
- Sync ADB device to DB with explicit operator approval if mutation needed.
- Re-run preflight and store report.

## Architecture
- Shell env -> scripts -> Supabase project -> device/macro rows -> UI smoke.

## Related Code Files
- `scripts/preflight-mobile-mcp-local.mjs`
- `scripts/ensure-mobile-mcp-operator.mjs`
- `scripts/sync-mobile-mcp-adb-devices.mjs`
- `scripts/verify-mobile-mcp-local.mjs`

## Implementation Steps
1. Confirm current shell env without printing secrets.
2. Run `npm.cmd run runtime:mobile-mcp:check`.
3. Run `npm.cmd run ensure:mobile-mcp:operator -- --dry-run`.
4. Run `npm.cmd run sync:mobile-mcp:devices -- --dry-run`.
5. If dry-runs prove only missing DB rows, run approved non-dry-run repair.
6. Run `npm.cmd run preflight:mobile-mcp`.
7. Attach report path and summarize pass/fail.

## Todo List
- [x] Confirm UI smoke credentials source.
- [x] Confirm macro seed source.
- [x] Confirm DB device sync is allowed.
- [x] Re-run preflight.
- [x] Update current-state report.

## Success Criteria
- `npm.cmd run preflight:mobile-mcp` exits 0.
- Report shows operator login, macro, and devices all pass.

## Risk Assessment
- Wrong Supabase project can make old report and current preflight disagree.
- Non-dry-run sync mutates DB.

## Security Considerations
- Do not expose Supabase keys or smoke password.
- Do not commit `.env`.

## Next Steps
- Move to Phase 02 only after current preflight is reproducible.

## Completion Evidence
- `plans/reports/mobile-mcp-operator-2026-05-05T03-20-17-876Z.json`
- `plans/reports/mobile-mcp-adb-sync-2026-05-05T03-20-17-950Z.json`
- `plans/reports/mobile-mcp-preflight-2026-05-05T03-20-23-986Z.json`
- `plans/reports/mobile-mcp-preflight-2026-05-05T03-20-53-107Z.json`
