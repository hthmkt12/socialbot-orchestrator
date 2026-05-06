# Plan Verification Rules

Apply before finalizing any multi-phase plan. Pattern: scout -> planner writes -> fresh audit verifies -> report. Do not trust scout/planner summaries without checking live files.

## Verification Discipline

- Verify factual claims against code/config: re-grep paths, scripts, env names, endpoints, route names, and counts before putting them in the plan.
- Every symbol or API in a plan must cite `file:line`; no cite means red flag. Do not invent plausible wrappers, managers, hooks, stores, or shared helpers.
- Trace semantics, not just lines: identify when fields mutate, which branches call a function, and which early returns skip behavior.
- Before adding state to an object, class, Zustand store, module singleton, worker coordinator, or gateway/session manager, verify its lifetime: one render/request/run/device session/process/app lifetime. Wrong lifetime can leak state across users, devices, or runs.
- For bug plans, make the reproducer or characterization test/blocking check the first implementation step, then make it pass.

## Scope And Coverage

- Enumerate all callers before signature changes. `Update all callers` is not enough; list the files/functions that must change.
- Grep delete/refactor scope across `src/`, `packages/`, `services/`, `scripts/`, and `supabase/`; stubs often remain in routes, exports, smoke scripts, docs, or migrations.
- Match port/config shape when adapting external examples. If field names/types/env names differ from upstream, explicitly record the divergence and rationale in the plan.

## Phasing And Audit

- Re-scout when scope changes from deferred to active; old brainstorm notes are not evidence.
- Cross-phase gates must be explicit, e.g. `Phase N-1 merged + npm.cmd test/typecheck/lint/build green`; execution order alone is not enforcement.
- After planning, spawn a fresh grep/scout/code-review audit to spot-check at least 15 important claims against the repo before reporting the plan as ready.

## Pattern

- Avoid: user asks -> planner writes -> report done.
- Prefer: user asks -> scout -> planner writes -> audit verifies -> report.
