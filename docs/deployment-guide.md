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
| `VITE_ACCOUNT_PASSWORD_KEY` | frontend (pilot legacy only) | 32+ character key for transitional `v2:` browser encryption; not required when the server-side credential vault is configured and never a production vault |
| `SUPABASE_URL` | worker | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | worker | Supabase service role key |
| `CREDENTIAL_BOUNDARY_SERVICE_ROLE_KEY` | worker + credential-vault Edge Function | Optional dedicated service key for worker decrypt; falls back to `SUPABASE_SERVICE_ROLE_KEY` when unset |
| `WORKER_CORS_ORIGIN` | worker | Exact browser origin allowed for worker health/control-plane responses (defaults to `http://localhost:5173`) |
| `CREDENTIAL_VAULT_WORKER_TOKEN` | worker + credential-vault Edge Function | Shared server-side token for worker decrypt calls; never expose to the browser |
| `CREDENTIAL_VAULT_ALLOWED_ORIGIN` | credential-vault Edge Function | Exact browser origin allowed for vault requests (defaults to `http://localhost:5173`; wildcard `*` is rejected) |
| `EXECUTE_RUN_ALLOWED_ORIGIN` | execute-run Edge Function | Exact browser origin allowed for run-control requests (defaults to `http://localhost:5173`) |
| `DEVICE_BACKEND` | worker | `mobile-mcp` (default) or `laixi` |
| `MOBILE_MCP_BRIDGE_URL` | worker | Mobile MCP bridge HTTP URL |
| `MOBILE_MCP_BRIDGE_TOKEN` | worker/bridge | Shared token for protected bridge endpoints |
| `MOBILE_MCP_ALLOW_INSECURE_DEV` | bridge | Optional local-only bypass when no token is configured |
| `MOBILE_MCP_ENSURE_PORTAL_ON_SESSION` | bridge | Optional Android Portal setup on session start; leave false for ADB-first smoke devices |
| `GATEWAY_HTTP_TOKEN` | worker/gateway | Bearer token for Laixi gateway `/sessions` and `/dispatch-step` |
| `GATEWAY_DEVICE_ENROLLMENT_TOKEN` | gateway | Token required when a Laixi device registers over WebSocket |
| `GATEWAY_ALLOW_INSECURE_DEV` | gateway | Optional isolated-local bypass; keep unset/false for pilot or production |

For browser control-plane access, set `VITE_WORKER_BASE_URL` to the worker URL (for example `http://127.0.0.1:4310`). The UI calls only the authenticated worker proxy routes `GET /control/mobile-mcp/devices` and `POST /control/mobile-mcp/devices/{serial}/execute-step`; it does not call the bridge directly or send `MOBILE_MCP_BRIDGE_TOKEN`. The worker validates the Supabase bearer token and `ADMIN`/`OPERATOR` profile role, injects `x-bridge-token` server-side, and forwards only the bridge response. Worker CORS is restricted to `WORKER_CORS_ORIGIN`; requests from other origins receive no allow-origin header.

Laixi gateway control-plane proxy routes are also available on the worker: `GET /control/gateway/sessions` and `POST /control/gateway/dispatch-step`. They use the same Supabase bearer/profile authorization and inject `GATEWAY_HTTP_TOKEN` server-side before forwarding to the private gateway. Frontend setup/probe consumers still have a migration pending: until they call these worker routes, keep direct Laixi gateway access restricted to trusted local/service contexts and do not expose `GATEWAY_HTTP_TOKEN` in browser configuration.

The `execute-run` Edge Function requires a valid Supabase bearer token, checks the caller's profile role, and permits start/cancel only for runs owned by that profile (ADMIN may operate on any run). Invalid JSON and unsupported actions return `400`; cross-origin requests are limited to `EXECUTE_RUN_ALLOWED_ORIGIN`. Deploy the function with `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` configured.

## CI/CD

## Credential Boundary

Social account credential storage supports a 3-tier status model (`pilot_client_encrypted`, `server_boundary_required`, and `server_managed`). If no server-side vault is configured, the system operates in transitional `server_boundary_required` status where saving and importing are blocked unless `VITE_ACCOUNT_PASSWORD_KEY` is configured with at least 32 characters, producing `v2:` encrypted values. This client-side key is pilot-only; browser-side encryption is pilot-only and a server boundary is required for production. All secret keys are automatically scrubbed from readiness reports and evidence.

## Production Safety Closure

Phase 04 remains blocked until release authority assigns and records all owners below. `TBD` is not an approval.

| Role | Required assignment | Gate evidence |
|------|---------------------|---------------|
| Security owner | TBD | Security decision: `approved`, `hold`, or `needs_rerun` |
| Key owner | TBD | Secret-name inventory and rotation authority |
| Pilot operator | TBD | Immutable run and artifact records |
| Admin reviewer | TBD | Role, ownership, and evidence review |
| Rollback owner | TBD | Stop, rollback, and incident decision |

Secret inventory records names, consumers, and owners only. Never copy values into this guide, reports, logs, or evidence.

| Secret name | Allowed consumers | Boundary |
|-------------|-------------------|----------|
| `SUPABASE_SERVICE_ROLE_KEY` | Worker, gateway, Edge Functions | Server/service network only |
| `CREDENTIAL_BOUNDARY_SERVICE_ROLE_KEY` | Credential-vault Edge Function | Credential boundary only |
| `CREDENTIAL_VAULT_WORKER_TOKEN` | Worker, credential-vault Edge Function | Dedicated worker decrypt channel |
| `MOBILE_MCP_BRIDGE_TOKEN` | Worker, Mobile MCP bridge | Dedicated bridge channel |
| `GATEWAY_HTTP_TOKEN` | Worker, Laixi gateway | HTTP dispatch channel |
| `GATEWAY_DEVICE_ENROLLMENT_TOKEN` | Laixi gateway, enrolled device sessions | WebSocket enrollment channel |
| `VITE_ACCOUNT_PASSWORD_KEY` | Browser legacy migration path | Pilot-only `v2:` compatibility; never production vault |

Token reuse across worker, vault, gateway, bridge, enrollment, and claim boundaries is prohibited. `MOBILE_MCP_ALLOW_INSECURE_DEV` and `GATEWAY_ALLOW_INSECURE_DEV` stay unset/false outside isolated local development. Browser-facing origins use exact allowlists; wildcard `*` is rejected.

### Rotation rehearsal — not execution

Use placeholders only until separate security and release approval exists:

1. List secret names, consumers, owner, current key record ID, and legacy consumers; do not read or print values.
2. Define target key record IDs, deployment order, maintenance window, health checks, and rollback owner.
3. Validate that worker, vault, gateway, bridge, browser, and enrollment channels use separate placeholders.
4. Define retirement evidence for every legacy consumer and a stop condition for any unknown consumer.
5. Rehearse expected outputs: consumer inventory, staged order, validation results, rollback decision, and evidence IDs invalidated by context change.
6. Do not rotate, mutate environment, deploy, or claim production readiness in this phase.

### Evidence invalidation and rollback boundary

Invalidate prior pilot evidence and stop promotion after any secret leak, unknown consumer, auth-mode change, Supabase project change, backend or bridge change, workflow/version change, device mapping change, key rotation, origin change, duplicate execution, stale ownership, unreleased lock, missing artifact, or manual DB repair. Rollback owner records the incident and release decision; future key rotation or environment changes require separate approval.

GitHub Actions workflow at `.github/workflows/ci.yml`:
- Runs on push/PR to `master`
- Jobs: web lint/typecheck/build/test, worker build, gateway build, Python bridge unit tests, and Python bridge compile check.

The local gate list below is broader than the current CI workflow; worker/gateway focused suites and Edge Function auth tests must be run before a production closure sign-off until CI parity is complete.

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

Artifact evidence must use explicit storage metadata: `inline`, `object_storage`, `external_ref`, or `omitted`. Large JSON/text previews over 64 KB and screenshot/base64 payloads must not be stored inline by default. Readiness reports cannot be marked `pilot_verified` when submitted evidence or artifact metadata has `redaction_status: blocked`, secret-like fields, a missing/invalid `verified_at`, or evidence older than 14 days.

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
