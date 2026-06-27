# Phase 8: Parallelize Execution (Fleet Speed)

## Context
Currently, the execution worker processes multi-device targets sequentially. If a user targets a group of 50 devices, the worker claims the run and executes the macro on Device 1, then Device 2, and so on. This limits the platform's ability to act as a fast fleet automation tool. We need to implement parallelized execution so a single `workflow_run` dispatched to multiple devices executes concurrently.

## Goals
1. Modify the `ExecutionWorker` and `RunClaimCoordinator` to support parallel device execution.
2. Refactor `orchestrateRun` to spawn concurrent step runners for each device in the target group rather than iterating sequentially.
3. Ensure state updates (step records, artifacts, run status) are thread-safe and handle race conditions cleanly.
4. Prevent database connection pool exhaustion when blasting large queries from 50+ concurrent loops.

## Approach
- **Current Behavior:** `orchestrateRun` in `execution-worker.ts` iterates over `run.device_ids` sequentially via a `for...of` loop.
- **New Behavior:** `orchestrateRun` will `Promise.allSettled` over the device list, spawning isolated execution tracks. 
- **Safety limit:** Introduce a concurrency limit (e.g., `p-limit` or simple chunking) to prevent a massive group (e.g., 500 devices) from OOMing the Node worker or exhausting Supabase DB connections. We'll set the default `MAX_CONCURRENT_DEVICES_PER_RUN = 10`.

## Files to Modify
| File | Action |
|------|--------|
| `services/execution-worker/src/execution-worker.ts` | Refactor `orchestrateRun` to use chunked `Promise.all` |
| `services/execution-worker/src/worker-run-store.ts` | Ensure `updateRunStatus` gracefully handles overlapping completions (e.g. `COMPLETED` vs `FAILED`) |
| `docs/project-roadmap.md` | Move Phase 8 out of "Later" to active roadmap |

## Verification
- Start the worker.
- Dispatch a `run` targeting a group of 3 devices (e.g., mock devices).
- Check the console logs: the worker should log "Executing step X on device 1", "Executing step X on device 2" interleaved, rather than strictly sequential.
- Confirm `workflow_runs` table successfully transitions to `COMPLETED` when all promises resolve.
