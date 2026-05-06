# Laixi Orchestration Platform

A full-stack platform for orchestrating Android device automation workflows through Laixi, a local WebSocket-based device gateway.

## Overview

The platform enables teams to:

- **Manage Android devices** connected through a Laixi WebSocket gateway (`ws://127.0.0.1:22221/`)
- **Define reusable macros** as versioned JSON workflows with 14 step types (tap, swipe, launch app, screenshot, ADB, AutoX scripts, conditional logic, and more)
- **Execute workflow runs** across single devices, device groups, or entire fleets
- **Monitor runs in real time** with step-by-step progress, live status indicators, and artifact collection
- **Gate sensitive operations** with approval checkpoints for ADB and script commands
- **Audit everything** with a full immutable audit trail

## Architecture

```
Browser (Vite + React SPA)
    |
    |--- Supabase (Postgres + Auth + RLS)
    |        |--- profiles, devices, device_groups
    |        |--- macros, macro_versions
    |        |--- workflow_runs, run_steps, artifacts
    |        |--- approvals, audit_logs, device_locks
    |        |--- execution_profiles
    |
    |--- Execution Worker (Node.js control plane; claims queued runs)
    |
    |--- Device Backend
             |--- Laixi Gateway Service
             |--- Mobile MCP Bridge (Android serial backend)
             |--- Android Device 1
             |--- Android Device 2
             |--- ...
```

### Tech Stack

| Layer      | Technology                              |
|------------|-----------------------------------------|
| Frontend   | React 18, TypeScript, Vite, Tailwind CSS |
| State      | Zustand (auth, UI, Laixi connection)    |
| Data       | React Query (TanStack Query v5)         |
| Database   | Supabase (PostgreSQL with RLS)          |
| Auth       | Supabase Auth (email/password)          |
| Icons      | Lucide React                            |
| Validation | Zod                                     |
| Gateway    | Laixi WebSocket or Mobile MCP bridge    |

### Key Directories

```
src/
  adapters/laixi/    # WebSocket client, command builders, step mapper
  components/        # Layout (AppLayout, Header, Sidebar) + UI primitives
  contracts/         # Macro definition types, validation, sample macros
  engine/            # Workflow runner, variable resolver, execution types
  hooks/             # React Query hooks for all entities
  lib/               # Supabase client, database types, audit helper
  pages/             # All route pages
  stores/            # Zustand stores (auth, UI, Laixi)

supabase/
  migrations/        # PostgreSQL migrations (schema + seed data)
  functions/         # Edge functions

packages/
  shared/            # Shared execution and control-plane contracts
  laixi-adapter/     # Shared Laixi command builders
services/
  execution-worker/  # Worker with queue-claim, lease loop, and single-device backend execution
  laixi-gateway/     # Gateway service for device sessions, heartbeats, and step dispatch
  mobile-mcp-bridge/ # Android serial bridge backed by mobile-mcp-ai
```

## Prerequisites

- Node.js 20+
- Python 3.10+ for the optional Mobile MCP bridge
- A Supabase project (already provisioned -- connection details in `.env`)
- (Optional) Laixi gateway running on `ws://127.0.0.1:22221/` for live device control
- (Optional) Android SDK Platform Tools (`adb`) for `DEVICE_BACKEND=mobile-mcp`
- (Optional) Docker for containerized deployment

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Environment variables

Start from `.env.example` and create a local `.env`.

Frontend env:

```bash
VITE_SUPABASE_URL=<your-supabase-url>
VITE_SUPABASE_ANON_KEY=<your-anon-or-publishable-key>
VITE_GATEWAY_BASE_URL=http://127.0.0.1:8080
VITE_WORKER_BASE_URL=http://127.0.0.1:4310
VITE_MOBILE_MCP_BRIDGE_URL=http://127.0.0.1:4321
VITE_RUN_CONTROL_MODE=auto
```

Backend and control-plane env:

```bash
SUPABASE_URL=<your-supabase-url>
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-or-secret-key>
GATEWAY_BASE_URL=http://127.0.0.1:8080
DEVICE_BACKEND=laixi
MOBILE_MCP_BRIDGE_URL=http://127.0.0.1:4321
DEVICE_COMMAND_TIMEOUT_MS=15000
GATEWAY_PORT=8080
WORKER_PORT=4310
```

Notes:
- Frontend should only use the low-privilege anon or publishable key.
- Gateway, worker, and the `execute-run` Edge Function require the elevated backend key.
- Newer Supabase projects may expose an `sb_secret_...` key instead of relying on the legacy `service_role` JWT key. This repo still uses the env name `SUPABASE_SERVICE_ROLE_KEY` for that backend credential.
- On Windows, run `npm run env:mobile-mcp:user` to store backend and UI-smoke secrets in the Windows User environment instead of repo files. The helper also sets the current helper process env; already-open external terminals still need restart.
- Set `DEVICE_BACKEND=mobile-mcp` to execute Android steps through Mobile MCP. In this mode, `devices.laixi_device_id` is treated as the Android ADB serial.
- Set `MOBILE_MCP_EXPECTED_SERIALS` to a comma-separated list of required Android serials when this workstation should always warn if a known phone is missing from ADB or the Mobile MCP bridge.
- Set `VITE_RUN_CONTROL_MODE=browser` for local/new Supabase projects where the `execute-run` Edge Function is not deployed yet; keep `auto` or `edge` when the function is deployed and reachable.

### 3. Database setup

Migrations are applied automatically through Supabase. The schema includes:

1. **Foundation tables** -- profiles, devices, device groups, execution profiles
2. **Workflow tables** -- macros, macro versions, workflow runs, run steps
3. **Support tables** -- artifacts, approvals, audit logs, device locks
4. **Seed data** -- 4 demo devices, 2 device groups, execution profiles, and a `seed_demo_macros()` function

### 4. Start development

```bash
npm run dev
```

### 5. First login

1. Register a new account on the login page
2. Navigate to **Macros** and click **Load Samples** to seed the 3 demo macros
3. The seeded devices and groups will appear on the **Devices** and **Device Groups** pages

## End-to-End Demo: `launch_app_and_capture`

Navigate to the **E2E Demo** page in the sidebar. This provides an interactive walkthrough of the `launch_app_and_capture` workflow.

### What the macro does

1. **launch_app** -- Sends an `OpenApp` command to Laixi to launch the specified package
2. **wait** -- Pauses for 3 seconds to let the app initialize
3. **screenshot** -- Captures the device screen and stores it as an artifact
4. **get_current_app** -- Queries the device for the currently running app package and activity

### Running the demo

**Simulated mode** (no Laixi required):
1. Go to the **E2E Demo** page
2. Keep mode set to "Simulated"
3. Enter an app package name (default: `com.android.settings`)
4. Click **Execute Run**
5. Watch each step execute with realistic timing and output

**Live mode** (requires Laixi + device):
1. Ensure Laixi is running at `ws://127.0.0.1:22221/` with at least one connected device
2. Go to the **E2E Demo** page
3. Switch mode to "Live (Laixi)"
4. Select a target device
5. Click **Execute Run**
6. The workflow creates a real `workflow_run` record and dispatches it to the backend control plane
7. A running worker can now claim and execute `SINGLE_DEVICE`, `MULTI_DEVICE`, `DEVICE_GROUP`, and `ALL_DEVICES` runs from the backend
8. Approval waits now persist in the backend and resume after approval through the worker claim loop
9. Live device steps are now dispatched to the gateway, which owns device websocket sessions and returns `step_result` payloads back to the worker

**Mobile MCP mode** (requires Android devices visible to `adb devices`):
1. Run `npm run setup:mobile-mcp:local` once to install the Mobile MCP bridge dependencies and configure Windows User env values
2. Export `SUPABASE_SERVICE_ROLE_KEY` in the current shell or provide it when `setup:mobile-mcp:local` prompts; do not commit it to `.env`
3. Open a new terminal, then run `npm run runtime:mobile-mcp` to start the Mobile MCP bridge, execution worker, Vite UI, and startup ADB device sync with Mobile MCP defaults
4. Optionally run `npm run sync:mobile-mcp:devices -- --dry-run` to preview the current ADB-to-DB device mapping
5. Open `http://127.0.0.1:5173`
6. The worker keeps queue, audit, approval, and artifact behavior while the bridge executes Android steps by serial
7. Optional runtime checks and real-device worker-backend smoke:

```bash
npm run setup:mobile-mcp:local
npm run setup:mobile-mcp:quick
npm run setup:mobile-mcp:full
npm run setup:mobile-mcp:local -- -EnsureOperatorAfter
npm run setup:mobile-mcp:local -- -SyncDevicesAfter
npm run setup:mobile-mcp:local -- -QuickVerifyAfter
npm run setup:mobile-mcp:local -- -VerifyAfter
npm run ensure:mobile-mcp:operator -- --dry-run
npm run ensure:mobile-mcp:operator
npm run sync:mobile-mcp:devices -- --dry-run
npm run sync:mobile-mcp:devices
npm run runtime:mobile-mcp:check
npm run status:mobile-mcp
npm run diagnose:mobile-mcp:devices
npm run recover:mobile-mcp:adb
npm run wait:mobile-mcp:devices -- --timeout-ms 60000 --recover-adb --doctor-on-fail
npm run preflight:mobile-mcp
npm run verify:mobile-mcp:quick
npm run verify:mobile-mcp
npm run env:mobile-mcp:user

set MOBILE_MCP_DEVICE_SERIAL=<adb-serial>
set MOBILE_MCP_BRIDGE_URL=http://127.0.0.1:4321
npm run smoke:mobile-mcp

set MOBILE_MCP_DEVICE_SERIALS=<adb-serial-1>,<adb-serial-2>
npm run smoke:mobile-mcp:multi

set SUPABASE_SERVICE_ROLE_KEY=<service-role-or-sb-secret-key>
npm run smoke:mobile-mcp:db-multi
npm run smoke:mobile-mcp:db-queue
set MOBILE_MCP_DB_QUEUE_TARGET_COUNT=1
npm run smoke:mobile-mcp:db-queue

set UI_SMOKE_EMAIL=<operator-email>
set UI_SMOKE_PASSWORD=<operator-password>
npm run smoke:mobile-mcp:ui

npm run record:social-macro -- --dry-run --app-package com.brave.browser --output-dir plans/social-macro-recordings/brave-draft

npm run doctor:adb
```

### Current backend execution notes

- `SINGLE_DEVICE`, `MULTI_DEVICE`, `DEVICE_GROUP`, and `ALL_DEVICES` runs are executed by `services/execution-worker`
- The worker now dispatches live commands to `services/laixi-gateway` over HTTP `POST /dispatch-step`
- The worker can alternatively use `services/mobile-mcp-bridge` with `DEVICE_BACKEND=mobile-mcp`
- Run control defaults to `auto`: it first calls the `execute-run` Edge Function, then falls back to the same shared queue/cancel control logic through authenticated Supabase RLS when the function is unavailable. Use `VITE_RUN_CONTROL_MODE=browser` to skip the Edge Function in local/new projects and avoid noisy CORS/function-missing console errors.
- Mobile MCP mode supports Android `launch_app`, `input_text`, `tap`, `swipe`, `screenshot`, `get_current_app`, `adb`, and worker-local `wait`
- Mobile MCP mode does not execute `run_autox` steps in V1; approval flow remains in the worker before backend dispatch
- Social automation should use the Social Macro DSL as source of truth: Mobile MCP trains/debugs the flow, the platform compiles it to existing macro steps, and `exportSocialMacroToAutoJs()` emits a review-gated AutoJS runtime script
- The **MCP Orchestrator** page can control multiple Android serials from one bridge: refresh fleet, select serials, launch an app, query foreground app, and collect screenshot grids
- Approval checkpoints and approval-required steps now release ownership at `WAITING_APPROVAL` and resume from persisted `run_steps` after approval
- Multi-target execution currently shares one worker claim and runs devices sequentially inside that claim
- The Mobile MCP bridge keeps one lazy session and one mutex per Android serial, so separate serials are isolated and same-device calls are serialized
- `npm run smoke:mobile-mcp` verifies worker-to-bridge execution against a real Android device with `launch_app`, `wait`, `get_current_app`, `swipe`, `tap`, `adb`, and `screenshot`
- `npm run smoke:mobile-mcp:multi` verifies multiple Android serials through one bridge endpoint; pass comma-separated serials in `MOBILE_MCP_DEVICE_SERIALS`
- `npm run smoke:mobile-mcp:db-multi` creates a real Supabase `MULTI_DEVICE` workflow run, maps online ADB serials into `devices.laixi_device_id`, executes it through the worker Mobile MCP backend, and verifies run steps plus screenshot artifacts
- `npm run smoke:mobile-mcp:db-queue` leaves the run in `QUEUED`, starts the worker claim loop, verifies the worker claims and completes the Supabase run, then checks steps and screenshot artifacts; with one online serial it creates a `SINGLE_DEVICE` queued run, and `MOBILE_MCP_DB_QUEUE_TARGET_COUNT=1` forces Redmi-only validation
- `npm run smoke:mobile-mcp:ui` drives the real browser run wizard, selects the configured Android device labels, dispatches the run, and verifies completion through authenticated Supabase reads without requiring `SUPABASE_SERVICE_ROLE_KEY`
- `npm run ensure:mobile-mcp:operator` creates or fixes the UI smoke operator auth user/profile using `UI_SMOKE_EMAIL`, `UI_SMOKE_PASSWORD`, and `SUPABASE_SERVICE_ROLE_KEY`; existing `.invalid` smoke users get password refreshed automatically, while real emails require `-- --update-password`
- `npm run sync:mobile-mcp:devices` reads online `adb devices -l` transports and upserts them into `devices` using each Android serial as `laixi_device_id`; pass `-- --dry-run` to preview without writing
- `npm run status:mobile-mcp` prints ADB, bridge, worker, UI health, summarizes the latest Mobile MCP reports including expected-device wait/diagnose recommendations, and warns about missing env, expected serials, or device/report mismatches without mutating DB/auth/device state
- `npm run diagnose:mobile-mcp:devices` runs the standard expected-device wait with one ADB restart and doctor-on-fail diagnostics; use this first when one expected phone disappears from ADB or the bridge
- `npm run recover:mobile-mcp:adb` runs ADB doctor/recovery, then runs `status:mobile-mcp`; if `MOBILE_MCP_EXPECTED_SERIALS` is set and any expected phone is still missing from ADB or bridge, it writes serial-specific recommendations and exits non-zero
- `npm run wait:mobile-mcp:devices` polls ADB and Mobile MCP bridge `/devices` until all `MOBILE_MCP_EXPECTED_SERIALS` are online, then writes a wait report; pass `-- --timeout-ms <ms>` for shorter or longer waits, `-- --recover-adb` or `MOBILE_MCP_WAIT_RECOVER_ADB=true` to restart the ADB server once, and `-- --doctor-on-fail` or `MOBILE_MCP_WAIT_DOCTOR_ON_FAIL=true` to attach summarized USB/PnP diagnostics when the wait still fails
- `npm run preflight:mobile-mcp` verifies local env, ADB, bridge, expected serials, worker, UI, Supabase login, macro availability, and device DB mapping before running expensive real-device UI smoke
- `npm run verify:mobile-mcp:quick` runs the current-runtime check, expected-device wait, UI smoke operator ensure, ADB device sync, and preflight without launching browser UI smoke; pass `-- --skip-wait-devices` or set `MOBILE_MCP_SKIP_WAIT_DEVICES=true` to bypass the wait gate, or pass `-- --recover-adb --doctor-on-fail` to restart ADB once and attach diagnostics during the wait
- `npm run verify:mobile-mcp` runs the current-runtime check, expected-device wait, UI smoke operator ensure, ADB device sync, preflight, and real browser UI smoke in sequence, then writes one aggregate verification report under `plans/reports/`; operator ensure and device sync are dry-runs unless `SUPABASE_SERVICE_ROLE_KEY` is loaded in the shell
- `npm run setup:mobile-mcp:quick` runs setup, operator ensure, ADB device sync, and non-browser verification in one command
- `npm run setup:mobile-mcp:full` runs setup, operator ensure, ADB device sync, and full browser verification in one command
- `npm run setup:mobile-mcp:local` installs Mobile MCP bridge dependencies and stores required local secret/config values in Windows User env through hidden prompts; pass `-- -EnsureOperatorAfter` to create/fix the UI smoke operator, `-- -SyncDevicesAfter` to sync DB devices in the same setup process, `-- -QuickVerifyAfter` for non-browser verification, or `-- -VerifyAfter` for full browser verification when runtime services are already healthy
- `npm run runtime:mobile-mcp` is the local one-command runtime starter; it checks ADB, starts missing local services, waits for `MOBILE_MCP_EXPECTED_SERIALS` unless `-- --skip-device-wait` or `MOBILE_MCP_SKIP_DEVICE_WAIT=true` is set, supports `-- --recover-adb --doctor-on-fail` during that wait, runs startup ADB device sync, writes logs to `plans/reports/mobile-mcp-runtime/`, and requires `SUPABASE_SERVICE_ROLE_KEY` from the shell only when starting a new worker
- `npm run doctor:adb` reports ADB transports plus Windows USB/PnP visibility and restarts the ADB server when no online transport is available
- `npm run smoke:social-macro` verifies the Social Macro DSL compiles to platform macro JSON and review-gated AutoJS
- `npm run record:social-macro -- --app-package <package> --serial <adb-serial>` records a Mobile MCP-assisted draft flow and writes Social DSL, platform macro JSON, AutoJS, and a recording report; publish taps stay blocked unless `--allow-publish` is explicitly passed
- Screenshot and text-log artifacts are now persisted in artifact rows with inline metadata previews for the run-detail UI
- A repeatable backend smoke suite now covers start, cancel, and approval-resume flows without browser-owned state
- The gateway now owns device websocket sessions, heartbeat tracking, per-step dispatch outcomes, and device-health persistence (`last_seen_at`, `heartbeat_freshness`, `last_error_*`) when service-role env is configured
- Device and run-target surfaces now share one lifecycle policy: expected heartbeat every `15s`, stale after `45s`, offline after `120s`

### Backend smoke suite

Run the repeatable backend smoke coverage with:

```bash
npm run smoke:backend
```

Current coverage:

- start request queues a pending run replay-safely
- cancel request clears active steps, pending approvals, and device locks
- approval-resume flow completes after a fresh runner instance reclaims persisted state, modeling refresh/tab-close style UI disconnect

### Macro JSON definition

```json
{
  "version": 1,
  "meta": {
    "key": "launch_app_and_capture",
    "name": "Launch App And Capture",
    "tags": ["demo", "capture"]
  },
  "inputs": {
    "appName": {
      "type": "string",
      "required": true,
      "description": "App package name to launch"
    }
  },
  "target": { "mode": "single_device" },
  "execution": {
    "defaultTimeoutMs": 10000,
    "maxRetries": 1,
    "onError": "stop"
  },
  "steps": [
    { "id": "launch",   "type": "launch_app",     "params": { "appName": "{{appName}}" } },
    { "id": "wait1",    "type": "wait",            "params": { "ms": 3000 } },
    { "id": "screen1",  "type": "screenshot",      "params": { "saveToArtifact": true } },
    { "id": "current1", "type": "get_current_app", "params": {} }
  ]
}
```

### Variable resolution

- `{{appName}}` resolves to the user-provided input variable
- `{{steps.get_app.output.appPackage}}` resolves to a previous step's output (used in the `current_app_check` macro)

## Docker Deployment

### Build and run

```bash
docker compose up --build
```

The app will be available at `http://localhost:3000`.

### Build arguments

Pass Supabase credentials as build args:

```bash
docker build \
  --build-arg VITE_SUPABASE_URL=https://your-project.supabase.co \
  --build-arg VITE_SUPABASE_ANON_KEY=your-anon-key \
  -t laixi-orchestrator .
```

## Supported Step Types

| Type                  | Description                                    |
|-----------------------|------------------------------------------------|
| `launch_app`          | Launch an Android app by package name          |
| `tap`                 | Tap at relative screen coordinates (0-1)       |
| `swipe`               | Swipe between two coordinate pairs             |
| `input_text`          | Type text into the focused field               |
| `screenshot`          | Capture device screen as PNG artifact          |
| `get_current_app`     | Query current foreground app info              |
| `wait`                | Pause execution for N milliseconds             |
| `adb`                 | Execute an ADB shell command                   |
| `run_autox`           | Execute an AutoX/AutoJs script file            |
| `conditional`         | Branch based on variable comparison            |
| `group`               | Group steps into a logical block               |
| `foreach_device`      | Iterate across target devices                  |
| `approval_checkpoint` | Pause and require manual approval              |
| `stop`                | Halt execution with a reason                   |

## Pages

| Page          | Path            | Description                                  |
|---------------|-----------------|----------------------------------------------|
| Devices       | `/devices`      | Device inventory with status, battery, search |
| Device Setup  | `/device-setup` | Onboarding verification for gateway, worker, heartbeats, and live probes |
| Device Groups | `/device-groups`| Organize devices into named groups            |
| Macros        | `/macros`       | Macro library with create/seed/search         |
| Macro Detail  | `/macros/:id`   | Step visualization, version timeline          |
| Runs          | `/runs`         | All workflow runs with stats and filters      |
| Run Detail    | `/runs/:id`     | Live step timeline, progress bar, artifacts   |

### Device Setup Verification

- The Device Setup page now starts with a live verification flow instead of instructions only.
- It checks gateway `/health`, worker `/health`, device registration, fresh vs stale heartbeats, and live current-app / screenshot probes.
- For local browser access, gateway and worker now expose permissive CORS headers on their health endpoints, and the gateway also allows browser-origin `POST /dispatch-step` setup probes.
| Approvals     | `/approvals`    | Pending/resolved approval requests            |
| Audit Logs    | `/audit-logs`   | Searchable, filterable event log              |
| E2E Demo      | `/demo`         | Interactive launch_app_and_capture walkthrough |

## Security

- Row Level Security (RLS) on all 13 tables
- Role-based access: ADMIN, OPERATOR, VIEWER
- Approval gates for ADB and AutoX commands
- Device locking prevents concurrent run conflicts
- Audit logging for all state-changing operations
