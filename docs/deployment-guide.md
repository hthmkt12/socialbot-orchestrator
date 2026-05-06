# Deployment Guide

Date: 2026-05-05

## Local Development
- `npm.cmd install`
- `npm.cmd run dev`

## Local Worker
- Requires `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.
- `npm.cmd run dev:worker`
- Health: `http://127.0.0.1:4310/health`

## Mobile MCP Runtime
- Expected serial: `QC4DKJUO6PW4FMQW`
- User env persists `UI_SMOKE_EMAIL` and `MOBILE_MCP_EXPECTED_SERIALS`.
- Start/check:
  - `npm.cmd run runtime:mobile-mcp`
  - `npm.cmd run runtime:mobile-mcp:check`
- Verify:
  - `npm.cmd run preflight:mobile-mcp`
  - `npm.cmd run verify:mobile-mcp`

## Laixi Gateway
- `npm.cmd run dev:gateway`
- Health: `http://127.0.0.1:8080/health`
- Laixi live proof is not closed by OPS-08 Mobile MCP proof.

## Unresolved Questions
- What is the production host/deployment target?
- Is Supabase Edge Function `execute-run` deployed in the active Supabase project?
