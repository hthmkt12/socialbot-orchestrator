# UX-04: Build Minimal Macro Builder For Common Steps

Status: completed
Date: 2026-05-04
Purpose: let operators author common flat workflows without starting from raw JSON while preserving JSON as the fallback for advanced automation structures

## Decision
- Keep raw JSON authoring in place for advanced users and advanced structures such as branching, grouped steps, and unsupported step types.
- Add a guided builder only for the common flat step set first:
  - `launch_app`
  - `wait`
  - `tap`
  - `swipe`
  - `input_text`
  - `screenshot`
  - `get_current_app`
  - `approval_checkpoint`
  - `stop`
- Reuse one shared authoring modal for both create and new-version flows so the builder does not fork product behavior.

## What Changed
- Added `src/lib/macro-builder.ts` with:
  - empty macro seed generation
  - guided-step defaults
  - compatibility checks that decide whether a definition can be edited safely in guided mode
- Added `src/components/macros/macro-definition-builder-panel.tsx` for structured editing of:
  - macro basics
  - input schema
  - flat step sequence
  - per-step approval/timeout/retry policy
- Added `src/components/macros/macro-definition-authoring-modal.tsx` as the shared create/version authoring shell with:
  - `Guided Builder` mode
  - `Raw JSON` mode
  - validation handling
  - safe fallback to JSON when an existing definition is too advanced for guided editing
- Updated `src/pages/MacrosPage.tsx` so creating a macro is no longer JSON-only.
- Updated `src/pages/MacroDetailPage.tsx` so creating a new version can start from the active definition in guided mode when compatible, or fall back to raw JSON when not.

## Why This Matters
- New operators can create basic workflows from product controls instead of hand-writing the entire macro schema.
- Existing advanced macro authors keep their JSON path, so this slice improves accessibility without blocking power-user patterns.
- The product now has a credible first builder step without pretending to be a full no-code system.

## Limits Of This Step
- Guided mode supports only flat common-step workflows.
- Conditional logic, grouped steps, foreach flows, and unsupported advanced step types still require raw JSON.
- The builder does not yet offer reusable templates or branching authoring assistance.

## Acceptance For UX-04
- Common steps can be authored without raw JSON.
- Existing advanced definitions are not silently downgraded; they fall back to raw JSON with explicit reasons.
- Create and new-version authoring now share one consistent builder-vs-JSON experience.
- `npm.cmd run typecheck`
- `npm.cmd run build`
- `npm.cmd run build:gateway`
- `npm.cmd run build:worker`
- `npm.cmd run smoke:backend`

## Unresolved Questions
- Which 2-3 starter templates should become the first opinionated builder presets in UX-05?
- Do we want input defaults and richer variable helpers in guided mode before pilot, or is bare schema entry enough for now?
