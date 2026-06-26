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

### Platform Support (Mobilerun drivers)

| Aspect | Android | iOS |
|--------|---------|-----|
| Driver | `AndroidDriver(serial)` via ADB | `IOSDriver(url)` Portal REST API |
| Portal setup | Auto via `ensure_portal_ready()` | Manual: install iOS Portal + `iproxy` |
| Device ID | ADB serial (e.g. `RF8R81CXXXX`) | Portal URL (e.g. `http://127.0.0.1:6643`) |
| Supported buttons | back, home, enter | home only |
| `adb` step | ✅ ADB shell | ❌ Not supported |
| `get_current_app` | ✅ ADB dumpsys | ❌ Not supported |
| Device discovery | ADB device list | Portal port probe (6643-6653) |

## Run Path
1. Operator creates run in UI.
2. Run is queued in Supabase.
3. Worker claims run with lease.
4. Worker resolves devices and steps.
5. Worker dispatches to selected device backend (Laixi / Mobile MCP / Mobilerun).
6. Worker writes run steps, artifacts, summary.
7. UI monitors run and artifacts through Supabase.

## Current Pilot Backend
Mobile MCP (default). Mobilerun backend extends it with LLM-driven `ai_task` support.

## Unresolved Questions
- Whether Laixi gateway remains optional or must be pilot-certified.
- Whether screenshots remain inline or move to object storage.
