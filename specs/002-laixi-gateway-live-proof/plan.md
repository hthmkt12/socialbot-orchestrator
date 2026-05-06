# Implementation Plan: Laixi Gateway Live Proof

**Branch**: `002-laixi-gateway-live-proof`<br>
**Spec**: `specs/002-laixi-gateway-live-proof/spec.md`<br>
**Status**: Draft<br>
**Created**: 2026-05-06

## Summary

Create a reproducible Laixi gateway live-proof gate that decides whether Laixi is required for pilot readiness or should remain future-compatible after the Mobile MCP proof. This first slice is intentionally evidence/documentation focused; implementation code should only be added later if a verification gap is found.

## Technical Context

- Gateway service entrypoint: `services/laixi-gateway/src/index.ts`.
- Gateway endpoints: `GET /health`, `GET /sessions`, `POST /dispatch-step`.
- Gateway device-session manager: `services/laixi-gateway/src/gateway-session-manager.ts`.
- Worker entrypoint and backend selection: `services/execution-worker/src/index.ts`.
- Worker Laixi dispatch client: `services/execution-worker/src/laixi-gateway-client.ts`.
- Worker device-step mapper: `services/execution-worker/src/execute-device-step.ts`.
- Shared gateway protocol: `packages/shared/src/execution-contract.ts`.
- Laixi command builders: `packages/laixi-adapter/src/commands.ts`.
- Existing package scripts: `npm.cmd run dev:gateway`, `npm.cmd run build:gateway`, `npm.cmd run dev:worker`, `npm.cmd run build:worker`, `npm.cmd run smoke:backend`.

## Constitution Check

- **Simplicity**: Reuse existing gateway/worker/protocol paths; no duplicate backend.
- **Surgical Scope**: Prefer proof scripts/docs over runtime changes unless evidence shows a gap.
- **Testability**: Each proof state must produce a report or command output that can be cited.
- **Security**: Do not read or commit `.env`; service-role credentials stay in shell/user env only.
- **Windows Compatibility**: Use `npm.cmd` from PowerShell.

## Project Structure

```text
specs/002-laixi-gateway-live-proof/
  spec.md
  plan.md
  tasks.md

docs/
  backend-capability-matrix.md
  codebase-summary.md
  project-roadmap.md
  project-changelog.md

services/laixi-gateway/src/
  index.ts
  gateway-session-manager.ts

services/execution-worker/src/
  index.ts
  laixi-gateway-client.ts
  execute-device-step.ts
```

## Phase 0: Research & Environment Audit

Goal: determine whether a real Laixi-compatible device session is available.

Planned checks:
- `npm.cmd run build:gateway`
- `npm.cmd run build:worker`
- Start or attach to gateway runtime if available.
- `GET http://127.0.0.1:8080/health`
- `GET http://127.0.0.1:8080/sessions`
- `GET http://127.0.0.1:4310/health` with `DEVICE_BACKEND=laixi` when worker runtime is available.

Exit outcomes:
- **Clean-path available**: at least one live Laixi session exists.
- **Blocked clean-path**: gateway works but no external Laixi session exists.
- **Runtime blocked**: gateway/worker cannot start or required env is unavailable.

## Phase 1: Proof Harness Decision

Goal: choose the smallest evidence path.

Preferred path:
- Use existing worker queue/run path and a real device row whose `laixi_device_id` matches the connected Laixi session.

Fallback path:
- Add a narrowly scoped proof script only if existing scripts cannot capture health/session/run evidence reproducibly.

Non-goals:
- No new backend abstraction.
- No Laixi protocol redesign.
- No object-storage changes.
- No Mobile MCP behavior changes.

## Phase 2: Clean-Path Evidence

Goal: capture a Laixi-backed completed run.

Required evidence:
- Gateway health JSON.
- Gateway sessions JSON showing connected device.
- Worker health JSON showing `deviceBackend: "laixi"`.
- Supabase run report showing final status, step counts, artifact counts, and screenshot count.
- Run evidence UI/manual smoke only if authenticated UI and artifact-bearing run are available.

## Phase 3: Failure-Path Evidence

Goal: prove offline/missing/stale sessions fail clearly.

Required evidence:
- A missing/offline/stale session attempt that returns an expected gateway/worker error outcome, such as `device_offline`, `timed_out`, or `dispatch_failed`.
- A report file or captured command output with the observed status.

## Phase 4: Docs & Decision Sync

Goal: update project truth.

Docs to update:
- `docs/backend-capability-matrix.md`: Laixi proof result and pilot decision.
- `docs/codebase-summary.md`: current product state and risks.
- `docs/project-roadmap.md`: completed/current/next state.
- `docs/project-changelog.md`: evidence summary.

Decision states:
- `pilot-required`: Laixi proof passed and product needs Laixi for pilot.
- `future-only`: Mobile MCP remains pilot default; Laixi proof is not pilot-blocking.
- `blocked`: Laixi clean path cannot be proven due missing external device/gateway availability.

## Validation Gates

- `npm.cmd run build:gateway`
- `npm.cmd run build:worker`
- `npm.cmd test`
- `npm.cmd run typecheck`
- `npm.cmd run lint`
- `npm.cmd run build`
- Gateway health/session checks when runtime is available.
- Worker health check with `DEVICE_BACKEND=laixi` when runtime is available.
- Live clean-path and failure-path evidence, or explicit blocked report if external Laixi session is unavailable.

## Risks

- A real Laixi-compatible device session may not be available in the current workstation.
- Existing scripts are Mobile MCP-focused; a small Laixi proof script may be needed later.
- Supabase service-role env is required for worker-backed run proof but must not be committed or printed.
- Stale Mobile MCP evidence must not be reused as Laixi evidence.

## Open Questions

- Is a real Laixi device/session available now, or should this feature first produce a blocked-readiness report?
- Which device row should be mapped to the Laixi session if clean-path proof is available?
- Does the pilot business decision require Laixi, or is a passing proof only a compatibility milestone?
