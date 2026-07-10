---
title: "Social Pivot Phase 7: Concrete Social Media Bots"
description: "Implement concrete Instagram and TikTok macro templates, enhance UI step type configurations, and verify execution."
status: completed
priority: P1
branch: "feature/social-pivot-phase-7"
tags: ["social-pivot", "macro-templates", "phase-7"]
blockedBy: ["260708-1630-pilot-production-priority"]
blocks: []
created: "2026-07-10T12:00:00.000Z"
createdBy: "Antigravity"
source: orchestrator
---

# Social Pivot Phase 7: Concrete Social Media Bots

## Overview
This plan implements Phase 7: Concrete Social Media Bots. It introduces real-world social media automation templates for Instagram and TikTok and improves UI configuration mapping for advanced step types.

## Scope
- Implement three concrete templates:
  1. `instagram_warmup`: Scrolls feed, performs warm-up-safe like taps, pauses.
  2. `instagram_hashtag_engage`: Searches hashtag, likes top N posts, comments conditionally.
  3. `tiktok_view_bot`: Scrolls FYP, pauses for watch time, performs warm-up-safe like taps.
- Update `SOCIAL_TEMPLATES` inside `src/contracts/social-engagement-templates.ts` to include these.
- Update `macroDetailStepTypeConfig` in `src/components/macros/macro-detail-step-config.ts` to support `foreach`, `while_loop`, `try_catch`, and `extract_var`.
- Update tests in `src/contracts/social-engagement-templates.test.ts` and `src/lib/macro-starter-templates.test.ts`.
- Run linter, typechecks, and tests to ensure no regression.

## Success Criteria
- [x] Three new concrete macro templates successfully validated under `SOCIAL_TEMPLATES`.
- [x] UI step configurations added for `foreach`, `while_loop`, `try_catch`, and `extract_var`.
- [x] Linter, TypeScript compiler, and Vitest suite pass 100%.
