# AGENTS.md

Repo-local instructions for OpenCode sessions. Keep this file compact: only preserve facts an agent is likely to miss.

## Start Here
- Work from `F:\project-bolt-sb1-keyopwhy\project`; the parent folder is only a container.
- Read `README.md`, `docs/codebase-summary.md`, `docs/common-issues.md`, and `docs/code-standards.md` before non-trivial code work.
- `CLAUDE.md` points back here; `.claude/rules/` has the full local workflow rules when a task needs planning, delegation, docs updates, or agent reports.
- Karpathy coding principles live in `.claude/rules/karpathy-coding-principles.md` for workflows that read rule files directly.
- Plan verification details also live in `.claude/rules/plan-verification-rules.md` for workflows that read rule files directly.
- Bug-fix details also live in `.claude/rules/bug-fix-rules.md` for workflows that read rule files directly.
- Check `docs/common-issues.md` before debugging runtime or Mobile MCP failures.
- Before fixing any bug, always check `docs/common-issues.md` first to see whether the symptom, root cause, or known workaround is already documented.
- After each bug fix, add or update a `docs/common-issues.md` entry with `Symptoms`, `Root Cause`, `Common Triggers`, `Solutions`, and `Verification`.

## Project Shape
- Main app: React 18 + Vite + TypeScript SPA in `src/`; entrypoints are `src/main.tsx` and `src/App.tsx`.
- Data/control: Supabase Auth/Postgres/RLS via React Query hooks in `src/hooks/` and helpers in `src/lib/`.
- Shared runtime contracts live in `packages/shared/src`; Laixi command builders live in `packages/laixi-adapter/src`.
- Backend worker entrypoint: `services/execution-worker/src/index.ts`; it claims queued runs and dispatches to Laixi or Mobile MCP.
- Laixi gateway entrypoint: `services/laixi-gateway/src/index.ts`; HTTP health/dispatch plus WebSocket device sessions.
- Mobile MCP bridge: `services/mobile-mcp-bridge/src/bridge_server.py`; Node scripts call the local Python venv through package scripts.
- This is not an npm workspace; root scripts call services with `npm --prefix ...`.

## Windows Commands
- Use `npm.cmd`, not `npm.ps1`; use `ck.cmd`, not `ck.ps1`, to avoid PowerShell execution-policy failures.
- Install root deps with `npm.cmd install`; Docker uses `npm ci` from `package-lock.json`.
- App dev server: `npm.cmd run dev`.
- Worker dev server: `npm.cmd run dev:worker`; health is `http://127.0.0.1:4310/health`.
- Gateway dev server: `npm.cmd run dev:gateway`; health is `http://127.0.0.1:8080/health`.
- One-command Mobile MCP local runtime: `npm.cmd run runtime:mobile-mcp`; status-only check: `npm.cmd run runtime:mobile-mcp:check`.

## Verification
- Frontend/src/package changes: run `npm.cmd test`, `npm.cmd run typecheck`, `npm.cmd run lint`, then `npm.cmd run build`.
- Focused app tests: `npx.cmd vitest run src/path/to/file.test.ts` or `npm.cmd test -- src/path/to/file.test.ts`.
- Worker changes: run `npm.cmd run build:worker` plus the most relevant smoke, usually `npm.cmd run smoke:backend` for run resilience or a Mobile MCP smoke below.
- Gateway changes: run `npm.cmd run build:gateway`.
- Mobile MCP diagnostics: start with `npm.cmd run status:mobile-mcp`; missing devices use `npm.cmd run diagnose:mobile-mcp:devices`; ADB transport failures use `npm.cmd run recover:mobile-mcp:adb`.
- Mobile MCP proof gates: `npm.cmd run preflight:mobile-mcp`, then `npm.cmd run verify:mobile-mcp` only when bridge, worker, UI, Supabase login, and device DB mapping are expected ready.
- Real-device smoke commands: `npm.cmd run smoke:mobile-mcp`, `npm.cmd run smoke:mobile-mcp:multi`, `npm.cmd run smoke:mobile-mcp:db-queue`, `npm.cmd run smoke:mobile-mcp:ui`.

## Runtime And Env Gotchas
- Never read or print `.env` unless the user explicitly approves secret access; use `.env.example` for names only.
- Frontend must use `VITE_SUPABASE_ANON_KEY`; worker/gateway/Edge Function require `SUPABASE_SERVICE_ROLE_KEY` or newer `sb_secret_...` stored outside committed files.
- `VITE_RUN_CONTROL_MODE=auto` tries the `execute-run` Edge Function first; use `browser` for local Supabase projects where the function is not deployed.
- `DEVICE_BACKEND=mobile-mcp` means `devices.laixi_device_id` stores the Android ADB serial.
- Mobile MCP V1 supports `launch_app`, `input_text`, `tap`, `swipe`, `screenshot`, `get_current_app`, `adb`, and worker-local `wait`; it does not execute `run_autox`.
- Multi-target runs are currently sequential inside one worker claim; do not promise parallel fleet execution.
- Current pilot artifact strategy stores screenshot/text-log previews in artifact rows; Supabase Storage is a future decision.
- Use `npm.cmd run env:mobile-mcp:user` or `npm.cmd run setup:mobile-mcp:local` to persist Windows User env values instead of writing secrets into repo files.

## Code Conventions That Matter
- Prefer existing facades/import surfaces; many modules were split to keep files small while preserving callers.
- Keep touched code files near or under 200 lines when practical; see `docs/file-size-refactor-plan.md` before large refactors.
- New file names should be descriptive kebab-case unless framework/tooling requires otherwise.
- Do not create parallel `enhanced` replacement files; update existing paths or extract focused helpers.
- React routes are lazy-loaded in `src/App.tsx`; preserve existing route paths and auth/layout behavior.
- Use shared helpers for role access, device lifecycle, run preflight, approval insights, and step error display instead of duplicating policy logic.

## Planning, Docs, And Delegation
- For implementation work, create or follow a plan under `plans/`; current hard-priority plan is `plans/20260505-1013-specify-gap-hard-priority-plan/plan.md`.
- Spec Kit is available; Windows scripts live under `scripts/powershell/`. Flow is `/constitution`, `/specify`, `/plan`, `/tasks`, `/implement`.
- After meaningful feature, bug, security, architecture, or milestone changes, update relevant docs in `docs/`, especially changelog/roadmap when status changes.
- Subagent prompts must include: work context `F:\project-bolt-sb1-keyopwhy\project`, reports path `F:\project-bolt-sb1-keyopwhy\project\plans\reports`, plans path `F:\project-bolt-sb1-keyopwhy\project\plans`, scoped files, acceptance criteria, and constraints.
- Subagents must end with `Status: DONE | DONE_WITH_CONCERNS | BLOCKED | NEEDS_CONTEXT`, `Summary: ...`, and `Concerns/Blockers: ...`; never ignore `BLOCKED` or `NEEDS_CONTEXT`.

## Plan Verification Rules
Apply before finalizing any multi-phase plan. Pattern: scout -> planner writes -> fresh audit verifies -> report. Do not trust scout/planner summaries without checking live files.

- Verify factual claims against code/config: re-grep paths, scripts, env names, endpoints, route names, and counts before putting them in the plan.
- Every symbol or API in a plan must cite `file:line`; no cite means red flag. Do not invent plausible wrappers, managers, hooks, stores, or shared helpers.
- Trace semantics, not just lines: identify when fields mutate, which branches call a function, and which early returns skip behavior.
- Before adding state to an object, class, Zustand store, module singleton, worker coordinator, or gateway/session manager, verify its lifetime: one render/request/run/device session/process/app lifetime. Wrong lifetime can leak state across users, devices, or runs.
- Enumerate all callers before signature changes. `Update all callers` is not enough; list the files/functions that must change.
- Grep delete/refactor scope across `src/`, `packages/`, `services/`, `scripts/`, and `supabase/`; stubs often remain in routes, exports, smoke scripts, docs, or migrations.
- Match port/config shape when adapting external examples. If field names/types/env names differ from upstream, explicitly record the divergence and rationale in the plan.
- Re-scout when scope changes from deferred to active; old brainstorm notes are not evidence.
- Cross-phase gates must be explicit, e.g. `Phase N-1 merged + npm.cmd test/typecheck/lint/build green`; execution order alone is not enforcement.
- For bug plans, make the reproducer or characterization test/blocking check the first implementation step, then make it pass.
- After planning, spawn a fresh grep/scout/code-review audit to spot-check at least 15 important claims against the repo before reporting the plan as ready.
