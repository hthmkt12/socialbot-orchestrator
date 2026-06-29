---
phase: 1
title: "Docs Update"
status: completed
effort: "Low"
---

# Phase 1: Docs Update

## Context Links
- `plans/brainstorm-report-social-first-roadmap.md`

## Overview

Update existing documentation, README, and generic copy across the platform to reflect the new "Social Media Automation" positioning. Emphasize anti-detection, account lifecycle management, and social multi-app workflows.

## Requirements
- Functional: Ensure all project documentation accurately describes the new platform direction.
- Non-functional: Keep the tone professional, focusing on the target audience (social media automation teams running 5-50 devices).

## Architecture
N/A (Documentation changes only)

## Related Code Files
- Modify: `project/README.md`
- Modify: `project/docs/project-overview-pdr.md`
- Modify: `project/docs/codebase-summary.md` (Verify and update if necessary)
- Modify: Onboarding/Landing page copy in `project/src/pages/` (e.g., `project/src/pages/SetupPage.tsx` or similar landing/demo pages if they exist).

## Implementation Steps

1.  **Update `project/README.md`**:
    - Change the main title/description to reflect "Social Media Automation Platform".
    - Highlight key features: Anti-detection, Account lifecycle tracking, Multi-app workflows (Instagram, TikTok, Facebook).
    - Remove generic "device orchestration" messaging.
2.  **Update `project/docs/project-overview-pdr.md`**:
    - Align the product overview, target audience, and core use cases with the social pivot.
3.  **Update Onboarding/Landing Copy**:
    - Search through `project/src/pages/` and `project/src/components/` for generic text related to the platform's purpose.
    - Update headers, descriptions, and empty states to mention social accounts, warm-up sequences, and engagement macros.
4.  **Review `project/docs/codebase-summary.md`**:
    - Ensure the "Product" and "Strategic Direction" sections reflect the latest pivot.

## Success Criteria
- [x] `README.md` clearly states the platform is for social media automation.
- [x] `project-overview-pdr.md` is updated.
- [x] UI copy (landing/onboarding) uses social-first terminology.

## Risk Assessment
- Risk: Inconsistent terminology across different docs.
- Mitigation: Perform a global search for old terms like "generic device orchestration" and replace them systematically.
