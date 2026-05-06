# EXE-03: Shared Execution Contract

Status: completed
Date: 2026-05-04
Purpose: make command payloads, gateway messages, and step-result shapes come from one source of truth

## Decision
- Add `packages/shared/src/execution-contract.ts` as the canonical contract module.
- Add `packages/laixi-adapter/src/commands.ts` as the shared command-builder layer on top of that contract.
- Point frontend adapter code and backend service skeletons at these shared sources.

## What Was Standardized
- Gateway protocol version constant
- Laixi command request shape
- Laixi command response shape
- Device registration and heartbeat messages
- Gateway ack and error messages
- Future-facing step dispatch and step result message shapes
- Shared artifact and step-result payload structure

## Code Changes
- Shared contract:
  - `packages/shared/src/execution-contract.ts`
  - `packages/shared/src/index.ts`
- Shared Laixi command builders:
  - `packages/laixi-adapter/src/commands.ts`
  - `packages/laixi-adapter/src/index.ts`
- Frontend adapter now reuses shared sources:
  - `src/adapters/laixi/types.ts`
  - `src/adapters/laixi/commands.ts`
- Service skeletons now reference the shared protocol source:
  - `services/execution-worker/src/index.ts`
  - `services/laixi-gateway/src/index.ts`

## Why This Matters
- The repo already had `packages/*` path intent in `tsconfig.app.json` but no concrete implementation.
- This step turns that intent into real source files.
- Command and protocol drift now has a single place to fix before execution logic deepens.

## Limits Of This Step
- The worker still does not claim or execute runs.
- Gateway does not yet dispatch step commands to devices.
- Shared contracts exist, but no end-to-end validation suite enforces them yet.
- Root Vite app still uses relative imports into `packages/` rather than finalized package alias wiring.

## Acceptance For EXE-03
- One shared module defines command payloads, gateway message version, and step-result payload shape.
- Frontend Laixi adapter stops owning command definitions by itself.
- Worker and gateway skeletons both read from the same protocol source.
- EXE-04 and later tasks can build on stable message shapes instead of re-inventing payloads.

## Unresolved Questions
- Do we want to formalize package alias resolution in Vite next, or wait until package volume increases?
- Should gateway step dispatch shape stay device-centric, or be split into worker-to-gateway and gateway-to-device contracts later?
- Should run summary payload also move into `packages/shared` during EXE-04 or EXE-05?
