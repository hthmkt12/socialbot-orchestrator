---
title: "Release closure research"
date: 2026-07-25
scope: "authorization, deploy contract, CI, proof"
---

# Release closure research

## Verified constraints

- `execute-run` service-role client and caller-controlled `runId`: `supabase/functions/execute-run/index.ts:118-135`.
- Workflow ownership field and role policies: `supabase/migrations/20260309165537_workflow_tables.sql:135-179`.
- Worker requires credential-vault and gateway tokens: `services/execution-worker/src/index.ts:28-34`.
- Compose omits those values and gateway environment: `docker-compose.yml:16-40`.
- Gateway fail-closed token constructor: `services/laixi-gateway/src/gateway-security.ts:21-33`.
- Root test scope excludes services: `package.json:11`.
- CI builds services but does not run their tests: `.github/workflows/ci.yml:32-61`.
- Bridge protected endpoints require token: `services/mobile-mcp-bridge/src/bridge_server.py:71-105`.
- Browser Mobile MCP calls omit token: `src/lib/mobile-mcp-orchestrator.ts:58-119`.
- Macro validator does not require fields dereferenced by preflight: `src/contracts/macro.ts:98-162`, `src/lib/run-preflight.ts:64-70`.

## Required test matrix

- Edge function: identity, role, ownership, unknown run, start/cancel replay, no cross-run side effects.
- Proxy: 401/403, URL allowlist, token injection, no browser bundle/log disclosure.
- Compose: env names, missing-token fail-closed startup, no secret echo.
- Services: worker/gateway test scripts in CI; bridge unit and compile checks.
- Contracts: malformed macro rejection and signed event protocol version.
- Release proof: schema, nonce/canary/hash binding, freshness, redaction, exact commit.

## Unresolved owner decisions

- Production origin allowlist and gateway auth topology.
- Proof-harness authority and evidence retention.
- E2E PR/nightly cadence and coverage threshold.
- Key rotation maintenance window and rollback authority.
