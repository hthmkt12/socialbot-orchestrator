---
title: "Phase 02 Implementation — Gateway and Vault Boundaries"
date: 2026-07-23
session: production-rollout-closure-phase-02
type: journal
status: completed
---

# Journal: 2026-07-23 — Phase 02 Implementation

## Context

Phase 02 of the production-rollout-closure plan implemented the owner-approved option A: a shared internal HTTP service token, a device-enrollment token for WebSocket registration, and a private-network deployment boundary. The credential vault now uses an exact configured frontend origin instead of a wildcard CORS policy.

## What Happened

- Added a fail-closed gateway security policy. Production-like startup requires `GATEWAY_HTTP_TOKEN` and `GATEWAY_DEVICE_ENROLLMENT_TOKEN`; tokenless operation is available only with the explicit `GATEWAY_ALLOW_INSECURE_DEV=true` development switch.
- Kept `/health` public and minimal while protecting `/sessions` and `/dispatch-step` with bearer authentication, request-size limits, malformed-input handling, and a fixed-window per-client rate limiter.
- Enforced the device enrollment token during WebSocket registration and kept the existing session manager lifecycle intact.
- Propagated the gateway HTTP token from the execution worker to gateway requests and required it when the worker uses the Laixi device backend.
- Replaced credential-vault wildcard CORS with `CREDENTIAL_VAULT_ALLOWED_ORIGIN`, returning the exact trusted origin and rejecting untrusted origins.
- Added focused gateway, security-policy, worker-client, and vault-origin tests; documented the new environment contract in `.env.example`.

## Verification

| Gate | Result |
|---|---|
| Targeted security tests | PASS — 35/35 |
| Root tests | PASS — 509/509 |
| Gateway source tests | PASS — 8/8 |
| Worker source tests | PASS — 77/77 |
| Typecheck | PASS |
| ESLint | PASS |
| Application, gateway, and worker builds | PASS |
| `git diff --check` | PASS |
| Tester review | PASS |

## Decisions Made

| Decision | Rationale | Impact |
|---|---|---|
| Shared bearer token for internal gateway HTTP calls | Provides a small, deployable trust boundary without changing the public product auth model | Laixi workers must receive `GATEWAY_HTTP_TOKEN` in production-like environments |
| Separate WebSocket enrollment token | Prevents device registration from reusing the service-to-service HTTP credential | Device clients must present `GATEWAY_DEVICE_ENROLLMENT_TOKEN` during registration |
| Explicit insecure-development escape hatch | Keeps local bring-up possible while making accidental production fail-open behavior impossible | Tokenless startup is rejected unless the opt-in flag is exactly enabled |
| Exact vault CORS origin | Wildcard CORS could expose credential responses to unintended browser origins | Deployments must configure the frontend origin explicitly |

## Reflection and Residual Concerns

The boundary is now enforced at the gateway and worker call sites, with deterministic automated coverage. The implementation assumes the gateway is placed on a private network and that any reverse proxy preserves the intended client identity; the current rate limiter keys on the direct socket address and does not trust arbitrary forwarded headers. Live-device, Supabase, and reverse-proxy integration were not run in this phase.

The WebSocket enrollment comparison remains a direct string comparison inside the existing session manager; it is functionally enforced and covered, but could be hardened to use the same timing-safe comparison helper in a later security pass. Origin configuration currently supports one exact frontend origin, so deployments with multiple browser origins need an explicit follow-up design.

## Next Steps

Proceed to Phase 03: close Docker and CI/dependency gaps, including worker vault-token wiring, dependency audit remediation, and production build/verification workflow updates.

Status: DONE_WITH_CONCERNS
Summary: Phase 02 gateway, worker, WebSocket enrollment, and vault-origin boundaries implemented under option A; all targeted and full automated gates pass.
Concerns/Blockers: No live-device/DB/E2E verification yet; reverse-proxy client identity and timing-safe WebSocket token comparison remain follow-up hardening items; a single exact CORS origin is supported by current configuration.
