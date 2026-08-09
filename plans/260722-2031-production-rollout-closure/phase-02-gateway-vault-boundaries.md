---
title: "Phase 02 — Gateway and vault boundaries"
status: completed
---

# Phase 02 — Gateway and vault boundaries

## Goal

Close unauthenticated gateway routes/WebSocket exposure and remove production wildcard CORS while preserving the worker decrypt contract.

## TDD tasks

1. Add gateway contract tests for `/health`, `/sessions`, `/dispatch-step`, OPTIONS, malformed payloads, unauthenticated requests, and WebSocket connection/auth behavior [services/laixi-gateway/src/index.ts:77-127](../../services/laixi-gateway/src/index.ts#L77-L127).
2. Add vault handler tests asserting configured-origin CORS, rejected origins, preflight headers, and unchanged per-action authentication/authorization [supabase/functions/credential-vault/index.ts:32-50](../../supabase/functions/credential-vault/index.ts#L32-L50), [supabase/functions/credential-vault/index.ts:73-90](../../supabase/functions/credential-vault/index.ts#L73-L90).
3. Implement explicit gateway auth (shared service token or private-network boundary), rate limits, and WebSocket handshake checks; keep `/health` intentionally observable only if owner approves.
4. Replace vault `*` with an environment-driven allowlist and document the threat model; preserve `Authorization` and worker-token headers.

## Acceptance gate

Unauthenticated dispatch/session/WebSocket tests fail closed; approved origin succeeds and wildcard origin is rejected; vault decrypt still requires exact worker auth, active run, claim token, and account binding [supabase/functions/credential-vault/index.ts:21-29](../../supabase/functions/credential-vault/index.ts#L21-L29).

## Dependencies / risks

Requires deployment-owner decision on auth mechanism, trusted origins, and whether gateway is private-only. Risk of breaking local development is handled with explicit test/dev configuration, never an implicit production bypass.

## Security notes

Never log bearer tokens, worker tokens, JWTs, plaintext, ciphertext, or keys; preserve generic error responses on auth/decrypt failure.

## Context links
Parent: [plan.md](./plan.md); [system architecture](../../docs/system-architecture.md#L5-L15); [gateway](../../services/laixi-gateway/src/index.ts#L77-L127); [vault](../../supabase/functions/credential-vault/index.ts#L32-L50).

## Overview
Date: 2026-07-22. Priority: P0/P1. Implementation status: completed 2026-07-23. Review status: automated gates pass; live device/DB E2E remains outside scope.

## Key Insights
Gateway routes/WebSocket lacked auth [index.ts:89-122](../../services/laixi-gateway/src/index.ts#L89-L122); vault CORS was wildcard [credential-vault/index.ts:32-37](../../supabase/functions/credential-vault/index.ts#L32-L37). Both boundaries are now explicit and fail closed.

## Requirements
Authenticated/private access, configured origins, rate limits, unchanged run/account binding.

## Architecture
HTTP/WebSocket checks precede dispatch; vault origin policy wraps existing per-action auth.

## Related code files
`services/laixi-gateway/src/index.ts:52-122`; `supabase/functions/credential-vault/index.ts:32-50,200-260`.

## Implementation Steps
Add contract tests, implement auth/origin allowlist/rate limits, run gateway/vault tests.

## Todo list
- [x] HTTP/WebSocket auth tests
- [x] CORS allowlist tests
- [x] Auth/origin implementation

## Success Criteria
Unauthenticated requests fail closed; approved origins and worker decrypt pass.

## Risk Assessment
Local flows may break; provide explicit isolated dev config only.

## Security Considerations
Keep tokens and credential material out of logs/errors.

## Next steps
Publish final environment names to Phase 03 and wire them into Docker/CI without exposing tokens to frontend bundles. AutoJS provisioning must supply `GATEWAY_DEVICE_ENROLLMENT_TOKEN` at device runtime; browser probes require a server-mediated bearer token.
