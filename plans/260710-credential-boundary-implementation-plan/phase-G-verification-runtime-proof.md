# Phase G - Verification And Runtime Proof

## Context Links

- Parent plan: `plans/260710-credential-boundary-implementation-plan/plan.md`
- Mobile MCP scripts: `scripts/verify-mobile-mcp-local.mjs`, `scripts/verify-first-social-pilot.mjs`
- Current runtime baseline: `plans/260708-1630-pilot-production-priority/reports/phase-06-pilot-beta-hardening-summary.md`

## Overview

Date: 2026-07-10
Priority: P1
Implementation status: Implemented
Review status: Non-device verified

Verify the production credential boundary end to end.

## Key Insights

- Passing unit tests is not enough.
- A credential login proof must prove both positive behavior and absence of plaintext persistence.
- Runtime proof needs device `97249fb5` or an updated expected serial.

## Requirements

- Full non-device suite passes.
- Edge Function auth negative tests pass.
- Runtime login macro succeeds.
- Canary plaintext absent from every persisted surface.

## Architecture

Final evidence report should include:

- Account id
- Credential payload prefix `s3:`
- Login run id
- Device serial
- Artifact refs
- Scrub/canary search result
- Readiness report id/status

## Related Code Files

- `scripts/verify-mobile-mcp-local.mjs`
- `scripts/verify-first-social-pilot.mjs`
- Proposed credential verification script
- `plans/reports/*`

## Implementation Steps

1. Run non-device gates.
2. Run Edge Function encrypt/decrypt integration tests.
3. Run migration dry-run and migration if applicable.
4. Start Mobile MCP runtime.
5. Run credential login macro proof.
6. Search DB/report/log outputs for canary plaintext.
7. Write final verification report.

## Todo List

- [x] `npm.cmd run lint`
- [x] `npm.cmd run typecheck`
- [x] `npm.cmd test`
- [x] `npm.cmd run build`
- [x] `npm.cmd run build:worker`
- [x] Edge Function tests (13 crypto-helper tests pass)
- [x] Runtime proof (device unavailable - non_device_only, production claim blocked)
- [x] Plaintext canary search (canary only in test files and verification script, no violations)

## Success Criteria

- New credentials are `s3:`.
- Login macro can use credential.
- No plaintext in persistence/logs.
- Readiness evidence claims server-managed boundary only with fresh proof.

## Risk Assessment

- Runtime device can block final proof.
- If device is unavailable, stop at non-device verified and keep production claim blocked.

## Security Considerations

- Do not use real customer credentials for first proof.
- Use disposable test credential canary.

## Next Steps

Only after Phase G can docs claim server-managed credential boundary implemented and verified.
