# Phase 02: Close OPS-08 Live Validation Gate

## Context Links
- Parent plan: `./plan.md`
- Old blocker file: `plans/20260504-1000-cto-hard-plan-laixi-platform/ops-08-live-onboarding-validation-status.md`

## Overview
- Date: 2026-05-05
- Priority: P1
- Implementation status: completed
- Review status: evidence captured
- Purpose: close or keep OPS-08 blocked with current evidence.

## Key Insights
- Mobile MCP is accepted as the pilot backend proof for OPS-08.
- Laixi gateway remains separate, not covered by this closure.

## Requirements
- Decide validation backend: Laixi, Mobile MCP, or both.
- Capture one clean onboarding path.
- Capture one real failure path.
- Update OPS-08 status and backlog truth.

## Architecture
- Clean path: UI -> Supabase run -> worker -> backend bridge/gateway -> Android device -> artifacts.
- Failure path: same path, but controlled stale/disconnect/permission failure and UI diagnostics.

## Related Code Files
- `src/pages/DeviceSetupPage.tsx`
- `src/pages/RunMonitorPage.tsx`
- `services/execution-worker/src/`
- `services/laixi-gateway/src/`
- `services/mobile-mcp-bridge/src/`
- `plans/20260504-1000-cto-hard-plan-laixi-platform/ops-08-live-onboarding-validation-status.md`

## Implementation Steps
1. Choose backend proof target.
2. Run clean path command:
   - Mobile MCP: `npm.cmd run verify:mobile-mcp`
   - Laixi: start gateway/worker with service-role env, connect Laixi device, run Device Setup verification.
3. Capture report JSON, screenshots, run id, artifact evidence.
4. Run one failure path: stale heartbeat, disconnected device, current-app failure, or screenshot denial.
5. Confirm UI surfaces diagnostic and recovery action.
6. Update OPS-08 status and implementation backlog.

## Todo List
- [x] Backend proof target decided.
- [x] Clean path run captured.
- [x] Failure path run captured.
- [x] OPS-08 status updated.
- [x] Backlog updated.

## Success Criteria
- Clean path has run id, completed status, device serial, step count, screenshot artifact.
- Failure path has visible operator diagnostic and recovery guidance.
- OPS-08 moves to completed only if evidence matches selected backend requirement.

## Risk Assessment
- If Laixi is mandatory, Mobile MCP proof cannot close OPS-08.
- Real failure path may require manual device/network action.

## Security Considerations
- No secrets in reports.
- Failure path must not damage device state.

## Next Steps
- After OPS-08, update README/plan to remove stale wording.

## Completion Evidence
- Closure report: `./reports/ops-08-mobile-mcp-closure-report.md`
- Clean path: `plans/reports/mobile-mcp-verify-2026-05-05T03-20-50-382Z.json`
- UI DB evidence: `plans/reports/ui-mobile-mcp-smoke-db-2026-05-05T03-20-54-496Z.json`
- Failure path: `plans/reports/mobile-mcp-wait-devices-2026-05-05T03-22-05-453Z.json`
