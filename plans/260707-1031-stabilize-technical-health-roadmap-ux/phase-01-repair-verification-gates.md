---
phase: 1
title: Repair Verification Gates
status: completed
priority: P1
dependencies: []
effort: S
---

# Phase 1: Repair Verification Gates

## Overview

Restore the local quality gates before touching higher-risk code. This phase fixes the known TypeScript mismatch, makes ESLint ignore generated/local artifact folders, and removes or properly types current `any` violations.

## Requirements

- Functional: `typecheck`, `lint`, `test`, and `build` produce trustworthy signals.
- Non-functional: changes stay narrow; no behavior change except safer typings/config.

## Related Code Files

- Modify: `F:\project-bolt-sb1-keyopwhy\project\src\components\macros\MacroDetailVersionsPanel.tsx`
- Modify: `F:\project-bolt-sb1-keyopwhy\project\eslint.config.js`
- Modify: `F:\project-bolt-sb1-keyopwhy\project\src\lib\anti-detection-helpers.ts`
- Modify: `F:\project-bolt-sb1-keyopwhy\project\src\lib\account-action-reset.test.ts`
- Modify: `F:\project-bolt-sb1-keyopwhy\project\src\lib\account-service-helpers.test.ts`

## Implementation Steps

1. Fix the `onViewJson` type mismatch by accepting the actual macro definition shape or a JSON-safe type shared with `MacroVersion.definition_json`.
2. Add ESLint ignores for `coverage`, `dist`, `services/*/dist`, `node_modules`, `services/*/node_modules`, `services/*/.venv`, and `.venv-old`.
3. Replace `any` in `anti-detection-helpers.ts` with a local params type such as `Record<string, unknown>` plus narrow field access.
4. Replace test `as any` casts with typed partial fixtures or explicit helper factory return types.
5. Run verification after each small cluster: typecheck first, then lint, then tests/build.

## Tests Before

- Re-run current failing commands and capture failures:
  - `npm.cmd run typecheck`
  - `npm.cmd run lint`

## Refactor

- Keep fixes mechanical and type-focused.
- Do not alter macro version activation behavior or anti-detection output semantics.

## Tests After

- Add a focused assertion only if a typing fix reveals an untested runtime edge.
- Avoid adding snapshot noise.

## Success Criteria

- [ ] `npm.cmd run typecheck` passes.
- [ ] `npm.cmd run lint` passes.
- [ ] `npm.cmd test` remains `156+` tests passing.
- [ ] `npm.cmd run build` passes.

## Risk Assessment

- Risk: broad ESLint ignore hides real source.
  Mitigation: ignore only generated/local artifact directories, keep `src`, `packages`, `services/*/src`, and `supabase` visible.
- Risk: typing change masks JSON shape mismatch.
  Mitigation: use explicit macro definition or JSON-compatible type, not `any`.
