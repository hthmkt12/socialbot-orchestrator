# Backend Capability Matrix

Date: 2026-05-05

Purpose: make pilot backend support explicit before adding more workflows.

## Pilot Default

Mobile MCP is the current pilot validation backend.

Laixi remains supported architecture, but Laixi-specific live proof is separate from the Mobile MCP OPS-08 closure.

## Capability Matrix

| Capability | Mobile MCP | Laixi Gateway | Notes |
| --- | --- | --- | --- |
| Device identity | ADB serial via `devices.laixi_device_id` | Laixi device id/session | Mobile MCP maps serials into existing device rows. |
| `launch_app` | Supported | Supported | Verified through Mobile MCP smoke paths. |
| `input_text` | Supported | Backend-dependent | Mobile MCP has explicit support. |
| `tap` | Supported | Supported | Same macro step type, different dispatch backend. |
| `swipe` | Supported | Supported | Same macro step type, different dispatch backend. |
| `screenshot` | Supported | Supported | Current artifacts are persisted as artifact rows with inline metadata/previews. |
| `get_current_app` | Supported | Supported | Used by demo and smoke checks. |
| `adb` | Supported with approval flow | Supported with approval flow | Keep approval gates before backend dispatch. |
| `wait` | Worker-local | Worker-local | No device dispatch required. |
| `run_autox` | Not supported in V1 | Backend-specific | Do not promise Mobile MCP execution for AutoX scripts. |
| Approval resume | Supported in worker | Supported in worker | Backend dispatch occurs after approval. |
| Multi-target run | Supported sequentially | Supported sequentially | One worker claim executes targets sequentially. |
| Device health | ADB/bridge status and expected serial checks | Gateway heartbeat/session checks | Use backend-specific diagnostics. |

## Artifact Decision

Current pilot decision: keep screenshot, text-log, and JSON result previews in `artifacts` rows with inline metadata/previews.

This inline artifact-row path is the default for small pilot validation runs and is not a blocker for current Mobile MCP proof.

Object storage, such as Supabase Storage, is deferred until the product needs higher screenshot volume, longer retention, or external artifact sharing.

## Multi-Target Decision

Current pilot decision: sequential multi-target execution is acceptable for small pilot validation.

Parallel execution should become a new feature only if pilot needs fleet-speed guarantees or strict per-device runtime SLA.

## Operator Verification

Use these checks before claiming pilot readiness:

- `npm.cmd run status:mobile-mcp`
- `npm.cmd run preflight:mobile-mcp`
- `npm.cmd run verify:mobile-mcp`
- `npm.cmd run smoke:mobile-mcp:db-queue`
- `npm.cmd run smoke:mobile-mcp:ui`

## Unresolved Questions

- What screenshot volume or retention target requires Supabase Storage?
- What target fleet size makes sequential multi-target execution unacceptable?
