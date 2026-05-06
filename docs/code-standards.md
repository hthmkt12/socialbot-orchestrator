# Code Standards

Date: 2026-05-05

## Baseline
- Prefer simple, readable TypeScript.
- Keep code close to existing patterns.
- Use `npm.cmd` on Windows.
- Use React Query hooks for Supabase data access.
- Use shared helpers for role access, device lifecycle, run preflight, and step error display.
- Follow `.claude/rules/karpathy-coding-principles.md`: think first, keep changes simple, surgical, and goal-driven.
- Before fixing bugs, follow `.claude/rules/bug-fix-rules.md` and check `docs/common-issues.md` first.

## Planning Discipline
- Before finalizing multi-phase plans, follow `.claude/rules/plan-verification-rules.md`.
- Every symbol or API in a plan should cite `file:line`; missing citation is a red flag.
- After planning, run a fresh grep/scout/code-review audit instead of trusting self-validation.

## Validation
- For frontend changes: `npm.cmd run typecheck`, `npm.cmd run lint`, `npm.cmd run build`.
- For worker changes: `npm.cmd run build:worker`, relevant smoke command.
- For gateway changes: `npm.cmd run build:gateway`.
- For Mobile MCP pilot proof: `npm.cmd run preflight:mobile-mcp` and `npm.cmd run verify:mobile-mcp`.

## File Size
- Files above 200 lines should be considered for modularization when touched.
- Do not refactor large files without behavior-focused verification.

## Security
- Do not commit `.env`.
- Do not print service-role keys or smoke passwords.
- Keep frontend on anon/publishable Supabase key.
- Keep backend worker/gateway on elevated key only in local/server env.

## Unresolved Questions
- Should large-file modularization be mandatory before more pilot UI work?
