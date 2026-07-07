---
phase: 2
title: Secure Credentials And Bridge Defaults
status: completed
priority: P1
dependencies:
  - 1
effort: M
---

# Phase 2: Secure Credentials And Bridge Defaults

## Overview

Remove unsafe credential and device-control defaults before pilot data expands. Account password encryption must no longer rely on a hardcoded app-wide frontend passphrase, and the Mobile MCP bridge must require deliberate opt-in for unauthenticated local development.

## Requirements

- Functional: existing account create/import flows still store encrypted password payloads.
- Functional: worker-to-bridge calls still work when `MOBILE_MCP_BRIDGE_TOKEN` is configured.
- Non-functional: fail safe by default; no secrets committed; migration path documented.

## Architecture

Two decisions keep this small:

1. Account credentials: move from static frontend passphrase to an injected secret path. Preferred pilot-safe minimum is backend/service-side encryption or a per-user/env-injected key that is unavailable in source. If backend decryption is needed by workers, document the boundary explicitly.
2. Bridge auth: require `MOBILE_MCP_BRIDGE_TOKEN` unless `MOBILE_MCP_ALLOW_INSECURE_DEV=true` and bind/origin docs make local-only intent obvious.

## Related Code Files

- Modify: `F:\project-bolt-sb1-keyopwhy\project\src\lib\account-password-crypto.ts`
- Modify: `F:\project-bolt-sb1-keyopwhy\project\src\components\accounts\create-account-modal.tsx`
- Modify: `F:\project-bolt-sb1-keyopwhy\project\src\components\accounts\csv-import-modal.tsx`
- Modify: `F:\project-bolt-sb1-keyopwhy\project\src\pages\AccountsPage.tsx`
- Modify: `F:\project-bolt-sb1-keyopwhy\project\src\pages\AccountSetupPage.tsx`
- Modify: `F:\project-bolt-sb1-keyopwhy\project\services\mobile-mcp-bridge\src\bridge_server.py`
- Modify: `F:\project-bolt-sb1-keyopwhy\project\README.md`
- Modify: `F:\project-bolt-sb1-keyopwhy\project\docs\deployment-guide.md`

## Implementation Steps

1. Decide the minimum viable credential boundary:
   - Option A: env-injected frontend key for pilot only.
   - Option B: Supabase Edge Function or backend service encrypt/decrypt with server-held key.
   - Recommendation: Option B for any real social credentials; Option A only for local/demo and clearly labeled.
2. Add tests around encryption format, missing key behavior, and backward compatibility if old encrypted rows must be read.
3. Replace hardcoded `ENCRYPTION_PASSPHRASE` with selected key source and fail with actionable error when unavailable.
4. Update account create/import UI to surface a clear failure if encryption is not configured.
5. Change bridge auth behavior:
   - If token exists, require exact `x-bridge-token`.
   - If token missing and insecure dev flag absent, return 503/401 for protected endpoints.
   - `/health` may remain unauthenticated but must report auth mode safely.
6. Update worker/README/setup docs so local runtime scripts set/pass the token consistently.

## Tests Before

- Add or inspect tests for `account-password-crypto.ts`.
- Add Python bridge auth tests if a test harness exists; otherwise create a minimal request-handler test or smoke script note.

## Refactor

- Keep encryption API shape stable where possible: `encryptPassword(plaintext)` can delegate to configured provider.
- Do not redesign account schema in this phase unless chosen credential boundary requires version metadata.

## Tests After

- `npm.cmd test -- src/lib/account-password-crypto.test.ts` if added.
- `npm.cmd run build:worker`
- Mobile MCP protected endpoint smoke with missing token and valid token when runtime is available.

## Success Criteria

- [ ] No hardcoded production-capable account encryption secret remains in source.
- [ ] Bridge protected endpoints fail closed unless explicit insecure dev flag is set.
- [ ] Local setup docs mention `MOBILE_MCP_BRIDGE_TOKEN` and insecure-dev escape hatch.
- [ ] Existing account create/import UX handles encryption setup failure.

## Risk Assessment

- Risk: existing encrypted account rows become unreadable.
  Mitigation: include version marker or compatibility decrypt path; document migration.
- Risk: local pilot scripts break because token not passed.
  Mitigation: update scripts/docs and add a quick verification command.
- Risk: frontend-only key still exposes secrets to users.
  Mitigation: reject frontend static key for production; mark frontend env key as demo-only if used.
