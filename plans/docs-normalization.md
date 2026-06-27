# Docs Normalization Plan

## Context
The roadmap lists "Normalize docs/spec workflow around specs/ for new work." Currently, we have some older spec files or we are creating specs directly in docs/. We need to ensure new features go to `specs/` or standardize the approach.

Wait, actually the "Next" section lists:
1. Normalize docs/spec workflow around specs/ for new work.
2. Modularize oversized UI files after runtime proof remains stable.
3. Keep sequential multi-target execution for small pilot validation unless fleet-speed SLA appears.
4. Keep authenticated route lazy-loading in place; main Vite chunk is now below warning threshold.

Let's look at oversized UI files: `social-dashboard-page.tsx` is 279 lines (11.6KB). We should modularize it according to the "Next" action items.
