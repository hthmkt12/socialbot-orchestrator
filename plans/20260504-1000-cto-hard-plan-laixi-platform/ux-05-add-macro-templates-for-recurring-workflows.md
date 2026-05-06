# UX-05: Add Macro Templates For Recurring Workflows

Status: completed
Date: 2026-05-04
Purpose: let operators start from reusable starter workflows instead of a blank macro draft while preserving the advanced JSON path

## Decision
- Reuse `SAMPLE_MACROS` as the first product-facing template source instead of inventing a new template store.
- Surface starter templates directly inside the create-macro authoring modal so operators see them at the moment they need a starting point.
- Keep the scope intentionally small:
  - guided-compatible templates open in `Guided Builder`
  - advanced templates open in `Raw JSON`
  - no template library CRUD, versioning, or marketplace mechanics

## What Changed
- Extended `src/lib/macro-builder.ts` with starter-template metadata derived from the existing sample macros.
- Added template routing metadata so each starter knows whether it opens in `Guided Builder` or `Raw JSON`.
- Updated `src/components/macros/macro-definition-authoring-modal.tsx` to show a `Start From Template` picker that:
  - lists the top starter workflows
  - explains which authoring mode each template opens in
  - replaces the current draft when a template is applied
- Updated `src/pages/MacrosPage.tsx` so the create-macro flow exposes the starter template picker by default.

## Why This Matters
- New operators no longer start from an empty schema when the job is a common QA or smoke workflow.
- The product now offers opinionated starting points without pretending every macro can be handled by the guided builder.
- Advanced workflows stay honest: if a template depends on conditional logic or other advanced structure, the UI routes it to raw JSON instead of flattening it incorrectly.

## Limits Of This Step
- Starter templates currently come from the sample macro set, not a dedicated template catalog.
- Template picking is applied to the create flow only; new-version editing still starts from the active definition.
- Advanced templates still require JSON editing after selection.

## Acceptance For UX-05
- Operators can start a new macro from reusable starter templates instead of a blank draft.
- Guided-compatible templates open directly in the builder.
- Advanced starter templates open in raw JSON with explicit mode labeling.
- `npm.cmd run typecheck`
- `npm.cmd run build`
- `npm.cmd run build:gateway`
- `npm.cmd run build:worker`
- `npm.cmd run smoke:backend`

## Unresolved Questions
- Which additional templates are worth promoting before pilot beyond the first starter set?
- Should new-version authoring also support template replacement, or is that more likely to create accidental overwrite risk than operator value?
