---
phase: 1
title: "Anti-Detection Engine"
status: completed
effort: "High"
---

# Phase 1: Anti-Detection Engine

## Context Links
- `plans/brainstorm-report-social-first-roadmap.md`
- `docs/backend-capability-matrix.md`

## Overview
Implement the core anti-detection capabilities required for social media automation. This involves modifying the step execution pipeline to include random delays (3-8s) instead of fixed delays, injecting random scroll variance before tap actions, and managing device fingerprinting (user-agent, profile) per execution.

## Requirements
- Functional:
  - Add randomization helpers (`src/engine/anti-detection.ts` or equivalent in the Node.js worker/Python bridge).
  - Apply random delays between macro steps transparently.
  - Implement scroll variance before interaction steps.
- Non-functional: Must not break existing macro execution logic; should be configurable via macro settings.

## Architecture
The anti-detection logic should be intercepted at the device backend level (e.g., `services/execution-worker/src/backends/MobileMcpStepBackend.ts` or within the Python bridge) so that it applies transparently to all step executions regardless of the macro definition.

## Related Code Files
- Create: `services/execution-worker/src/lib/anti-detection.ts` (or similar)
- Modify: `services/execution-worker/src/backends/MobileMcpStepBackend.ts` (or the Python bridge step handlers)
- Modify: `packages/shared/src/contracts/` (to allow overriding default delay settings)

## Implementation Steps
1. Create a utility module for generating random delays (e.g., bounded random wait times) and slight coordinate offsets for taps/scrolls.
2. Integrate this utility into the step dispatch loop. Before dispatching a `tap` or `input` step, apply a random pre-action delay.
3. For scroll actions, implement logic to slightly vary the swipe duration and path.
4. Ensure these behaviors can be toggled or configured via the workflow run settings or macro meta properties.

## Success Criteria
- [x] Automated tests verify that delays between steps are randomized within the 3-8s bounds.
- [x] Tap coordinates exhibit minor variance when anti-detection is enabled.
- [x] Execution logs confirm anti-detection features are active.

## Risk Assessment
- Risk: Too much variance might cause steps to fail (e.g., tapping outside a button).
- Mitigation: Keep coordinate offsets very small (e.g., +/- 2-5 pixels) and ensure delays don't cause timeouts in the overarching orchestration layer.
