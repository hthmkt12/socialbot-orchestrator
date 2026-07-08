# Backend Capability Matrix

Date: 2026-07-08

Purpose: make pilot backend support explicit before adding more workflows.

## Backend Selection

Three backends available, configured via `DEVICE_BACKEND` env var on the worker:

| Env value | Worker class | Use case |
|-----------|-------------|----------|
| `laixi` | `LaixiStepBackend` | Laixi Gateway sessions |
| `mobile-mcp` | `MobileMcpStepBackend` | Mobilerun AndroidDriver/IOSDriver (basic steps) |
| `mobilerun` | `MobilerunStepBackend` | Same + `ai_task` LLM-driven steps |

## Pilot Default

Mobile MCP is the current pilot validation backend. Current Level 1 proof is Android serial `97249fb5`, first social pilot run `a414e519-c1ac-44df-b287-e91e845f0084`, screenshot artifact `c741ceb8-0cba-4096-ad02-b107878f4dbd`, and readiness report `76e0141b-2e23-475c-97ea-d4214d50d3d3` marked `pilot_verified`.

Level 1 readiness evidence must include a valid `verified_at` timestamp and remains fresh for 14 days. Rerun verification before claiming readiness if evidence expires or if the pilot device, runtime backend, bridge auth mode, Supabase project, or proof workflow changes.

## Security Defaults

- The Mobile MCP bridge requires `MOBILE_MCP_BRIDGE_TOKEN` for protected endpoints.
- `MOBILE_MCP_ALLOW_INSECURE_DEV=true` is an isolated local-development escape hatch only.
- Android sessions are ADB-first by default. Set `MOBILE_MCP_ENSURE_PORTAL_ON_SESSION=true` only when Portal-dependent actions are required and USB install policy allows Portal setup.
- Social account passwords require `VITE_ACCOUNT_PASSWORD_KEY` before browser-side pilot encryption can save credentials. Treat this as pilot-only; move encryption server-side before production credential storage.

## Capability Matrix

| Capability | Mobile MCP (Android) | Mobile MCP (iOS) | Mobilerun (Android) | Mobilerun (iOS) | Laixi Gateway | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| Device identity | ADB serial | Portal URL | ADB serial | Portal URL | Laixi device id/session | iOS Portal URL stored in `devices.laixi_device_id`. |
| `launch_app` | Supported | Supported | Supported | Supported | Supported | iOS uses bundle ID. |
| `input_text` | Supported | Supported | Supported | Supported | Backend-dependent | |
| `tap` | Supported | Supported | Supported | Supported | Supported | Same macro step type, different dispatch backend. |
| `swipe` | Supported | Supported | Supported | Supported | Supported | Same macro step type, different dispatch backend. |
| `screenshot` | Supported | Supported | Supported | Supported | Supported | Current artifacts are persisted as artifact rows with inline metadata/previews. |
| `get_current_app` | Supported | ❌ Not supported | Supported | ❌ Not supported | Supported | iOS lacks ADB dumpsys. |
| `adb` | Supported | ❌ Not supported | Supported | ❌ Not supported | Supported with approval flow | iOS has no ADB. |
| `press_button` | back/home/enter | home only | back/home/enter | home only | Backend-specific | Validated via `driver.supported_buttons`. |
| `get_ui_tree` | Supported | Supported | Supported | Supported | Not supported | Accessibility tree via Portal. |
| `ai_task` | N/A | N/A | Supported | Supported | N/A | LLM-driven goal via MobileAgent. |
| `wait` | Worker-local | Worker-local | Worker-local | Worker-local | Worker-local | No device dispatch required. |
| `run_autox` | Not supported | Not supported | Not supported | Not supported | Backend-specific | Do not promise execution for AutoX scripts. |
| Approval resume | Supported | Supported | Supported | Supported | Supported | Backend dispatch occurs after approval. |
| Multi-target run | Supported sequentially | Supported sequentially | Supported sequentially | Supported sequentially | Supported sequentially | One worker claim executes targets sequentially. |
| Device health | ADB/bridge status + expected serials | Portal date probe | ADB/bridge status + expected serials | Portal date probe | Gateway heartbeat/session checks | Use backend-specific diagnostics. |
| Device discovery | ADB device list | Portal port scan (6643-6653) | ADB device list | Portal port scan (6643-6653) | Gateway sessions endpoint | |

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

For Mobilerun backend: set `DEVICE_BACKEND=mobilerun` and verify `/health` shows `deviceBackend: "mobilerun"`.

For Laixi compatibility checks, use `npm.cmd run dev:gateway`, then verify `GET /health` and `GET /sessions`. Do not claim Laixi pilot readiness unless `/sessions` shows a live device and the worker health confirms `deviceBackend: "laixi"` before a completed backend run.

For Mobile MCP bridge auth checks, verify `/health` reports `authRequired: true` when `MOBILE_MCP_BRIDGE_TOKEN` is set, and verify protected endpoints reject missing/invalid `x-bridge-token`.

## Unresolved Questions

- What real pilot telemetry should revise the current artifact thresholds?
- What target fleet size makes sequential multi-target execution unacceptable?
- When will Laixi VIP/API access be available for clean-path proof?
