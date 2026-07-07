---
title: "Brainstorm Summary - Stabilize Technical Health, Roadmap, and UX"
status: complete
created: 2026-07-07
source: ck:brainstorm
---

# Brainstorm Summary - Stabilize Technical Health, Roadmap, and UX

## Problem

The review found the app has good architecture bones but weak readiness signals: red verification gates, unsafe credential/device-control defaults, optimistic roadmap status, and hidden operator routes.

## Requirements

- Expected output: implementation plan with phase files under `plans/260707-1031-stabilize-technical-health-roadmap-ux/`.
- Acceptance: plan identifies files, steps, success criteria, risks, and verification commands.
- Scope boundary: no implementation in this session; no new social automation feature.
- Constraints: reuse existing React/Vite/Supabase/worker/bridge patterns; keep changes surgical; preserve route paths.
- Touchpoints: `eslint.config.js`, macro version panel, account crypto/UI, Mobile MCP bridge, roadmap docs, sidebar navigation.

## Options Considered

| Option | Pros | Cons |
|--------|------|------|
| Patch gates only | Quick unblock | Leaves security and product trust gaps |
| Security-first refactor | Tackles highest-risk item | Harder while typecheck/lint are red |
| Gate-first stabilization then security/docs/UX | Best sequencing, easy verification | More phases |

## Recommendation

Use gate-first stabilization. Fix typecheck/lint/test/build first, then harden credential and bridge defaults, then align roadmap truth and navigation UX. This follows KISS: no new platform work until current claims are trustworthy.

## Success Metrics

- Static gates green.
- No hardcoded production-capable account encryption secret.
- Bridge protected endpoints fail closed by default.
- Roadmap uses evidence-based status labels.
- Operators can reach core workflows from navigation.

## Open Questions

- Should account credential encryption move fully server-side now, or use an env-injected pilot key temporarily?
- Should Mobile MCP Orchestrator be visible to normal operators or remain advanced/dev-only?
