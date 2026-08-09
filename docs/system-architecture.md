# System Architecture

Date: 2026-06-26

## Runtime Shape
Browser SPA talks to Supabase for auth/data and dispatches run control. Backend worker claims queued runs and executes steps through the selected device backend.

## Components
- Browser: React/Vite app.
- Data/Auth: Supabase Postgres, Auth, RLS.
- Worker: Node execution-worker service.
- Laixi Gateway: HTTP/WebSocket gateway for Laixi sessions.
- Mobile MCP Bridge: local Python bridge that wraps Mobilerun drivers for Android (ADB + Portal APK) and iOS (Portal app via iproxy).
- Mobilerun Backend: extension of the Mobile MCP backend with `ai_task` step support via MobileAgent (LLM-driven).
- Shared packages: execution contracts and lifecycle policy.

## Device Backends

Three backends are supported, selected via `DEVICE_BACKEND` env var:

| Backend | Worker class | Bridge driver | Steps |
|---------|-------------|---------------|-------|
| `laixi` | `LaixiStepBackend` | Laixi Gateway HTTP/WS | All basic steps + `run_autox` |
| `mobile-mcp` | `MobileMcpStepBackend` | Mobilerun AndroidDriver/IOSDriver | Basic steps (tap, swipe, screenshot, etc.) |
| `mobilerun` | `MobilerunStepBackend` | Same as mobile-mcp + MobileAgent | All basic steps + `ai_task` |

### Mobilerun Bridge Architecture

```
Worker (Node/TypeScript)
  └─ MobilerunStepBackend / MobileMcpStepBackend
       └─ HTTP POST /devices/{serial}/execute-step
            └─ Mobile MCP Bridge (Python)
                 ├─ DeviceSession (async event loop per device)
                 │    ├─ AndroidDriver(serial)  ← ADB + Portal APK
                 │    └─ IOSDriver(url)          ← Portal REST API via iproxy
                 ├─ _STEP_HANDLERS dispatch table
                 └─ MobileAgent (ai_task step, lazy-loaded)
```

### Browser Mobile MCP Control Plane

The browser does not connect directly to the Mobile MCP bridge. Fleet discovery and operator step probes use the execution-worker proxy:

- `GET /control/mobile-mcp/devices`
- `POST /control/mobile-mcp/devices/{serial}/execute-step`

The UI sends the Supabase session bearer token. The worker checks the token with Supabase, permits only `ADMIN` or `OPERATOR` profiles, and injects the server-side `MOBILE_MCP_BRIDGE_TOKEN` as `x-bridge-token` when forwarding to the bridge. The bridge token is never placed in `VITE_*` variables or browser requests. Worker responses are CORS-scoped to `WORKER_CORS_ORIGIN`; unauthorised requests return `401`/`403`, and a missing bridge token returns `503` without attempting an insecure fallback.

### Browser Laixi Gateway Control Plane

The worker exposes equivalent authenticated proxy routes for the Laixi gateway:

- `GET /control/gateway/sessions` → gateway `GET /sessions`
- `POST /control/gateway/dispatch-step` → gateway `POST /dispatch-step`

For both routes, the worker validates the Supabase bearer token and `ADMIN`/`OPERATOR` profile role, then adds the server-side `GATEWAY_HTTP_TOKEN` before forwarding over the private service network. The gateway token must not be included in browser `VITE_*` configuration. Frontend migration of existing Laixi setup/probe callers to these proxy routes remains pending; direct browser-to-gateway calls are therefore a transitional, trusted-local path only.

### Platform Support (Mobilerun drivers)

| Aspect | Android | iOS |
|--------|---------|-----|
| Driver | `AndroidDriver(serial)` via ADB | `IOSDriver(url)` Portal REST API |
| Portal setup | Optional via `MOBILE_MCP_ENSURE_PORTAL_ON_SESSION=true`; ADB-first by default | Manual: install iOS Portal + `iproxy` |
| Device ID | ADB serial (e.g. `RF8R81CXXXX`) | Portal URL (e.g. `http://127.0.0.1:6643`) |
| Supported buttons | back, home, enter | home only |
| `adb` step | ✅ ADB shell | ❌ Not supported |
| `get_current_app` | ✅ ADB dumpsys | ❌ Not supported |
| Device discovery | ADB device list | Portal port probe (6643-6653) |

## Run Path
1. Operator creates run in UI.
2. Run is queued in Supabase.
3. Operator start/cancel requests go through the `execute-run` Edge Function. It authenticates the Supabase bearer token, checks the caller profile role, and enforces run ownership (ADMIN may operate on any run).
4. Worker claims run with lease.
5. Worker resolves devices and steps.
6. Worker dispatches to selected device backend (Laixi / Mobile MCP / Mobilerun).
7. Worker writes run steps, artifacts, summary.
8. UI monitors run and artifacts through Supabase.

## Control-Plane Security

- `execute-run` is server-authoritative for start/cancel mutations. It uses the service role only after authenticating the caller with the Supabase anon client, then applies profile role and `triggered_by_user_id` ownership checks. The browser never receives the service-role key.
- Browser-facing Edge Functions use exact-origin CORS (`EXECUTE_RUN_ALLOWED_ORIGIN` and `CREDENTIAL_VAULT_ALLOWED_ORIGIN`); wildcard origins are not accepted.
- Credential vault decrypt calls are worker-only and require `CREDENTIAL_VAULT_WORKER_TOKEN`. Laixi dispatch and device enrollment require separate `GATEWAY_HTTP_TOKEN` and `GATEWAY_DEVICE_ENROLLMENT_TOKEN`; keep all of these values on private server/service networks.
- Insecure gateway/bridge bypass flags are explicit local-development escape hatches and must remain disabled for controlled proof and production deployment.

## Current Pilot Backend
Mobile MCP (default). Mobilerun backend extends it with LLM-driven `ai_task` support.

## Unresolved Questions
- Whether Laixi gateway remains optional or must be pilot-certified.
- Whether screenshots remain inline or move to object storage.
