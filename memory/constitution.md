<!--
Sync Impact Report
Version change: none -> 1.0.0
Modified principles: initial adoption
Added sections: Core Principles, Workflow Gates, Governance
Removed sections: none
Templates requiring updates: templates already restored from Spec Kit package
Follow-up TODOs: decide whether future hard plans move from plans/ to specs/
-->

# Laixi Orchestration Platform Constitution

Version: 1.0.0
Ratified: 2026-05-05
Last Amended: 2026-05-05

## Core Principles

### 1. Runtime Truth First
Claims about readiness MUST be backed by current commands, report files, or live
runtime evidence. Old reports are context, not proof.

### 2. Backend-Owned Execution
Workflow execution MUST remain backend-owned. UI state can display and request
actions, but it must not become the durable owner of run lifecycle.

### 3. Device Proof Is Backend-Specific
Mobile MCP and Laixi are separate device backends. Evidence for one backend MUST
not be presented as proof for the other unless explicitly accepted for the gate.

### 4. Secrets Stay Out Of Source
Service-role keys, passwords, `.env`, and local machine secrets MUST NOT be
committed, printed in reports, or copied into docs.

### 5. Operator Recovery Must Be Actionable
Failure paths MUST include the failing layer and next recovery action where
possible: ADB, bridge, worker, UI, DB mapping, device lock, or permission issue.

### 6. Keep Work Scoped
New abstractions, refactors, and docs MUST serve the active task. Large files may
be modularized when touched, but behavior verification remains mandatory.

## Workflow Gates

- Read `README.md`, `AGENTS.md`, and relevant docs before implementation.
- For frontend changes, run `npm.cmd run typecheck` and relevant build/lint.
- For worker/gateway changes, run the matching build and smoke command.
- For Mobile MCP pilot proof, run `npm.cmd run preflight:mobile-mcp` and
  `npm.cmd run verify:mobile-mcp`.
- For Spec Kit features, create specs through `/specify`, then `/plan`, then
  `/tasks`, then implementation.

## Governance

Constitution changes require:
- A dated edit to this file.
- A short sync impact note.
- Updates to affected docs or plan files.

Versioning:
- MAJOR for principle removal or incompatible workflow change.
- MINOR for new principle or required gate.
- PATCH for clarifications.

Compliance is checked during plan review and before final readiness claims.

## Unresolved Questions

- Should future hard plans live under `specs/` instead of `plans/`?
- Is Laixi gateway pilot proof required after Mobile MCP OPS-08 closure?
