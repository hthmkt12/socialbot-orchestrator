# OPS-01: Device Lifecycle And Freshness Thresholds

Status: completed
Date: 2026-05-04
Purpose: stop treating raw `device.status` as the full truth and give product plus platform one shared lifecycle policy for heartbeat freshness

## Decision
- Canonical device lifecycle now lives in `packages/shared/src/device-lifecycle.ts`.
- Expected gateway heartbeat interval is `15s`.
- A device heartbeat becomes `stale` after `45s` and is treated as `offline` after `120s`.
- `OFFLINE` still wins immediately when the raw device status is already offline, but `ONLINE`, `BUSY`, and `ERROR` now age into stale/offline through the same helper.

## What Changed
- Added `packages/shared/src/device-lifecycle.ts` and exported it through `packages/shared/src/index.ts`.
- Extended `packages/shared/src/execution-contract.ts` so gateway session snapshots can expose derived status and freshness fields.
- `services/laixi-gateway/src/gateway-session-manager.ts` now derives session `status`, `freshness`, heartbeat age, and stale flag from the shared helper instead of exposing heartbeat timestamps alone.
- Added `src/lib/device-health.ts` as the UI-side presentation adapter for badge variants, labels, and operator-facing freshness copy.
- `src/pages/DevicesPage.tsx` now filters, counts, badges, and detail text from the shared lifecycle policy instead of raw DB status only.
- `src/components/runs/RunWizard.tsx` now uses the shared lifecycle policy for target counts, dispatch eligibility, stale-device warnings, and review chips.
- `src/pages/DemoPage.tsx` now picks runnable devices through the same policy and warns when the selected live target only has a stale heartbeat.

## Why This Matters
- The product no longer treats an old `last_seen_at` as silently equivalent to a healthy online device.
- Gateway health endpoints and UI surfaces now describe device freshness with the same thresholds, which reduces policy drift before OPS-02 persistence work.
- Operators can see stale-heartbeat risk before a run instead of learning only from dispatch failure.

## Limits Of This Step
- Freshness is still derived from existing `last_seen_at`; the gateway does not persist heartbeat updates into device rows yet.
- UI surfaces can now mark devices stale or offline more honestly, but live truth still depends on OPS-02 writing gateway heartbeat state back to Supabase.
- The setup page is still instruction-first; onboarding verification remains a later task.

## Acceptance For OPS-01
- One shared helper defines `ONLINE`, `OFFLINE`, `BUSY`, `ERROR`, heartbeat stale, and heartbeat offline thresholds.
- Product-facing device surfaces consume the shared helper instead of hand-rolled status checks.
- Gateway session snapshots expose freshness semantics through the same helper.
- Run-target selection no longer relies on raw `device.status === 'ONLINE'` alone.

## Unresolved Questions
- Should stale-but-not-offline devices remain runnable through pilot, or should OPS-02 tighten dispatch eligibility once persisted gateway freshness is available?
- Do we want the setup page copy to expose exact thresholds, or wait until the onboarding verification flow replaces the current instruction-only page?
