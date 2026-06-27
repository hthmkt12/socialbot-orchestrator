# Phase 9: Laixi Clean-path Proof

## Context
Currently, the primary device execution path relies on the `mobile-mcp-bridge` (which we upgraded to use `mobilerun` internally in Phase 1-3). The roadmap specifies an unresolved requirement to implement a "Laixi Clean-path Proof". Laixi provides a separate cloud-based orchestration and device farm service. We need to build out the `laixi-step-backend.ts` to actually send execution requests to Laixi's endpoints, providing a true alternative backend for execution when `DEVICE_BACKEND=laixi` is configured.

## Goals
1. Flesh out the `laixi-step-backend.ts` which currently just throws "Not implemented" for most commands.
2. Implement standard commands (`launch_app`, `tap`, `swipe`, `input_text`) mapping to the Laixi Gateway API format.
3. Validate connection and fallback logic for `DEVICE_BACKEND=laixi`.
4. Ensure the `RunClaimCoordinator` successfully passes operations down to the Laixi backend cleanly.

## Files to Modify
| File | Action |
|------|--------|
| `services/execution-worker/src/laixi-step-backend.ts` | Implement `executeStep` mappings to the Laixi format. |
| `services/execution-worker/src/laixi-gateway-client.ts` | Ensure the underlying API wrapper exists and can POST to Laixi endpoints. |
| `docs/project-roadmap.md` | Move Laixi Clean-path to completed/active status. |

## Approach
1. **API Client**: Define the interface for the Laixi cloud endpoints (e.g. `/api/v1/devices/{device_id}/command`).
2. **Step Mapping**: Convert our internal `MacroStep` objects into the payload format expected by Laixi.
3. **Execution Backend**: Update `LaixiStepBackend` to call the `laixi-gateway-client.ts` methods instead of throwing.

## Verification
- Start the worker with `DEVICE_BACKEND=laixi`.
- Dispatch a basic run (e.g. a `tap` and a `wait`).
- Since we likely do not have real Laixi VIP API credentials yet, verify the worker correctly attempts to POST the correctly-formatted payload to the Laixi URL and handles the standard `401 Unauthorized` or `404 Not Found` response gracefully, rather than crashing or throwing "Not implemented".
