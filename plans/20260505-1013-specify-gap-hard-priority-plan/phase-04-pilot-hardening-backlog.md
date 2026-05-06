# Phase 04: Pilot Hardening Backlog

## Context Links
- Parent plan: `./plan.md`
- Gap report: `./reports/current-state-gap-report.md`

## Overview
- Date: 2026-05-05
- Priority: P2
- Implementation status: completed
- Review status: static checks passed
- Purpose: reduce pilot risks after live proof is stable.

## Key Insights
- Static checks pass, but several files are too large for maintainable iteration.
- Authenticated page routes are lazy-loaded; main Vite chunk is now below the 500 kB warning threshold.
- Mobile MCP V1 does not support `run_autox`.
- Multi-target execution is sequential inside one worker claim.
- Artifact storage stays inline for small pilot volume; Supabase Storage is required before higher screenshot volume, long retention, or external sharing.
- Sequential multi-target execution is acceptable for small pilot validation; parallelism is a later feature if fleet-speed SLA appears.

## Requirements
- Do not refactor before runtime truth is stable.
- Modularize only around existing boundaries.
- Keep pilot scope small.

## Architecture
- UI decomposition: page -> panels -> hooks -> shared helpers.
- Runtime decomposition: backend-specific capabilities must be explicit.
- Evidence storage: inline now vs Supabase Storage before pilot.

## Related Code Files
- `src/pages/DeviceSetupPage.tsx`
- `src/components/runs/RunWizard.tsx`
- `src/pages/DemoPage.tsx`
- `src/pages/RunMonitorPage.tsx`
- `src/pages/DevicesPage.tsx`
- `services/execution-worker/src/single-device-step-runner.ts`
- `vite.config.ts`

## Implementation Steps
1. Split `DeviceSetupPage` into focused panels and hooks.
2. Split `RunWizard` by target selection, preflight, macro inputs, submit flow.
3. Add lazy route/code splitting for heavy pages if bundle warning remains.
4. Document backend capability matrix: Laixi vs Mobile MCP.
5. Decide artifact storage path before larger screenshot volume.
6. Decide if sequential multi-target is acceptable for pilot.

## Todo List
- [x] File-size refactor plan.
- [x] Bundle split plan.
- [x] Backend capability matrix.
- [x] Artifact storage decision.
- [x] Multi-target execution decision.

## Success Criteria
- Large files reduced without behavior change.
- Build/typecheck/lint still pass.
- Pilot operators understand supported backend capabilities.

## Risk Assessment
- Refactor can destabilize working UI if done before OPS-08.
- Code splitting can hide runtime route bugs unless browser smoke is run.

## Security Considerations
- Keep role gating tests around split surfaces.
- Artifact storage must preserve access control.

## Next Steps
- Turn `DeviceSetupPage` refactor into a formal implementation plan if large-file cleanup is selected next.
