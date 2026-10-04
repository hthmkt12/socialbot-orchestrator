# Common Issues

Date: 2026-05-06

Before fixing any bug, always check `docs/common-issues.md` first to see whether the symptom, root cause, or known workaround is already documented.

After each bug fix, add or update an entry here using this format:

```md
## <Short Issue Name>

Symptoms:
- <What the user/dev sees>

Root Cause:
- <Why it happens>

Common Triggers:
- <Inputs/env/state that reproduce it>

Solutions:
- <Minimal proven fix or workaround>

Verification:
- <Command or manual check that proves fixed>
```

## Worker Health Claim Token Exposure

Symptoms:
- Worker `/health` response includes active claim ownership tokens.

Root Cause:
- `RunClaimCoordinator.getHealthSnapshot()` projected private `claimToken` values into the public health payload.

Common Triggers:
- Inspecting `/health` while a worker owns a queued or running workflow run.

Solutions:
- Keep claim tokens private and expose only run ID, claim timing, and lease timing in health metadata.

Verification:
- `npm.cmd --prefix project exec vitest run services/execution-worker/src/run-claim-coordinator.test.ts`
- Confirm worker health serialization contains no claim token literal.

## Credential Boundary Decrypt Token Mismatch

Symptoms:
- `valid_bound_decrypt` returns HTTP 401 and credential boundary proof fails with `vault_http_error`.

Root Cause:
- `supabase/functions/function-env.txt` served by local Supabase Edge Runtime contained an outdated or placeholder `CREDENTIAL_VAULT_WORKER_TOKEN`, while the execution worker and proof harness used the active secret token.

Common Triggers:
- Running `node scripts/run-credential-boundary-proof.mjs --run-real-proof` or `node scripts/credential-boundary-proof-harness.mjs` against a local Supabase Edge Runtime instance where function env was not synced.

Solutions:
- Synchronize `CREDENTIAL_VAULT_WORKER_TOKEN` in `supabase/functions/function-env.txt` to match the worker runtime environment and restart `supabase functions serve`.

Verification:
- `node scripts/run-credential-boundary-proof.mjs --run-real-proof`
- Confirm `valid_bound_decrypt` passes with status `pass` and overall verdict is `full_verified`.

## Karpathy Coding Principles

Four guardrails against common LLM coding failures.

### 1. Think Before Coding

- State assumptions explicitly before writing code.
- When multiple interpretations exist, present them; never pick silently.
- Push back if a simpler approach exists.
- If something is unclear, stop and ask before proceeding.

### 2. Simplicity First

- No features beyond what was explicitly asked.
- No abstractions for single-use code.
- No flexibility or configurability not requested.
- No error handling for impossible scenarios.
- Self-test: would a senior engineer say this is overcomplicated? If yes, rewrite.
- If 200 lines could be 50, rewrite it.

### 3. Surgical Changes

- Do not improve adjacent code, comments, or formatting.
- Do not refactor things that are not broken.
- Match existing style even if you would do it differently.
- If you notice unrelated dead code, mention it; do not delete it.
- When your changes create orphans such as unused imports, variables, or functions, clean those up.
- Litmus test: every changed line must trace directly to the user's request.

### 4. Goal-Driven Execution

- Transform tasks into verifiable goals with success criteria.
- `Add validation` means write tests for invalid inputs, then make them pass.
- `Fix the bug` means write a test that reproduces it, then make it pass.
- `Refactor X` means ensure tests pass before and after.
- Multi-step plans must have explicit verify conditions per step.

### Planning Rules

- Every symbol in a plan must cite `file:line`; no cite is a red flag.
- Before adding state to an object or class, verify its lifetime: one request, one run, or entire app lifetime. Wrong lifetime can leak state across users.
- After planning, run a fresh grep/scout audit. Do not trust self-validation.

## Windows Command Runner

- Prefer `npm.cmd` and `ck.cmd` from PowerShell.
- Avoid relying on `npm.ps1` or `ck.ps1`; PowerShell execution policy can block them.
- If `rg.exe` fails with `Access is denied`, use PowerShell `Get-ChildItem` and `Select-String`.

## Workspace Root

- The working app root is `F:\project-bolt-sb1-keyopwhy\project`.
- The outer `F:\project-bolt-sb1-keyopwhy` folder is only a container.
- Run project commands from the app root.

## Secrets

- Do not read or print `.env` unless the user explicitly approves secret access.
- Keep `SUPABASE_SERVICE_ROLE_KEY`, smoke passwords, and backend secrets outside committed files.
- Use `.env.example` for templates only.

## Mobile MCP Runtime

- Start with `npm.cmd run status:mobile-mcp` for current local runtime state.
- Use `npm.cmd run diagnose:mobile-mcp:devices` when expected devices are missing.
- Use `npm.cmd run recover:mobile-mcp:adb` when ADB transports disappear.
- Use `npm.cmd run preflight:mobile-mcp` before expensive full verification.
- Use `npm.cmd run verify:mobile-mcp` only when bridge, worker, UI, Supabase login, and device mapping are expected to be ready.

## Android USB Device Not Visible To ADB

Symptoms:
- `npm.cmd run status:mobile-mcp` shows no online ADB devices.
- Expected serial, such as the current pilot serial `97249fb5`, is missing from ADB and bridge checks.
- `npm.cmd run diagnose:mobile-mcp:devices` reports `Windows does not see an Android USB device`.

Root Cause:
- The phone is not visible to Windows USB/PnP or ADB, so Mobile MCP cannot discover or run against it.

Common Triggers:
- Phone unplugged, locked, or in charge-only USB mode.
- USB debugging prompt not accepted on the phone.
- Bad cable, bad port, missing driver, or stale ADB transport.
- `MOBILE_MCP_EXPECTED_SERIALS` still points at a device that is not currently connected.

Solutions:
- Replug the phone with a data-capable cable and unlock it.
- Select file transfer/data USB mode and accept the USB debugging authorization prompt.
- Try another USB port/cable or reinstall the Android/OEM driver if Windows still does not see the device.
- Run `npm.cmd run recover:mobile-mcp:adb`, then `npm.cmd run diagnose:mobile-mcp:devices`.
- Update `MOBILE_MCP_EXPECTED_SERIALS` only if the pilot device serial changed.

Verification:
- `npm.cmd run diagnose:mobile-mcp:devices` reports the expected serial with no missing devices.
- `npm.cmd run status:mobile-mcp` shows the expected serial online before running `npm.cmd run preflight:mobile-mcp`.

## Device Lock Released Without Ownership

Symptoms:
- A run that fails to acquire a device lock still attempts lock cleanup.
- A lock owned by another run could be deleted if cleanup predicates later match the same device and run identifiers.

Root Cause:
- `executeOwnedDeviceRun` executed release cleanup from `finally` without tracking whether acquisition succeeded.

Common Triggers:
- Active lock conflict or lock-acquisition lookup failure before runner startup.

Solutions:
- Track lock ownership after successful acquisition and release only when this invocation acquired the lock.

Verification:
- `npx.cmd vitest run services/execution-worker/src/execute-owned-device-run.test.ts services/execution-worker/src/worker-device-locks.test.ts`

## Frontend And Build Checks

- Frontend code changes: run `npm.cmd run typecheck`, `npm.cmd run lint`, and `npm.cmd run build`.
- Worker changes: run `npm.cmd run build:worker` and a relevant smoke command.
- Gateway changes: run `npm.cmd run build:gateway`.

## Execute-Run Authorization Boundary

Symptoms:
- A caller can invoke `execute-run` with a known run ID, or an owning operator receives an unexpected authorization failure.

Root Cause:
- The Edge Function uses service-role mutations, so UI/RLS checks are bypassed; run ownership is stored as `profiles.id`, not `auth.users.id`.

Common Triggers:
- Missing/invalid bearer, VIEWER role, cross-owner run ID, or comparing `triggered_by_user_id` to the auth user ID directly.

Solutions:
- Validate the bearer with `auth.getUser()`, load the profile role/id, require ADMIN/owner OPERATOR access, and keep service-role mutation behind that guard.

Verification:
- `npx.cmd vitest run supabase/functions/execute-run/auth.test.ts packages/shared/src/run-control-authorization.test.ts`

## Mobile MCP Bridge Serial Field Mismatch

Status:
- Fixed in runtime scripts and UI fleet loading. Keep this entry for regression diagnosis.

Symptoms:
- `wait-mobile-mcp-expected-devices.mjs` reports `bridge: none` even though the bridge `/devices` endpoint returns the device.
- Preflight reports `bridge.devices` PASS but `bridge.expectedSerials` FAIL.
- Status script warnings show "Expected serial X is not visible from bridge /devices" despite bridge being healthy.

Root Cause:
- The bridge `/devices` endpoint returns devices with a `serial` field (e.g., `{"serial":"97249fb5","state":"device"}`), but the scripts read `device.id` which is `undefined`. The `.filter(Boolean)` then removes the undefined entries, making the bridge appear empty.

Common Triggers:
- Running Mobile MCP scripts (preflight, wait-devices, status) against a Mobilerun-based bridge that returns `serial` instead of `id`.

Solutions:
- Normalize bridge device identity with `device.id ?? device.serial` in scripts and UI code that read `/devices`.
- Current fixed surfaces include `preflight-mobile-mcp-local.mjs`, `status-mobile-mcp-local.mjs`, `wait-mobile-mcp-expected-devices.mjs`, `recover-mobile-mcp-adb.mjs`, `verify-use-cases-real.mjs`, and `src/lib/mobile-mcp-orchestrator.ts`.

Verification:
- `npm.cmd run diagnose:mobile-mcp:devices` shows the expected serial as present in both ADB and bridge checks.
- `npm.cmd run status:mobile-mcp` does not warn that an ADB-online serial is missing from bridge `/devices`.

## Windows spawn EINVAL With npm.cmd

Status:
- Fixed in `scripts/start-mobile-mcp-local-runtime.mjs`; keep this entry for regression diagnosis.

Symptoms:
- `start-mobile-mcp-local-runtime.mjs` fails with `runtime error: spawn EINVAL`.
- The bridge/worker/UI services do not start, but the preflight venv checks pass.

Root Cause:
- `npm.cmd` on Windows is a batch file. Node.js `spawn()` cannot execute batch files directly without `shell: true`. The runtime script spawns services with `spawn(command, args, { ... })` without the `shell` option, causing `EINVAL`.

Common Triggers:
- Running `node scripts/start-mobile-mcp-local-runtime.mjs` on Windows without `shell: isWindows`.

Solutions:
- Ensure service spawns use `shell: isWindows` when the command is `npm.cmd`.
- Current runtime script already sets `shell: isWindows` in `start-mobile-mcp-local-runtime.mjs`.

Verification:
- `node scripts/start-mobile-mcp-local-runtime.mjs --check` reports all services healthy.

## CK Bootstrap

- Use `ck.cmd update`.
- Use `ck.cmd init --yes` in non-interactive shells.
- After `ck init`, ensure `CLAUDE.md` and `AGENTS.md` both exist.

## Vitest Mock Hoisting Errors

Symptoms:
- Uninitialized variable or reference errors during Vitest runtime execution.

Root Cause:
- Vitest hoists `vi.mock()` calls above local variable declarations and normal imports, causing variables used inside mock factories or imported symbols to be uninitialized when referenced during initial setup.

Common Triggers:
- Declaring mock functions or referencing imports before defining `vi.mock()` statements.

Solutions:
- Group all `vi.mock()` statements at the absolute top of the test files (immediately after `import { ... } from 'vitest'`) and group all `import` statements immediately following the mocks.

Verification:
- Run `npm.cmd run test` to confirm tests pass cleanly.

## Flaky Coordinate Jitter Test in Anti-Detection Helpers

Symptoms:
- Occasional test assertion failures in `anti-detection-helpers.test.ts` for coordinate jitter tests.

Root Cause:
- Low `Math.random` return values cause the computed jitter distance to round to 0, resulting in the jittered coordinates matching the original coordinates exactly and failing the `.not.toBe()` checks.

Common Triggers:
- Not mocking `Math.random` or mocking with too small a value (under 0.2).

Solutions:
- Mock `Math.random` to return a high value (like 0.9) and assert the precise, predictable rounded coordinates.

Verification:
- Run `npx.cmd vitest run src/lib/anti-detection-helpers.test.ts` to ensure 100% pass rate.

## Credential Proof Tests Inheriting Local Env

Symptoms:
- A supposedly hermetic credential-boundary contract test can observe values from the repository `.env`.
- An opt-in test might reach service startup or the runtime proof when the local `.env` has complete credentials.

Root Cause:
- The orchestrator loads `rootDir/.env` before merging `process.env`, while the child-process test only supplied a partial environment.

Common Triggers:
- Running opt-in contract tests on an operator workstation with a fully configured local `.env`.

Solutions:
- Set `CREDENTIAL_BOUNDARY_SKIP_DOTENV=true` in isolated contract-test child processes.
- Keep the normal `.env` loader enabled for operator invocations; this test-only flag does not bypass either real-proof opt-in gate.

Verification:
- `npx.cmd vitest run src/lib/credential-boundary-orchestrator-contract.test.ts`

## Readiness Audit Verdict Conflation

Symptoms:
- A readiness audit records `static_verified` even though its no-opt-in command returned `blocked`.
- The audit reports a service as unreachable after probing a fallback URL that was never configured for the runtime proof.

Root Cause:
- The audit mixed the static verifier's standing with the readiness command's result and treated fallback local URLs as configured evidence targets.

Common Triggers:
- Writing a status report from multiple verification commands without naming each command's verdict separately.

Solutions:
- Record `readinessCommandVerdict` separately from a static verifier verdict derived by an independently run no-write verifier subprocess.
- Do not run or report health checks unless the corresponding runtime URL is explicitly configured; use `checked: false` and a missing-config reason instead.

Verification:
- `npm.cmd run proof:credential-boundary` returns `blocked` without opt-in.
- Parse `plans/260710-credential-boundary-remediation/reports/credential-boundary-readiness-audit-2026-07-15.json` and confirm both verdict fields and `healthChecks.*.checked: false` when URLs are missing.

## Readiness Audit Inheriting Verifier Test Mode

Symptoms:
- A readiness audit can report a passing static verifier verdict while verifier gates were skipped by a test-mode environment variable.

Root Cause:
- The audit forwarded the parent environment to the static verifier, including verifier test hooks.

Common Triggers:
- Running an audit from a shell that previously set `CREDENTIAL_BOUNDARY_TEST_MODE=true`.

Solutions:
- The audit removes verifier test hooks by default.
- Contract tests require both `CREDENTIAL_BOUNDARY_AUDIT_TEST_MODE=true` and `NODE_ENV=test` before the audit forwards a verifier test hook.
- The verifier test-mode gate itself also requires both `CREDENTIAL_BOUNDARY_TEST_MODE=true` and `NODE_ENV=test`; with either absent, all real static gates, scans, and runtime probes run exactly as in production.

Verification:
- `npx.cmd vitest run src/lib/credential-boundary-audit-contract.test.ts`
- `npm.cmd run audit:credential-boundary` reports `staticVerifierTestMode: false` and `staticVerifierChildTestMode: false`.

## Slow Audit Contract Suite From Verifier Static Scans

Symptoms:
- `npx.cmd vitest run src/lib/credential-boundary-audit-contract.test.ts` takes over 100 seconds even though `CREDENTIAL_BOUNDARY_TEST_MODE` mocks lint/typecheck/test/build.

Root Cause:
- The verifier still performed expensive source canary scanning, Edge Function source scanning, runtime availability probing, and crypto/redaction unit-test spawns for every spawned audit child, even when the heavy compiler gates were mocked.

Common Triggers:
- Running the audit contract suite without the Phase 11 test-mode short-circuit.

Solutions:
- The verifier test-mode gate now requires both `CREDENTIAL_BOUNDARY_TEST_MODE=true` and `NODE_ENV=test` and, when active, replaces all expensive static scan/check operations with deterministic safe fixture results that preserve the verifier JSON schema and verdict policy.
- No network, device, service, or Supabase contact occurs in test mode.
- `--no-write-report` continues to suppress filesystem report writes in test mode.
- Production behavior is unchanged: without both test conditions, the verifier runs real lint/typecheck/tests/build/static scans exactly as before.

Verification:
- `npx.cmd vitest run src/lib/credential-boundary-audit-contract.test.ts` completes comfortably under 30 seconds in normal local conditions (24 tests); before Phase 11 the same suite took over 100 seconds because each spawned audit child ran the full static scan/probe path.
- `npm.cmd run audit:credential-boundary` still reports `staticVerifierTestMode: false` and `staticVerifierChildTestMode: false` and derives real static evidence with test mode disabled.

## Credential Redaction Fails Open At Deep Or Artifact Boundaries

Symptoms:
- A credential can survive redaction when it appears beyond the recursion limit.
- A bare decrypted value under a non-sensitive key such as `text`, `detail`, or an upload error can reach log artifact metadata.

Root Cause:
- The depth guard returned the original object after ten levels, and key/pattern-based scrubbing could not identify a known credential literal under an otherwise safe key.

Common Triggers:
- Deeply nested or circular backend output.
- Persisting a backend error or artifact message that embeds the decrypted value without a `password`/`secret`/`token` key name.

Solutions:
- Return a non-secret `redaction_status: blocked` sentinel on maximum depth or cycles; never return the original secret-bearing branch.
- Pass the run's active sensitive literals to `createLogArtifact`; it scrubs text, metadata, and upload errors immediately before persistence.
- Keep key-based redaction as defense in depth after literal-value redaction.

Verification:
- `npx.cmd vitest run services/execution-worker/src/credential-redaction.test.ts services/execution-worker/src/worker-run-store.test.ts`
- Confirm the serialized Supabase insert payload does not contain the synthetic credential canary.

## Laixi Gateway Missing Internal Tokens

Symptoms:
- The Laixi gateway refuses to start, or worker requests receive `401 Unauthorized`.
- WebSocket device registration closes with code `4003`.

Root Cause:
- Gateway authentication is fail-closed. `GATEWAY_HTTP_TOKEN` protects `/sessions` and `/dispatch-step`; `GATEWAY_DEVICE_ENROLLMENT_TOKEN` protects WebSocket registration.

Common Triggers:
- A deployment omitted one of the two gateway tokens.
- The worker's `GATEWAY_HTTP_TOKEN` differs from the gateway token.
- Tokenless mode was assumed without explicitly enabling local-only `GATEWAY_ALLOW_INSECURE_DEV=true`.

Solutions:
- Configure matching non-empty `GATEWAY_HTTP_TOKEN` values in the gateway and Laixi worker, plus `GATEWAY_DEVICE_ENROLLMENT_TOKEN` for device clients.
- Keep `GATEWAY_ALLOW_INSECURE_DEV=false` in shared, staging, and production environments. Use the insecure flag only for isolated local development.
- Register devices with the enrollment token; do not put either token in browser-visible configuration.

Verification:
- `npm.cmd run build:gateway` and `npm.cmd run build:worker` pass.
- Gateway tests confirm public minimal `/health`, bearer protection, malformed/oversized request handling, and `4003` for missing enrollment.

## Credential Vault Origin Rejected

Symptoms:
- Browser calls to the `credential-vault` Edge Function fail with HTTP `403` and `Origin not allowed`.
- The response has no wildcard `Access-Control-Allow-Origin` header.

Root Cause:
- Vault CORS is intentionally exact-origin. Only `CREDENTIAL_VAULT_ALLOWED_ORIGIN` is accepted; wildcard origins are not supported for credential operations.

Common Triggers:
- The deployed frontend origin differs from `CREDENTIAL_VAULT_ALLOWED_ORIGIN` (including scheme, hostname, or port).
- A local frontend uses a different Vite port than the configured `http://localhost:5173` default.

Solutions:
- Set `CREDENTIAL_VAULT_ALLOWED_ORIGIN` to the exact browser origin for the environment, then redeploy the function.
- Keep the value out of client secrets and do not broaden it to `*`.

Verification:
- Trusted-origin requests return the exact `Access-Control-Allow-Origin` value and `Vary: Origin`.
- Untrusted-origin requests return `403`; the vault auth tests cover both paths.

## Readiness Evidence Confuses Expected And Observed Devices

Symptoms:
- Readiness evidence reports configured expected serials as observed runtime serials.
- A report can appear to prove device execution without runtime device evidence.

Root Cause:
- The verification generator previously assigned `expectedSerials` directly to `observed_serials`.

Common Triggers:
- Running local verification without UI evidence or without a readable UI evidence artifact.
- Reviewing quick verification output as if it were completed device proof.

Solutions:
- Keep configured `expected_serials` separate from runtime-derived `observed_serials`.
- Omit observed serials when runtime evidence is unavailable.
- Keep quick verification distinct from completed workflow proof.

Verification:
- `node --check scripts/verify-mobile-mcp-local.mjs`
- `npx.cmd vitest run src/lib/readiness-report-service.test.ts src/lib/readiness-report-form-helpers.test.ts`

## Readiness Freshness Tests Depend On Wall Clock

Symptoms:
- A readiness test that previously passed starts failing after its fixed `verified_at` or `finished_at` fixture becomes older than 14 days.

Root Cause:
- `validateReadinessEvidence` evaluated freshness against the current system time while the test asserted a permanently fresh result for a fixed historical timestamp.

Common Triggers:
- Re-running the suite more than 14 days after a hard-coded evidence timestamp.

Solutions:
- Pass an explicit `now` to `validateReadinessEvidence` in freshness-sensitive tests.
- Preserve the production default, which uses the current time when no clock is supplied.

Verification:
- `npx.cmd vitest run src/lib/readiness-report-service.test.ts`

## Phase 05 Evidence Identifier Coercion

Symptoms:
- Sequence evidence can appear materially complete when all context fields are null or when run, serial, target, or artifact fields contain values that are coerced to strings.

Root Cause:
- Sequence validation previously checked only `undefined` context and converted arbitrary IDs with `String(...)`, allowing malformed evidence to compare equal.

Common Triggers:
- Missing backend/auth/project/workflow context represented as null.
- Numeric, null, or whitespace run, serial, and artifact identifiers in imported evidence.
- Mixed numeric/string workflow-version representations across runs.

Solutions:
- Require non-empty material context values.
- Accept serial and artifact arrays only when every entry is a non-empty string; reject mixed or coerced values.
- Require run-level artifact refs for every target artifact; do not infer one-to-one artifact cardinality when artifact bundles may be shared.
- Keep characterization tests for malformed IDs and unlinked target artifacts.

Verification:
- Focused Vitest: 2 files passed, 45 tests passed, exit code 0.
- Full `test:all`: 58 files passed, 577 tests passed, exit code 0.
- `npm.cmd run typecheck`: exit code 0.
- `npm.cmd run lint`: exit code 0.
- `npm.cmd run build`: exit code 0; build completed with an existing Browserslist freshness warning.
- `npm.cmd run build:worker`: exit code 0.
- `npm.cmd run build:gateway`: exit code 0.

## Device Concurrency Lock Rejection

Symptoms:
- Workflow run fails immediately with error code `DEVICE_LOCKED`: `Device is locked by run <id>`.

Root Cause:
- Single-device execution runner enforces mutual exclusion on device hardware. If a workflow run is actively running on the device, subsequent runs targeting that device fail immediately to prevent physical touch/gesture collisions.

Common Triggers:
- Triggering overlapping runs against the same physical device serial.
- Premature client polling cancellation while worker and device are still executing steps.

Solutions:
- Await active run terminal status (`COMPLETED`, `FAILED`, `CANCELLED`) before dispatching the next run to the same device.
- In automated test scripts and schedulers, query active run locks before dispatching.

Verification:
- `node scripts/verify-level2-social-pilot.mjs`

## Current Decisions

- Mobile MCP is the accepted pilot-default backend. Laixi remains future-compatible until VIP/API/live-session proof is available.
- Spec Kit workflow documentation lives in `docs/specify-workflow.md`; do not rerun bootstrap unless a new Spec Kit feature or repo-root migration explicitly requires it.
