# System Architecture

Date: 2026-05-05

## Runtime Shape
Browser SPA talks to Supabase for auth/data and dispatches run control. Backend worker claims queued runs and executes steps through the selected device backend.

## Components
- Browser: React/Vite app.
- Data/Auth: Supabase Postgres, Auth, RLS.
- Worker: Node execution-worker service.
- Laixi Gateway: HTTP/WebSocket gateway for Laixi sessions.
- Mobile MCP Bridge: local Android bridge for ADB-visible devices.
- Shared packages: execution contracts and lifecycle policy.

## Run Path
1. Operator creates run in UI.
2. Run is queued in Supabase.
3. Worker claims run with lease.
4. Worker resolves devices and steps.
5. Worker dispatches to Mobile MCP or Laixi backend.
6. Worker writes run steps, artifacts, summary.
7. UI monitors run and artifacts through Supabase.

## Current Pilot Backend
Mobile MCP.

## OPS-08 Evidence
- Clean path full verify passed.
- Missing expected device failure path captured diagnostics and recommendation.

## Unresolved Questions
- Whether Laixi gateway remains optional or must be pilot-certified.
- Whether screenshots remain inline or move to object storage.
