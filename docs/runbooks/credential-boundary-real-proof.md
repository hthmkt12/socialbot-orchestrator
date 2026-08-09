# Credential Boundary Real Proof Operator Runbook

## Purpose

This runbook guides an operator through preparing and executing a controlled credential boundary runtime proof. It covers readiness checks, service startup, the two explicit opt-ins required for destructive remote execution, expected outcomes, cleanup verification, and incident handling.

**Status:** `full_verified` for the controlled proof scope. Real proof executed successfully on 2026-07-17.

## Safety Rules

- Never print, log, or persist tokens, passwords, canary values, plaintext, ciphertext, or raw request bodies.
- Reports contain only IDs, counts, statuses, hashes, prefixes, timestamps, and safe failure categories.
- A blocked verdict is never a success. Do not present `blocked` as `full_verified`.
- Do not use a real customer credential. Use a disposable canary password supplied at runtime only.
- Do not commit secrets, `.env` files with real values, or proof logs.

## Readiness Check (No Mutation)

Run the readiness check to see every missing prerequisite without secrets:

```bash
node scripts/run-credential-boundary-proof.mjs
```

Output is a JSON object with:
- `readiness.ready`: `true` only if all core env vars are set
- `readiness.missing`: list of env var names that are not set (labels only, never values)
- `readiness.present`: list of env var names that are set (labels only)
- `preflight.failures`: specific failure categories (e.g., `SUPABASE_URL not set`)
- `verdict`: `blocked` when opt-in is missing
- `realProofExecuted`: always `false` without opt-in

No database writes, no process spawning, no device commands occur in this mode.

### Deterministic Audit Command

For a deterministic readiness audit that generates a timestamped report:

```bash
npm.cmd run audit:credential-boundary
npm.cmd run audit:credential-boundary -- --write-report
```

The audit script:
- Spawns the readiness command with `CREDENTIAL_BOUNDARY_ALLOW_REAL_PROOF` explicitly suppressed
- Records the readiness verdict separately from the current static verifier verdict, derived by a no-write static verifier subprocess
- Performs bridge/worker health checks only when their URLs are explicitly configured
- With `--write-report`, writes a timestamped JSON report to `plans/260710-credential-boundary-remediation/reports/`
- Never overwrites an existing report file
- Output contains only labels, booleans, status categories, timestamps, and exit codes

## Required Runtime-Only Variables

All variables must be set in the process environment or `.env` (loaded by the orchestrator). Never commit real values to `.env`.

### Core (required for any real proof attempt)

| Variable | Description |
|----------|-------------|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key for DB access and vault decrypt |
| `CREDENTIAL_BOUNDARY_SERVICE_ROLE_KEY` | Dedicated service-role key used by the vault decrypt boundary; set this during key rotation |
| `SUPABASE_ANON_KEY` | Anon key for Edge Function auth |
| `CREDENTIAL_VAULT_WORKER_TOKEN` | Internal worker token for vault decrypt authorization |
| `PROOF_OPERATOR_JWT` | Short-lived OPERATOR or ADMIN JWT for encrypt action |
| `CREDENTIAL_BOUNDARY_CANARY` | Disposable password/canary (process env only, never in source) |
| `MOBILE_MCP_BRIDGE_URL` | Mobile MCP bridge URL (e.g., `http://127.0.0.1:4321`) |
| `MOBILE_MCP_BRIDGE_TOKEN` | Bridge authentication token |
| `WORKER_BASE_URL` | Execution worker URL (e.g., `http://127.0.0.1:4310`) |

### Existing Service Log Directories (required when services are already running)

When the worker or bridge is already healthy (not started by the orchestrator), the operator must provide independently captured log directories so the proof can scan them for canary leakage. A real proof is not permitted with missing log evidence.

| Variable | Description |
|----------|-------------|
| `CREDENTIAL_BOUNDARY_EXISTING_WORKER_LOG_DIR` | Absolute path to the running worker's stdout/stderr log directory |
| `CREDENTIAL_BOUNDARY_EXISTING_BRIDGE_LOG_DIR` | Absolute path to the running bridge's stdout/stderr log directory |

These directories must:
- Be writable by the orchestrator process
- Be covered by `.gitignore` (the `logs/` pattern already covers them if placed under `logs/`)
- Contain the actual log files from the running services

If the orchestrator starts the services itself, it creates unique log directories under `logs/credential-boundary-proof-<timestamp>/` and does not require these variables.

## Service Startup and Health Checks

### Option A: Orchestrator starts services

If the bridge and worker are not already running, the orchestrator starts them and redirects their output to unique proof log directories. The operator does not need to set `CREDENTIAL_BOUNDARY_EXISTING_*_LOG_DIR`.

### Option B: Services already running

If the bridge and worker are already healthy, the orchestrator does not start new processes. The operator must provide:

```powershell
$env:CREDENTIAL_BOUNDARY_EXISTING_WORKER_LOG_DIR = "F:\path\to\worker\logs"
$env:CREDENTIAL_BOUNDARY_EXISTING_BRIDGE_LOG_DIR = "F:\path\to\bridge\logs"
```

For Bash-compatible shells:

```bash
export CREDENTIAL_BOUNDARY_EXISTING_WORKER_LOG_DIR=/path/to/worker/logs
export CREDENTIAL_BOUNDARY_EXISTING_BRIDGE_LOG_DIR=/path/to/bridge/logs
```

The orchestrator throws `existing_worker_log_dir_required` or `existing_bridge_log_dir_required` if these are missing when services are already healthy. This is by design: a real proof without log evidence is not permitted.

### Health check endpoints

- Bridge: `GET <MOBILE_MCP_BRIDGE_URL>/health`
- Worker: `GET <WORKER_BASE_URL>/health`

The orchestrator checks these before proceeding.

## Two Explicit Opt-Ins for Real Proof

Both must be present simultaneously. Neither alone is sufficient.

1. **CLI flag:** `--run-real-proof`
2. **Environment variable:** `CREDENTIAL_BOUNDARY_ALLOW_REAL_PROOF=true`

```powershell
$env:CREDENTIAL_BOUNDARY_ALLOW_REAL_PROOF = "true"
node scripts/run-credential-boundary-proof.mjs --run-real-proof
```

For Bash-compatible shells:

```bash
CREDENTIAL_BOUNDARY_ALLOW_REAL_PROOF=true node scripts/run-credential-boundary-proof.mjs --run-real-proof
```

Without both opt-ins, the orchestrator runs readiness only and returns `blocked`.

## Expected Outcomes

### Blocked (no mutation)

- Missing opt-in(s): `verdict: "blocked"`, `reason: "opt-in required"`
- Missing prerequisites: `verdict: "blocked"`, `reason: "preflight_failed"`
- No database writes, no process spawning, no device commands

### Full Verified (only if all gates pass)

- All static gates pass (lint, typecheck, test, build, build:worker, crypto, redaction, canary scan, edge function logging)
- Auth matrix passes (all negative cases rejected, valid bound decrypt succeeds)
- Login run completes through `{{accountPassword}}` worker -> vault -> bridge path
- Persistence scan clean (database, artifact metadata, artifact objects, worker logs, bridge logs, reports)
- Captured logs clean (no canary in stdout/stderr)
- Temp logs deleted
- Cleanup verified (disposable account, run, artifacts, macro version deleted)

If any gate fails, the verdict is `blocked` or `failed`, never `full_verified`.

## Cleanup Verification

The harness deletes all disposable records after evidence capture:
- `run_steps` for the proof run
- `artifacts` for the proof run
- `workflow_runs` for the proof run
- `account_action_history` for the disposable account
- `accounts` for the disposable account
- `macro_versions` for the disposable macro

The manifest reports `cleanup.verified: true` only if all deletions succeed and the records no longer exist in the database.

The orchestrator scans proof log directories for the canary before deleting them. If the canary is found, `logsClean: false` and the verdict cannot be `full_verified`.

## Incident Handling

### Proof fails (verdict: blocked or failed)

1. Check the JSON output for `reason` and `preflight.failures`
2. Do not retry without addressing the root cause
3. Verify no disposable records remain in the database:
   ```sql
   SELECT * FROM accounts WHERE username LIKE 'proof-disposable-%';
   SELECT * FROM workflow_runs WHERE execution_owner = 'proof-harness';
   ```
4. If records remain, delete them manually (they contain no real credentials)
5. Check proof log directories under `logs/credential-boundary-proof-*` for canary leakage
6. If canary is found in logs, investigate the source before retrying

### Orchestrator crashes

1. The orchestrator cleans up only processes it started (tracked via `startedProcesses`)
2. Already-running services are not stopped
3. Check for orphaned disposable records (see SQL above)
4. Check for orphaned proof log directories

### Canary found in captured logs

1. The orchestrator sets `logsClean: false`
2. The verdict cannot be `full_verified`
3. Investigate which process emitted the canary
4. Check Edge Function logging, bridge `_handle_input_text`, and worker redaction
5. Do not retry until the leak source is fixed

### Service fails to start

1. The orchestrator reports `serviceError: "bridge_unhealthy"` or `"worker_unhealthy"`
2. Check service logs in the proof log directory
3. Verify env vars are correct (without printing their values)
4. Retry after fixing the service configuration

## Legacy Service-Key Rotation

Use this procedure after a legacy `service_role` key is exposed:

1. In Supabase Dashboard, create a replacement secret key under **Settings -> API Keys**. Do not paste it into chat, source, or reports.
2. Update `CREDENTIAL_BOUNDARY_SERVICE_ROLE_KEY` in the hosted project and the worker runtime (including Docker Compose, when used). Keep the worker's `SUPABASE_SERVICE_ROLE_KEY` unchanged for database/control-plane access.
3. Restart only the execution worker and verify `/health`; keep the bridge/UI untouched.
4. Run the controlled proof with both explicit opt-ins. Require `full_verified`, valid decrypt, clean scans, and verified cleanup.
5. Confirm the local/cloud key hashes match without printing values.
6. Delete or revoke the old key in the Dashboard only after all consumers use the replacement.
7. Re-run the proof once more after revocation to confirm no hidden dependency remains.

The Supabase CLI can list keys and secrets but does not perform legacy key rotation. Legacy key replacement is a Dashboard operation.

## Current Status

- **Plan status:** `complete`
- **Phase 3 status:** `full_verified` (controlled runtime proof passed)
- **Documentation claims:** `full_verified` for the controlled proof scope; production rollout still requires normal operational sign-off
- **Real proof executed:** Yes, with explicit opt-in and a connected Android device
- **Current verdict:** `full_verified`

## Exact Blockers

1. No deployed Supabase project with `credential-vault` Edge Function
2. No `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`, `CREDENTIAL_VAULT_WORKER_TOKEN` configured
3. No `PROOF_OPERATOR_JWT` (short-lived OPERATOR/ADMIN JWT)
4. No `CREDENTIAL_BOUNDARY_CANARY` (disposable password, process env only)
5. No running execution worker at `WORKER_BASE_URL`
6. No running Mobile MCP bridge at `MOBILE_MCP_BRIDGE_URL`
7. No connected ONLINE Android device
8. Both opt-in gates must be explicitly set (`--run-real-proof` + `CREDENTIAL_BOUNDARY_ALLOW_REAL_PROOF=true`)
