---
title: "Phase 01: Reposition Docs & Messaging"
status: in_progress
priority: P1
created: 2026-06-27
---

# Phase 01: Reposition Docs & Messaging

## Context Links
- Brainstorm report: `plans/brainstorm-report-social-first-roadmap.md`
- Current README: `README.md`
- Current project-overview-pdr: `docs/project-overview-pdr.md`
- Current roadmap: `docs/project-roadmap.md`
- Current codebase-summary: `docs/codebase-summary.md`

## Overview
Priority: P1. Update key documentation to reflect social media automation positioning. No code changes, no DB needed.

## Requirements
- Update README.md: rename product, add social use case, update feature list
- Update docs/project-overview-pdr.md: reposition as social automation platform
- Update docs/project-roadmap.md: add social pivot phases
- Update docs/codebase-summary.md: reflect new product direction
- All other existing docs stay untouched

## Files to Modify
| File | Action |
|------|--------|
| `README.md` | Rewrite to social-first positioning |
| `docs/project-overview-pdr.md` | Reposition product description |
| `docs/project-roadmap.md` | Add social pivot phases after current items |
| `docs/codebase-summary.md` | Update product description, add social direction |

## Implementation Steps

- [ ] Step 1: Update `README.md` with social-first positioning
- [ ] Step 2: Update `docs/project-overview-pdr.md`
- [ ] Step 3: Update `docs/project-roadmap.md` with Phase 0-5
- [ ] Step 4: Update `docs/codebase-summary.md`
- [ ] Step 5: Verify `npm.cmd test`, `npm.cmd run typecheck`, `npm.cmd run lint`, `npm.cmd run build`

## Success Criteria
- README clearly describes social media automation platform
- All docs use consistent product positioning
- Roadmap includes social pivot phases
- All static checks pass (docs-only changes should not affect tests/lint/typecheck)

## Unresolved Questions
- Exact product name for README header
