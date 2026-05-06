# Phase 03: Normalize Specify And Project Docs

## Context Links
- Parent plan: `./plan.md`
- Research: `./research/researcher-01-plan-and-specify-scout.md`

## Overview
- Date: 2026-05-05
- Priority: P1
- Implementation status: completed
- Review status: evidence captured
- Purpose: make project workflow match actual files.

## Key Insights
- `.claude/commands`, `scripts/powershell`, `scripts/bash`, `templates`, `memory/constitution.md`, `AGENTS.md`, `CLAUDE.md`, and `docs/` now exist on disk.
- `speckit` is installed and repo-local Spec Kit assets are restored.
- App root is now a git repo for Spec Kit script compatibility.

## Requirements
- Decide whether to initialize Spec Kit here.
- Decide git root first.
- Create repo-local instructions/docs only after avoiding overwrite risk.
- Keep current hard plan as evidence source.

## Architecture
- Canonical planning layer should be one of:
  - Spec Kit `.specify/` + specs/tasks.
  - Existing `plans/` with repo docs.
  - Both, with clear ownership boundaries.

## Related Code Files
- `README.md`
- `plans/`
- Future: `AGENTS.md`, `CLAUDE.md`, `docs/`, `.specify/`

## Implementation Steps
1. Resolve git root: initialize repo or confirm external owner.
2. Dry-run or preview `speckit init --here --ai claude` impact.
3. If accepted, initialize Spec Kit workflow.
4. Create minimal `docs/` index matching project docs requirements.
5. Move or link plan state into canonical docs/spec files.
6. Update README only where it is stale.

## Todo List
- [x] Decide git root.
- [x] Decide Spec Kit init.
- [x] Create docs source of truth.
- [x] Sync current backend/device reality through docs and reports.
- [x] Mark hard plan status accurately.

## Success Criteria
- `speckit check` still passes required tools.
- Project has clear local instructions and docs.
- No contradiction between README, plan, backlog, and runtime evidence.

## Risk Assessment
- Spec Kit init may overwrite or create instruction files unexpectedly.
- Docs work can become busywork if OPS-08 still blocked.

## Security Considerations
- Docs must not include secrets.
- Env guidance should reference variable names only.

## Next Steps
- After docs normalize, handle pilot hardening backlog.

## Completion Evidence
- `./reports/spec-kit-bootstrap-report.md`
- `AGENTS.md`
- `CLAUDE.md`
- `docs/specify-workflow.md`
- `memory/constitution.md`
- `scripts/powershell/get-feature-paths.ps1` correctly fails on non-feature branch.
