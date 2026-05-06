# Project Roadmap

Date: 2026-05-05

## Completed
- Backend-owned run execution path.
- Worker claim and lease handling.
- Gateway and Mobile MCP bridge integration.
- Mobile MCP real-device clean path.
- Mobile MCP missing-device failure path.
- `OPS-08` closure for Mobile MCP pilot backend.
- Spec Kit local bootstrap.
- Repo-local agent instruction hardening with common-issue logging, bug-fix rules, Karpathy coding principles, and verified plan rules.
- Project baseline commit.
- 2026-05-05 hard-priority plan and Phase 04 pilot hardening backlog.

## Now
- Decide whether Laixi gateway proof is required for pilot.
- Decide whether first Spec Kit feature should cover artifact storage, UI modularization, or Laixi validation.
- Use `docs/backend-capability-matrix.md` as the pilot backend capability source of truth.
- Use `docs/file-size-refactor-plan.md` to sequence large-file refactors.
- Select the first real Spec Kit feature/spec from the baseline.

## Next
- Normalize docs/spec workflow around `specs/` for new work.
- Modularize oversized UI files after runtime proof remains stable.
- Decide artifact storage path before larger screenshot volume.
- Keep sequential multi-target execution for small pilot validation unless fleet-speed SLA appears.
- Keep authenticated route lazy-loading in place; main Vite chunk is now below warning threshold.

## Later
- Parallelize multi-target execution if pilot requires fleet speed.
- Add Laixi-specific live proof if that backend becomes mandatory.

## Unresolved Questions
- Which backend is pilot-default long term: Mobile MCP, Laixi, or both?
- What is the first real Spec Kit feature branch?
