# EXE-02: Runtime And Service Boundary

Status: completed
Date: 2026-05-04
Purpose: choose the backend runtime, service layout, and local bootstrap commands for durable execution work

## Decision
- Choose Node 20 + TypeScript for both backend services.
- Keep services colocated inside this repo under `services/`.
- Split responsibilities into two services:
  - `services/execution-worker`
  - `services/laixi-gateway`
- Keep the existing Vite app as frontend only.

## Why This Choice
- The repo is already TypeScript-first and already depends on Supabase JS.
- Node 20 aligns with the existing Docker base image and README prerequisite.
- Colocation reduces coordination cost while architecture is still moving quickly.
- Separate services make ownership boundaries explicit before deeper implementation.

## Chosen Folder Layout
- `services/execution-worker`
  - owns run claiming, state transitions, retries, approvals, finalization
- `services/laixi-gateway`
  - owns device sessions, heartbeat intake, and device-facing protocol transport

## Local Start Commands
- Frontend:
  - `npm run dev`
- Execution worker:
  - `npm run dev:worker`
- Gateway:
  - `npm run dev:gateway`

## Local Config Story
- Worker env:
  - `WORKER_PORT`
  - `RUN_POLL_INTERVAL_MS`
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `GATEWAY_BASE_URL`
- Gateway env:
  - `GATEWAY_PORT`
  - `GATEWAY_PROTOCOL_VERSION`
- Current bootstrap assumes per-service install via each service package until workspace unification is chosen later.

## Service Boundary Rules
- Frontend:
  - may create runs
  - may request cancellation
  - may render state and evidence
  - must not execute workflow steps
- Execution worker:
  - only run owner
  - claims runnable work
  - updates `workflow_runs` and `run_steps`
  - consumes approval outcomes
  - releases locks and finalizes runs
- Gateway:
  - accepts device registration and heartbeat
  - tracks active sessions
  - later dispatches device commands on behalf of worker
  - must not finalize run outcomes

## Bootstrap Added In This Step
- Root scripts for `dev:worker`, `build:worker`, `dev:gateway`, `build:gateway`
- Minimal worker health server and claim-loop placeholder
- Minimal gateway health server and WebSocket registration/heartbeat skeleton

## What This Step Does Not Solve Yet
- No durable run claim logic yet
- No shared contract extraction yet
- No worker-to-gateway command dispatch yet
- No artifact upload path yet
- No docker wiring for new services yet

## Acceptance For EXE-02
- Runtime choice is explicit and written down.
- Service ownership split is explicit.
- Folder layout and start commands are committed.
- Minimal bootstrap exists so EXE-03 and EXE-04 can build on real files instead of abstract notes.

## Unresolved Questions
- Should the repo later migrate to npm workspaces, or keep per-service package boundaries?
- Will the worker talk to the gateway over HTTP, WebSocket, or shared queue plus callback protocol?
- Should the gateway normalize both current Laixi-style commands and the AutoJS-facing protocol, or should that translation live elsewhere?
