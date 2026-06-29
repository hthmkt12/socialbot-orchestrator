# Phase 1: Shared State Audit Report

## 1. Execution Engine Pull Mechanism
Currently, the Execution Engine **does not use BullMQ**. It uses a custom polling mechanism built directly on top of Supabase tables.
- **File:** `services/execution-worker/src/run-claim-coordinator.ts`
- **Method:** Polling `workflow_runs` table where `status = 'QUEUED'`.
- **Locking:** It sets `execution_owner`, `execution_claim_token`, and `execution_lease_expires_at` to claim a run.
- **Issue:** Currently, any worker can pick up any run. There is no routing by `deviceId`. 

## 2. Shared DB Mutations
- **Workflow Runs:** `updateRunSummary` and general updates (`status`, `finished_at`, `summary_json`) in `worker-run-store.ts`.
- **Run Steps:** `persistRunStep` in `worker-step-store.ts` inserts or updates rows in `run_steps`.
- **Artifacts & Logs:** `createArtifactRecord` in `worker-run-store.ts`.
- **Device Locks:** `worker-device-locks.ts` uses `device_locks` table to prevent multiple runs from using the same device concurrently.
- **Account Action History:** `single-device-step-runner.ts` inserts into `account_action_history` and updates `accounts` table.

## 3. Worker-per-Device Redesign (Revised)
Because we are NOT using BullMQ, the "Worker-per-Device" topology needs to be adapted for the Supabase poller:
- Instead of binding to a BullMQ queue, the `RunClaimCoordinator` must be modified to accept a specific `DEVICE_ID` filter.
- However, macros can be `MULTI_DEVICE` or `ALL_DEVICES` or target a `DEVICE_GROUP`.
- **Architectural Conflict:** If a worker binds to a single `DEVICE_ID`, it cannot easily coordinate a `MULTI_DEVICE` run. 
- **Recommendation:** Keep the global poller, but instead of blocking the main Node event loop to run steps, the main worker should act as a lightweight **Dispatcher** that spawns or sends IPC messages to child processes (one per device). 
- Alternatively, if we stick to Worker-per-Device, the poller needs to query `workflow_runs` by joining `run_steps` or checking the `target_selector_json`, which is complex.

## 4. Immediate Safety Concerns
- The `single-device-step-runner.ts` updates `accounts.current_action_count` concurrently:
  ```typescript
  await this.params.supabase
    .from('accounts')
    .update({ current_action_count: (account.current_action_count || 0) + 1 })
    .eq('id', accountId);
  ```
  **RACE CONDITION DETECTED:** This is a classic read-modify-write race condition. If two devices use the same account (or update rapidly), counts will be lost. It needs an RPC (stored procedure) for atomic increment.

## Conclusion
The original assumption of using BullMQ was incorrect. The system uses a custom Supabase poller (`RunClaimCoordinator`). To implement "Fleet Speed", we must either:
1. Make the `RunClaimCoordinator` spawn isolated `single-device-run-executor` loops in child processes/Worker Threads.
2. Refactor the custom poller to natively support multi-processing (e.g., using Node's `worker_threads`).
