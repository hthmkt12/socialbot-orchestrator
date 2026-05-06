# OPS-02: Persist Gateway Heartbeat Freshness And Last Device Error

Status: completed
Date: 2026-05-04
Purpose: move device health from inference-only UI logic to persisted gateway-owned fields that the product can read directly

## Decision
- `devices` now stores `heartbeat_freshness`, `last_error_message`, and `last_error_at`.
- The gateway persists device health through Supabase REST using the service-role env already used elsewhere in the platform.
- `last_seen_at` remains the canonical heartbeat timestamp, while `heartbeat_freshness` gives UI and operators a direct persisted state instead of re-deriving everything from timestamps alone.

## What Changed
- Added migration `supabase/migrations/20260504153000_add_device_health_persistence_fields.sql`.
- Extended `src/lib/database.types.ts` with `heartbeat_freshness`, `last_error_message`, and `last_error_at`.
- `packages/shared/src/device-lifecycle.ts` now accepts persisted freshness and last-error overrides so product and platform still go through one shared helper.
- `services/laixi-gateway/src/gateway-device-state-store.ts` now writes device health through Supabase REST upserts keyed by `laixi_device_id`.
- `services/laixi-gateway/src/gateway-session-manager.ts` now persists register, heartbeat, busy, error, and disconnect state through one device-health path and sweeps session freshness on a timer.
- `services/laixi-gateway/src/index.ts` now wires optional Supabase env into the gateway health store and warns when persistence is disabled by missing env.
- `src/hooks/useDevices.ts` now writes `heartbeat_freshness: fresh` during manual browser sync so the fallback path stays coherent with the new schema.
- `src/lib/device-health.ts` and `src/pages/DevicesPage.tsx` now surface persisted last-error information in the device drawer.

## Why This Matters
- UI device state is no longer limited to stale timestamp math; there is now a service-owned persisted freshness field.
- Operators can inspect the latest device error without opening gateway logs first.
- The gateway and product now converge on the same persisted health truth before onboarding and diagnostics work.

## Limits Of This Step
- Runtime persistence depends on `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` being present for `services/laixi-gateway`.
- `BUSY` is still dispatch-window oriented; whole-run lock semantics still belong to later lock and ops work.
- The current onboarding page is still instruction-first and does not actively probe these new health signals yet.

## Acceptance For OPS-02
- Device rows expose persisted freshness and last-error fields.
- Gateway register, heartbeat, failed dispatch, failed step result, and disconnect paths update device health through one service-owned path.
- UI health helpers can consume persisted fields without forking lifecycle logic.
- Existing build and backend smoke gates still pass after the persistence changes.

## Unresolved Questions
- Should the gateway become hard-fail on missing Supabase service-role env, or is the current warning plus disabled persistence acceptable for local protocol-only work?
- Do we want a dedicated operator event or audit record for gateway-level device errors, or is the device-row snapshot enough until OPS-04 diagnostics land?
