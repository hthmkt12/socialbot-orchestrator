# Backend Capability Matrix

Date: 2026-05-05

Purpose: make pilot backend support explicit before adding more workflows.

## Pilot Default

Mobile MCP is the current pilot validation backend.

Laixi remains supported architecture and future-compatible, but Laixi-specific clean-path proof is blocked until Laixi VIP/API access and a live Laixi device session are available.

Current Laixi evidence: local gateway health is OK on `http://127.0.0.1:8080/health`, but `/sessions` returns no devices. This is an external availability blocker, not a code failure.

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

Inline artifact rows remain acceptable when all conditions are true:
- Single inline preview payload is at or below 512,000 bytes.
- A normal run produces 10 or fewer artifacts total.
- A normal run produces 5 or fewer screenshots.
- Artifact retention is 30 days or less.
- Artifacts are viewed only inside authenticated app run-detail pages.

Object storage becomes required before scaling when any condition is true:
- Full-fidelity retrieval is needed for an artifact above 512,000 bytes.
- A normal run is expected to produce more than 10 artifacts or more than 5 screenshots.
- Artifact retention must exceed 30 days.
- Artifacts need external links, exports, customer sharing, or audit packages.
- Database row size, query performance, or Supabase billing shows artifact payloads are becoming operationally visible.

The 512,000-byte limit is a UI inline-preview ceiling, not a full storage migration trigger by itself. Oversized inline preview omission can remain acceptable if metadata is readable and full-fidelity retrieval is not required.

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

For Laixi compatibility checks, use `npm.cmd run dev:gateway`, then verify `GET /health` and `GET /sessions`. Do not claim Laixi pilot readiness unless `/sessions` shows a live device and the worker health confirms `deviceBackend: "laixi"` before a completed backend run.

## Unresolved Questions

- What real pilot telemetry should revise the current artifact thresholds?
- What target fleet size makes sequential multi-target execution unacceptable?
- When will Laixi VIP/API access be available for clean-path proof?
