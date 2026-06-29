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
| `SUPABASE_URL` | worker | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | worker | Supabase service role key |
| `DEVICE_BACKEND` | worker | `mobile-mcp` (default) or `laixi` |
| `MOBILE_MCP_WS_URL` | worker | Bridge WebSocket URL |

## CI/CD

GitHub Actions workflow at `.github/workflows/ci.yml`:
- Runs on push/PR to `master`
- Jobs: lint → typecheck → build → test (42 unit tests)

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
| `npm run smoke:social-macro` | Social macro exporter |
| `npm run smoke:mobile-mcp` | Mobile MCP device smoke |
| `npm run smoke:mobile-mcp:multi` | Multi-device smoke |
| `npm run smoke:mobile-mcp:db-multi` | DB-driven multi-device smoke |
