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
- Spec Kit feature `002-laixi-gateway-live-proof` created and current outcome recorded: gateway health OK, no Laixi sessions, clean-path proof blocked until Laixi VIP/API access is available.
- Spec Kit feature `003-artifact-storage-thresholds` completed to define numeric inline artifact and object-storage trigger policy without implementing storage.

## Now
- Keep Mobile MCP as pilot-default backend while Laixi remains future-compatible until VIP/API access and a live session are available.
- Use `docs/backend-capability-matrix.md` as the pilot backend capability source of truth.
- Use `docs/file-size-refactor-plan.md` to sequence large-file refactors.
- Run manual run-detail smoke for `001-normalize-pilot-artifact` when an authenticated UI session and artifact-bearing completed run are available.
- Use the artifact storage thresholds before approving larger screenshot volume, longer retention, or external sharing.

## Next
- Normalize docs/spec workflow around `specs/` for new work.
- Modularize oversized UI files after runtime proof remains stable.
- Implement object storage only if artifact thresholds are exceeded or external sharing/audit packages become required.
- Keep sequential multi-target execution for small pilot validation unless fleet-speed SLA appears.
- Keep authenticated route lazy-loading in place; main Vite chunk is now below warning threshold.

## Later
- Parallelize multi-target execution if pilot requires fleet speed.
- Add Laixi-specific clean-path proof if VIP/API access becomes available or that backend becomes mandatory.

## Unresolved Questions
- When will Laixi VIP/API access be available for clean-path proof?
- What is the next real Spec Kit feature branch after artifact threshold policy?
- What authenticated artifact-bearing run should be used for the deferred run-detail smoke?
