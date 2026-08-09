---
title: "Phase 02B — Application authorization and secure control plane"
status: completed
---

# Phase 02B — Application authorization and secure control plane

## Context links

Parent: [plan.md](./plan.md); approved design [brainstorm](../reports/260725-2011-project-state-brainstorm.md). Existing gateway/vault controls: [Phase 02](./phase-02-gateway-vault-boundaries.md).

## Overview

Date: 2026-07-25. Description: close the service-role authorization gap and remove browser access to backend bridge/gateway secrets. Priority: P0. Implementation status: authorization and authenticated Mobile MCP/gateway worker proxies completed; focused review and regression verification passed.

## Key Insights

- `execute-run` uses service-role mutation without caller authorization: `supabase/functions/execute-run/index.ts:118-135`.
- Run ownership field/policies exist in `supabase/migrations/20260309165537_workflow_tables.sql:135-179`.
- Mobile MCP protected endpoints require `X-Bridge-Token`: `services/mobile-mcp-bridge/src/bridge_server.py:71-105`.
- Browser fleet calls omit the token and silently fallback: `src/lib/mobile-mcp-orchestrator.ts:58-119`, `src/hooks/useDevices.ts:53-96`.

## Requirements

- Verify bearer identity and profile role before service-role operations.
- Enforce owner/operator/admin policy; deny viewer, unknown run, and cross-tenant access.
- Add 401/403/404 and no-side-effect tests for start/cancel.
- Add same-origin backend proxy for bridge/gateway operations; inject server-only tokens.
- Remove silent auth-error fallback; preserve explicit local-only development mode.
- Allowlist bridge/gateway URLs; never add backend tokens to `VITE_*`.

## Architecture

Browser → authenticated Supabase/Edge proxy → server-only bridge/gateway token → Mobile MCP/Gateway. `execute-run` performs user-scoped authorization before narrowly-scoped privileged mutation.

## Related code files

`supabase/functions/execute-run/index.ts:118-135`; `supabase/migrations/20260309165537_workflow_tables.sql:135-179`; `src/hooks/useDevices.ts:53-120`; `src/lib/mobile-mcp-orchestrator.ts:46-119`; `src/lib/device-setup-probes.ts:12-36`; `src/components/device-setup/device-setup-verification-probe-helpers.ts:17-40`.

## Implementation Steps

1. Characterize current start/cancel and browser bridge behavior.
2. Define role/ownership matrix and safe error contract.
3. Implement auth/ownership guard and tests.
4. Implement proxy/token injection and tests. (Mobile MCP and gateway routes plus browser migration complete.)
5. Re-run boundary tests and inspect bundle/logs for token leakage.

## Todo list

- [x] Authorization characterization tests
- [x] Role/ownership guard
- [x] Cross-tenant/no-side-effect tests
- [x] Mobile MCP bridge proxy contract
- [x] Token non-disclosure contract checks
- [x] Fresh security review (focused)
- [x] Laixi/gateway worker proxy contract
- [x] Migrate setup/readiness browser callers to gateway proxy

## Success Criteria

Unauthorized run mutations fail closed; authorized owner/operator/admin paths pass; Mobile MCP and gateway browser control use authenticated worker proxies.

## Risk Assessment

Changing run-control auth can break viewer/operator UX; preserve explicit role semantics and test existing start/cancel replay behavior.

## Security Considerations

Never trust UI role gates. Do not log bearer/bridge/enrollment tokens. Keep service-role and bridge tokens server-side.

## Next steps

Pass the final auth/proxy contract to Phase 03 CI and deployment tests after proxy completion.
