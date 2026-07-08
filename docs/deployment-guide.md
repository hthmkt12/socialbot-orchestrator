# Deployment Guide

Date: 2026-06-29

## Local Development

```bash
npm install
npm run dev          # Vite dev server → http://127.0.0.1:5173
```

## Local Worker

```bash
npm run dev:worker   # tsx watch, hot-reload
```

Requires `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` environment variables.
Health check: `http://127.0.0.1:4310/health`

## Laixi Gateway

```bash
npm run dev:gateway  # tsx watch, hot-reload
```

Health check: `http://127.0.0.1:8080/health`

## Mobile MCP Bridge

- Start: `npm run runtime:mobile-mcp`
- Check: `npm run runtime:mobile-mcp:check`
- Verify: `npm run preflight:mobile-mcp` → `npm run verify:mobile-mcp`
- Expected device serials: configured via `MOBILE_MCP_EXPECTED_SERIALS` env
- Protected bridge endpoints require `MOBILE_MCP_BRIDGE_TOKEN`.
- `npm run runtime:mobile-mcp` fails closed when `MOBILE_MCP_BRIDGE_TOKEN` is missing.
- Set `MOBILE_MCP_ALLOW_INSECURE_DEV=true` only as an explicit isolated-local bypass without real account credentials.

## Docker (Full Stack)

```bash
# Build and start all services
docker compose up --build

# Individual services
docker compose up frontend   # http://127.0.0.1:3000
docker compose up worker     # health: http://127.0.0.1:4310/health
docker compose up gateway    # health: http://127.0.0.1:8080/health
```

Required environment variables in `.env`:

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_SUPABASE_URL` | frontend | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | frontend | Supabase anon key |
| `VITE_ACCOUNT_PASSWORD_KEY` | frontend | 32+ character pilot-only browser encryption key for social account passwords; not a production vault |
| `SUPABASE_URL` | worker | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | worker | Supabase service role key |
| `DEVICE_BACKEND` | worker | `mobile-mcp` (default) or `laixi` |
| `MOBILE_MCP_BRIDGE_URL` | worker | Mobile MCP bridge HTTP URL |
| `MOBILE_MCP_BRIDGE_TOKEN` | worker/bridge | Shared token for protected bridge endpoints |
| `MOBILE_MCP_ALLOW_INSECURE_DEV` | bridge | Optional local-only bypass when no token is configured |
| `MOBILE_MCP_ENSURE_PORTAL_ON_SESSION` | bridge | Optional Android Portal setup on session start; leave false for ADB-first smoke devices |

## CI/CD

## Credential Boundary

Social account credential storage is pilot-only. `VITE_ACCOUNT_PASSWORD_KEY` must be configured with at least 32 characters before account save/import flows are enabled, and stored account payloads must remain `v2:` encrypted values. Do not treat this browser-side key as production credential management; production social credentials require a later server-side encryption/key-management boundary before scale.

GitHub Actions workflow at `.github/workflows/ci.yml`:
- Runs on push/PR to `master`
- Jobs: web lint/typecheck/build/test, worker build, gateway build, Python bridge unit tests, and Python bridge compile check.

## Pilot Release Gates

Before making pilot-to-production readiness claims, run the full local gate suite:

```bash
npm run lint
npm run typecheck
npm run test
npm run build
npm run build:worker
npm run build:gateway
python -m unittest discover -s services/mobile-mcp-bridge/tests -p "test_*.py"
python -m py_compile services/mobile-mcp-bridge/src/android_session_manager.py services/mobile-mcp-bridge/src/bridge_server.py services/mobile-mcp-bridge/src/json_response.py
npm run verify:use-cases
npm run preflight:mobile-mcp
npm run verify:mobile-mcp
```

Artifact evidence must use explicit storage metadata: `inline`, `object_storage`, `external_ref`, or `omitted`. Large JSON/text previews over 64 KB and screenshot/base64 payloads must not be stored inline by default. Readiness reports cannot be marked `pilot_verified` when submitted evidence or artifact metadata has `redaction_status: blocked` or secret-like fields.

## Build Commands

| Command | Output |
|---------|--------|
| `npm run build` | `dist/` — Vite SPA |
| `npm run build:worker` | `services/execution-worker/dist/` |
| `npm run build:gateway` | `services/laixi-gateway/dist/` |

## Smoke Tests

| Command | What it tests |
|---------|---------------|
| `npm run smoke:backend` | Worker resilience smoke |
| `npm run smoke:mobile-mcp` | Mobile MCP device smoke |
| `npm run smoke:mobile-mcp:multi` | Multi-device smoke |
| `npm run smoke:mobile-mcp:db-multi` | DB-driven multi-device smoke |
