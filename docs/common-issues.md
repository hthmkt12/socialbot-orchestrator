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
- Expected serial, such as `QC4DKJUO6PW4FMQW`, is missing from ADB and bridge checks.
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

## Frontend And Build Checks

- Frontend code changes: run `npm.cmd run typecheck`, `npm.cmd run lint`, and `npm.cmd run build`.
- Worker changes: run `npm.cmd run build:worker` and a relevant smoke command.
- Gateway changes: run `npm.cmd run build:gateway`.

## Mobile MCP Bridge Serial Field Mismatch

Symptoms:
- `wait-mobile-mcp-expected-devices.mjs` reports `bridge: none` even though the bridge `/devices` endpoint returns the device.
- Preflight reports `bridge.devices` PASS but `bridge.expectedSerials` FAIL.
- Status script warnings show "Expected serial X is not visible from bridge /devices" despite bridge being healthy.

Root Cause:
- The bridge `/devices` endpoint returns devices with a `serial` field (e.g., `{"serial":"97249fb5","state":"device"}`), but the scripts read `device.id` which is `undefined`. The `.filter(Boolean)` then removes the undefined entries, making the bridge appear empty.

Common Triggers:
- Running Mobile MCP scripts (preflight, wait-devices, status) against a Mobilerun-based bridge that returns `serial` instead of `id`.

Solutions:
- Replace `device.id` with `device.id ?? device.serial` in all three scripts: `preflight-mobile-mcp-local.mjs:113`, `status-mobile-mcp-local.mjs:120`, `wait-mobile-mcp-expected-devices.mjs:70`.

Verification:
- `node -e "process.env.MOBILE_MCP_EXPECTED_SERIALS='<serial>'; require('./scripts/wait-mobile-mcp-expected-devices.mjs')"` shows "missing: none".

## Windows spawn EINVAL With npm.cmd

Symptoms:
- `start-mobile-mcp-local-runtime.mjs` fails with `runtime error: spawn EINVAL`.
- The bridge/worker/UI services do not start, but the preflight venv checks pass.

Root Cause:
- `npm.cmd` on Windows is a batch file. Node.js `spawn()` cannot execute batch files directly without `shell: true`. The runtime script spawns services with `spawn(command, args, { ... })` without the `shell` option, causing `EINVAL`.

Common Triggers:
- Running `node scripts/start-mobile-mcp-local-runtime.mjs` on Windows without `shell: isWindows`.

Solutions:
- Add `shell: isWindows` to the `spawn()` call options in `start-mobile-mcp-local-runtime.mjs:155`.

Verification:
- `node scripts/start-mobile-mcp-local-runtime.mjs --check` reports all services healthy.

## CK Bootstrap

- Use `ck.cmd update`.
- Use `ck.cmd init --yes` in non-interactive shells.
- After `ck init`, ensure `CLAUDE.md` and `AGENTS.md` both exist.

## Unresolved Questions

- Should Laixi gateway proof still be required for pilot, or is Mobile MCP enough?
- Should `speckit init --here --ai claude` run in this app root after git/root decision?
