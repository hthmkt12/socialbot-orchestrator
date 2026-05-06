# Feature Specification: Laixi Gateway Live Proof

**Feature Branch**: `002-laixi-gateway-live-proof`<br>
**Created**: 2026-05-06<br>
**Status**: Blocked by external Laixi VIP/API availability<br>
**Input**: User direction: "prepare the next best feature after Mobile MCP proof"

## User Scenarios & Testing _(mandatory)_

### Primary User Story

As a pilot decision maker, I need a clear Laixi gateway live-proof gate so the team can decide whether Laixi is required for the pilot or remains a future-compatible backend after the Mobile MCP proof.

### Acceptance Scenarios

1. **Given** the Laixi gateway service is running, **When** an operator opens the gateway health endpoint, **Then** the response shows service status, protocol version, connected-device count, pending dispatch count, and whether device-state persistence is enabled.
2. **Given** a Laixi device session is connected to the gateway, **When** an operator opens the sessions endpoint, **Then** the device appears with identity, protocol version, heartbeat freshness, pending dispatch count, and any last error state.
3. **Given** the execution worker is configured for the Laixi backend, **When** a small live proof run executes against the connected device, **Then** the worker records a completed run with successful `launch_app`, `screenshot`, and `get_current_app` evidence.
4. **Given** no matching Laixi device session exists or heartbeat freshness is stale, **When** the proof attempts dispatch, **Then** the failure is captured as an expected failure-path result instead of being treated as a product-ready success.
5. **Given** the proof completes, **When** maintainers review project docs, **Then** the backend capability matrix and roadmap state whether Laixi is pilot-required, future-only, or still blocked with explicit evidence.

### Edge Cases

- Gateway is healthy but has zero connected device sessions.
- Device session exists but heartbeat freshness is stale.
- Dispatch reaches the gateway but the device reports a step-level error.
- Dispatch times out before a `step_result` message arrives.
- Screenshot command succeeds but artifact payload is missing or cannot be previewed.
- Worker is accidentally still configured for `DEVICE_BACKEND=mobile-mcp` during a Laixi proof.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The proof MUST verify `services/laixi-gateway` health through `GET /health` before any run is claimed as live evidence.
- **FR-002**: The proof MUST verify at least one active Laixi device session through `GET /sessions` before attempting a clean-path dispatch.
- **FR-003**: The proof MUST verify the execution worker reports `deviceBackend: "laixi"` through worker health before claiming a Laixi-backed run.
- **FR-004**: The clean-path proof MUST execute a minimal live workflow that includes `launch_app`, `screenshot`, and `get_current_app` against a Laixi device identity stored in `devices.laixi_device_id`.
- **FR-005**: The proof MUST capture run-level and step-level evidence from Supabase after execution, including final run status, successful step count, failed step count, artifact count, and screenshot count.
- **FR-006**: The proof MUST include one expected failure path for missing/offline/stale Laixi device sessions and record the observed gateway or worker error outcome.
- **FR-007**: The proof MUST update `docs/backend-capability-matrix.md` with the Laixi proof result and the pilot-backend decision.
- **FR-008**: The proof MUST update roadmap/changelog docs so future work does not confuse Mobile MCP OPS-08 closure with Laixi live-proof closure.
- **FR-009**: The proof MUST avoid introducing a new backend or duplicate execution path; it should exercise the existing gateway, worker, shared protocol, and artifact flow.
- **FR-010**: The proof MUST make any remaining blocker explicit rather than marking Laixi ready from stale or simulated evidence.

### Key Entities

- **Laixi Gateway Health Snapshot**: The `GET /health` response from `services/laixi-gateway`, including service status, protocol version, connected devices, pending dispatches, persistence flag, and session snapshots.
- **Laixi Device Session**: A WebSocket-backed device registration tracked by the gateway with device ID, device name, heartbeat timestamps, protocol version, pending dispatch count, and lifecycle/freshness fields.
- **Laixi Proof Run**: A backend-claimed workflow run executed by the worker with `DEVICE_BACKEND=laixi`, using an existing device row whose `laixi_device_id` matches the live Laixi session device ID.
- **Failure-Path Evidence**: A recorded proof attempt where the expected missing/offline/stale device condition produces a clear gateway or worker error outcome.
- **Pilot Backend Decision**: The resulting documented decision: Laixi required for pilot, Laixi future-only, or Laixi blocked pending external device/gateway availability.

### Assumptions

- Mobile MCP proof is already closed and remains the current pilot validation baseline.
- Laixi proof is a separate decision gate; passing Mobile MCP evidence does not automatically prove Laixi readiness.
- The existing gateway exposes `GET /health`, `GET /sessions`, and `POST /dispatch-step`.
- The existing worker defaults to Laixi unless `DEVICE_BACKEND=mobile-mcp` is set.
- Real clean-path proof requires an external Laixi-compatible device session connected over WebSocket; if that is unavailable, only health and expected failure-path evidence can be captured.

## Current Outcome

- Gateway service health was proven locally: `GET http://127.0.0.1:8080/health` returned status `200` with `service: "laixi-gateway"`, `status: "ok"`, `protocolVersion: "1"`, `connectedDevices: 0`, `pendingDispatches: 0`, and `sessions: []`.
- Gateway sessions were proven empty: `GET http://127.0.0.1:8080/sessions` returned status `200` with `devices: []`.
- Clean-path dispatch is blocked because the operator does not currently have Laixi VIP/API access, so no Laixi-compatible device session can connect to the gateway.
- Worker-backed full proof is also blocked in the current shell because `SUPABASE_URL` is not available in process/user/machine env, while `SUPABASE_SERVICE_ROLE_KEY` is present.
- Pilot decision: Mobile MCP remains the current pilot-default backend; Laixi remains future-compatible until VIP/API access and a live Laixi session are available.

---

## Review & Acceptance Checklist

### Content Quality

- [x] No implementation details beyond existing endpoint/contract names needed for testability
- [x] Focused on pilot decision value
- [x] Written for mixed product/engineering stakeholders
- [x] All mandatory sections completed

### Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Scope is clearly bounded
- [x] Dependencies and assumptions identified

---

## Execution Status

- [x] User direction parsed
- [x] Key concepts extracted from current docs and gateway/worker code
- [x] Ambiguities resolved through current pilot docs
- [x] User scenarios defined
- [x] Requirements generated
- [x] Entities identified
- [x] Review checklist passed
- [x] Current blocked/future-only outcome recorded
