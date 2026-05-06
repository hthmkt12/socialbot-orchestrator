# Project Roadmap

Date: 2026-05-06

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
- First Spec Kit feature completed: `001-normalize-pilot-artifact` normalized pilot artifact labels, linkage warnings, preview availability copy, and storage-decision documentation without adding object storage.

## Now
- Decide whether Laixi gateway proof is required for pilot.
- Use `docs/backend-capability-matrix.md` as the pilot backend capability source of truth.
- Use `docs/file-size-refactor-plan.md` to sequence large-file refactors.
- Run manual run-detail smoke for `001-normalize-pilot-artifact` when an authenticated UI session and artifact-bearing completed run are available.
- Select the next real Spec Kit feature/spec from the baseline.

## Next
- Normalize docs/spec workflow around `specs/` for new work.
- Modularize oversized UI files after runtime proof remains stable.
- Decide numeric artifact storage thresholds before larger screenshot volume, longer retention, or external sharing.
- Keep sequential multi-target execution for small pilot validation unless fleet-speed SLA appears.
- Keep authenticated route lazy-loading in place; main Vite chunk is now below warning threshold.

## Later
- Parallelize multi-target execution if pilot requires fleet speed.
- Add Laixi-specific live proof if that backend becomes mandatory.

## Unresolved Questions
- Which backend is pilot-default long term: Mobile MCP, Laixi, or both?
- What is the next real Spec Kit feature branch?
- What authenticated artifact-bearing run should be used for the deferred run-detail smoke?
