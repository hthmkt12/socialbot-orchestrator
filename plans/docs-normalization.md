# Docs Normalization Plan

## Context
The "Next" section of the roadmap calls for two items we can address now:
1. Normalize docs/spec workflow around `specs/` for new work.
2. Modularize oversized UI files after runtime proof remains stable.

We have already completed modularization of `social-dashboard-page.tsx` and `fleet-health-page.tsx`.
Now we focus on docs normalization.

## Implementation Steps
### Step 1: Update Unresolved Questions
In `docs/specify-workflow.md`, the question is asked: "Should future hard plans live under `specs/` instead of `plans/`?"
Answer: Yes, future *feature specifications* should live under `specs/`, but day-to-day implementation plans should stay in `plans/`.

### Step 2: Update Roadmap
Mark "Normalize docs/spec workflow around specs/ for new work" and "Modularize oversized UI files after runtime proof remains stable" as complete in `docs/project-roadmap.md` since we have addressed both of them.
