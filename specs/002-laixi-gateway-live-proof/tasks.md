# Tasks: Laixi Gateway Live Proof

**Input**: `specs/002-laixi-gateway-live-proof/spec.md` and `plan.md`<br>
**Branch**: `002-laixi-gateway-live-proof`<br>
**Status**: Blocked / Future-only

## Phase 1: Setup & Baseline

- [x] T001 Confirm repo is on `002-laixi-gateway-live-proof` with a clean starting status.
- [x] T002 Run `npm.cmd run build:gateway` and record result.
- [x] T003 Run `npm.cmd run build:worker` and record result.
- [ ] T004 Run `npm.cmd test`, `npm.cmd run typecheck`, `npm.cmd run lint`, and `npm.cmd run build` as the static baseline.

## Phase 2: Gateway Runtime Evidence

- [x] T005 Start or attach to Laixi gateway runtime on `http://127.0.0.1:8080` without reading or printing `.env` secrets.
- [x] T006 Capture `GET /health` evidence, including service status, protocol version, connected-device count, pending dispatch count, persistence flag, and sessions snapshot.
- [x] T007 Capture `GET /sessions` evidence and classify state as connected, zero-session, stale-session, or runtime-blocked.

Evidence: gateway health returned status `200` with protocol `1`, zero connected devices, zero pending dispatches, persistence disabled, and empty sessions. Gateway sessions returned status `200` with `devices: []`. State classified as zero-session due missing external Laixi VIP/API/session availability.

## Phase 3: Worker Backend Evidence

- [ ] T008 Start or attach to the execution worker with `DEVICE_BACKEND=laixi`. Blocked in current shell because `SUPABASE_URL` is unavailable.
- [ ] T009 Capture worker `GET /health` evidence showing `deviceBackend: "laixi"`, `gatewayBaseUrl`, protocol version, command timeout, lease settings, and claim state.
- [ ] T010 Verify the worker is not accidentally running in Mobile MCP mode before any Laixi proof run.

## Phase 4: Clean-Path Proof

- [ ] T011 Confirm a live Laixi device session exists and identify the matching `devices.laixi_device_id` row without exposing secrets. Blocked until Laixi VIP/API access is available.
- [ ] T012 Execute a minimal Laixi-backed run with `launch_app`, `screenshot`, and `get_current_app`. Blocked until T011 is unblocked.
- [ ] T013 Capture Supabase evidence for final run status, successful step count, failed step count, artifact count, screenshot count, and current-app output. Blocked until T012 is unblocked.
- [ ] T014 If authenticated UI is available, manually smoke the run detail evidence view for the Laixi proof run. Blocked until T012 is unblocked.

## Phase 5: Failure-Path Proof

- [ ] T015 Execute or simulate the expected missing/offline/stale Laixi session path through the existing gateway/worker flow.
- [ ] T016 Record the observed error outcome, such as `device_offline`, `timed_out`, or `dispatch_failed`, and verify it is clear to operators.

## Phase 6: Decision Sync

- [x] T017 Update `docs/backend-capability-matrix.md` with Laixi proof result and pilot backend decision.
- [x] T018 Update `docs/codebase-summary.md`, `docs/project-roadmap.md`, and `docs/project-changelog.md` with current truth.
- [x] T019 If clean-path proof is blocked by no external Laixi session, mark the feature outcome as blocked/future-only rather than complete-ready.

## Phase 7: Final Verification

- [ ] T020 Run `npm.cmd run build:gateway` and `npm.cmd run build:worker` after any script/doc changes.
- [ ] T021 Run `npm.cmd test`, `npm.cmd run typecheck`, `npm.cmd run lint`, and `npm.cmd run build` after any app/doc changes that affect checked files.
- [ ] T022 Review reports/docs for stale Mobile MCP evidence being mislabeled as Laixi evidence.
- [ ] T023 Commit only intended spec/report/doc changes after forbidden-path and sensitive-value checks pass.

## Dependencies

- T005 depends on T002.
- T008 depends on T003.
- T011-T014 depend on T006-T010 and require a real Laixi-compatible device session.
- T015-T016 can run without a clean-path session if the gateway and worker are available.
- T017-T019 depend on the evidence outcome.

## Notes

- Do not claim Laixi pilot readiness from Mobile MCP evidence.
- Do not commit `.env`, smoke credentials, service-role keys, runtime screenshots, or generated report files unless explicitly approved.
- A blocked clean path is a valid feature outcome if it is documented with current runtime evidence.
