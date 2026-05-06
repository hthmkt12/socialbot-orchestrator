# Design Guidelines

Date: 2026-05-05

## Product Feel
Operational, dense, and clear. Avoid marketing-style surfaces inside the app.

## UI Principles
- Show backend-owned truth, not local placeholder state.
- Prefer explicit disabled/read-only states over hidden failures.
- Use role-aware actions consistently.
- Use operator-readable error reasons and recovery hints.
- Keep artifacts close to the step/device that produced them.

## Mobile MCP Pilot UX
- Device readiness must show ADB, bridge, worker, UI, DB macro, and DB device mapping.
- Missing expected device must show direct recovery guidance.
- Run monitor must show run id, status, device, steps, and artifacts.

## Unresolved Questions
- Which pages should be modularized first for maintainability?
